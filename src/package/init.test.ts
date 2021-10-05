import { Script } from 'vm'
import { readFileSync } from 'fs'
import jsdom from 'jsdom'
const { JSDOM } = jsdom

const lines = (path: string): string[] => {
    return readFileSync(path, 'utf8').split('\n').filter(x => !x.startsWith('import ') && !x.startsWith('export '))
}
test('dom', async () => {
    const dom = new JSDOM(``, { runScripts: "outside-only" });
    dom.window.TextDecoder = TextDecoder
    const script = new Script(
        ["'use strict';const {window, document, location} = (function(){"]
            .concat(lines('./packages/package/primordial.js'))
            .concat(lines('./packages/package/init.js'))
            .concat(['return {window:selfProxy, document:documentProxy, location:locationProxy} })();'])
            .concat(lines('./src/dev/test1/lib/t1.js'))
            .join('\n'));
    const vmContext = dom.getInternalVMContext();
    script.runInContext(vmContext);
    const r = await dom.window['bintocaTest']
    expect(r.bad).toEqual([])
    expect(r.good.length).toBe(1)
});