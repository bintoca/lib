import {
    ParseFilesError, getSubstituteId, getSubstituteIdCore, parseFile, parseFiles, createLookup, encodePackage, encodeFile, decodePackage, decodeFile,
    lookupExists, getPackageBreakIndex, FileType, Update, packageBase, packageCJSPath, getCJSFiles
} from '@bintoca/package/server'
import {
    FileURLSystem
} from '@bintoca/package'
import { readFileSync } from 'fs'
const TD = new TextDecoder()
const TE = new TextEncoder()

test.each([[0, '$AAAAA'], [1, '$BAAAA'], [63, '$$AAAA'], [64, '$ABAAA'], [4095, '$$$AAA'], [4096, '$AABAA'], [262143, '$$$$AA'], [262144, '$AAABA'], [16777215, '$$$$$A'], [16777216, '$AAAAB'], [1073741823, '$$$$$$']])('getSubstitueIdCore(%i)', (a, e) => {
    expect(getSubstituteIdCore(a, 5, '$')).toEqual(e)
})
test.each([[{}, '$AAAAA'], [{ '$AAAAA': 1, '$BAAAA': 1, }, '$CAAAA']])('getSubstitueId', (a, e) => {
    expect(getSubstituteId(a, 5, '$')).toEqual(e)
})
test('parseFiles', async () => {
    const files: Update = { 'dist/index.js': { action: 'add', buffer: readFileSync(new URL('./pack1/dist/index.js', import.meta.url) as any) } }
    const r = parseFiles(files)
    expect(r.files['dist/index.js']).toEqual(new Map<number, any>([[1, FileType.js], [2, 2291],
    [4, ['Math', 'Number', 'd2']], [7, "$BAAAA"], [8, "$BAA"],
    [5, [new Map<number, any>([[1, "import * as $eeeee from "], [2, 'es😀d']]), new Map<number, any>([[1, "import { $AAAAA } from "], [2, 'a1']]), new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])]],
    [6, [new Map<number, any>([[1, "$AAA"]]), new Map<number, any>([[1, "f"]]), new Map<number, any>([[1, "c"]]), new Map<number, any>([[2, "export { ar }"]]), new Map<number, any>([[2, "export { c1 } from "], [3, 'c1']]),
    new Map<number, any>([[2, "export * from "], [3, 'd1']]), new Map<number, any>([[2, "export * as d2 from "], [3, 'd2']]), new Map<number, any>([[2, "export * as d3 from "], [3, 'd3']]), new Map<number, any>([[4, "$AAAAAAAA"]])]],
    [3, `                               
                           
                       
       const $AAA = this
const ar = () => this
const $ddddd = Number.EPSILON + Number.MAX_SAFE_INTEGER
$BAAAA('ss' + $BAAAA.meta.url)
       function f($vvvvv) {
    (0, $BAA)();
    (0, this.b)();
    return this
}
       class c {
    #$ppppp = this
    #clicked() {
        const h = Math.log(1) + this.#$ppppp + d2
        try { } catch { }
    }
}
             
                       
                  
                        
                        
var $AAAAAAAA= {}
const cc = class { #v = this }
const fe = function () { return this }`]]))
})
test.each([['import a from "/x"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '/x']])],
['import a from "/x/a"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '/x/a']])],
['import a from ".b"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '.b']])],
['import a from "..b"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '..b']])],
['import a from "b"', new Map<number, any>([[1, FileType.js]])],
['import a from "./b"', new Map<number, any>([[1, FileType.js]])],
['import a from "../b"', new Map<number, any>([[1, FileType.js]])],
['import a from "../../b"', new Map<number, any>([[1, FileType.js]])],
['export {a} from "../../b"', new Map<number, any>([[1, FileType.js]])],
['import a from "../../../b"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '../../../b']])],
])('parseFile', (a, e) => {
    const m = parseFile('lib/lib/a.js', Buffer.from(a))
    if (m.get(1) == FileType.error) {
        expect(m).toEqual(e)
    }
    else {
        expect(m.get(1)).toBe(e.get(1))
    }
})
const freeGlobals = createLookup(new Set(['Free']))
const controlledGlobals = createLookup(new Set(['Math']))
const parentURL = new URL('file:///a.mjs')
const files = { 'file:///a.mjs': 'const a=1', 'file:///x/p/b.cjs': 'exports.hey=1' }
const fs: FileURLSystem = {
    exists: async (u: URL) => files[u.href] !== undefined,
    read: async (u: URL, decoded: boolean) => encodeFile(parseFile(u.href, TE.encode(files[u.href]))),
    jsonCache: {}, stateURL: import.meta.url,
    fsSync: {
        exists: (u: URL) => files[u.href] !== undefined,
        read: null, jsonCache: {}
    }, cjsParseCache: {}, initCJS: () => Promise.resolve()
}
test('getCJSFiles', () => {
    expect(getCJSFiles({ 'package.json': { type: 'module' }, 'a.js': 1, 'a.json': 1, 'a.cjs': 1, 'a.txt': 1, 'b/package.json': { type: 'none' }, 'b/a.js': 1, 'c/package.json': { type: 'commonjs' }, 'c/a.js': 1 }))
        .toEqual(['package.json', 'a.json', 'a.cjs', 'b/package.json', 'b/a.js', 'c/package.json', 'c/a.js'])
})
test('decodeFile buffer', async () => {
    const cb = encodeFile(new Map<number, any>([[1, FileType.buffer], [2, new TextEncoder().encode('{"a":2}')]]))
    expect(TD.decode((await decodeFile(cb, freeGlobals, controlledGlobals, parentURL, fs)).data)).toBe('{"a":2}')
})
test('decodeFile buffer cjs json', async () => {
    const cb = encodeFile(new Map<number, any>([[1, FileType.buffer], [2, new TextEncoder().encode('{"a":2}')]]))
    expect(TD.decode((await decodeFile(cb, freeGlobals, controlledGlobals, new URL('file://' + packageCJSPath + '/a.json'), fs)).data))
        .toBe('import{cjsRegister}from\"/x/a/' + testPath + '";cjsRegister({"a":2},"file:///x/pc/a.json");')
})
const testPath = import.meta.url
test('decodeFile cjs', async () => {
    const cb = encodeFile(new Map<number, any>([[1, FileType.js], [2, 50], [3, 'const a = 2;module.exports = require("./b.cjs");']]))
    expect(TD.decode((await decodeFile(cb, freeGlobals, controlledGlobals, new URL('file://' + packageBase + 'a.cjs'), fs)).data))
        .toBe('import "/x/pc";import{cjsExec}from"/x/a/' + testPath + '";const m=cjsExec("file:///x/p/a.cjs");export default m.exports;export const {hey}=m.exports;')
})
test.each([['const w = 4;          const r=5;',
    'import{cjsRegister as s3jY8Nt5dO3xokuh194BF}from"/x/a/' + testPath + '";s3jY8Nt5dO3xokuh194BF((function (module,exports,require,__dirname,__filename,s3jY8Nt5dO3xokuh194BF){const w = 4;          const r=5;}),"file:///a.cjs");'
    , new Map<number, any>([[1, FileType.js], [2, 50], [3, 'const w = 4;          const r=5;']])],
['const w = 4;          ImporTTHISconst r=5;EvAL\nimport Math from"/x/g/Math.js"\nimport define from"/x/u"\nimport $bbbbb from "bxx"\nexport {b0} from "bxx"\nexport {r}\nexport{r}\nexport default $AA\nimport ImporT from"/x/i/file%3A%2F%2F%2Fa.mjs"\nimport EvAL from"/x/u"',
    'import{cjsRegister as s3jY8Nt5dO3xokuh194BF}from"/x/a/' + testPath + '";s3jY8Nt5dO3xokuh194BF((function (module,exports,require,__dirname,__filename,s3jY8Nt5dO3xokuh194BF){const w = 4;          ImporTTHISconst r=5;EvAL}),"file:///a.cjs");\nimport Math from"/x/g/Math.js"\nimport define from"/x/u"\nimport ImporT from"/x/i/file%3A%2F%2F%2Fa.cjs"\nimport EvAL from"/x/u"',
    new Map<number, any>([[1, FileType.js], [2, 50],
    [3, 'const w = 4;          ImporTTHISconst r=5;EvAL'],
    [4, ['Math', 'define', 'Free']],
    [5, [new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])]],
    [6, [new Map<number, any>([[2, "export {b0} from "], [3, 'b1']]), new Map<number, any>([[2, "export {r}"]]), new Map<number, any>([[1, "r"]]), new Map<number, any>([[4, "$AA"]])]],
    [7, 'ImporT'], [8, 'EvAL']
    ])]])('decodeFile js', async (a, c, b) => {
        const cb = encodeFile(b)
        expect(TD.decode((await decodeFile(cb, freeGlobals, controlledGlobals, parentURL, fs)).data)).toBe(a)
        expect(TD.decode((await decodeFile(cb, freeGlobals, controlledGlobals, new URL('file:///a.cjs'), fs)).data)).toBe(c)
    })
test('createLookup', () => {
    expect(new Uint8Array(createLookup(new Set(['hey', 'dude'])).buffer)).toEqual(new Uint8Array([0, 0, 0, 2, 100, 0, 0, 12, 104, 0, 0, 17, 4, 100, 117, 100, 101, 3, 104, 101, 121]))
})
const look = createLookup(new Set(['hey', 'dude']))
test.each([[new DataView(new Uint8Array([104, 101, 121]).buffer), true], [new DataView(new Uint8Array([100, 117, 100, 101]).buffer), true],
[new DataView(new Uint8Array([104, 101, 122]).buffer), false], [new DataView(new Uint8Array([104, 101, 121, 120]).buffer), false], [new DataView(new Uint8Array([100, 117, 100, 102]).buffer), false]])('createLookup', (a, e) => {
    expect(lookupExists(look, a, 0, a.byteLength)).toBe(e)
})
const shortString = TD.decode(new Uint8Array(30))
const longString = TD.decode(new Uint8Array(3000))
const repeat = (d, n) => {
    const a = []
    for (let i = 0; i < n; i++) {
        a.push(d)
    }
    return a
}
const sizeEstimate = (chunks, imports, glob) => chunks.map(x => typeof x == 'string' ? TE.encode(x).length : 0)
    .concat(imports.map(x => TE.encode(x.get(1)).length + TE.encode(x.get(2)).length + 50)).concat(glob.map(x => TE.encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0)
const testFile = (chunks, imports, glob) => decodePackage(encodePackage({ files: { 'p.js': new Map<number, any>([[1, FileType.js], [2, sizeEstimate(chunks, imports, glob)], [3, chunks], [4, glob], [5, imports]]) } })).get(1)['p.js']
const bench = (n, f, d) => {
    const c = Date.now()
    for (let i = 0; i < 100000; i++) {
        f(d)
    }
    console.log(n, Date.now() - c)
}
const f = (d) => decodeFile(d, freeGlobals, controlledGlobals, parentURL, fs)
const doBench = () => {
    bench('a', f, testFile([shortString], [], []))
    bench('b', f, testFile([shortString, longString], [], []))
    bench('c', f, testFile([shortString], [], ['Math', 'Number']))
    bench('d', f, testFile([shortString, longString], [], ['Math', 'Number']))
    bench('e', f, testFile(repeat(shortString, 100), [], ['Math', 'Number']))
    bench('f', f, testFile([shortString, longString], [new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']]), new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])], ['Math', 'Number']))
}
//doBench()
test.each([['', -1], ['a', -1], ['/x/x/node_modules/', -1], ['/x/x/node_modules/a', -1], ['/x/x/node_modules/@', -1], ['/x/x/node_modules/@/', -1],
['/x/x/node_modules/a/', '/'], ['/x/x/node_modules/@a/a/', '/'], ['/x/x/node_modules/a/wes', '/wes'], ['/x/x/node_modules/@a/a/wes', '/wes'], ['/x/x/node_modules/cv/node_modules/@a/a/wes', '/wes']])('getPackageBreakIndex(%s)', (a, e) => {
    const index = getPackageBreakIndex(a)
    expect(index === -1 ? index : a.slice(index)).toBe(e)
})