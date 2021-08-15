import { ChunkType, FileType, encode, decodePackage, decodeFile, createLookup, exists } from '@bintoca/loader'
import { DecoderState } from '@bintoca/cbor/core'

const importResolve = (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number): number => {
    u[len++] = 98
    u[len++] = 120
    u[len++] = 120
    return 3
}
const freeGlobals = createLookup(['Free'])
const controlledGlobals = createLookup(['Math'])
test('buffer', () => {
    const cb = encode({ files: { 'p.json': new Map<number, any>([[1, FileType.buffer], [2, new TextEncoder().encode('{"a":2}')]]) } })
    const d = decodePackage(cb)
    expect(new TextDecoder().decode(decodeFile(d.get(1)['p.json'], freeGlobals, controlledGlobals, importResolve))).toBe('{"a":2}')
})
test.each([['const w = 4;          const r=5;', new Map<number, any>([[1, FileType.js], [2, 500], [3, ['const w = 4;', new Map<number, any>([[1, ChunkType.Placeholder], [2, 10]]), 'const r=5;']]])],
['const w = 4;          ImporTTHISconst r=5;\nimport Math from"/x/g/Math"\nimport Number from"/x/u"\nimport $bbbbb from "bxx"\nimport ImporT from"/x/i"\nimport THIS from"/x/t"', new Map<number, any>([[1, FileType.js], [2, 500], [6, 'ImporT'], [7, 'THIS'],
[3, ['const w = 4;', new Map<number, any>([[1, ChunkType.Placeholder], [2, 10]]), new Map<number, any>([[1, ChunkType.Import]]), new Map<number, any>([[1, ChunkType.This]]), 'const r=5;']],
[4, ['Math', 'Number', 'Free']],
[5, [new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])]]
])]])('js', (a, b) => {
    const cb = encode({ files: { 'p.js': b } })
    const d = decodePackage(cb)
    expect(new TextDecoder().decode(decodeFile(d.get(1)['p.js'], freeGlobals, controlledGlobals, importResolve))).toBe(a)
})
test('createLookup', () => {
    expect(new Uint8Array(createLookup(['hey', 'dude']).buffer)).toEqual(new Uint8Array([0, 0, 0, 2, 100, 0, 0, 12, 104, 0, 0, 17, 4, 100, 117, 100, 101, 3, 104, 101, 121]))
})
const look = createLookup(['hey', 'dude'])
test.each([[new DataView(new Uint8Array([104, 101, 121]).buffer), true], [new DataView(new Uint8Array([100, 117, 100, 101]).buffer), true],
[new DataView(new Uint8Array([104, 101, 122]).buffer), false], [new DataView(new Uint8Array([104, 101, 121, 120]).buffer), false],[new DataView(new Uint8Array([100, 117, 100, 102]).buffer), false]])('createLookup', (a, e) => {
    expect(exists(look, a, 0, a.byteLength)).toBe(e)
})