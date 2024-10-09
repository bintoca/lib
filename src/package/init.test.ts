import { Script } from 'vm'
import { readFileSync } from 'fs'
import jsdom from 'jsdom'
const { JSDOM } = jsdom

const lines = (path: string): string[] => {
    return readFileSync(path, 'utf8').split('\n').filter(x => !x.startsWith('import ') && !x.startsWith('export '))
}
test('dom', async () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { runScripts: "outside-only" });
    dom.window.TextDecoder = TextDecoder
    dom.window.fetch = (input: RequestInfo, init?: RequestInit): Promise<any> => Promise.resolve({ json: () => Promise.resolve(JSON.stringify({ src: 'src.js' })), arrayBuffer: () => Promise.resolve(readFileSync('./src/dev/test1/lib/leb128.wasm')) })
    dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillRect: () => { } } } as any
    dom.window.Response = class { constructor(b) { this['b'] = b }; arrayBuffer() { return Promise.resolve(this['b']) } }
    const script = new Script(
        ["'use strict';const {window, document, location, self} = (function(){"]
            .concat(lines('./packages/package/primordial.js'))
            .concat(['const { ObjectCreate, _Proxy, _Reflect, _WeakMap, StringEndsWith, _WebAssembly } = primordials'])
            .concat(lines('./packages/package/init.js').filter(x => !x.startsWith('const { _Set,'))
                .map(x => x.includes('delete ob[k]') ? "if (typeof k == 'string' && !k.startsWith('_') && k != 'document' && k != 'location' && k != 'customElements') {delete ob[k]}" : x)
                .map(x => x.includes('if (allowedNodeProps.has(property)) {') ? "if(typeof property == 'symbol'){return target[property]};if (allowedNodeProps.has(property)) {" : x))
            .concat(['gt.bintocaFetchTest = fetchPromise', 'return {window:selfProxy, document:documentProxy, location:locationProxy, self:selfProxy} })();'])
            .concat(lines('./src/dev/test1/lib/t1.js'))
            .join('\n'));
    const vmContext = dom.getInternalVMContext();
    script.runInContext(vmContext);
    await dom.window['bintocaFetchTest']
    const r = await dom.window['bintocaTest']
    expect(dom.window['bintocaNonConfigurable']).toEqual(['window', 'top', 'document', 'location'])
    expect(r.bad).toEqual([])
    expect(r.good.length).toBe(21)
    expect(dom.window.document.head.firstChild != null).toBe(true)
});