import { parseItem, finishItem, encodeLoop, decodeLoop, finalChecks } from '@bintoca/cbor/core'
import { traverse, traverseSync, encodeObjectFunc, Output, Input, altEncodeFunc, browser } from '@bintoca/cbor/util'

export async function encode(value): Promise<ArrayBuffer>;
export async function encode(value, op?: { useWTF8?: boolean, uint8?: true }): Promise<Uint8Array>;
export async function encode(value, op?: { useWTF8?: boolean, uint8?: false | unknown }): Promise<ArrayBuffer> {
    const out: Output = { view: new DataView(new ArrayBuffer(4096)), length: 0, stack: [await traverse(value)], shared: new Map(), useWTF8: op?.useWTF8, ws: new WeakSet() }
    encodeLoop(out, encodeObjectFunc, altEncodeFunc)
    return op?.uint8 ? new Uint8Array(out.view.buffer, 0, out.length) : out.view.buffer.slice(0, out.length)
}
export function encodeSync(v): ArrayBuffer;
export function encodeSync(v, op?: { useWTF8?: boolean, uint8?: true }): Uint8Array;
export function encodeSync(v, op?: { useWTF8?: boolean, uint8?: false | unknown }): ArrayBuffer {
    const out: Output = { view: new DataView(new ArrayBuffer(4096)), length: 0, stack: [traverseSync(v)], shared: new Map(), useWTF8: op?.useWTF8, ws: new WeakSet() }
    encodeLoop(out, encodeObjectFunc, altEncodeFunc)
    return op?.uint8 ? new Uint8Array(out.view.buffer, 0, out.length) : out.view.buffer.slice(0, out.length)
}
export async function decode(b: BufferSource, op?: { allowExcessBuffer?: boolean, endPosition?: number }) {
    const src: Input = { buffer: b, position: 0, opt: { metaData: { cryptoKeysTemp: [], cryptoKeys: [], shareable: [] } } }
    let v = decodeLoop(src, parseItem, finishItem)
    finalChecks(src, op)
    if (src.opt.metaData.cryptoKeysTemp.length > 0) {
        for (let x of src.opt.metaData.cryptoKeysTemp) {
            const ck = x.extractable ? await browser.crypto.subtle.importKey('jwk', x.keyData, x.algorithm, x.extractable, x.usages) :
                await browser.crypto.subtle.generateKey(x.algorithm, x.extractable, x.usages)
            src.opt.metaData.cryptoKeys.push(ck)
        }
        src.position = 0
        src.opt.metaData.cryptoKeysTemp = []
        src.opt.metaData.shareable = []
        v = decodeLoop(src, parseItem, finishItem)
    }
    return v
}
export function decodeSync(b: BufferSource, op?: { allowExcessBuffer?: boolean, endPosition?: number }) {
    const src: Input = { buffer: b, position: 0, opt: { metaData: { cryptoKeysTemp: [], cryptoKeys: [], shareable: [] } } }
    let v = decodeLoop(src, parseItem, finishItem)
    finalChecks(src, op)
    if (src.opt.metaData.cryptoKeysTemp.length > 0) {
        throw new Error('CryptoKey not supported in sync mode')
    }
    return v
}