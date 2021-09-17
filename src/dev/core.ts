import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import {
    READ_PACKAGE_JSON, ESM_RESOLVE, FileURLSystem, CJS_MODULE
} from '@bintoca/package'
import {
    parseFiles, parseFile, ParseFilesError, getShrinkwrapURLs, encodePackage, encodeFile, decodePackage, decodeFile, createLookup, FileType, getCacheKey,
    getShrinkwrapResolved, ShrinkwrapPackageDescription, importBase, getDynamicImportModule, reloadBase, packageBase, internalBase, Update, getManifest, undefinedPath,
    packageCJSPath, getAllCJSModule, getCJSFiles, globalBase, metaURL as packageMetaURL, getGlobalModule
} from '@bintoca/package/server'
import { url as stateURL } from '@bintoca/package/state'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'
import pacote from 'pacote'
import cacache from 'cacache'
import tar from 'tar'
import cachedir from 'cachedir'

const TD = new TextDecoder()
const TE = new TextEncoder()
const clientURL = internalBase + new URL('./client.js', packageMetaURL).href
const initURL = internalBase + new URL('./init.js', packageMetaURL).href
const configURL = '/x/config'
export const defaultConfig: Config = {
    hostname: 'localhost',
    port: 3000,
    ignore: [/(^|[\/\\])\../, 'node_modules'], // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    open: true,
    watch: true,
    configFile: './bintoca.dev.js'
}
export const resetCache = (state: State) => {
    state.urlCache = {}
    state.cjsCache = null
    state.fileURLSystem.cjsParseCache = {}
    state.fileURLSystem.jsonCache = state.fileURLSystem.fsSync.jsonCache = {}
}
export const createFileURLSystem = (state: State): FileURLSystem => {
    const jc = {}
    const f: FileURLSystem = {
        exists: async (p: URL) => {
            if (p.pathname.startsWith(packageCJSPath)) {
                p = new URL(p.pathname.replace(packageCJSPath + '/', packageBase), p)
            }
            if (state.fileCache[p.pathname]) {
                return true
            }
            if (p.pathname.startsWith(internalBase)) {
                return fs.existsSync(new URL(p.pathname.slice(internalBase.length)) as any)
            }
            if (p.pathname.startsWith(packageBase + 'node_modules/')) {
                const key = getCacheKey(p.pathname, packageBase, state.shrinkwrap)
                return key ? await cacache.get.info(cacacheDir, key) != null : false
            }
            return false
        },
        read: async (p: URL, decoded: boolean) => {
            if (p.pathname.startsWith(packageCJSPath)) {
                p = new URL(p.pathname.replace(packageCJSPath + '/', packageBase), p)
            }
            let r
            if (state.fileCache[p.pathname]) {
                r = state.fileCache[p.pathname]
            }
            else if (p.pathname.startsWith(internalBase)) {
                r = state.fileCache[p.pathname] = encodeFile(parseFile(p.pathname, fs.readFileSync(new URL(p.pathname.slice(internalBase.length)) as any)))
            }
            else if (p.pathname.startsWith(packageBase + 'node_modules/')) {
                try {
                    r = (await cacache.get(cacacheDir, getCacheKey(p.pathname, packageBase, state.shrinkwrap))).data
                }
                catch (e) {
                    optimizePackage(getShrinkwrapResolved(p.pathname, packageBase, state.shrinkwrap), state)
                    r = (await cacache.get(cacacheDir, getCacheKey(p.pathname, packageBase, state.shrinkwrap))).data
                }
            }
            return decoded ? (await decodeFile(r, null, p, null)).data : r
        },
        jsonCache: jc,
        stateURL,
        cjsParseCache: {},
        conditions: undefined,
        fsSync: {
            exists: (p: URL) => {
                if (state.cjsCache[p.pathname]) {
                    return true
                }
                return false
            },
            read: (p: URL) => {
                const m: CJS_MODULE = { exports: f.jsonCache[p.href] }
                return m
            },
            jsonCache: jc,
            conditions: undefined
        },
        initCJS: async () => {
            if (!state.cjsCache) {
                state.cjsCache = {}
                const ur = getShrinkwrapURLs(state.shrinkwrap)
                for (let x in ur) {
                    const m = JSON.parse(TD.decode((await cacache.get(cacacheDir, ur[x].resolved + '/manifest')).data))
                    const u = getCJSFiles(m)
                    for (let y of u) {
                        const pathname = packageBase + x + '/' + y
                        state.cjsCache[pathname] = 1
                        if (pathname.endsWith('/package.json')) {
                            await READ_PACKAGE_JSON(new URL(pathname, getRootURL(state)), f)
                        }
                    }
                }
            }
        }
    }
    return f
}
export type Config = { hostname: string, port: number, ignore, awaitWriteFinish, open: boolean, watch: boolean, configFile }
export type State = {
    urlCache, fileCache, cjsCache: { [k: string]: 1 }, fileURLSystem: FileURLSystem, readlineInterface: readline.Interface, shrinkwrap, packageJSON, wsConnections: any[],
    config: Config, controlledGlobals: Set<string>, controlledGlobalsLookup: DataView
}
export const cacacheDir = path.join(cachedir('bintoca'), '_cacache')
export const parseTar = async (t: NodeJS.ReadableStream): Promise<Update> => {
    return new Promise((resolve, reject) => {
        const files: Update = {}
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
                res.end(JSON.stringify({ src: await ESM_RESOLVE(state.packageJSON.name, new URL(packageBase, getRootURL(state)), state.fileURLSystem) }))
            }
            else if (req.url == undefinedPath) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end('export default undefined')
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
            else if (req.url == packageCJSPath) {
                res.setHeader('Content-Type', 'text/javascript')
                res.end(getAllCJSModule(state.cjsCache))
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
            else if (await state.fileURLSystem.exists(new URL(req.url, getRootURL(state)))) {
                const u = await decodeFile(await state.fileURLSystem.read(new URL(req.url, getRootURL(state)), false), req.url.startsWith(internalBase) ? null : state.controlledGlobalsLookup, new URL(req.url, getRootURL(state)), state.fileURLSystem)
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
        x.sendUTF(JSON.stringify({ type: 'update', data: { base: new URL(packageBase, getRootURL(state)).href, baseReload: new URL(reloadBase, getRootURL(state)).href, updates } }))
    }
}
export const checkParsed = (parsed: { files: { [k: string]: Map<number, any> } }, prefix: string, state: State): boolean => {
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
                log(state, 'File: ' + prefix + x, 'Syntax error: ' + m.get(3))
            }
            else if (type == ParseFilesError.invalidSpecifier) {
                log(state, 'File: ' + prefix + x, 'Invalid import specifier: ' + m.get(3))
            }
            else {
                log(state, 'File: ' + prefix + x, 'Error type: ' + m.get(2), 'Message: ' + m.get(3))
            }
        }
    }
    return r
}
export const optimizePackage = async (x: ShrinkwrapPackageDescription, state: State) => {
    try {
        const prefix = x.resolved.substring(x.resolved.lastIndexOf('/') + 1)
        log(state, 'Optimizing:', prefix)
        const up: Update = await pacote.tarball.stream(x.resolved, parseTar)
        const parsed = parseFiles(up)
        if (checkParsed(parsed, prefix, state)) {
            const enc = decodePackage(encodePackage(parsed)).get(1)
            for (let k in enc) {
                await cacache.put(cacacheDir, x.resolved + '/files/' + k, enc[k])
            }
            await cacache.put(cacacheDir, x.resolved + '/manifest', TE.encode(JSON.stringify(getManifest(up))))
        }
    }
    catch (e) {
        log(state, 'Error optimizing package', e)
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
            log(state, 'Invalid package.json', e)
        }
    }
    if (f['npm-shrinkwrap.json']) {
        try {
            state.shrinkwrap = undefined
            resetCache(state)
            if (f['npm-shrinkwrap.json'].action != 'remove') {
                state.shrinkwrap = JSON.parse(TD.decode(f['npm-shrinkwrap.json'].buffer))
                const u = getShrinkwrapURLs(state.shrinkwrap)
                for (let x in u) {
                    if (!await cacache.get.info(cacacheDir, u[x].resolved + '/manifest')) {
                        await optimizePackage(u[x], state)
                    }
                }
            }
        }
        catch (e) {
            log(state, 'Invalid npm-shrinkwrap.json', e)
        }
    }
    const parsed = parseFiles(f)
    checkParsed(parsed, '', state)
    const enc = decodePackage(encodePackage(parsed)).get(1)
    for (let x in enc) {
        const url = packageBase + alignPath(x)
        state.fileCache[url] = enc[x]
        state.urlCache[url] = undefined
    }
    const notif = {}
    for (let k in f) {
        const url = new URL(packageBase + alignPath(k), getRootURL(state))
        notif[url.href] = { action: f[k].action, error: parsed.files[k].get(1) === FileType.error ? { type: parsed.files[k].get(2), message: parsed.files[k].get(3) } : undefined }
        if (f[k].action == 'remove') {
            state.fileCache[url.pathname] = undefined
            state.urlCache[url.pathname] = undefined
        }
        if (url.href.endsWith('package.json')) {
            resetCache(state)
        }
    }
    notify(notif, state)
}
export const alignPath = (s) => s.replace(/\\/g, '/')
export const readlineHandler = (line, state: State) => {
    if (line.trim() == 'clear cache') {
        cacache.rm.all(cacacheDir).then(x => log(state, 'Cache cleared successfully')).catch(x => log(x))
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
    state.readlineInterface.prompt()
}
export const log = (state: State, ...x) => {
    console.log(...x)
    state.readlineInterface.prompt()
}
export const watch = (state: State) => {
    const w = chokidar.watch('.', {
        ignored: state.config.ignore,
        ignoreInitial: true,
        awaitWriteFinish: state.config.awaitWriteFinish
    })
    //w.on('ready', () => log(w.getWatched(), config))
    w.on('error', er => log(state, 'Watcher error', er))
    w.on('add', path => { update({ [path]: { action: 'add', buffer: fs.readFileSync(path) } }, state) })
    w.on('addDir', path => { update(readDir(path, cwd(), {}, state), state) })
    w.on('change', path => { update({ [path]: { action: 'change', buffer: fs.readFileSync(path) } }, state) })
    w.on('unlink', path => { update({ [path]: { action: 'remove', buffer: undefined } }, state) })
    w.on('unlinkDir', path => {
        const f: Update = {}
        for (let k in state.urlCache) {
            if (k.startsWith(packageBase + alignPath(path) + '/')) {
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
export const init = async (config?: Config) => {
    const state: State = {
        urlCache: {}, fileCache: {}, cjsCache: null, fileURLSystem: null, wsConnections: [], shrinkwrap: undefined, packageJSON: undefined,
        readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' }),
        config: config || Object.assign({}, defaultConfig), controlledGlobals: new Set(), controlledGlobalsLookup: null
    }
    state.fileURLSystem = createFileURLSystem(state)
    if (state.config.configFile) {
        await applyConfigFile(state)
    }
    state.readlineInterface.prompt()
    log(state, 'Loading files...')
    //cacache.ls(cacacheDir).then(x => log('ls', x)).catch(x => log('lse', x))
    try {
        await update(readDir('', cwd(), {}, state), state)
        log(state, 'Done loading files.')
    }
    catch (e) {
        log(state, e)
    }
    const httpServer = http.createServer({}, async (req: http.IncomingMessage, res: http.ServerResponse) => await httpHandler(req, res, state))
    const wsServer = new wss({ httpServer: httpServer })
    wsServer.on('request', function (request) { wsHandler(request, state) })
    httpServer.listen(state.config.port)
    if (state.config.open) {
        open(getRootURL(state))
    }
    state.readlineInterface.on('line', line => readlineHandler(line, state))
    if (state.config.watch) {
        watch(state)
    }
    return { httpServer, wsServer, state }
}