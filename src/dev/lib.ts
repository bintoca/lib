import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import {
    ParseFilesError, decodeFile, createLookup, ParseBundle,
    importBase, getDynamicImportModule, reloadBase, packageBase, internalBase, FileBundle,
    globalBase, getGlobalModule, Manifest, FileParseError, parseFiles, validateParsed, encodeFile
} from '@bintoca/package/core'
import { initPlatformManifest, defaultPlatformManifest, defaultRoutes } from '@bintoca/package'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import * as readline from 'readline'
import pacote from 'pacote'
import tar from 'tar'
import { EncoderState } from '@bintoca/cbor/core'
import { createHash } from 'crypto'
import { setupEncoderState } from '@bintoca/package/core'
import { indexHtml, indexHtmlHeaders, matchHtmlRoute, PageConfig, PlatformManifest } from '@bintoca/package/shared'
import { configURL } from '@bintoca/package/primordial'

const TD = new TextDecoder()
const TE = new TextEncoder()
export const defaultConfig: Config = {
    hostname: 'localhost',
    port: 3000,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    open: true,
    watch: true,
    configFile: './bintoca.config.js',
    path: '.',
    pageConfig: { title: 'bintoca', docs: 'https://docs.bintoca.com', isDev: false }
}
export type Config = { hostname: string, port: number, ignore, awaitWriteFinish, open: boolean, watch: boolean, configFile, path: string, pageConfig: PageConfig }
export type State = {
    urlCache, fileCache, readlineInterface: readline.Interface, wsConnections: any[], watcher: chokidar.FSWatcher, manifest: Manifest, parsed: ParseBundle,
    config: Config, controlledGlobals: Set<string>, controlledGlobalsLookup: DataView, encoderState: EncoderState, isWatching: boolean, autoReload: boolean, platformManifest: PlatformManifest
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
export type RequestFields = { method: string, url: string, headers: { [header: string]: string | string[] | undefined }, body: Buffer }
export type ResponseFields = { statusCode: number, body: string | Buffer, headers: { [header: string]: number | string } }
export const contentType = (res: ResponseFields, ct: string) => res.headers['Content-Type'] = ct
export const httpHandler = async (req: RequestFields, state: State): Promise<ResponseFields> => {
    const res: ResponseFields = { statusCode: 200, body: '', headers: {} }
    const route = matchHtmlRoute(req.url, defaultRoutes)
    if (route) {
        res.headers = indexHtmlHeaders()
        res.body = indexHtml(state.config.pageConfig, state.platformManifest, route)
    }
    else if (req.url == '/') {
        let err
        if (!state.manifest) {
            err = 'error parsing package'
        }
        if (err) {
            res.statusCode = 500
        }
        else {
            res.headers = indexHtmlHeaders()
            res.body = indexHtml(state.config.pageConfig, state.platformManifest, { base: packageBase, scripts: ['@bintoca/package/client', '@bintoca/package/init'], stylesheets: ['css'] })
        }
    }
    else if (req.url == configURL) {
        const c = JSON.parse(TD.decode(req.body)) as { nonConfigurable: string[] }
        for (let x of c.nonConfigurable) {
            state.controlledGlobals.add(x)
        }
        state.controlledGlobalsLookup = createLookup(state.controlledGlobals)
        contentType(res, 'application/json')
        res.body = JSON.stringify({ src: packageBase + state.manifest.main })
    }
    else if (req.url.startsWith(internalBase)) {
        const f = Object.keys(state.platformManifest).map(x => state.platformManifest[x]).filter(x => x.path == req.url)[0]
        if (f) {
            contentType(res, f.ct)
            res.body = f.content
        }
        else {
            res.statusCode = 404
        }
    }
    else if (req.url == '/sw.js') {
        if (state.config.pageConfig.isDev) {
            state.platformManifest = initPlatformManifest(state.platformManifest, state.config.pageConfig, defaultRoutes)
        }
        const sw = state.platformManifest['@bintoca/package/sw']
        if (req.headers['if-none-match'] == sw.path) {
            res.statusCode = 304
        }
        else {
            contentType(res, sw.ct)
            res.headers['ETag'] = sw.path
            res.body = sw.content
        }
    }
    else if (req.url == '/favicon.ico') {
        const x = state.platformManifest['favicon']
        contentType(res, x.ct)
        res.body = x.content
    }
    else if (req.url.startsWith(importBase)) {
        const x = state.platformManifest['@bintoca/package/client']
        contentType(res, 'text/javascript')
        res.body = getDynamicImportModule(req.url, state.platformManifest, 'import {metaServer} from "' + x.path + '";imp.meta.server=metaServer;')
    }
    else if (req.url.startsWith(reloadBase)) {
        const u = state.urlCache[packageBase + req.url.slice(req.url.indexOf('/', 5) + 1)]
        if (u) {
            contentType(res, u.type)
            res.body = Buffer.from(u.data)
        }
        else {
            res.statusCode = 404
        }
    }
    else if (state.urlCache[req.url]) {
        const u = state.urlCache[req.url]
        contentType(res, u.type)
        res.body = Buffer.from(u.data)
    }
    else if (req.url.startsWith(globalBase)) {
        const x = state.platformManifest['@bintoca/package/init']
        contentType(res, x.ct)
        const g = req.url.slice(globalBase.length)
        const d = Buffer.from(TE.encode(getGlobalModule(g, x.path)))
        state.urlCache[req.url] = { data: d, type: x.ct }
        res.body = d
    }
    else if (state.fileCache[req.url]) {
        const u = decodeFile(state.fileCache[req.url], req.url.startsWith(internalBase) ? null : state.controlledGlobalsLookup, new URL(req.url, getRootURL(state)))
        state.urlCache[req.url] = u
        contentType(res, u.type)
        res.body = Buffer.from(u.data)
    }
    else {
        res.statusCode = 404
    }
    return res
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
export const logErrors = (err: FileParseError[], state: State) => {
    for (let x of err) {
        if (x.error == ParseFilesError.syntax) {
            log(state, 'File: ' + x.filename, '- Syntax error: ' + x.message)
        }
        else if (x.error == ParseFilesError.invalidSpecifier) {
            log(state, 'File: ' + x.filename, '- Invalid import specifier: ' + x.message)
        }
        else if (x.error == ParseFilesError.packageJSON) {
            log(state, 'File: ' + x.filename, '- ' + x.message)
        }
        else {
            log(state, 'File: ' + x.filename, '- Error type: ' + x.error, 'Message: ' + x.message)
        }
    }
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
        loadPackage(state)
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
export const update = (f: FileBundle, state: State) => {
    const p = parseFiles(f)
    for (let x in p) {
        state.parsed[x] = p[x]
    }
    const up = validateParsed(state.parsed)
    if (up.manifest) {
        state.manifest = up.manifest
        for (let x in p) {
            const url = packageBase + x
            state.fileCache[url] = encodeFile(p[x], state.encoderState)
            state.urlCache[url] = undefined
        }
        if (state.autoReload) {
            notify(state)
        }
    }
    else {
        logErrors(up.errors, state)
    }
}
export const alignPath = (s: string) => s.replace(/\\/g, '/')
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
        w.on('change', path => {
            path = alignPath(path)
            if (state.parsed[path]) {
                update({ [path]: { action: 'change', buffer: fs.readFileSync(path) } }, state)
            }
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
    state.parsed = {}
    state.manifest = undefined
    const man = await pacote.manifest('file:' + state.config.path)
    update(await pacote.tarball.stream(man._resolved, parseTar), state)
    if (!state.isWatching) {
        log(state, 'Done loading files.')
    }
}
export const init = async (config?: Config) => {
    const state: State = {
        urlCache: {}, fileCache: {}, wsConnections: [], manifest: undefined, watcher: undefined, isWatching: false, autoReload: true,
        readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' }), parsed: null,
        config: config || Object.assign({}, defaultConfig), controlledGlobals: new Set(), controlledGlobalsLookup: null, encoderState: setupEncoderState(),
        platformManifest: initPlatformManifest(defaultPlatformManifest, defaultConfig.pageConfig, defaultRoutes)
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
    const httpServer = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => {
        let chunks: Buffer[] = []
        req.on('data', (c: Buffer) => {
            chunks.push(c)
        })
        req.on('end', async () => {
            try {
                const r = await httpHandler({ method: req.method || '', url: req.url || '', headers: req.headers, body: Buffer.concat(chunks) }, state)
                res.statusCode = r.statusCode
                for (let h in r.headers) {
                    res.setHeader(h, r.headers[h])
                }
                res.end(r.body)
                if (res.statusCode == 404) {
                    log(state, 404, req.url)
                }
            }
            catch (e) {
                res.statusCode = 500
                log(state, e)
                res.end()
            }
        })
    })
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