import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process';
import {
    parseFiles, ParseFilesError, getShrinkwrapURLs, encode, decodePackage, decodeFile, createLookup, FileType, defaultConditions, ESM_RESOLVE, getCacheKey,
    getShrinkwrapResolved, ShrinkwrapPackageDescription, dynamicImportBase, getDynamicImportModule, reloadBase, Update, FileURLSystem, getManifest
} from '@bintoca/package'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'
import pacote from 'pacote'
import cacache from 'cacache'
import tar from 'tar'
import cachedir from 'cachedir'

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
export const reset = (state: State) => {
    state.urlCache = {}
    state.fileURLSystem = {
        exists: async (p: URL) => {
            if (!p.pathname.startsWith(base)) {
                return false
            }
            if (p.pathname.startsWith(base + 'node_modules/')) {
                const key = getCacheKey(p.pathname, base, state.shrinkwrap)
                return key ? await cacache.get.info(cacacheDir, key) != null : false
            }
            return state.fileCache[p.pathname] !== undefined
        },
        read: async (p: URL, decoded: boolean) => {
            let r
            if (p.pathname.startsWith(base + 'node_modules/')) {
                try {
                    r = (await cacache.get(cacacheDir, getCacheKey(p.pathname, base, state.shrinkwrap))).data
                }
                catch (e) {
                    optimizePackage(getShrinkwrapResolved(p.pathname, base, state.shrinkwrap), state)
                    r = (await cacache.get(cacacheDir, getCacheKey(p.pathname, base, state.shrinkwrap))).data
                }
            }
            else {
                r = state.fileCache[p.pathname]
            }
            return decoded ? (await decodeFile(r, null, null, null, null, null)).data : r
        },
        jsonCache: {}
    }
}
export type Config = { hostname: string, port: number, ignore, awaitWriteFinish, open: boolean, watch: boolean, configFile }
export type State = { urlCache, fileCache, fileURLSystem: FileURLSystem, readlineInterface: readline.Interface, shrinkwrap, packageJSON, wsConnections: any[], config: Config }
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
                        mod = await ESM_RESOLVE(state.packageJSON.name, new URL(base, getRootURL(state)), defaultConditions, state.fileURLSystem)
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
            else if (await state.fileURLSystem.exists(new URL(req.url, getRootURL(state)))) {
                const u = await decodeFile(await state.fileURLSystem.read(new URL(req.url, getRootURL(state)), false), freeGlobals, controlledGlobals, new URL(req.url, getRootURL(state)), defaultConditions, state.fileURLSystem)
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
        x.sendUTF(JSON.stringify({ type: 'update', data: { base: new URL(base, getRootURL(state)).href, baseReload: new URL(reloadBase, getRootURL(state)).href, updates } }))
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
        const parsed = parseFiles(await pacote.tarball.stream(x.resolved, parseTar))
        if (checkParsed(parsed, prefix, state)) {
            const enc = decodePackage(encode(parsed)).get(1)
            for (let k in enc) {
                await cacache.put(cacacheDir, x.resolved + '/files/' + k, enc[k])
            }
            await cacache.put(cacacheDir, x.resolved + '/manifest', getManifest(enc))
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
            reset(state)
            if (f['npm-shrinkwrap.json'].action != 'remove') {
                state.shrinkwrap = JSON.parse(TD.decode(f['npm-shrinkwrap.json'].buffer))
                for (let x of getShrinkwrapURLs(state.shrinkwrap)) {
                    if (!await cacache.get.info(cacacheDir, x.resolved + '/package.json')) {
                        await optimizePackage(x, state)
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
    const enc = decodePackage(encode(parsed)).get(1)
    for (let x in enc) {
        const url = base + alignPath(x)
        state.fileCache[url] = enc[x]
        state.urlCache[url] = undefined
    }
    const notif = {}
    for (let k in f) {
        const url = new URL(base + alignPath(k), getRootURL(state))
        notif[url.href] = { action: f[k].action }
        if (f[k].action == 'remove') {
            state.fileCache[url.pathname] = undefined
            state.urlCache[url.pathname] = undefined
        }
        if (url.href.endsWith('package.json')) {
            reset(state)
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
export const init = async (config?: Config) => {
    const state = {
        urlCache: {}, fileCache: {}, fileURLSystem: null, wsConnections: [], shrinkwrap: undefined, packageJSON: undefined,
        readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' }),
        config: config || Object.assign({}, defaultConfig)
    }
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
        log(e)
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