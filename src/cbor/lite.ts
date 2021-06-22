import { Output, Input, parseItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSyncLoop, concat } from '@bintoca/cbor/core'

export class Encoder {
    workingBuffer = { buffer: new ArrayBuffer(4096), offset: 0 }
    encodeSyncLoop = (value): Uint8Array[] => encodeSyncLoop(value, this.workingBuffer)
    encode = (value): Uint8Array => concat(encodeSyncLoop(value, this.workingBuffer))
}
export const encode = (value): Uint8Array => concat(encodeSyncLoop(value, null))
export const decode = (b: BufferSource, op?: { allowExcessBuffer?: boolean, endPosition?: number }): any => {
    const src: Input = { buffer: b, position: 0 }
    const v = decodeLoop(src, parseItem, finishItem)
    finalChecks(src, op)
    return v
}