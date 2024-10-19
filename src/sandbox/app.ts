import { installedPrefix, installedOriginalPrefix, installedProcessedPrefix } from '@bintoca/sandbox/shared'
export type AppPath = { url?: string, integrity?: string, text?: string, base64?: string, contentType?: string }
export type AppManifest = { paths: { [k: string]: AppPath } }
export type InstalledList = { names: { [k: string]: number } }
const cacheName = 'cache1'
const TE = new TextEncoder()

export const install = async (m: AppManifest, name: string): Promise<{ error?: string }> => {
    if (typeof m.paths != 'object') {
        return { error: 'invalid paths' }
    }
    const cache = await caches.open(cacheName)
    const out: AppManifest = { paths: {} }
    for (let k in m.paths) {
        const gr = await getResponse(m.paths[k], cache)
        if (gr.error) {
            return { error: `path ${k} ${gr.error}` }
        }
        const v = await processFile(gr.response)
        if (v.error) {
            return { error: `path ${k} ${v.error}` }
        }
        if (gr.fetched) {
            await cache.put(integrityCacheURL(m.paths[k].integrity), gr.response)
        }
        if (v.transformed) {
            out.paths[k] = { integrity: await toSRI_sha256(await v.transformed.arrayBuffer()) }
            await cache.put(integrityCacheURL(out.paths[k].integrity), v.transformed)
        }
        else {
            out.paths[k] = { integrity: m.paths[k].integrity }
        }
    }
    cache.put(installedOriginalPrefix + name, new Response(JSON.stringify(m)))
    cache.put(installedProcessedPrefix + name, new Response(JSON.stringify(out)))
    const ir = await cache.match(installedPrefix)
    const installed: InstalledList = ir ? await ir.json() : {}
    installed.names[name] = 1
    cache.put(installedPrefix, new Response(JSON.stringify(installed)))
    return {}
}
export const getResponse = async (p: AppPath, cache: Cache): Promise<{ error?: string, response?: Response, fetched?: boolean }> => {
    if (p.url) {
        if (!p.integrity) {
            return { error: `url:${p.url} missing integrity` }
        }
        const cr = await cache.match(integrityCacheURL(p.integrity))
        const r = cr ?? await fetch(p.url)
        if (r.type != 'basic' && r.type != 'cors') {
            return { error: `url:${p.url} bad response type ${r.type}` }
        }
        if (r.status >= 400) {
            return { error: `url:${p.url} bad response status ${r.status}` }
        }
        const ab = await r.arrayBuffer()
        const algo = p.integrity.split('-')[0]
        if (!SRI_prefix_to_algo[algo]) {
            return { error: `url:${p.url} unsupported integrity algorithm ${algo}` }
        }
        const sha = await toSRI(ab, algo)
        if (sha != p.integrity) {
            return { error: `url:${p.url} integrity mismatch, specified: ${p.integrity} computed: ${sha}` }
        }
        return { response: r, fetched: !cr }
    }
    else if (p.text) {
        const r = new Response(TE.encode(p.text))
        if (p.contentType) {
            r.headers.set('Content-type', p.contentType)
        }
        return { response: r }
    }
    else if (p.base64) {
        const r = new Response(fromBase64(p.base64))
        if (p.contentType) {
            r.headers.set('Content-type', p.contentType)
        }
        return { response: r }
    }
    else {
        return { error: `invalid` }
    }
}
export const integrityCacheURL = (i: string) => '/' + i
export const enum ResourceType { js, binary }
export const getResourceType = (r: Response): ResourceType => {
    const ct = r.headers.get("Content-Type")
    if (!ct) {
        return ResourceType.binary
    }
}

export const processFile = async (r: Response): Promise<{ error?: string, transformed?: Response }> => {
    const rt = getResourceType(r)
    switch (rt) {
        case ResourceType.js: {

        }
        case ResourceType.binary:
            return {}
        default:
            return { error: `resource type ${rt} not implemented` }
    }
}
export const SRI_prefix_to_algo = { 'sha256': 'SHA-256', 'sha384': 'SHA-384', 'sha512': 'SHA-512' }
export const toSRI = async (ab: ArrayBuffer, sriPrefix: string) => {
    const sha = await crypto.subtle.digest(SRI_prefix_to_algo[sriPrefix], ab)
    return sriPrefix + '-' + toBase64(sha)
}
export const toSRI_sha256 = async (ab: ArrayBuffer) => await toSRI(ab, 'sha256')
function toBase64(bytes: ArrayBuffer) {
    const binString = Array.from(new Uint8Array(bytes), (byte: number) =>
        String.fromCodePoint(byte),
    ).join("");
    return btoa(binString);
}
function fromBase64(base64) {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
}
