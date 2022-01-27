import { defaultConditionsSync, ESM_RESOLVE, FileURLSystemSync } from '@bintoca/http/resolve'
import { existsSync, readFileSync } from 'fs'
import * as crypto from 'crypto'
import * as readline from 'readline'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import { HtmlRoutes, PageConfig, PlatformManifest, matchHtmlRoute, indexHtml, indexHtmlHeaders } from '@bintoca/http/shared'

const TD = new TextDecoder()
const TE = new TextEncoder()
export const defaultPlatformManifest: PlatformManifest = {
    '@bintoca/http/shared': { ct: 'text/javascript' },
    '@bintoca/http/home': { ct: 'text/javascript' },
    '@bintoca/http/sw': { ct: 'text/javascript' },
    'favicon': { ct: 'image/x-icon', fileURL: new URL('./favicon.ico', import.meta.url) },
    'apple-touch-icon': { ct: 'image/png', fileURL: new URL('./apple-touch-icon.png', import.meta.url) },
    'css': { ct: 'text/css', fileURL: new URL('./main.css', import.meta.url) }
}
export const defaultRoutes: HtmlRoutes = {
    "/": { scripts: ['@bintoca/http/home'], stylesheets: ['css'] }
}
const fus: FileURLSystemSync = {
    exists: (p: URL) => existsSync(p as any),
    read: (p: URL) => JSON.parse(readFileSync(p as any, 'utf8')),
    jsonCache: {},
    conditions: defaultConditionsSync
}
export const initPlatformManifest = (manifest: PlatformManifest, pageConfig: PageConfig, routes: HtmlRoutes) => {
    for (let k in manifest) {
        const u = manifest[k].fileURL || ESM_RESOLVE(k, new URL(import.meta.url), fus)
        let b: Buffer = readFileSync(u as any)
        if (manifest[k].deps) {
            let s = TD.decode(b)
            for (let d of manifest[k].deps) {
                s = s.replace(new RegExp(d, 'g'), manifest[d].path)
            }
            b = Buffer.from(s)
        }
        manifest[k].content = b
        manifest[k].path = '/' + k + '.' + crypto.createHash('sha256').update(b).digest().toString('hex')
    }
    const shared = manifest['@bintoca/http/shared']
    const sw = manifest['@bintoca/http/sw']
    const liteManifest = {}
    for (let k in manifest) {
        if (k != '@bintoca/http/sw') {
            liteManifest[k] = { ct: manifest[k].ct, path: manifest[k].path }
        }
    }
    sw.content = Buffer.from(TD.decode(shared.content).split('\n')
        .concat(TD.decode(sw.content)
            .replace('const manifest = {}', 'const manifest = ' + JSON.stringify(liteManifest))
            .replace('const pageConfig = {}', 'const pageConfig = ' + JSON.stringify(pageConfig))
            .replace('const routes = {}', 'const routes = ' + JSON.stringify(routes))
            .split('\n'))
        .filter(x => !x.startsWith('import ') && !x.startsWith('export ')).join('\n'))
    sw.path = crypto.createHash('sha256').update(sw.content).digest().toString('hex')
    return manifest
}
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
export type State = { readlineInterface: readline.Interface, config: Config, platformManifest: PlatformManifest }
export type RequestFields = { method: string, url: string, headers: { [header: string]: string | string[] | undefined }, body: Buffer }
export type ResponseFields = { statusCode: number, body: string | Buffer, headers: { [header: string]: number | string } }
export const contentType = (res: ResponseFields, ct: string) => res.headers['Content-Type'] = ct
export const httpHandler = async (req: RequestFields, state: State): Promise<ResponseFields> => {
    const res: ResponseFields = { statusCode: 200, body: '', headers: {} }
    switch (req.method) {
        case 'GET': {
            const route = matchHtmlRoute(req.url, defaultRoutes)
            const manifestMatch = Object.keys(state.platformManifest).map(x => state.platformManifest[x]).filter(x => x.path == req.url)[0]
            if (route) {
                res.headers = indexHtmlHeaders()
                res.body = indexHtml(state.config.pageConfig, state.platformManifest, route)
            }
            else if (manifestMatch) {
                contentType(res, manifestMatch.ct)
                res.body = manifestMatch.content
            }
            else if (req.url == '/sw.js') {
                if (state.config.pageConfig.isDev) {
                    state.platformManifest = initPlatformManifest(state.platformManifest, state.config.pageConfig, defaultRoutes)
                }
                const sw = state.platformManifest['@bintoca/http/sw']
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
            else {
                res.statusCode = 404
            }
            break
        }
        case 'POST': {
            switch (req.url) {

                default:
                    res.statusCode = 404
            }
            break
        }
        default:
            res.statusCode = 405
    }
    return res
}
export const readlineHandler = (line, state: State) => {
    if (line.trim() == 'help' || line.trim() == 'h' || line.trim() == '?') {
        console.log('Commands:')
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
export const getRootURL = (state: State) => 'http://' + state.config.hostname + ':' + state.config.port
export const init = async (config?: Config) => {
    const state: State = {
        readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'bintoca> ' }), config: config || Object.assign({}, defaultConfig),
        platformManifest: initPlatformManifest(defaultPlatformManifest, defaultConfig.pageConfig, defaultRoutes)
    }
    if (state.config.configFile) {
        await applyConfigFile(state)
    }
    state.readlineInterface.on('line', line => readlineHandler(line, state))
    state.readlineInterface.prompt()
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
    httpServer.listen(state.config.port)
    log(state, 'Listening on ' + getRootURL(state))
    if (state.config.open) {
        open(getRootURL(state))
    }
    return { httpServer, state }
}