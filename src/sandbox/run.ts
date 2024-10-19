import { State, defaultConfig, defaultPlatformManifest, initRootsJS, initPlatformManifest, defaultRoutes, build, run, outURL } from '@bintoca/sandbox'
import * as readline from 'readline'
import * as fs from 'fs'

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
//fs.copyFileSync(new URL('./wrap.html', import.meta.url), new URL('./wrap.html', outURL(defaultConfig)))
run(state)