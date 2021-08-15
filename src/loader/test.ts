import { ChunkType, FileType, encode, decodePackage, decodeFile } from '@bintoca/loader'
import { DecoderState } from '@bintoca/cbor/core'

const globalResolve = (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number): number => {
    if (dv.getUint8(state.position) == 77) {
        u[len++] = 103
        u[len++] = 49
    }
    else {
        u[len++] = 103
        u[len++] = 50
    }
    return 2
}
const importResolve = (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number): number => {
    u[len++] = 98
    u[len++] = 120
    u[len++] = 120
    return 3
}
test('buffer', () => {
    const cb = encode({ files: { 'p.json': new Map<number, any>([[1, FileType.buffer], [2, new TextEncoder().encode('{"a":2}')]]) } })
    const d = decodePackage(cb)
    expect(new TextDecoder().decode(decodeFile(d.get(1)['p.json'], globalResolve, importResolve))).toBe('{"a":2}')
})
test.each([['const w = 4;          const r=5;', new Map<number, any>([[1, FileType.js], [2, 500], [3, ['const w = 4;', new Map<number, any>([[1, ChunkType.Placeholder], [2, 10]]), 'const r=5;']]])],
['const w = 4;          ImporTTHISconst r=5;\nimport{v as Math}from"g1"\nimport{v as Number}from"g2"\nimport $bbbbb from "bxx"', new Map<number, any>([[1, FileType.js], [2, 500], [6, 'ImporT'], [7, 'THIS'],
[3, ['const w = 4;', new Map<number, any>([[1, ChunkType.Placeholder], [2, 10]]), new Map<number, any>([[1, ChunkType.Import]]), new Map<number, any>([[1, ChunkType.This]]), 'const r=5;']],
[4, ['Math', 'Number']],
[5, [new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])]]
])]])('js', (a, b) => {
    const cb = encode({ files: { 'p.js': b } })
    const d = decodePackage(cb)
    expect(new TextDecoder().decode(decodeFile(d.get(1)['p.js'], globalResolve, importResolve))).toBe(a)
})