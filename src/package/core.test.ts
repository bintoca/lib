import {
    ParseFilesError, getSubstituteId, getSubstituteIdCore, parseFile, parseFiles, createLookup, encodePackage, encodeFile, decodeFile,
    lookupExists, FileType, Update, decodeFileToOriginal, setupEncoderState
} from '@bintoca/package/core'
import {
    FileURLSystem
} from '@bintoca/package'
import { readFileSync } from 'fs'
import { setupEncoder } from '@bintoca/cbor/core'
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
test('parseFiles', async () => {
    const files: Update = { 'dist/index.js': { action: 'add', buffer: distIndex } }
    const r = parseFiles(files)
    expect(r['dist/index.js']).toEqual({
        type: FileType.js, value: new Map<number, any>([
        [3, ['Math', 'Number', 'd2', 'eval', 'this']], [4, "$BAAAA"], [5, [187, 201]],
        [2, 
`import * as $eeeee from 'es😀d'
import { $AAAAA } from 'a1'
import $bbbbb from 'b1'
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
export { c1 } from 'c1'
export * from 'd1'
export * as d2 from 'd2'
export * as d3 from "d3"
export default {}
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
])('parseFile(%s)', (a, e) => {
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
test('decodeFile buffer', async () => {
    const cb = encodeFile({ type: FileType.buffer, value: new TextEncoder().encode('{"a":2}') }, encoderState)
    expect(TD.decode((decodeFile(cb, controlledGlobals, parentURL)).data)).toBe('{"a":2}')
})
test.each([['const w = 4;          const r=5;', { type: FileType.js, value: new Map<number, any>([[2, 'const w = 4;          const r=5;']]) }],
['const w = 4;          ImporT;const r=5;\nimport Math from"/x/g/Math.js"\nimport ImporT from"/x/i/file%3A%2F%2F%2Fa.mjs"',
    {
        type: FileType.js, value: new Map<number, any>([
        [2, 'const w = 4;          ImporT;const r=5;'],
        [3, ['Math', 'define', 'Free']],
        [4, 'ImporT'], [5, [2]]
        ])
    }]])('decodeFile js', async (a, b) => {
        const cb = encodeFile(b, encoderState)
        expect(TD.decode((decodeFile(cb, controlledGlobals, parentURL)).data)).toBe(a)
    })
test.each([distIndex])('decodeFileToOriginal', (a) => {
    expect(decodeFileToOriginal(encodeFile(parseFile('a.txt', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(parseFile('a.json', a), encoderState))).toEqual(a)
    expect(decodeFileToOriginal(encodeFile(parseFile('a.wasm', a), encoderState))).toEqual(a)
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
const testFile = (chunks, imports, glob) => encodeFile({ type: FileType.js, value: new Map<number, any>([[2, chunks], [3, glob], [4, imports]]) }, encoderState)
const bench = (n, f, d) => {
    const c = Date.now()
    for (let i = 0; i < 100000; i++) {
        f(d)
    }
    console.log(n, Date.now() - c)
}
const f = (d) => decodeFile(d, controlledGlobals, parentURL)
const doBench = () => {
    bench('a', f, testFile(shortString, [], []))
    bench('b', f, testFile(longString, [], []))
    bench('c', f, testFile(shortString, [], ['Math', 'Number']))
    bench('d', f, testFile(longString, [], ['Math', 'Number']))
}
//doBench()