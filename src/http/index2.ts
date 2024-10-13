import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as crypto from 'crypto'
import * as readline from 'readline'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import open from 'open'
import { cwd } from 'process'
import { HtmlRoutes, PageConfig, PlatformManifest, matchHtmlRoute, indexHtml, indexHtmlHeaders, PlatformManifestItem } from '@bintoca/http/shared'

export type Config = { hostname: string, port: number, open: boolean, configFile, pageConfig: PageConfig, outPath: string }
export type State = { readlineInterface: readline.Interface, config: Config, platformManifest: PlatformManifest, routes: HtmlRoutes, log: (x: { type: string, [k: string]: any }) => any }

const TD = new TextDecoder()
export const applyConfigFile = async (state: State) => {
    if (fs.existsSync(state.config.configFile)) {
        const dev = await import(path.join('file://' + cwd(), state.config.configFile))
        Object.assign(state.config, dev.default)
    }
}
export const getRootURL = (state: State) => 'http://' + state.config.hostname + ':' + state.config.port
export const defaultConfig: Config = {
    hostname: 'localhost',
    port: 3001,
    open: true,
    configFile: './bintoca.config.js',
    outPath: './out/',
    pageConfig: { title: 'bintoca', docs: 'https://docs.bintoca.com', isDev: false }
}
export const defaultPlatformManifest: PlatformManifest = {
    'home': { ct: 'text/javascript', module: '@bintoca/http/home', extension: '.js' },
    'favicon': { ct: 'image/x-icon', fileURL: new URL('./favicon.ico', import.meta.url), extension: '.ico' },
    'apple-touch-icon': { ct: 'image/png', fileURL: new URL('./apple-touch-icon.png', import.meta.url), extension: '.png' },
    'css': { ct: 'text/css', fileURL: new URL('./main.css', import.meta.url), extension: '.css' },
    'sw': { ct: 'text/javascript', module: '@bintoca/http/sw', path: '/sw.js' }
}
export const defaultRoutes: HtmlRoutes = {
    "/": { scripts: ['home'], stylesheets: ['css'] }
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
export const inferContentType = (path: string) => {
    if (path.endsWith('.html')) {
        return 'text/html'
    }
    if (path.endsWith('.js')) {
        return 'text/javascript'
    }
    if (path.endsWith('.css')) {
        return 'text/css'
    }
    if (path.endsWith('.ico')) {
        return 'image/x-icon'
    }
    if (path.endsWith('.png')) {
        return 'image/png'
    }
    return 'application/octet-stream'
}
export const run = async (state: State) => {
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
                res.statusCode = 200
                switch (req.method) {
                    case 'GET': {
                        if (req.url == '/') {
                            req.url = '/index.html'
                            const hs = indexHtmlHeaders()
                            for (let h in hs) {
                                res.setHeader(h, hs[h])
                            }
                        }
                        const furl = new URL('.' + req.url, outURL(state.config))
                        if (existsSync(furl)) {
                            res.setHeader('Content-Type', inferContentType(req.url))
                            res.end(readFileSync(furl))
                        }
                        else {
                            res.statusCode = 404
                        }
                        break
                    }
                    default:
                        res.statusCode = 405
                }
                // const r = await httpHandler({ method: req.method || '', url: req.url || '', headers: req.headers, body: Buffer.concat(chunks) }, state)
                // res.statusCode = r.statusCode
                // for (let h in r.headers) {
                //     res.setHeader(h, r.headers[h])
                // }
                //res.end(r.body)
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
export const outURL = (config: Config) => new URL(config.outPath, import.meta.url)
export const readFile = (item: PlatformManifestItem) => readFileSync(item.fileURL || new URL(import.meta.resolve(item.module)))
export const initRootsJS = (manifest: PlatformManifest) => {
    const roots = Object.keys(manifest).filter(x => manifest[x].ct == 'text/javascript').map(x => manifest[x])
    function scan(item: PlatformManifestItem) {
        const imp = TD.decode(readFile(item)).split('\n').filter(x => x.startsWith('import ')).map(x => x.substring(x.indexOf("'") + 1, x.lastIndexOf("'")))
        for (let x of imp) {
            if (!Object.keys(manifest).some(k => manifest[k].module == x)) {
                const it = { ct: 'text/javascript', module: x, extension: '.js' }
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
export const initPlatformManifest = (manifest: PlatformManifest, config: Config) => {
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
        if (!manifest[k].path) {
            manifest[k].path = '/' + k.replace(/\//g, '_') + '.' + crypto.createHash('sha256').update(b).digest().toString('hex') + (manifest[k].extension || '')
            writeFileSync(new URL('.' + manifest[k].path, outURL(config)), b)
        }
    }
    for (let k in manifest) {
        rec(k)
    }
    return manifest
}
export const initInline = (k: string, manifest: PlatformManifest, replace: { [k: string]: string }, config: Config) => {
    const item = manifest[k]
    const b = readFile(item)
    let rb = TD.decode(b)
    for (let k in replace) {
        rb = rb.replace(k, replace[k])
    }
    const content = Buffer.from(item.deps.map(x => TD.decode(readFile(manifest[x])).split('\n')).flat()
        .concat(rb.split('\n'))
        .filter(x => !x.startsWith('import ') && !x.startsWith('export '))
        .join('\n'))
    item.hash = crypto.createHash('sha256').update(content).digest().toString('hex')
    writeFileSync(new URL('.' + item.path, outURL(config)), content)
}
export const serviceWorkerReplace = (manifest: PlatformManifest, pageConfig: PageConfig, routes: HtmlRoutes) => {
    return {
        'const manifest = {}': 'const manifest = ' + JSON.stringify(manifest),
        'const pageConfig = {}': 'const pageConfig = ' + JSON.stringify(pageConfig),
        'const routes = {}': 'const routes = ' + JSON.stringify(routes)
    }
}
export const build = (state: State) => {
    writeFileSync(new URL('./index.html', outURL(state.config)), indexHtml(state.config.pageConfig, state.platformManifest, { scripts: ['home'], stylesheets: ['css'] }))
    initInline('sw', state.platformManifest, serviceWorkerReplace(state.platformManifest, state.config.pageConfig, state.routes), state.config)
}
