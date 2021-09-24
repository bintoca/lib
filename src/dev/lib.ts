import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import {
    defaultConditionsSync,
    ESM_RESOLVE
} from '@bintoca/package'
import {
    parseFiles, ParseFilesError, encodePackage, encodeFile, decodeFile, createLookup, FileType,
    importBase, getDynamicImportModule, reloadBase, packageBase, internalBase, Update,
    globalBase, metaURL as packageMetaURL, getGlobalModule, configURL, FileParse, fileError
} from '@bintoca/package/core'
import { url as stateURL } from '@bintoca/package/state'
import * as chokidar from 'chokidar'
import { server as wss } from 'websocket'
import anymatch from 'anymatch'
import * as readline from 'readline'
import pacote from 'pacote'
import cacache from 'cacache'
import tar from 'tar'
import cachedir from 'cachedir'
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
    configFile: './bintoca.config.js'
}
export type Config = { hostname: string, port: number, ignore, awaitWriteFinish, open: boolean, watch: boolean, configFile }
export type State = {
    urlCache, fileCache, readlineInterface: readline.Interface, packageJSON, wsConnections: any[],
    config: Config, controlledGlobals: Set<string>, controlledGlobalsLookup: DataView, encoderState: EncoderState
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
                const u = new URL(packageBase, getRootURL(state))
                res.end(JSON.stringify({ src: ESM_RESOLVE(state.packageJSON.name, u, { exists: (p: URL) => p.href == new URL('./package.json', u).href, read: (p: URL) => state.packageJSON, jsonCache: {}, conditions: defaultConditionsSync }) }))
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
export const notify = (updates, state: State) => {
    for (let x of state.wsConnections) {
        x.sendUTF(JSON.stringify({ type: 'update', data: { base: new URL(packageBase, getRootURL(state)).href, baseReload: new URL(reloadBase, getRootURL(state)).href, updates } }))
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
            const type = m.value.type
            if (type == ParseFilesError.syntax) {
                log(state, 'File: ' + prefix + x, 'Syntax error: ' + m.value.message)
            }
            else if (type == ParseFilesError.invalidSpecifier) {
                log(state, 'File: ' + prefix + x, 'Invalid import specifier: ' + m.value.message)
            }
            else {
                log(state, 'File: ' + prefix + x, 'Error type: ' + m.value.message, 'Message: ' + m.value.message)
            }
        }
    }
    return r
}
export const parse = async (packageSpecifier: string, state: State) => {
    const parsed = parseFiles(await pacote.tarball.stream(packageSpecifier, parseTar))
    for (let x in parsed) {
        const m = parsed[x]
        if (m.type == FileType.error) {
            return { parsed }
        }
    }
    const packageJSON = JSON.parse(TD.decode(parsed['package.json'].value))
    if (packageJSON.type != 'module') {
        parsed['package.json'] = fileError(ParseFilesError.syntax, 'package type must be module')
        return { parsed }
    }
    else if (!packageJSON.name) {
        parsed['package.json'] = fileError(ParseFilesError.syntax, 'package name required')
        return { parsed }
    }
    const encoded = encodePackage(parsed, state.encoderState)
    const manifest: { [k: string]: { integrity: string } } = {}
    for (let x in encoded) {
        const sha256 = createHash('sha256')
        const dig = sha256.update(encoded[x]).digest('base64')
        manifest[x] = { integrity: 'sha256-' + dig }
    }
    return { parsed, encoded, manifest, packageJSON }
}
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
export const applyConfigFile = async (state: State) => {
    if (fs.existsSync(state.config.configFile)) {
        const dev = await import(path.join('file://' + cwd(), state.config.configFile))
        Object.assign(state.config, dev.default)
    }
}
export const init = async (config?: Config) => {
    const state: State = {
        urlCache: {}, fileCache: {}, wsConnections: [], packageJSON: undefined,
        readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'DEV> ' }),
        config: config || Object.assign({}, defaultConfig), controlledGlobals: new Set(), controlledGlobalsLookup: null, encoderState: setupEncoderState()
    }
    if (state.config.configFile) {
        await applyConfigFile(state)
    }
    state.readlineInterface.prompt()
    log(state, 'Loading files...')
    //cacache.ls(cacacheDir).then(x => log('ls', x)).catch(x => log('lse', x))
    try {
        const man = await pacote.manifest('file:.')
        const up = await parse(man._resolved, state)
        if (up.manifest) {
            state.packageJSON = up.packageJSON
            for (let x in up.encoded) {
                const url = packageBase + x
                state.fileCache[url] = up.encoded[x]
            }
        }
        else {
            checkParsed(up.parsed, '', state)
            process.exit()
        }
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
        //watch(state)
    }
    return { httpServer, wsServer, state }
}