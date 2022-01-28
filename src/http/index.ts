import { init, State, initPlatformManifest, defaultPlatformManifest, defaultRoutes, defaultConfig, initRootsJS } from '@bintoca/http/server'
import * as readline from 'readline'
const state: State = {
    readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'bintoca> ' }), config: defaultConfig,
    platformManifest: initPlatformManifest(initRootsJS(defaultPlatformManifest)), routes: defaultRoutes, log: ((x: { type: string, [k: string]: any }) => {
        console.log(x)
        state.readlineInterface.prompt()
    })
}
init(state)