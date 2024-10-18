export type AppPath = { path: string, url?: string, integrity?: string, text?: string, base64?: string, contentType?: string }
export type AppManifest = { paths: AppPath[] }
const cacheName = 'cache1'
const TE = new TextEncoder()

export const install = async (m: AppManifest): Promise<{ error?: string }> => {
    if (!Array.isArray(m.paths)) {
        return { error: 'invalid paths' }
    }
    const cache = await caches.open(cacheName)
    for (let i = 0; i < m.paths.length; i++) {
        const p = m.paths[i]
        if (!p.path) {
            return { error: `path index ${i} missing path` }
        }
        const gr = await getResponse(p, cache)
        if (gr.error) {
            return { error: `path index ${i} ${gr.error}` }
        }
        const v = await processFile(gr.response)
        if (v.error) {
            return { error: `path index ${i} ${v.error}` }
        }
        if (v.transformed) {
            await cache.put(integrityCacheURL(await toSRI_sha256(await v.transformed.arrayBuffer())), v.transformed)
        }
        if (gr.fetched) {
            await cache.put(integrityCacheURL(await toSRI_sha256(await gr.response.arrayBuffer())), gr.response)
        }
    }
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
        const sha = await toSRI_sha256(ab)
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
export const simpleContentTypes = new Set([null, '', 'application/octet-stream'])
export const processFile = async (r: Response): Promise<{ error?: string, transformed?: Response }> => {
    const ct = r.headers.get("Content-Type")
    switch (ct) {
        case 'text/css': {

        }
        default:
            if (simpleContentTypes.has(ct)) {
                return {}
            }
            return { error: `content type ${ct} not implemented` }
    }
}
export const toSRI_sha256 = async (ab: ArrayBuffer) => {
    const sha256 = await crypto.subtle.digest("SHA-256", ab)
    return 'sha256-' + toBase64(sha256)
}
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
