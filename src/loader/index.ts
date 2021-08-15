import { Encoder, Decoder } from '@bintoca/cbor'
import { defaultTypeMap, EncoderState, binaryItem, tagItem, tags, bufferSourceToDataView, DecoderState, decodeInfo } from '@bintoca/cbor/core'

export const enum FileType {
    buffer = 1,
    js = 2,
}
export const enum ChunkType {
    Placeholder = 1,
    Import = 2,
    This = 3
}
export const encode = (p: { files: {} }): Uint8Array => {
    const en = new Encoder({ omitMapTag: true })
    for (let k in p.files) {
        p.files[k] = en.encode(p.files[k])
    }
    const tm = new Map(defaultTypeMap)
    tm.set(Uint8Array, (a: Uint8Array, state: EncoderState) => {
        tagItem(tags.encodedCBORItem, state)
        binaryItem(a, state)
    })
    const enc = new Encoder({ omitMapTag: true, typeMap: tm })
    return enc.encode(new Map([[1, p.files]]))
}
export const decodePackage = (b: BufferSource): Map<number, any> => {
    const dec = new Decoder()
    return dec.decode(b)
}
export const decodeCount = (dv: DataView, state: DecoderState): number => {
    const c = dv.getUint8(state.position)
    state.position++
    const major = c >> 5
    const ai = c & 31
    return decodeInfo(major, ai, dv, state) as number
}
export const decodeFile = (b: BufferSource, globalResolve: (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number) => number, importResolve: (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number) => number): Uint8Array => {
    const state = { position: 0 } as DecoderState
    const dv = bufferSourceToDataView(b)
    if (dv.getUint8(0) >> 5 != 5) {
        throw new Error('invalid cbor at index 0')
    }
    if (dv.getUint8(1) != 1) {
        throw new Error('invalid cbor at index 1')
    }
    const type = dv.getUint8(2) & 31
    if (type == FileType.buffer) {
        state.position = 4
        if (dv.getUint8(state.position) == 192 + 24) {
            state.position += 2
        }
        const len = decodeCount(dv, state)
        return new Uint8Array(dv.buffer, dv.byteOffset + state.position, len)
    }
    else if (type == FileType.js) {
        state.position = 3
        if (dv.getUint8(state.position) != 2) {
            throw new Error('invalid cbor at index ' + state.position)
        }
        state.position++
        const sizeEstimate = decodeCount(dv, state)
        const u = new Uint8Array(sizeEstimate)
        let len = 0
        let importSubIndex = 0
        let thisSubIndex = 0
        if (dv.getUint8(state.position) == 6) {
            importSubIndex = state.position + 2
            state.position += 8
        }
        if (dv.getUint8(state.position) == 7) {
            thisSubIndex = state.position + 2
            state.position += 6
        }
        if (dv.getUint8(state.position) != 3) {
            throw new Error('invalid cbor at index ' + state.position)
        }
        state.position++
        const chunkCount = decodeCount(dv, state)
        for (let i = 0; i < chunkCount; i++) {
            const maj = dv.getUint8(state.position) >> 5
            if (maj == 3) {
                const size = decodeCount(dv, state)
                for (let j = 0; j < size; j++) {
                    u[len + j] = dv.getUint8(state.position + j)
                }
                state.position += size
                len += size
            }
            else {
                state.position += 2
                const chunkType = dv.getUint8(state.position)
                state.position++
                if (chunkType == ChunkType.Placeholder) {
                    state.position++
                    const size = decodeCount(dv, state)
                    for (let j = 0; j < size; j++) {
                        u[len + j] = 32
                    }
                    len += size
                }
                else if (chunkType == ChunkType.Import) {
                    if (!importSubIndex) {
                        throw new Error('import substitute not found')
                    }
                    for (let j = 0; j < 6; j++) {
                        u[len + j] = dv.getUint8(importSubIndex + j)
                    }
                    len += 6
                }
                else if (chunkType == ChunkType.This) {
                    if (!thisSubIndex) {
                        throw new Error('this substitute not found')
                    }
                    for (let j = 0; j < 4; j++) {
                        u[len + j] = dv.getUint8(thisSubIndex + j)
                    }
                    len += 4
                }
                else {
                    throw new Error('ChunkType not implemented ' + chunkType)
                }
            }
        }
        if (dv.byteLength > state.position) {
            if (dv.getUint8(state.position) != 4) {
                throw new Error('invalid cbor at index ' + state.position)
            }
            state.position++
            const globalCount = decodeCount(dv, state)
            for (let i = 0; i < globalCount; i++) {
                const size = decodeCount(dv, state)
                u[len++] = 10
                u[len++] = 105
                u[len++] = 109
                u[len++] = 112
                u[len++] = 111
                u[len++] = 114
                u[len++] = 116
                u[len++] = 123
                u[len++] = 118
                u[len++] = 32
                u[len++] = 97
                u[len++] = 115
                u[len++] = 32
                for (let j = 0; j < size; j++) {
                    u[len + j] = dv.getUint8(state.position + j)
                }
                len += size
                u[len++] = 125
                u[len++] = 102
                u[len++] = 114
                u[len++] = 111
                u[len++] = 109
                u[len++] = 34
                len += globalResolve(u, len, dv, state, size)
                u[len++] = 34
                state.position += size
            }
        }
        if (dv.byteLength > state.position) {
            if (dv.getUint8(state.position) != 5) {
                throw new Error('invalid cbor at index ' + state.position)
            }
            state.position++
            const importCount = decodeCount(dv, state)
            for (let i = 0; i < importCount; i++) {
                state.position += 2
                const size = decodeCount(dv, state)
                u[len++] = 10
                for (let j = 0; j < size; j++) {
                    u[len + j] = dv.getUint8(state.position + j)
                }
                len += size
                state.position += size + 1
                u[len++] = 34
                const specifierSize = decodeCount(dv, state)
                len += importResolve(u, len, dv, state, specifierSize)
                u[len++] = 34
                state.position += specifierSize
            }
        }
        return new Uint8Array(u.buffer, 0, len)
    }
    else {
        throw new Error('FileType not implemented ' + type)
    }
}