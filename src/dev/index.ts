import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process';
import { parseFiles, ParseFilesError, parseTar, getShrinkwrapURLs, cacacheDir } from '@bintoca/package'
import { encode, decodePackage, decodeFile, createLookup, FileType, defaultConditions, ESM_RESOLVE, getCacheKey, getShrinkwrapResolved, ShrinkwrapPackageDescription, dynamicImportBase, getDynamicImportModule } from '@bintoca/loader'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'
import pacote from 'pacote'
import cacache from 'cacache'

const TD = new TextDecoder()
const base = '/x/p/'
const config = {
    hostname: 'localhost',
    port: 3000,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    autoRefresh: true,
    open: true
}
const freeGlobals = createLookup(['window', 'document', 'console', 'Array', 'BigInt', 'Infinity', 'Object', 'RegExp', 'String', 'Symbol', 'SyntaxError', 'parseFloat', 'parseInt'])
const controlledGlobals = createLookup([])
const fus = {
    exists: async (p: URL) => {
        if (!p.pathname.startsWith(base)) {
            return false
        }
        if (p.pathname.startsWith(base + 'node_modules/')) {
            const key = getCacheKey(p.pathname, base, shrinkwrap)
            return key ? await cacacheExists(key) : false
        }
        return urlCache[p.pathname] !== undefined
    },
    read: async (p: URL, decoded: boolean) => {
        if (p.pathname.startsWith(base + 'node_modules/')) {
            let r
            try {
                r = await cacache.get(cacacheDir, getCacheKey(p.pathname, base, shrinkwrap))
            }
            catch (e) {
                processPackage(getShrinkwrapResolved(p.pathname, base, shrinkwrap))
                r = await cacache.get(cacacheDir, getCacheKey(p.pathname, base, shrinkwrap))
            }
            return decoded ? (await decodeFile(r.data, freeGlobals, controlledGlobals, null, defaultConditions, { exists: null, read: null })).data : r.data
        }
        return urlCache[p.pathname].data
    }
}
let loadedFiles = {}
let urlCache = {}
let shrinkwrap
let packageJSON
let notifyTimeout
let notifyEnabled = false
const server1 = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => {
    let chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
        chunks.push(c)
    })
    req.on('end', async () => {
        try {
            if (req.url == '/') {
                loadedFiles = { 'npm-shrinkwrap.json': 1 }
                let mod
                let err
                if (!packageJSON) {
                    err = 'package.json not found or invalid'
                }
                else if (!shrinkwrap) {
                    err = 'npm-shrinkwrap.json not found or invalid'
                }
                else {
                    if (packageJSON.type != 'module') {
                        err = 'package type must be module'
                    }
                    else if (!packageJSON.name) {
                        err = 'package name required'
                    }
                    else if (shrinkwrap.lockfileVersion != 2) {
                        err = 'npm-shrinkwrap.json lockfileVersion 2 (npm 7) required'
                    }
                    else {
                        mod = await ESM_RESOLVE(packageJSON.name, new URL(base, getRootURL()), defaultConditions, fus)
                    }
                }
                if (err) {
                    res.statusCode = 500
                    res.end(err)
                }
                else {
                    res.setHeader('Content-Type', 'text/html')
                    res.end('<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1" /><script>const ws = new WebSocket("ws://localhost:' + config.port + '");ws.onmessage = (ev)=>{window.location.reload()}</script><script type="module" src="' + mod + '"></script></head><body></body></html>')
                }
            }
            else if (req.url.startsWith(dynamicImportBase)) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(getDynamicImportModule(req.url))
            }
            else if (urlCache[req.url]) {
                loadedFiles[req.url] = 1
                const u = urlCache[req.url]
                res.setHeader('Content-Type', u.type)
                res.end(Buffer.from(u.data))
            }
            else if (await fus.exists(new URL(req.url, getRootURL()))) {
                const u = await decodeFile(await fus.read(new URL(req.url, getRootURL()), false), freeGlobals, controlledGlobals, new URL(req.url, getRootURL()), defaultConditions, fus)
                urlCache[req.url] = u
                res.setHeader('Content-Type', u.type)
                res.end(Buffer.from(u.data))
            }
            else {
                res.statusCode = 404
                res.end()
            }
        }
        catch (e) {
            res.statusCode = 500
            log(e)
            res.end()
        }
    })

})
function getRootURL() {
    return 'http://' + config.hostname + ':' + config.port
}
const wsServer = new wss({ httpServer: server1 })
const wsConnections = []
wsServer.on('request', function (request) {
    var connection = request.accept(null, request.origin);
    connection.on('message', function (message) {
        console.log('ws message', message)
    });
    connection.on('close', function (reasonCode, description) {
        wsConnections.splice(wsConnections.indexOf(connection), 1)
    });
    wsConnections.push(connection)
});
export const readDir = (p, wd, files) => {
    const dr = path.join(wd, p)
    const d = fs.readdirSync(dr)
    for (let x of d) {
        if (!anymatch(config.ignore, x)) {
            const fn = path.join(wd, p, x)
            if (fs.lstatSync(fn).isDirectory()) {
                readDir(path.join(p, x), wd, files)
            }
            else {
                files[(p ? p + '/' : '') + x] = fs.readFileSync(fn)
            }
        }
    }
    return files
}
const notify = () => {
    if (notifyEnabled) {
        if (notifyTimeout) {
            clearTimeout(notifyTimeout)
        }
        notifyTimeout = setTimeout(() => {
            notifyTimeout = undefined;
            for (let x of wsConnections) {
                x.sendUTF('reload')
            }
        }, 100)
    }
}
const cacacheExists = async (key: string): Promise<boolean> => await cacache.get.info(cacacheDir, key)
const checkParsed = (parsed: { files: { [k: string]: Map<number, any> } }, prefix: string): boolean => {
    if (prefix) {
        prefix += '/'
    }
    let r = true
    for (let x in parsed.files) {
        const m = parsed.files[x]
        if (m.get(1) == FileType.error) {
            r = false
            const type = m.get(2)
            if (type == ParseFilesError.syntax) {
                log('File: ' + prefix + x, 'Syntax error: ' + m.get(3))
            }
            else if (type == ParseFilesError.invalidSpecifier) {
                log('File: ' + prefix + x, 'Invalid import specifier: ' + m.get(3))
            }
            else {
                log('File: ' + prefix + x, 'Error type: ' + m.get(2), 'Message: ' + m.get(3))
            }
        }
    }
    return r
}
const processPackage = async (x: ShrinkwrapPackageDescription) => {
    try {
        const prefix = x.resolved.substring(x.resolved.lastIndexOf('/') + 1)
        log('Optimizing:', prefix)
        const parsed = parseFiles(await pacote.tarball.stream(x.resolved, parseTar))
        if (checkParsed(parsed, prefix)) {
            const enc = decodePackage(encode(parsed)).get(1)
            for (let k in enc) {
                await cacache.put(cacacheDir, x.resolved + '/' + k, enc[k])
            }
        }
    }
    catch (e) {
        log('Error optimizing package', e)
    }
}
export const update = async (f) => {
    if (f['package.json']) {
        try {
            packageJSON = undefined
            packageJSON = JSON.parse(TD.decode(f['package.json']))
        }
        catch (e) {
            log('Invalid package.json', e)
        }
    }
    if (f['npm-shrinkwrap.json']) {
        try {
            shrinkwrap = undefined
            urlCache = {}
            shrinkwrap = JSON.parse(TD.decode(f['npm-shrinkwrap.json']))
            for (let x of getShrinkwrapURLs(shrinkwrap)) {
                if (!await cacacheExists(x.resolved + '/package.json')) {
                    await processPackage(x)
                }
            }
        }
        catch (e) {
            log('Invalid npm-shrinkwrap.json', e)
        }
    }
    const parsed = parseFiles(f)
    checkParsed(parsed, '')
    const enc = decodePackage(encode(parsed)).get(1)
    for (let x in enc) {
        const url = base + alignPath(x)
        urlCache[url] = await decodeFile(enc[x], freeGlobals, controlledGlobals, new URL(url, getRootURL()), defaultConditions, fus)
        if (loadedFiles[url]) {
            notify()
        }
    }
}
export const alignPath = (s) => s.replace(/\\/g, '/')
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' })
const log = (...x) => {
    console.log(...x)
    rl.prompt()
}
export const init = async () => {
    const configFile = './bintoca.dev.js'
    if (fs.existsSync(configFile)) {
        const dev = await import(path.join('file://' + cwd(), configFile))
        Object.assign(config, dev.default)
    }
    rl.prompt()
    log('Loading files...')
    const w = chokidar.watch('.', {
        ignored: config.ignore,
        ignoreInitial: true,
        awaitWriteFinish: config.awaitWriteFinish
    })
    //w.on('ready', () => log(w.getWatched(), config))
    w.on('error', er => log('Watcher error', er))
    w.on('add', path => { update({ [path]: fs.readFileSync(path) }) })
    w.on('addDir', path => { update(readDir(path, cwd(), {})) })
    w.on('change', path => { update({ [path]: fs.readFileSync(path) }) })
    w.on('unlink', path => { urlCache[base + alignPath(path)] = undefined })
    w.on('unlinkDir', path => {
        for (let k in urlCache) {
            if (k.startsWith(base + alignPath(path) + '/')) {
                urlCache[k] = undefined
            }
        }
    })
    //cacache.ls(cacacheDir).then(x => log('ls', x)).catch(x => log('lse', x))
    try {
        await update(readDir('', cwd(), {}))
        log('Done loading files.')
    }
    catch (e) {
        log(e)
    }
    notifyEnabled = config.autoRefresh
    server1.listen(config.port)
    if (config.open) {
        open(getRootURL())
    }
    rl.on('line', line => {
        if (line.trim() == 'a' || line.trim() == 'autorefresh') {
            notifyEnabled = !notifyEnabled
            console.log('Auto-refresh is ' + (notifyEnabled ? 'on' : 'off'))
        }
        else if (line.trim() == 'clear cache') {
            cacache.rm.all(cacacheDir).then(x => log('Cache cleared successfully')).catch(x => log(x))
        }
        else if (line.trim() == 'help' || line.trim() == 'h' || line.trim() == '?') {
            console.log('Commands:')
            console.log('  autorefresh|a   toggle auto refresh')
            console.log('  clear cache     delete cached optimized packages')
            console.log('  help|h|?        display help')
            console.log('  exit|quit|q     exit the program')
        }
        else if (line.trim() == 'q' || line.trim() == 'quit' || line.trim() == 'exit') {
            process.exit()
        }
        else {
            console.log('Unknown command "' + line + '"')
        }
        rl.prompt()
    })
}
init()