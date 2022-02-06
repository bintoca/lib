import { init, State, initPlatformManifest, defaultPlatformManifest, defaultRoutes, defaultConfig, initRootsJS, initInline, serviceWorkerReplace } from '@bintoca/http/server'
import * as readline from 'readline'
const useServiceWorker = false //true
if (useServiceWorker) {
    defaultPlatformManifest['sw'] = { ct: 'text/javascript', module: '@bintoca/http/sw', path: '/sw.js' }
}
const state: State = {
    readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'bintoca> ' }), config: defaultConfig,
    platformManifest: initPlatformManifest(initRootsJS(defaultPlatformManifest)), routes: defaultRoutes, log: ((x: { type: string, [k: string]: any }) => {
        console.log(x)
        state.readlineInterface.prompt()
    })
}
if (useServiceWorker) {
    state.config.port = 3050
    initInline('sw', state.platformManifest, serviceWorkerReplace(state.platformManifest, state.config.pageConfig, state.routes))
}
init(state)