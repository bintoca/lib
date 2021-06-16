import { Output, Input, parseItem, finishItem, encodeObjectFunc, encodeLoop, decodeLoop } from '@bintoca/cbor/core'

export function encode(value): ArrayBuffer;
export function encode(value, op?: { uint8?: true }): Uint8Array;
export function encode(value, op?: { uint8?: false | unknown }): ArrayBuffer {
    const out: Output = { buffer: new ArrayBuffer(4096), length: 0 }
    encodeLoop(value, out, encodeObjectFunc)
    return op?.uint8 ? new Uint8Array(out.buffer, 0, out.length) : out.buffer.slice(0, out.length)
}
export const decode = (b: BufferSource, op?: { allowExcessBuffer?: boolean, endPosition?: number }): any => {
    const src: Input = { buffer: b, position: 0 }
    const v = decodeLoop(src, parseItem, finishItem)
    if (src.stack.length > 0) {
        throw new Error('unfinished depth: ' + src.stack.length)
    }
    if (!op?.allowExcessBuffer && src.position != src.buffer.byteLength) {
        throw new Error('length mismatch ' + src.position + ' ' + src.buffer.byteLength)
    }
    if (op) {
        op.endPosition = src.position
    }
    return v
}