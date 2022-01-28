import { defaultConditionsSync, ESM_RESOLVE, FileURLSystemSync } from '@bintoca/http/resolve'
import { existsSync, readFileSync } from 'fs'
import * as crypto from 'crypto'
import * as readline from 'readline'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import { HtmlRoutes, PageConfig, PlatformManifest, matchHtmlRoute, indexHtml, indexHtmlHeaders, PlatformManifestItem } from '@bintoca/http/shared'

const TD = new TextDecoder()
const TE = new TextEncoder()
export const defaultPlatformManifest: PlatformManifest = {
    'home': { ct: 'text/javascript', module: '@bintoca/http/home' },
    'favicon': { ct: 'image/x-icon', fileURL: new URL('./favicon.ico', import.meta.url) },
    'faviconBare': { ct: 'image/x-icon', fileURL: new URL('./favicon.ico', import.meta.url), path: '/favicon.ico' },
    'apple-touch-icon': { ct: 'image/png', fileURL: new URL('./apple-touch-icon.png', import.meta.url) },
    'css': { ct: 'text/css', fileURL: new URL('./main.css', import.meta.url) }
}
export const defaultRoutes: HtmlRoutes = {
    "/": { scripts: ['home'], stylesheets: ['css'] }
}
const fus: FileURLSystemSync = {
    exists: (p: URL) => existsSync(p as any),
    read: (p: URL) => JSON.parse(readFileSync(p as any, 'utf8')),
    jsonCache: {},
    conditions: defaultConditionsSync
}
export const readFile = (item: PlatformManifestItem) => readFileSync(item.fileURL || ESM_RESOLVE(item.module, new URL(import.meta.url), fus) as any)
export const initRootsJS = (manifest: PlatformManifest) => {
    const roots = Object.keys(manifest).filter(x => manifest[x].ct == 'text/javascript').map(x => manifest[x])
    function scan(item: PlatformManifestItem) {
        const imp = TD.decode(readFile(item)).split('\n').filter(x => x.startsWith('import ')).map(x => x.substring(x.indexOf("'") + 1, x.lastIndexOf("'")))
        for (let x of imp) {
            if (!Object.keys(manifest).some(k => manifest[k].module == x)) {
                const it = { ct: 'text/javascript', module: x }
                manifest[x] = it
                scan(it)
            }
            if (!item.deps) {
                item.deps = []
            }
            item.deps.push(x)
        }
    }
    for (let r of roots) {
        scan(r)
    }
    return manifest
}
export const initPlatformManifest = (manifest: PlatformManifest) => {
    function rec(k) {
        let b: Buffer = readFile(manifest[k])
        if (manifest[k].deps) {
            let s = TD.decode(b)
            for (let d of manifest[k].deps) {
                if (!manifest[d].path) {
                    rec(d)
                }
                s = s.replace(new RegExp("'" + manifest[d].module + "'", 'g'), "'" + manifest[d].path + "'")
            }
            b = Buffer.from(s)
        }
        manifest[k].content = b
        if (!manifest[k].path) {
            manifest[k].path = '/' + k + '.' + crypto.createHash('sha256').update(b).digest().toString('hex')
        }
    }
    for (let k in manifest) {
        rec(k)
    }
    return manifest
}
export const initInline = (k: string, manifest: PlatformManifest, replace: { [k: string]: string }) => {
    const item = manifest[k]
    const b = readFile(item)
    let rb = TD.decode(b)
    for (let k in replace) {
        rb = rb.replace(k, replace[k])
    }
    item.content = Buffer.from(item.deps.map(x => TD.decode(manifest[x].content).split('\n')).flat()
        .concat(rb.split('\n'))
        .filter(x => !x.startsWith('import ') && !x.startsWith('export '))
        .join('\n'))
    item.hash = crypto.createHash('sha256').update(item.content).digest().toString('hex')
}
export const serviceWorkerReplace = (manifest: PlatformManifest, pageConfig: PageConfig, routes: HtmlRoutes) => {
    return {
        'const manifest = {}': 'const manifest = ' + JSON.stringify(manifest),
        'const pageConfig = {}': 'const pageConfig = ' + JSON.stringify(pageConfig),
        'const routes = {}': 'const routes = ' + JSON.stringify(routes)
    }
}
export const defaultConfig: Config = {
    hostname: 'localhost',
    port: 3000,
    open: true,
    configFile: './bintoca.config.js',
    pageConfig: { title: 'bintoca', docs: 'https://docs.bintoca.com', isDev: false }
}
export type Config = { hostname: string, port: number, open: boolean, configFile, pageConfig: PageConfig }
export type State = { readlineInterface: readline.Interface, config: Config, platformManifest: PlatformManifest, routes: HtmlRoutes, log: (x: { type: string, [k: string]: any }) => any }
export type RequestFields = { method: string, url: string, headers: { [header: string]: string | string[] | undefined }, body: Buffer }
export type ResponseFields = { statusCode: number, body: string | Buffer, headers: { [header: string]: number | string } }
export const matchURL = (url: string, manifest: PlatformManifest, routes: HtmlRoutes, pageConfig: PageConfig): PlatformManifestItem => {
    const route = matchHtmlRoute(url, routes)
    if (route) {
        return { ct: 'text/html', headers: indexHtmlHeaders(), content: Buffer.from(indexHtml(pageConfig, manifest, route)) }
    }
    const manifestMatch = Object.keys(manifest).map(x => manifest[x]).filter(x => x.path == url)[0]
    if (manifestMatch) {
        manifestMatch.headers = Object.assign({ 'Content-Type': manifestMatch.ct }, manifestMatch.headers)
        if (manifestMatch.path.length > 64) {
            manifestMatch.headers['Cache-Control'] = 'public, max-age=31536000'
        }
        return manifestMatch
    }
}
export const httpHandler = async (req: RequestFields, state: State): Promise<ResponseFields> => {
    const res: ResponseFields = { statusCode: 200, body: '', headers: {} }
    switch (req.method) {
        case 'GET': {
            const m = matchURL(req.url, state.platformManifest, state.routes, state.config.pageConfig)
            if (m) {
                if (m.hash && req.headers['if-none-match'] == m.hash) {
                    res.statusCode = 304
                }
                else {
                    res.headers = m.headers
                    res.body = m.content
                    if (m.hash) {
                        res.headers['ETag'] = m.hash
                    }
                }
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
export const applyConfigFile = async (state: State) => {
    if (fs.existsSync(state.config.configFile)) {
        const dev = await import(path.join('file://' + cwd(), state.config.configFile))
        Object.assign(state.config, dev.default)
    }
}
export const getRootURL = (state: State) => 'http://' + state.config.hostname + ':' + state.config.port
export const init = async (state: State) => {
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
                    state.log({ type: '404', url: req.url })
                }
            }
            catch (e) {
                res.statusCode = 500
                state.log({ type: '500', url: req.url, e })
                res.end()
            }
        })
    })
    httpServer.listen(state.config.port)
    state.log({ type: 'listen', text: 'Listening on ' + getRootURL(state) })
    if (state.config.open) {
        open(getRootURL(state))
    }
    return { httpServer, state }
}