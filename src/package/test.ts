import {
    ParseFilesError, getSubstituteId, getSubstituteIdCore, parseFile, parseFiles, createLookup, encodePackage, encodeFile, decodeFile,
    lookupExists, getPackageBreakIndex, FileType, Update, packageBase, packageCJSPath, getCJSFiles, ImportExportType, decodeFileToOriginal
} from '@bintoca/package/server'
import {
    FileURLSystem
} from '@bintoca/package'
import { readFileSync } from 'fs'
import { setupEncoder } from '@bintoca/cbor/core'
const TD = new TextDecoder()
const TE = new TextEncoder()
const distIndex = new Uint8Array(readFileSync(new URL('./pack1/dist/index.js', import.meta.url) as any))
const encoderState = setupEncoder({ omitMapTag: true })

test.each([[0, '$AAAAA'], [1, '$BAAAA'], [63, '$$AAAA'], [64, '$ABAAA'], [4095, '$$$AAA'], [4096, '$AABAA'], [262143, '$$$$AA'], [262144, '$AAABA'], [16777215, '$$$$$A'], [16777216, '$AAAAB'], [1073741823, '$$$$$$']])('getSubstitueIdCore(%i)', (a, e) => {
    expect(getSubstituteIdCore(a, 5, '$')).toEqual(e)
})
test.each([[{}, '$AAAAA'], [{ '$AAAAA': 1, '$BAAAA': 1, }, '$CAAAA']])('getSubstitueId', (a, e) => {
    expect(getSubstituteId(a, 5, '$')).toEqual(e)
})
test('parseFiles', async () => {
    const files: Update = { 'dist/index.js': { action: 'add', buffer: distIndex } }
    const r = parseFiles(files)
    expect(r['dist/index.js']).toEqual({
        type: FileType.js, value: new Map<number, any>([[1, 2364],
        [3, ['Math', 'Number', 'd2', 'eval', 'this']], [5, "$BAAAA"], [6, [187, 201]],
        [4, [new Map<number, any>([[1, ImportExportType.regular], [2, 0], [3, "import * as $eeeee from '"], [4, 'es😀d']]), new Map<number, any>([[1, ImportExportType.regular], [2, 32], [3, "import { $AAAAA } from '"], [4, 'a1']]),
        new Map<number, any>([[1, ImportExportType.regular], [2, 60], [3, "import $bbbbb from '"], [4, 'b1']]), new Map<number, any>([[1, ImportExportType.exportName], [2, 84], [3, "$AAA"]]),
        new Map<number, any>([[1, ImportExportType.exportName], [2, 218], [3, "f"]]), new Map<number, any>([[1, ImportExportType.exportName], [2, 300], [3, "c"]]),
        new Map<number, any>([[1, ImportExportType.regular], [2, 437], [3, "export { ar }"]]), new Map<number, any>([[1, ImportExportType.regular], [2, 451], [3, "export { c1 } from '"], [4, 'c1']]),
        new Map<number, any>([[1, ImportExportType.regular], [2, 475], [3, "export * from '"], [4, 'd1']]), new Map<number, any>([[1, ImportExportType.regular], [2, 494], [3, "export * as d2 from '"], [4, 'd2']]),
        new Map<number, any>([[1, ImportExportType.regular], [2, 519], [3, "export * as d3 from \""], [4, 'd3']]), new Map<number, any>([[1, ImportExportType.exportDefault], [2, 544], [3, "$AAAAAAAA"]])]],
        [2, `                               
                           
                       
       const $AAA = this
const ar = () => this
const $ddddd = Number.EPSILON + Number.MAX_SAFE_INTEGER
$BAAAA('ss' + $BAAAA.meta.url)
       function f($vvvvv) {
    (0, eval)();
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
const fe = function () { return this }`]])
    })
})
test.each([['import a from "/x"', { type: FileType.error, value: { type: ParseFilesError.invalidSpecifier, message: '/x' } }],
['import a from "/x/a"', { type: FileType.error, value: { type: ParseFilesError.invalidSpecifier, message: '/x/a' } }],
['import a from ".b"', { type: FileType.error, value: { type: ParseFilesError.invalidSpecifier, message: '.b' } }],
['import a from "..b"', { type: FileType.error, value: { type: ParseFilesError.invalidSpecifier, message: '..b' } }],
['import a from "b"', { type: FileType.js }],
['import a from "./b"', { type: FileType.js }],
['import a from "../b"', { type: FileType.js }],
['import a from "../../b"', { type: FileType.js }],
['export {a} from "../../b"', { type: FileType.js }],
['import a from "../../../b"', { type: FileType.error, value: { type: ParseFilesError.invalidSpecifier, message: '../../../b' } }],
])('parseFile', (a, e) => {
    const m = parseFile('lib/lib/a.js', Buffer.from(a))
    if (m.type == FileType.error) {
        expect(m).toEqual(e)
    }
    else {
        expect(m.type).toBe(e.type)
    }
})
const controlledGlobals = createLookup(new Set(['Math']))
const parentURL = new URL('file:///a.mjs')
const files = { 'file:///a.mjs': 'const a=1', 'file:///x/p/b.cjs': 'exports.hey=1' }
const fs: FileURLSystem = {
    exists: async (u: URL) => files[u.href] !== undefined,
    read: async (u: URL, decoded: boolean) => encodeFile(parseFile(u.href, TE.encode(files[u.href])), encoderState),
    jsonCache: {}, stateURL: import.meta.url,
    conditions: undefined,
    fsSync: {
        exists: (u: URL) => files[u.href] !== undefined,
        read: null, jsonCache: {}, conditions: undefined
    }, cjsParseCache: {}, initCJS: () => Promise.resolve()
}
test('getCJSFiles', () => {
    expect(getCJSFiles({ 'package.json': { type: 'module' }, 'a.js': 1, 'a.json': 1, 'a.cjs': 1, 'a.txt': 1, 'b/package.json': { type: 'none' }, 'b/a.js': 1, 'c/package.json': { type: 'commonjs' }, 'c/a.js': 1 }))
        .toEqual(['package.json', 'a.json', 'a.cjs', 'b/package.json', 'b/a.js', 'c/package.json', 'c/a.js'])
})
test('decodeFile buffer', async () => {
    const cb = encodeFile({ type: FileType.buffer, value: new TextEncoder().encode('{"a":2}') }, encoderState)
    expect(TD.decode((await decodeFile(cb, controlledGlobals, parentURL, fs)).data)).toBe('{"a":2}')
})
test('decodeFile buffer cjs json', async () => {
    const cb = encodeFile({ type: FileType.json, value: new TextEncoder().encode('{"a":2}') }, encoderState)
    expect(TD.decode((await decodeFile(cb, controlledGlobals, new URL('file://' + packageCJSPath + '/a.json'), fs)).data))
        .toBe('import{cjsRegister}from\"/x/a/' + testPath + '";cjsRegister({"a":2},"file:///x/pc/a.json");')
})
const testPath = import.meta.url
test('decodeFile cjs', async () => {
    const cb = encodeFile({ type: FileType.js, value: new Map<number, any>([[1, 50], [2, 'const a = 2;module.exports = require("./b.cjs");']]) }, encoderState)
    expect(TD.decode((await decodeFile(cb, controlledGlobals, new URL('file://' + packageBase + 'a.cjs'), fs)).data))
        .toBe('import "/x/pc";import{cjsExec}from"/x/a/' + testPath + '";const m=cjsExec("file:///x/p/a.cjs");export default m.exports;export const {hey}=m.exports;')
})
test.each([['const w = 4;          const r=5;',
    'import{cjsRegister as s3jY8Nt5dO3xokuh194BF}from"/x/a/' + testPath + '";s3jY8Nt5dO3xokuh194BF((function (module,exports,require,__dirname,__filename,s3jY8Nt5dO3xokuh194BF){const w = 4;          const r=5;}),"file:///a.cjs");'
    , { type: FileType.js, value: new Map<number, any>([[1, 50], [2, 'const w = 4;          const r=5;']]) }],
['const w = 4;          ImporT;const r=5;\nimport Math from"/x/g/Math.js"\nimport $bbbbb from "bxx"\nexport {b0} from "bxx"\nexport {r}\nexport{r}\nexport default $AA\nimport ImporT from"/x/i/file%3A%2F%2F%2Fa.mjs"',
    'import{cjsRegister as s3jY8Nt5dO3xokuh194BF}from"/x/a/' + testPath + '";s3jY8Nt5dO3xokuh194BF((function (module,exports,require,__dirname,__filename,s3jY8Nt5dO3xokuh194BF){const w = 4;          ImporT;const r=5;}),"file:///a.cjs");\nimport Math from"/x/g/Math.js"\nimport ImporT from"/x/i/file%3A%2F%2F%2Fa.cjs"',
    {
        type: FileType.js, value: new Map<number, any>([[1, 50],
        [2, 'const w = 4;          ImporT;const r=5;'],
        [3, ['Math', 'define', 'Free']],
        [4, [new Map<number, any>([[1, ImportExportType.regular], [2, 60], [3, "import $bbbbb from \""], [4, 'b1']]),
        new Map<number, any>([[1, ImportExportType.regular], [2, 60], [3, "export {b0} from \""], [4, 'b1']]), new Map<number, any>([[1, ImportExportType.regular], [2, 60], [3, "export {r}"]]),
        new Map<number, any>([[1, ImportExportType.exportName], [2, 60], [3, "r"]]), new Map<number, any>([[1, ImportExportType.exportDefault], [2, 60], [3, "$AA"]])]],
        [5, 'ImporT'], [6, [2]]
        ])
    }]])('decodeFile js', async (a, c, b) => {
        const cb = encodeFile(b, encoderState)
        expect(TD.decode((await decodeFile(cb, controlledGlobals, parentURL, fs)).data)).toBe(a)
        expect(TD.decode((await decodeFile(cb, controlledGlobals, new URL('file:///a.cjs'), fs)).data)).toBe(c)
    })
