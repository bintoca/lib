import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import {
    ParseFilesError, decodeFile, createLookup, FileType,
    importBase, getDynamicImportModule, reloadBase, packageBase, internalBase, FileBundle,
    globalBase, metaURL as packageMetaURL, getGlobalModule, configURL, FileParse, parsePackage, Manifest
} from '@bintoca/package/core'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import * as readline from 'readline'
import pacote from 'pacote'
import tar from 'tar'
import { EncoderState } from '@bintoca/cbor/core'
import { createHash } from 'crypto'
import { setupEncoderState } from '@bintoca/package/core'

const TD = new TextDecoder()
const TE = new TextEncoder()
const clientURL = internalBase + new URL('./client.js', packageMetaURL).href
const initURL = internalBase + new URL('./init.js', packageMetaURL).href
const primordialURL = internalBase + new URL('./primordial.js', packageMetaURL).href

export const defaultConfig: Config = {
    hostname: 'localhost',
    port: 3000,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    open: true,
    watch: true,
    configFile: './bintoca.config.js',
    path: '.'
}
export type Config = { hostname: string, port: number, ignore, awaitWriteFinish, open: boolean, watch: boolean, configFile, path: string }
export type State = {
    urlCache, fileCache, readlineInterface: readline.Interface, wsConnections: any[], watcher: chokidar.FSWatcher, manifest: Manifest,
    config: Config, controlledGlobals: Set<string>, controlledGlobalsLookup: DataView, encoderState: EncoderState, isWatching: boolean, autoReload: boolean
}
export const parseTar = async (t: NodeJS.ReadableStream): Promise<FileBundle> => {
    return new Promise((resolve, reject) => {
        const files: FileBundle = {}
        const p: tar.ParseStream = new (tar.Parse as any)()
        const ent = (e: tar.ReadEntry) => {
            const fn = e.path.substring(e.path.indexOf('/') + 1)
            let chunks = []
            e.on('data', d => {
                chunks.push(d)
            })
            e.on('end', () => {
                if (fn && !fn.endsWith('/')) {
                    files[fn] = { action: 'add', buffer: Buffer.concat(chunks) }
                }
            })
        }
        p.on('entry', ent)
        p.on('end', () => {
            resolve(files)
        })
        t.on('error', er => {
            reject(er)
        })
        t.pipe(p)
    })
}
export const httpHandler = async (req: http.IncomingMessage, res: http.ServerResponse, state: State) => {
    let chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
        chunks.push(c)
    })
    req.on('end', async () => {
        try {
            if (req.url == '/') {
                let err
                if (!state.manifest) {
                    err = 'error parsing package'
                }
                if (err) {
                    res.statusCode = 500
                    res.end(err)
                }
                else {
                    res.setHeader('Content-Type', 'text/html')
                    res.end('<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1" /><script>self.configURL="' + configURL
                        + '"</script><script type="module" src="' + clientURL + '"></script><script type="module" src="' + initURL + '"></script></head><body></body></html>')
                }
            }
            else if (req.url == configURL) {
                const c = JSON.parse(TD.decode(Buffer.concat(chunks))) as { nonConfigurable: string[] }
                for (let x of c.nonConfigurable) {
                    state.controlledGlobals.add(x)
                }
                state.controlledGlobalsLookup = createLookup(state.controlledGlobals)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ src: packageBase + state.manifest.main }))
            }
            else if (req.url == clientURL) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(fs.readFileSync(new URL('./client.js', packageMetaURL) as any, { encoding: 'utf8' }).replace('@bintoca/package/primordial', primordialURL))
            }
            else if (req.url == initURL) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(fs.readFileSync(new URL('./init.js', packageMetaURL) as any, { encoding: 'utf8' }).replace('@bintoca/package/primordial', primordialURL))
            }
            else if (req.url == primordialURL) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(fs.readFileSync(new URL('./primordial.js', packageMetaURL) as any))
            }
            else if (req.url.startsWith(importBase)) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(getDynamicImportModule(req.url, 'import {metaServer} from "' + clientURL + '";imp.meta.server=metaServer;'))
            }
            else if (req.url.startsWith(reloadBase)) {
                const u = state.urlCache[packageBase + req.url.slice(req.url.indexOf('/', 5) + 1)]
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
            else if (req.url.startsWith(globalBase)) {
                res.setHeader('Content-Type', 'text/javascript')
                const g = req.url.slice(globalBase.length)
                const d = Buffer.from(TE.encode(getGlobalModule(g, initURL)))
                state.urlCache[req.url] = { data: d, type: 'text/javascript' }
                res.end(d)
            }
            else if (state.fileCache[req.url]) {
                const u = decodeFile(state.fileCache[req.url], req.url.startsWith(internalBase) ? null : state.controlledGlobalsLookup, new URL(req.url, getRootURL(state)))
                state.urlCache[req.url] = u
                res.setHeader('Content-Type', u.type)
                res.end(Buffer.from(u.data))
            }
            else {
                res.statusCode = 404
                log(state, 404, req.url)
                res.end()
            }
        }
        catch (e) {
            res.statusCode = 500
            log(state, e)
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
export const notify = (state: State) => {
    for (let x of state.wsConnections) {
        x.sendUTF(JSON.stringify({ type: 'update' }))
    }
}
export const checkParsed = (parsed: { [k: string]: FileParse }, prefix: string, state: State): boolean => {
    if (prefix) {
        prefix += '/'
    }
    let r = true
    for (let x in parsed) {
        const m = parsed[x]
        if (m.type == FileType.error) {
            r = false
            const type = m.error
            if (type == ParseFilesError.syntax) {
                log(state, 'File: ' + prefix + x, '- Syntax error: ' + m.message)
            }
            else if (type == ParseFilesError.invalidSpecifier) {
                log(state, 'File: ' + prefix + x, '- Invalid import specifier: ' + m.message)
            }
            else if (type == ParseFilesError.packageJSON) {
                log(state, 'File: ' + prefix + x, '- ' + m.message)
            }
            else {
                log(state, 'File: ' + prefix + x, '- Error type: ' + type, 'Message: ' + m.message)
            }
        }
    }
    return r
}
export const getIntegritySHA256 = (u: Uint8Array) => {
    const sha256 = createHash('sha256')
    const dig = sha256.update(u).digest('base64')
    return Promise.resolve('sha256-' + dig)
}
export const readlineHandler = (line, state: State) => {
    if (line.trim() == 'help' || line.trim() == 'h' || line.trim() == '?') {
        console.log('Commands:')
        console.log('  parse|p         parse the package')
        console.log('  reload|r        reload the browser')
        console.log('  watch|w         watch config path')
        console.log('  unwatch|u       unwatch config path')
        console.log('  auto|a          toggle auto browser reload')
        console.log('  help|h|?        display help')
        console.log('  exit|quit|q     exit the program')
    }
    else if (line.trim() == 'parse' || line.trim() == 'p') {
        loadPackage(state).then(x => {
            if (x && state.autoReload) {
                notify(state)
            }
        })
    }
    else if (line.trim() == 'reload' || line.trim() == 'r') {
        notify(state)
        console.log('Reloaded ' + getRootURL(state))
    }
    else if (line.trim() == 'watch' || line.trim() == 'w') {
        watch(state)
    }
    else if (line.trim() == 'unwatch' || line.trim() == 'u') {
        unwatch(state)
    }
    else if (line.trim() == 'auto' || line.trim() == 'a') {
        state.autoReload = !state.autoReload
        console.log('Auto reload is ' + (state.autoReload ? 'on' : 'off'))
    }
    else if (line.trim() == 'q' || line.trim() == 'quit' || line.trim() == 'exit') {
        process.exit()
    }
    else {
        console.log('Unknown command "' + line + '"')
    }
    state.readlineInterface.prompt()
}
export const log = (state: State, ...x) => {
    console.log(...x)
    state.readlineInterface.prompt()
}
export const applyConfigFile = async (state: State) => {
    if (fs.existsSync(state.config.configFile)) {
        const dev = await import(path.join('file://' + cwd(), state.config.configFile))
        Object.assign(state.config, dev.default)
    }
}
export const watch = (state: State) => {
    if (state.isWatching) {
        log(state, 'Already watching "' + state.config.path + '"')
    }
    else {
        const w = chokidar.watch(state.config.path, {
            ignored: state.config.ignore,
            ignoreInitial: true,
            awaitWriteFinish: state.config.awaitWriteFinish
        })
        //w.on('ready', () => log(w.getWatched(), config))
        w.on('error', er => log(state, 'Watcher error', er))
        w.on('all', () => {
            loadPackage(state).then(x => {
                if (x && state.autoReload) {
                    notify(state)
                }
            })
        })
        state.watcher = w
        state.isWatching = true
        log(state, 'Watching "' + state.config.path + '"')
    }
}
export const unwatch = (state: State) => {
    if (state.isWatching) {
        state.watcher.close()
        state.isWatching = false
        log(state, 'Unwatching "' + state.config.path + '"')
    }
    else {
        log(state, 'Not watching "' + state.config.path + '"')
    }
}
export const loadPackage = async (state: State) => {
    if (!state.isWatching) {
        log(state, 'Loading files...')
    }
    state.fileCache = {}
    state.urlCache = {}
    state.manifest = undefined
    const man = await pacote.manifest('file:' + state.config.path)
    const up = await parsePackage(await pacote.tarball.stream(man._resolved, parseTar), state.encoderState, getIntegritySHA256)
    let r = true
    if (up.manifest) {
        state.manifest = up.manifest
        for (let x in up.encoded) {
            const url = packageBase + x
            state.fileCache[url] = up.encoded[x]
        }
    }
    else {
        r = false
        checkParsed(up.parsed, '', state)
    }
    if (!state.isWatching) {
        log(state, 'Done loading files.')
    }
    return r
}
export const init = async (config?: Config) => {
    const state: State = {
        urlCache: {}, fileCache: {}, wsConnections: [], manifest: undefined, watcher: undefined, isWatching: false, autoReload: true,
        readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' }),
        config: config || Object.assign({}, defaultConfig), controlledGlobals: new Set(), controlledGlobalsLookup: null, encoderState: setupEncoderState()
    }
    if (state.config.configFile) {
        await applyConfigFile(state)
    }
    state.readlineInterface.on('line', line => readlineHandler(line, state))
    state.readlineInterface.prompt()
    try {
        await loadPackage(state)
    }
    catch (e) {
        log(state, e)
        process.exit()
    }
    const httpServer = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => await httpHandler(req, res, state))
    const wsServer = new wss({ httpServer: httpServer })
    wsServer.on('request', function (request) { wsHandler(request, state) })
    httpServer.listen(state.config.port)
    log(state, 'Listening on ' + getRootURL(state))
    if (state.config.open) {
        open(getRootURL(state))
    }
    if (state.config.watch) {
        watch(state)
    }
    return { httpServer, wsServer, state }
}