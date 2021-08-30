import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process';
import { parseFiles, parseFile, ParseFilesError } from '@bintoca/package'
import { encode, decodePackage, decodeFile, createLookup, FileType, defaultConditions, FileURLSystem, ESM_RESOLVE } from '@bintoca/loader'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'

const TD = new TextDecoder()
const base = '/x/p/'
let loadedFiles = {}
const config = {
    hostname: 'localhost',
    port: 3000,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
}
const freeGlobals = createLookup(['window', 'document', 'console', 'Array', 'BigInt', 'Infinity', 'Object', 'RegExp', 'String', 'Symbol', 'SyntaxError', 'parseFloat', 'parseInt'])
const controlledGlobals = createLookup([])
const fus = { exists: (p: URL) => { console.log(p.href.replace(getRootURL() + base, './')); return Promise.resolve(fs.existsSync(p.href.replace(getRootURL() + base, './'))) }, read: (p: URL) => Promise.resolve(fs.readFileSync(p.href.replace(getRootURL() + base, './'))) }
let encodedFiles = {}
let shrinkwrap
let notifyTimeout
let notifyEnabled = false
const server1 = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => {
    let chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
        chunks.push(c)
    })
    req.on('end', async () => {
        if (req.url == '/') {
            loadedFiles = { 'npm-shrinkwrap.json': 1 }
            let mod
            let packageJSON
            let err
            try {
                packageJSON = JSON.parse(TD.decode(await decodeFile(encodedFiles['package.json'], freeGlobals, controlledGlobals, new URL(getRootURL()), defaultConditions, fus)))
            }
            catch { }
            try {
                shrinkwrap = JSON.parse(TD.decode(await decodeFile(encodedFiles['npm-shrinkwrap.json'], freeGlobals, controlledGlobals, new URL(getRootURL()), defaultConditions, fus)))
            }
            catch { }
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
        else if (req.url.startsWith(base)) {
            const path = req.url.substring(base.length)
            if (!encodedFiles[path] && fs.existsSync(path)) {
                encodedFiles[path] = decodePackage(encode(parseFiles({ [path]: fs.readFileSync(path) }))).get(1)[path]
            }
            const f = encodedFiles[path]
            if (f) {
                loadedFiles[path] = 1
                if (req.url.endsWith('.js') || req.url.endsWith('.mjs') || req.url.endsWith('.cjs')) {
                    res.setHeader('Content-Type', 'text/javascript')
                }
                try {
                    res.end(Buffer.from(await decodeFile(f, freeGlobals, controlledGlobals, new URL(req.url, getRootURL()), defaultConditions, fus)))
                }
                catch (e) {
                    res.statusCode = 500
                    res.end(e)
                }
            }
            else {
                res.statusCode = 404
                res.end()
            }
        }
        else {
            res.statusCode = 404
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
export const update = (f) => {
    const parsed = parseFiles(f)
    for (let x in parsed.files) {
        const m = parsed.files[x]
        if (m.get(1) == FileType.error) {
            const type = m.get(2)
            if (type == ParseFilesError.syntax) {
                log('File: ' + x, 'Syntax error: ' + m.get(3))
            }
            else if (type == ParseFilesError.invalidSpecifier) {
                log('File: ' + x, 'Invalid import specifier: ' + m.get(3))
            }
            else {
                log('File: ' + x, 'Error type: ' + m.get(2), 'Message: ' + m.get(3))
            }
        }
    }
    const enc = decodePackage(encode(parsed)).get(1)
    for (let x in enc) {
        const path = alignPath(x)
        if (path == 'npm-shrinkwrap.json') {
            for (let k in encodedFiles) {
                if (k.startsWith('node_modules/')) {
                    encodedFiles[k] = undefined
                }
            }
        }
        encodedFiles[path] = enc[x]
        if (loadedFiles[path]) {
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
    w.on('unlink', path => { encodedFiles[alignPath(path)] = undefined })
    w.on('unlinkDir', path => {
        for (let k in encodedFiles) {
            if (k.startsWith(alignPath(path) + '/')) {
                encodedFiles[k] = undefined
            }
        }
    })
    update(readDir('', cwd(), {}))
    notifyEnabled = true
    server1.listen(config.port)
    //open(getRootURL())
    log('Auto-refresh is on. Enter "a" to toggle.')
    rl.on('line', line => {
        if (line.trim() == 'a') {
            notifyEnabled = !notifyEnabled
            console.log('Auto-refresh is ' + (notifyEnabled ? 'on' : 'off'))
        }
        rl.prompt()
    })
}
init()