test.each([distIndex])('decodeFileToOriginal', (a) => {
    expect(decodeFileToOriginal(encodeFile(parseFile('a.txt', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(parseFile('a.json', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(parseFile('a.wasm', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(parseFile('a.cbor', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(parseFile('a.js', a), encoderState))).toEqual(TD.decode(a))
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
const sizeEstimate = (body, importExports, glob) => importExports.map(x => TE.encode(x.get(3) || '').length + TE.encode(x.get(4) || '').length + 100).concat(glob.map(x => TE.encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0) + TE.encode(body).length
const testFile = (chunks, imports, glob) => encodeFile({ type: FileType.js, value: new Map<number, any>([[1, sizeEstimate(chunks, imports, glob)], [2, chunks], [3, glob], [4, imports]]) }, encoderState)
const bench = (n, f, d) => {
    const c = Date.now()
    for (let i = 0; i < 100000; i++) {
        f(d)
    }
    console.log(n, Date.now() - c)
}
const f = (d) => decodeFile(d, controlledGlobals, parentURL, fs)
const doBench = () => {
    bench('a', f, testFile(shortString, [], []))
    bench('b', f, testFile(longString, [], []))
    bench('c', f, testFile(shortString, [], ['Math', 'Number']))
    bench('d', f, testFile(longString, [], ['Math', 'Number']))
    bench('f', f, testFile(longString, [new Map<number, any>([[1, ImportExportType.regular], [2, 60], [3, "import $bbbbb from \""], [4, 'b1']]), new Map<number, any>([[1, ImportExportType.regular], [2, 60], [3, "import $bbbbb from \""], [4, 'b1']])], ['Math', 'Number']))
}
//doBench()
test.each([['', -1], ['a', -1], ['/x/x/node_modules/', -1], ['/x/x/node_modules/a', -1], ['/x/x/node_modules/@', -1], ['/x/x/node_modules/@/', -1],
['/x/x/node_modules/a/', '/'], ['/x/x/node_modules/@a/a/', '/'], ['/x/x/node_modules/a/wes', '/wes'], ['/x/x/node_modules/@a/a/wes', '/wes'], ['/x/x/node_modules/cv/node_modules/@a/a/wes', '/wes']])('getPackageBreakIndex(%s)', (a, e) => {
    const index = getPackageBreakIndex(a)
    expect(index === -1 ? index : a.slice(index)).toBe(e)
})