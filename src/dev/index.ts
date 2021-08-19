import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process';
import { parseFiles } from '@bintoca/package'
import { encode, decodePackage, decodeFile, createLookup } from '@bintoca/loader'
import { DecoderState } from '@bintoca/cbor/core'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'

const TD = new TextDecoder()
const port = 3001
const base = '/x/p/'
let loadedFiles = {}
const ignore = [/(^|[\/\\])\../, 'node_modules'] // ignore dotfiles
const freeGlobals = createLookup(['window', 'document'])
const controlledGlobals = createLookup([])
const importResolve = (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number): number => {
    u[len++] = 98
    u[len++] = 120
    u[len++] = 120
    return 3
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
                res.end('<html><head><script>const ws = new WebSocket("ws://localhost:' + port + '");ws.onmessage = (ev)=>{window.location.reload()}</script><script type="module" src="' + base + mod + '"></script></head><body></body></html>')
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
                res.end(Buffer.from(decodeFile(f, freeGlobals, controlledGlobals, importResolve)))
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
server1.listen(port)
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
        if (!anymatch(ignore, x)) {
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
let encodedFiles
let notifyTimeout
const notify = () => {
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
export const update = (f) => {
    const enc = decodePackage(encode(parseFiles(f))).get(1)
    for (let x in enc) {
        const path = alignPath(x)
        encodedFiles[path] = enc[x]
        if (loadedFiles[path]) {
            notify()
        }
    }
}
export const alignPath = (s) => s.replace(/\\/g, '/')
export const init = () => {
    const w = chokidar.watch('.', {
        ignored: ignore, // ignore dotfiles
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    })
    //w.on('ready', () => console.log(w.getWatched()))
    w.on('error', er => console.log('Watcher error', er))
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

    const files = parseFiles(readDir('', cwd(), {}))
    if (files.error) {
        console.log(files.error, files.message)
    }
    else {
        const pkg = decodePackage(encode(files))
        encodedFiles = pkg.get(1)
    }
    open('http://localhost:' + port)
}
init()