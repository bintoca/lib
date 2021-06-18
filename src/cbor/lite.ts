import { Output, Input, parseItem, finishItem, encodeObjectFunc, encodeLoop, decodeLoop, finalChecks, encodeSync, concat } from '@bintoca/cbor/core'

export const encode = (value): Uint8Array => concat(encodeSync(value))
export const decode = (b: BufferSource, op?: { allowExcessBuffer?: boolean, endPosition?: number }): any => {
    const src: Input = { buffer: b, position: 0 }
    const v = decodeLoop(src, parseItem, finishItem)
    finalChecks(src, op)
    return v
}