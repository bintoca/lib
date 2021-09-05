import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process';
import { parseFiles, ParseFilesError, parseTar, getShrinkwrapURLs, cacacheDir } from '@bintoca/package'
import { encode, decodePackage, decodeFile, createLookup, FileType, defaultConditions, ESM_RESOLVE, getCacheKey, getShrinkwrapResolved, ShrinkwrapPackageDescription, dynamicImportBase, getDynamicImportModule, reloadBase, Update, FileURLSystem } from '@bintoca/loader'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'
import pacote from 'pacote'
import cacache from 'cacache'

const TD = new TextDecoder()
export const base = '/x/p/'
export const defaultConfig: Config = {
    hostname: 'localhost',
    port: 3000,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    open: true,
    watch: true,
    configFile: './bintoca.dev.js'
}
export const freeGlobals = createLookup(['window', 'document', 'console', 'Array', 'BigInt', 'Infinity', 'Object', 'RegExp', 'String', 'Symbol', 'SyntaxError', 'parseFloat', 'parseInt'])
export const controlledGlobals = createLookup([])
export const getFileURLSystem = (state: State): FileURLSystem => {
    return {
        exists: async (p: URL) => {
            if (!p.pathname.startsWith(base)) {
                return false
            }
            if (p.pathname.startsWith(base + 'node_modules/')) {
                const key = getCacheKey(p.pathname, base, state.shrinkwrap)
                return key ? await cacache.get.info(cacacheDir, key) != null : false
            }
            return state.urlCache[p.pathname] !== undefined
        },
        read: async (p: URL, decoded: boolean) => {
            if (p.pathname.startsWith(base + 'node_modules/')) {
                let r
                try {
                    r = await cacache.get(cacacheDir, getCacheKey(p.pathname, base, state.shrinkwrap))
                }
                catch (e) {
                    optimizePackage(getShrinkwrapResolved(p.pathname, base, state.shrinkwrap))
                    r = await cacache.get(cacacheDir, getCacheKey(p.pathname, base, state.shrinkwrap))
                }
                return decoded ? (await decodeFile(r.data, freeGlobals, controlledGlobals, null, defaultConditions, { exists: null, read: null })).data : r.data
            }
            return state.urlCache[p.pathname].data
        }
    }
}
export type Config = { hostname: string, port: number, ignore, awaitWriteFinish, open: boolean, watch: boolean, configFile }
export type State = { urlCache, shrinkwrap, packageJSON, wsConnections: any[], config: Config }
export const httpHandler = async (req: http.IncomingMessage, res: http.ServerResponse, state: State) => {
    let chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
        chunks.push(c)
    })
    req.on('end', async () => {
        try {
            const fus = getFileURLSystem(state)
            if (req.url == '/') {
                let mod
                let err
                if (!state.packageJSON) {
                    err = 'package.json not found or invalid'
                }
                else if (!state.shrinkwrap) {
                    err = 'npm-shrinkwrap.json not found or invalid'
                }
                else {
                    if (state.packageJSON.type != 'module') {
                        err = 'package type must be module'
                    }
                    else if (!state.packageJSON.name) {
                        err = 'package name required'
                    }
                    else if (state.shrinkwrap.lockfileVersion != 2) {
                        err = 'npm-shrinkwrap.json lockfileVersion 2 (npm 7) required'
                    }
                    else {
                        mod = await ESM_RESOLVE(state.packageJSON.name, new URL(base, getRootURL(state)), defaultConditions, fus)
                    }
                }
                if (err) {
                    res.statusCode = 500
                    res.end(err)
                }
                else {
                    res.setHeader('Content-Type', 'text/html')
                    res.end('<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1" /><script src="client.js"></script><script type="module" src="' + mod + '"></script></head><body></body></html>')
                }
            }
            else if (req.url == '/client.js') {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(fs.readFileSync(new URL('./client.js', import.meta.url) as any))
            }
            else if (req.url.startsWith(dynamicImportBase)) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(getDynamicImportModule(req.url, true))
            }
            else if (req.url.startsWith(reloadBase)) {
                const u = state.urlCache[base + req.url.slice(req.url.indexOf('/', 5) + 1)]
                if (u) {
                    res.setHeader('Content-Type', u.type)
                    res.end(Buffer.from(u.data))
                }
                else {
                    res.statusCode = 404
                    res.end()
                }
            }
            else if (state.urlCache[req.url]) {
                const u = state.urlCache[req.url]
                res.setHeader('Content-Type', u.type)
                res.end(Buffer.from(u.data))
            }
            else if (await fus.exists(new URL(req.url, getRootURL(state)))) {
                const u = await decodeFile(await fus.read(new URL(req.url, getRootURL(state)), false), freeGlobals, controlledGlobals, new URL(req.url, getRootURL(state)), defaultConditions, fus)
                state.urlCache[req.url] = u
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
}
export const getRootURL = (state: State) => 'http://' + state.config.hostname + ':' + state.config.port
export const wsHandler = function (request, state: State) {
    var connection = request.accept(null, request.origin);
    connection.on('message', function (message) {
        console.log('ws message', message)
    });
    connection.on('close', function (reasonCode, description) {
        state.wsConnections.splice(state.wsConnections.indexOf(connection), 1)
    });
    state.wsConnections.push(connection)
}
export const readDir = (p, wd, files: Update, state: State) => {
    const dr = path.join(wd, p)
    const d = fs.readdirSync(dr)
    for (let x of d) {
        if (!anymatch(state.config.ignore, x)) {
            const fn = path.join(wd, p, x)
            if (fs.lstatSync(fn).isDirectory()) {
                readDir(path.join(p, x), wd, files, state)
            }
            else {
                files[(p ? p + '/' : '') + x] = { action: 'add', buffer: fs.readFileSync(fn) }
            }
        }
    }
    return files
}
export const notify = (updates, state: State) => {
    for (let x of state.wsConnections) {
        x.sendUTF(JSON.stringify({ type: 'update', data: { base: new URL(base, getRootURL(state)).href, baseReload: new URL(reloadBase, getRootURL(state)).href, updates } }))
    }
}
export const checkParsed = (parsed: { files: { [k: string]: Map<number, any> } }, prefix: string): boolean => {
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
export const optimizePackage = async (x: ShrinkwrapPackageDescription) => {
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
export const update = async (f: Update, state: State) => {
    if (f['package.json']) {
        try {
            state.packageJSON = undefined
            if (f['package.json'].action != 'remove') {
                state.packageJSON = JSON.parse(TD.decode(f['package.json'].buffer))
            }
        }
        catch (e) {
            log('Invalid package.json', e)
        }
    }
    if (f['npm-shrinkwrap.json']) {
        try {
            state.shrinkwrap = undefined
            state.urlCache = {}
            if (f['npm-shrinkwrap.json'].action != 'remove') {
                state.shrinkwrap = JSON.parse(TD.decode(f['npm-shrinkwrap.json'].buffer))
                for (let x of getShrinkwrapURLs(state.shrinkwrap)) {
                    if (!await cacache.get.info(cacacheDir, x.resolved + '/package.json')) {
                        await optimizePackage(x)
                    }
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
        state.urlCache[url] = await decodeFile(enc[x], freeGlobals, controlledGlobals, new URL(url, getRootURL(state)), defaultConditions, getFileURLSystem(state))
    }
    const notif = {}
    for (let k in f) {
        const url = new URL(base + alignPath(k), getRootURL(state)).href
        notif[url] = { action: f[k].action }
        if (f[k].action == 'remove') {
            state.urlCache[url] = undefined
        }
    }
    notify(notif, state)
}
export const alignPath = (s) => s.replace(/\\/g, '/')
export const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' })
export const readlineHandler = line => {
    if (line.trim() == 'clear cache') {
        cacache.rm.all(cacacheDir).then(x => log('Cache cleared successfully')).catch(x => log(x))
    }
    else if (line.trim() == 'help' || line.trim() == 'h' || line.trim() == '?') {
        console.log('Commands:')
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
    readlineInterface.prompt()
}
export const log = (...x) => {
    console.log(...x)
    readlineInterface.prompt()
}
export const watch = (state: State) => {
    const w = chokidar.watch('.', {
        ignored: state.config.ignore,
        ignoreInitial: true,
        awaitWriteFinish: state.config.awaitWriteFinish
    })
    //w.on('ready', () => log(w.getWatched(), config))
    w.on('error', er => log('Watcher error', er))
    w.on('add', path => { update({ [path]: { action: 'add', buffer: fs.readFileSync(path) } }, state) })
    w.on('addDir', path => { update(readDir(path, cwd(), {}, state), state) })
    w.on('change', path => { update({ [path]: { action: 'change', buffer: fs.readFileSync(path) } }, state) })
    w.on('unlink', path => { update({ [path]: { action: 'remove', buffer: undefined } }, state) })
    w.on('unlinkDir', path => {
        const f: Update = {}
        for (let k in state.urlCache) {
            if (k.startsWith(base + alignPath(path) + '/')) {
                f[k] = { action: 'remove', buffer: undefined }
            }
        }
        update(f, state)
    })
}
export const applyConfigFile = async (state: State) => {
    if (fs.existsSync(state.config.configFile)) {
        const dev = await import(path.join('file://' + cwd(), state.config.configFile))
        Object.assign(state.config, dev.default)
    }
}
export const init = async (st?: State) => {
    const state = st || { urlCache: {}, wsConnections: [], shrinkwrap: undefined, packageJSON: undefined, config: defaultConfig }
    if (state.config.configFile) {
        await applyConfigFile(state)
    }
    readlineInterface.prompt()
    log('Loading files...')
    //cacache.ls(cacacheDir).then(x => log('ls', x)).catch(x => log('lse', x))
    try {
        await update(readDir('', cwd(), {}, state), state)
        log('Done loading files.')
    }
    catch (e) {
        log(e)
    }
    const httpServer = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => await httpHandler(req, res, state))
    const wsServer = new wss({ httpServer: httpServer })
    wsServer.on('request', function (request) { wsHandler(request, state) })
    httpServer.listen(state.config.port)
    if (state.config.open) {
        open(getRootURL(state))
    }
    readlineInterface.on('line', readlineHandler)
    if (state.config.watch) {
        watch(state)
    }
    return { httpServer, wsServer, state }
}