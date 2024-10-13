import { State, defaultConfig, defaultPlatformManifest, initRootsJS, initPlatformManifest, defaultRoutes, build, run } from '@bintoca/sandbox'
import * as readline from 'readline'

const state: State = {
    //readlineInterface: readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'bintoca> ' }),
    config: defaultConfig,
    platformManifest: initPlatformManifest(initRootsJS(defaultPlatformManifest), defaultConfig),
    routes: defaultRoutes,
    log: ((x: { type: string, [k: string]: any }) => {
        console.log(x)
        //state.readlineInterface.prompt()
    })
}
build(state)
run(state)