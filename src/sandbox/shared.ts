export type PageConfig = { title: string, docs: string, isDev: boolean }
export type PlatformManifestItem = { fileURL?: URL, path?: string, deps?: string[], content?: Buffer, extension?: string, ct: string, module?: string, hash?: string, headers?: { [header: string]: number | string }, htmlOptions?: HtmlOptions }
export type PlatformManifest = { [k: string]: PlatformManifestItem }
export type HtmlOptions = { base?: string, scripts?: string[], embedData?, preconnects?: string[], stylesheets?: string[] }
export type HtmlRoutes = { [k: string]: HtmlOptions }
const apiVersion = 1
const indexHtml = (pageConfig: PageConfig, manifest: PlatformManifest, op: HtmlOptions) => {
    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${pageConfig.title}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="apple-touch-icon" href="${manifest['apple-touch-icon'].path}">
          <link rel="icon" href="${manifest['favicon'].path}">
          ${op.base ? `<base href="${op.base}">` : ''}
          ${op.embedData ? `<meta name="props" content="${JSON.stringify(op.embedData)}" />` : ''}
          ${(op.preconnects || []).map(x => `<link rel="preconnect" href="${x}" crossorigin>`).join('')}
          ${(op.scripts || []).map(x => `<script defer type="module" src="${manifest[x].path}"></script>`).join('')}
          ${(op.stylesheets || []).map(x => `<link href="${manifest[x].path}" rel="stylesheet">`).join('')}
        </head>
        <body>
        <noscript>Javascript is required <a href="${pageConfig.docs}">See documentation</a></noscript>
        <script>if('serviceWorker' in navigator){
            if(${manifest['sw'] ? 1 : 0}){
            navigator.serviceWorker.addEventListener('message', ev => {
                if ((ev.data.apiVersion && ev.data.apiVersion > ${apiVersion}) || ev.data.force) {
                    location.reload()
                }
            })
            navigator.serviceWorker.register('${manifest['sw'] ? manifest['sw'].path : ''}')
        }
        }else{document.write('This browser is not supported <a href="${pageConfig.docs}">See documentation</a>')}</script>
        </body>
      </html>`
}
const indexHtmlHeaders = () => {
    return {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'DENY',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
    }
}
const matchHtmlRoute = (pathname: string, routes: HtmlRoutes): HtmlOptions => {
    for (let k in routes) {
        if (k.endsWith('*')) {
            const v = k.slice(-1)
            if (v == pathname || pathname.startsWith(v)) {
                return routes[k]
            }
        }
        else {
            if (k == pathname) {
                return routes[k]
            }
        }
    }
}
export { apiVersion, indexHtml, indexHtmlHeaders, matchHtmlRoute }