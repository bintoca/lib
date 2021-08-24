import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process';
import { parseFiles, ParseFilesError } from '@bintoca/package'
import { encode, decodePackage, decodeFile, createLookup, FileType } from '@bintoca/loader'
import { DecoderState, bufferSourceToUint8Array } from '@bintoca/cbor/core'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'

const TD = new TextDecoder()
const base = '/x/p/'
let loadedFiles = {}
const config = {
    port: 3001,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
}
const freeGlobals = createLookup(['window', 'document', 'console'])
const controlledGlobals = createLookup([])
const importResolve = (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number): number => {
    const s = TD.decode(bufferSourceToUint8Array(dv, state.position, size))
    let isPassThrough = false
    if (s[0] == '.') {
        if (s[1] == '/') {
            isPassThrough = true
        }
        else if (s[1] == '.' && s[2] == '/') {
            isPassThrough = true
        }
    }
    let sp
    if (isPassThrough) {
        sp = s
    }
    else {
        sp = s
    }

    const spb = new TextEncoder().encode(sp)
    u.set(spb, len)
    return spb.byteLength
}
const server1 = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => {
    let chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
        chunks.push(c)
    })
    req.on('end', async () => {
        if (req.url == '/') {
            loadedFiles = {}
            let mod
            let packageJSON
            let err
            try {
                packageJSON = JSON.parse(TD.decode(decodeFile(encodedFiles['package.json'], freeGlobals, controlledGlobals, importResolve)))
            }
            catch { }
            if (!packageJSON) {
                err = 'package.json not found or invalid'
            }
            else {
                if (!packageJSON.exports || !packageJSON.exports['.']) {
                    err = 'package.json root export not found'
                }
                else {
                    mod = packageJSON.exports['.']
                }
            }
            if (err) {
                res.statusCode = 500
                res.end(err)
            }
            else {
                res.setHeader('Content-Type', 'text/html')
                res.end('<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1" /><script>const ws = new WebSocket("ws://localhost:' + config.port + '");ws.onmessage = (ev)=>{window.location.reload()}</script><script type="module" src="' + base + mod + '"></script></head><body></body></html>')
            }
        }
        else if (req.url.startsWith(base)) {
            const path = req.url.substring(base.length)
            const f = encodedFiles[path]
            if (f) {
                loadedFiles[path] = 1
                if (req.url.endsWith('.js') || req.url.endsWith('.mjs') || req.url.endsWith('.cjs')) {
                    res.setHeader('Content-Type', 'text/javascript')
                }
                try {
                    res.end(Buffer.from(decodeFile(f, freeGlobals, controlledGlobals, importResolve)))
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
let encodedFiles = {}
let notifyTimeout
let notifyEnabled = false
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
    open('http://localhost:' + config.port)
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