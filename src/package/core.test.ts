import { bufferSourceToDataView } from '@bintoca/cbor/core'
import {
    ParseFilesError, getSubstituteId, getSubstituteIdCore, parseFile, parseFiles, createLookup, encodeFile, decodeFile,
    lookupExists, FileType, FileBundle, decodeFileToOriginal, setupEncoderState, FileParseJS, FileParseJSON, FileParse, validatePackageJSON, FileParseBuffer, FileParseError, validateSourceMap, validateExternalDebugInfo
} from '@bintoca/package/core'
import { decodeLEB128_U32, parseWasm } from '@bintoca/package/primordial'
import { readFileSync } from 'fs'
import wabt from 'wabt'
const TD = new TextDecoder()
const TE = new TextEncoder()
const distIndex = new Uint8Array(readFileSync(new URL('./pack1/dist/index.js', import.meta.url) as any))
const encoderState = setupEncoderState()

test.each([[0, '$AAAAA'], [1, '$BAAAA'], [63, '$$AAAA'], [64, '$ABAAA'], [4095, '$$$AAA'], [4096, '$AABAA'], [262143, '$$$$AA'], [262144, '$AAABA'], [16777215, '$$$$$A'], [16777216, '$AAAAB'], [1073741823, '$$$$$$']])('getSubstitueIdCore(%i)', (a, e) => {
    expect(getSubstituteIdCore(a, 5, '$')).toEqual(e)
})
test.each([[{}, '$AAAAA'], [{ '$AAAAA': 1, '$BAAAA': 1, }, '$CAAAA']])('getSubstitueId', (a, e) => {
    expect(getSubstituteId(a, 5, '$')).toEqual(e)
})
test('parseFiles', () => {
    const files: FileBundle = { 'dist/index.js': { action: 'add', buffer: distIndex } }
    const r = parseFiles(files)
    expect(r['dist/index.js']).toEqual({
        type: FileType.js, value: distIndex, globals: ['Math', 'Number', 'd2', 'eval', 'this'], importSubstitute: "$BAAAA", importSubstituteOffsets: [193, 207], importSpecifiers: ["./es😀d", "./a1", "./b1", "./c1", "./d1", "./d2", "./d3"],
        sourceMappingURLs: ['a.js.map', 'b.js.map'],
        body: `import * as $eeeee from './es😀d'
import { $AAAAA } from './a1'
import $bbbbb from './b1'
export const $AAA = this
const ar = () => this
const $ddddd = Number.EPSILON + Number.MAX_SAFE_INTEGER
$BAAAA('ss' + $BAAAA.meta.url)
export function f($vvvvv) {
    (0, eval)();
    (0, this.b)();
    return this
}
export class c {
    #$ppppp = this
    #clicked() {
        const h = Math.log(1) + this.#$ppppp + d2
        try { } catch { }
    }
}
export { ar }
export { c1 } from './c1'
export * from './d1'
export * as d2 from './d2'
export * as d3 from "./d3"
export default {}
const cc = class { #v = this }
const fe = function () { return this }
//# sourceMappingURL=a.js.map x
//@ sourceMappingURL=b.js.map x`
    })
})
test.each([['import a from "/x"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '/x' }],
['import a from "/x/a"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '/x/a' }],
['import a from ".b"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '.b' }],
['import a from "..b"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '..b' }],
['import a from "b"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: 'b' }],
['import a from "https://a.com"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: 'https://a.com' }],
['import a from "./b"', { type: FileType.js }],
['import a from "../b"', { type: FileType.js }],
['import a from "../../b"', { type: FileType.js }],
['export {a} from "../../b"//# sourceMappingURL=../../c', { type: FileType.js }],
['//# sourceMappingURL=../../../b', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '../../../b' }],
['//# sourceMappingURL=file:///b', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: 'file:///b' }],
['import a from "../../../b"', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '../../../b' }],
])('parseFile(%s)', (a, e: FileParse) => {
    const filename = 'lib/lib/a.js'
    const m = parseFile(FileType.js, filename, Buffer.from(a))
    if (m.type == FileType.error) {
        (e as FileParseError).filename = filename
        expect(m).toEqual(e)
    }
    else {
        expect(m.type).toBe(e.type)
    }
})
test.each([['@media', { type: FileType.error, error: ParseFilesError.syntax, message: '@ rules or characters not supported' }],
['calc()', { type: FileType.error, error: ParseFilesError.syntax, message: 'functions or () blocks not supported' }],
['/* sourceMappingURL=../../../b */', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: '../../../b' }],
['/* sourceMappingURL=file:///b */', { type: FileType.error, error: ParseFilesError.invalidSpecifier, message: 'file:///b' }],
['a{border: salmon;}', { type: FileType.css }],
])('parseFile_css(%s)', (a, e: FileParse) => {
    const filename = 'lib/lib/a.css'
    const m = parseFile(FileType.css, filename, Buffer.from(a))
    if (m.type == FileType.error) {
        (e as FileParseError).filename = filename
        expect(m).toEqual(e)
    }
    else {
        expect(m.type).toBe(e.type)
    }
})
test.each([{ type: 'module', main: './xx.js' }, { type: 'module', main: 'xx.js' }])('validatePackageJSON', (p) => {
    const x = { 'xx.js': { type: FileType.js } as FileParseJS, 'package.json': { type: FileType.json, value: null, obj: p } as FileParseJSON }
    const man = { files: {}, main: null }
    const err = []
    validatePackageJSON(x, man, err)
    expect(man.main).toBe('xx.js')
})
test.each([[{}, 'package type must be module'], [{ type: 'module' }, 'package main required'], [{ type: 'module', main: '../' }, 'package main invalid'], [{ type: 'module', main: 'http://x/y' }, 'package main invalid'],
[{ type: 'module', main: 'index.js' }, 'package main not found'], [{ type: 'module', main: './index.js' }, 'package main not found'], [{ type: 'module', main: 'index.ts' }, 'package main must be js']])('validatePackageJSON_Error', (p, m) => {
    const x = { 'index.ts': { type: FileType.buffer } as FileParseBuffer, 'package.json': { type: FileType.json, value: null, obj: p } as FileParseJSON }
    const man = { files: {}, main: null }
    const err = []
    validatePackageJSON(x, man, err)
    expect(err[0]).toEqual({ type: FileType.error, error: ParseFilesError.packageJSON, message: m, filename: 'package.json' })
    const err1 = []
    validatePackageJSON({}, man, err1)
    expect(err1[0]).toEqual({ type: FileType.error, error: ParseFilesError.packageJSON, message: 'package.json not found', filename: 'package.json' })
})
test('validateSourceMap', () => {
    const x = {
        'a.map': { type: FileType.buffer, value: TE.encode(JSON.stringify({ version: 3, sources: ['1.ts'] })) } as FileParseBuffer,
        '1.ts': { type: FileType.buffer, value: TE.encode('hello') } as FileParseBuffer
    }
    const man = { files: {}, main: null }
    for (let k in x) {
        man.files[k] = {}
    }
    const err = []
    validateSourceMap('a.map', x, man, err)
    expect(err.length).toBe(0)
    expect(man.files).toEqual({ 'a.map': { debug: true }, '1.ts': { debug: true } })
})
test.each([[{}, 'sourceMap version must be 3'], [{ version: 3, sections: [] }, 'sourceMap sections not supported'], [{ version: 3, sourcesContent: ['sourceMappingURL=as'] }, 'sourceMappingURL found in sourcesContent'],
[{ version: 3, sourceRoot: {} }, 'malformed sources or sourceRoot'], [{ version: 3, sources: {} }, 'malformed sources or sourceRoot'], [{ version: 3, sources: ['../../x.ts'] }, '../../x.ts'],
[{ version: 3, sources: ['x.ts'] }, 'sourceMap source not found x.ts'], [{ version: 3, sources: ['y.ts'] }, 'sourceMappingURL found in y.ts']
])('validateSourceMap_Error(%s,%s)', (p, m) => {
    const x = { 'a.map': { type: FileType.buffer, value: TE.encode(JSON.stringify(p)) } as FileParseBuffer, 'y.ts': { type: FileType.buffer, value: TE.encode('sourceMappingURL=qq') } as FileParseBuffer }
    const man = { files: {}, main: null }
    for (let k in x) {
        man.files[k] = {}
    }
    const err: FileParseError[] = []
    validateSourceMap('a.map', x, man, err)
    expect(err[0].message).toEqual(m)
    const err1: FileParseError[] = []
    validateSourceMap('a.map', {}, man, err1)
    expect(err1[0].message).toEqual('sourceMap not found')
})
test('validateExternalDebugInfo', () => {
    const x = {
        'a.map': { type: FileType.buffer, value: Buffer.from('0061736d01000000', 'hex') } as FileParseBuffer
    }
    const man = { files: {}, main: null }
    for (let k in x) {
        man.files[k] = {}
    }
    const err = []
    validateExternalDebugInfo('a.map', x, man, err)
    expect(err.length).toBe(0)
    expect(man.files).toEqual({ 'a.map': { debug: true } })
})
test.each([['0061736d01000000001510736f757263654d617070696e6755524c032e2f73', 'sourceMappingURL found in external file'], ['0061736d0100000000181365787465726e616c5f64656275675f696e666f032e2f65', 'external_debug_info found in external file']
])('validateExternalDebugInfo_Error(%s,%s)', (b, m) => {
    const x = { 'a.map': { type: FileType.buffer, value: Buffer.from(b, 'hex') } as FileParseBuffer }
    const man = { files: {}, main: null }
    for (let k in x) {
        man.files[k] = {}
    }
    const err: FileParseError[] = []
    validateExternalDebugInfo('a.map', x, man, err)
    expect(err[0].message).toEqual(m)
    const err1: FileParseError[] = []
    validateExternalDebugInfo('a.map', {}, man, err1)
    expect(err1[0].message).toEqual('external_debug_info not found')
})
const controlledGlobals = createLookup(new Set(['Math']))
const parentURL = new URL('file:///a.mjs')
test('decodeFile buffer', async () => {
    const cb = encodeFile({ type: FileType.buffer, value: new TextEncoder().encode('{"a":2}') }, encoderState)
    expect(TD.decode((decodeFile(cb, controlledGlobals, parentURL)).data)).toBe('{"a":2}')
})
test.each([['const w = 4;          const r=5;', { type: FileType.js, value: null, body: 'const w = 4;          const r=5;', globals: null, importSubstitute: null, importSubstituteOffsets: null }],
['const w = 4;          ImporT;const r=5;\nimport Math from"/x/g/Math.js"\nimport ImporT from"/x/i/file%3A%2F%2F%2Fa.mjs"',
    { type: FileType.js, value: null, body: 'const w = 4;          ImporT;const r=5;', globals: ['Math', 'define', 'Free'], importSubstitute: 'ImporT', importSubstituteOffsets: [2] }]])
    ('decodeFile js', async (a, b) => {
        const cb = encodeFile(b as FileParseJS, encoderState)
        expect(TD.decode((decodeFile(cb, controlledGlobals, parentURL)).data)).toBe(a)
    })
test.each([distIndex])('decodeFileToOriginal', async (a) => {
    expect(decodeFileToOriginal(encodeFile(await parseFile(FileType.buffer, 'a.txt', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(await parseFile(FileType.js, 'a.js', a), encoderState))).toEqual(TD.decode(a))
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
const testFile = (body, globals) => encodeFile({ type: FileType.js, value: null, body, globals, importSubstitute: null, importSubstituteOffsets: null, importSpecifiers: null, sourceMappingURLs: null }, encoderState)
const bench = (n, f, d) => {
    const c = Date.now()
    for (let i = 0; i < 100000; i++) {
        f(d)
    }
    console.log(n, Date.now() - c)
}
const f = (d) => decodeFile(d, controlledGlobals, parentURL)
const doBench = () => {
    bench('a', f, testFile(shortString, []))
    bench('b', f, testFile(longString, []))
    bench('c', f, testFile(shortString, ['Math', 'Number']))
    bench('d', f, testFile(longString, ['Math', 'Number']))
}
//doBench()
test.each([['85', -1], ['808080808080', -1], ['05', 5], ['8500', 5], ['858000', 5], ['e58e26', 624485], ['808080fd07', 2141192192]])('decodeLEB128_U32(%s,%i)', (b, n) => {
    const dv = bufferSourceToDataView(Buffer.from(b, 'hex'))
    const state = { position: 0 }
    expect(decodeLEB128_U32(dv, state, -1)).toBe(n)
})
test.each([['85', 'Offset is outside the bounds of the DataView'], ['0061736d0100000001', 'invalid leb128 u32'], ['0061736d010000000005046e616d650003026565', 'invalid wasm custom section "ee"'],
['0061736d010000000d01', 'invalid section id 13'], ['0061736d01000000070102070102', 'repeated section id 7'], ['0061736d01000000020300', 'invalid end of section 2'], ['0061736d0100000002030104613a2f2f', 'invalid import specifier "a://"'],
['0061736d01000000001510736f757263654d617070696e6755524c04613a2f2f', 'invalid sourceMappingURL "a://"'], ['0061736d0100000000181365787465726e616c5f64656275675f696e666f04613a2f2f', 'invalid external_debug_info "a://"']
])('parseWasm_Error(%s,%s)', (b, n) => {
    const dv = bufferSourceToDataView(Buffer.from(b, 'hex'))
    expect(() => parseWasm('', dv)).toThrow(n)
})
test.each([['0061736d010000000005046e616d65001510736f757263654d617070696e6755524c032e2f7300181365787465726e616c5f64656275675f696e666f032e2f65',
    { customNames: ['name', 'sourceMappingURL', 'external_debug_info'], external_debug_infoURLs: ['./e'], importSpecifiers: [], sourceMappingURLs: ['./s'] }]
])('parseWasm(%s)', (b, n) => {
    //console.log(['name', 'sourceMappingURL', './s', 'external_debug_info', './e'].map(x => Buffer.from([x.length]).toString('hex') + Buffer.from(TE.encode(x)).toString('hex')))
    const dv = bufferSourceToDataView(Buffer.from(b, 'hex'))
    expect(parseWasm('', dv)).toEqual(n)
})
test.each([['(module(import "tab" "table" (table 1 anyfunc))(import "fu" "f" (func))(import "glo" "g" (global i32))(import "mem" "" (memory 1)))',
    { customNames: [], external_debug_infoURLs: [], importSpecifiers: ['tab', 'fu', 'glo', 'mem'], sourceMappingURLs: [] }]
])('parseWasm_wat(%s)', async (b, n) => {
    const w = await wabt()
    const m = w.parseWat('a.wat', b)
    const wasm = m.toBinary({}).buffer
    expect(parseWasm('', wasm)).toEqual(n)
})