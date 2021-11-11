export type PageConfig = { title: string, docs: string, preconnects: string[], isDev: boolean }
export type PlatformManifest = { [k: string]: { fileURL?: URL, path?: string, deps?: string[], content?: Buffer, ct: string } }
const apiVersion = 1
const indexHtml = (pageConfig:PageConfig, base: string, scripts: string[], man: PlatformManifest, embedData) => {
    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${pageConfig.title}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="apple-touch-icon" href="${man['apple-touch-icon'].path}">
          <link rel="icon" href="${man['favicon'].path}">
          ${base ? `<base href="${base}">` : ''}
          ${embedData ? `<meta name="props" content="${JSON.stringify(embedData)}" />` : ''}
          ${pageConfig.preconnects.map(x => `<link rel="preconnect" href="${x}" crossorigin>`).join('')}
          ${scripts.map(x => `<script defer type="module" src="${man[x].path}"></script>`).join('')}
        </head>
        <body>
        <noscript>Javascript is required <a href="${pageConfig.docs}">See documentation</a></noscript>
        <script>if('serviceWorker' in navigator){
            navigator.serviceWorker.addEventListener('message', ev => {
                if ((ev.data.apiVersion && ev.data.apiVersion > ${apiVersion}) || ev.data.force) {
                    location.reload()
                }
            })
            navigator.serviceWorker.register('/sw.js')
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
export { apiVersion, indexHtml, indexHtmlHeaders }