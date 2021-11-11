import { defaultConditionsSync, ESM_RESOLVE, FileURLSystemSync } from '@bintoca/package/resolve'
import { existsSync, readFileSync } from 'fs'
import * as crypto from 'crypto'
import { internalBase } from '@bintoca/package/core'
import { HtmlRoutes, PageConfig, PlatformManifest, } from '@bintoca/package/shared'

const TD = new TextDecoder()
const TE = new TextEncoder()
export const defaultPlatformManifest: PlatformManifest = {
    '@bintoca/package/primordial': { ct: 'text/javascript' },
    '@bintoca/package/shared': { ct: 'text/javascript' },
    '@bintoca/package/client': {
        ct: 'text/javascript',
        deps: ['@bintoca/package/primordial']
    },
    '@bintoca/package/init': {
        ct: 'text/javascript',
        deps: ['@bintoca/package/primordial']
    },
    '@bintoca/package/dynamic': {
        ct: 'text/javascript',
        deps: ['@bintoca/package/primordial']
    },
    '@bintoca/cbor/core': { ct: 'text/javascript' },
    '@bintoca/package/home': { ct: 'text/javascript' },
    '@bintoca/package/sw': {
        ct: 'text/javascript',
        deps: ['@bintoca/cbor/core']
    },
    'favicon': { ct: 'image/x-icon', fileURL: new URL('./favicon.ico', import.meta.url) },
    'apple-touch-icon': { ct: 'image/png', fileURL: new URL('./apple-touch-icon.png', import.meta.url) },
    'css': { ct: 'text/css', fileURL: new URL('./main.css', import.meta.url) }
}
export const defaultRoutes: HtmlRoutes = {
    "/": { scripts: ['@bintoca/package/home'], stylesheets: ['css'] }
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
        manifest[k].path = internalBase + k + '.' + crypto.createHash('sha256').update(b).digest().toString('hex')
    }
    const cbor = manifest['@bintoca/cbor/core']
    const shared = manifest['@bintoca/package/shared']
    const sw = manifest['@bintoca/package/sw']
    const liteManifest = {}
    for (let k in manifest) {
        if (k != '@bintoca/package/sw') {
            liteManifest[k] = { ct: manifest[k].ct, path: manifest[k].path }
        }
    }
    sw.content = Buffer.from(TD.decode(cbor.content).replace(/export const/g, 'const').replace(/export class/g, 'class').replace(/export var/g, 'var').split('\n')
        .concat(TD.decode(shared.content).split('\n'))
        .concat(TD.decode(sw.content)
            .replace('const manifest = {}', 'const manifest = ' + JSON.stringify(liteManifest))
            .replace('const pageConfig = {}', 'const pageConfig = ' + JSON.stringify(pageConfig))
            .replace('const routes = {}', 'const routes = ' + JSON.stringify(routes))
            .split('\n'))
        .filter(x => !x.startsWith('import ') && !x.startsWith('export ')).join('\n'))
    return manifest
}