import { ParseItemFunc, FinishItemFunc, arrayItem, mapItem, binaryItem, tagItem, encodeObject, stringItem, numberItem, bigintItem, booleanItem, encodeLoop, decodeAdditionalInformation, slice, decodeLoop, decodeBigInt, tags } from '@bintoca/cbor/core'
import * as core from '@bintoca/cbor/core'
import * as wtf8 from 'wtf-8'
export const asyncCacheSymbol = Symbol.for('github.com/bintoca/lib/cbor/asyncCache')
export const tagSymbol = Symbol.for('github.com/bintoca/lib/cbor/tag')
class _DOMPointReadOnly { x; y; z; w; constructor(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } }
class _DOMPoint { x; y; z; w; constructor(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } }
class _DOMRectReadOnly { x; y; width; height; constructor(x, y, z, w) { this.x = x; this.y = y; this.width = z; this.height = w; } }
class _DOMRect { x; y; width; height; constructor(x, y, z, w) { this.x = x; this.y = y; this.width = z; this.height = w; } }
class _DOMMatrixReadOnly {
    m11; m12; m13; m14; m21; m22; m23; m24; m31; m32; m33; m34; m41; m42; m43; m44;
    constructor(a: number[]) {
        this.m11 = a[0]
        this.m12 = a[1]
        this.m13 = a[2]
        this.m14 = a[3]
        this.m21 = a[4]
        this.m22 = a[5]
        this.m23 = a[6]
        this.m24 = a[7]
        this.m31 = a[8]
        this.m32 = a[9]
        this.m33 = a[10]
        this.m34 = a[11]
        this.m41 = a[12]
        this.m42 = a[13]
        this.m43 = a[14]
        this.m44 = a[15]
    }
}
class _DOMMatrix {
    m11; m12; m13; m14; m21; m22; m23; m24; m31; m32; m33; m34; m41; m42; m43; m44;
    constructor(a: number[]) {
        this.m11 = a[0]
        this.m12 = a[1]
        this.m13 = a[2]
        this.m14 = a[3]
        this.m21 = a[4]
        this.m22 = a[5]
        this.m23 = a[6]
        this.m24 = a[7]
        this.m31 = a[8]
        this.m32 = a[9]
        this.m33 = a[10]
        this.m34 = a[11]
        this.m41 = a[12]
        this.m42 = a[13]
        this.m43 = a[14]
        this.m44 = a[15]
    }
}
class _DOMQuad { p1; p2; p3; p4; constructor(x, y, z, w) { this.p1 = x; this.p2 = y; this.p3 = z; this.p4 = w; } }
class _Blob {
    ar; type;
    constructor(a: ArrayBuffer[], op: { type: string }) { this.ar = a[0]; this.type = op.type }
    arrayBuffer() {
        return Promise.resolve(this.ar)
    }
}
class _File {
    ar; type; name; lastModified;
    constructor(a: ArrayBuffer[], na, op: { type: string, lastModified: number }) {
        this.ar = a[0]; this.name = na; this.type = op.type; this.lastModified = op.lastModified
    }
    arrayBuffer() {
        return Promise.resolve(this.ar)
    }
}
class _ImageData { data; width; constructor(d, w) { this.data = d; this.width = w } }
let testKeys = []
const _crypto = {
    subtle: {
        generateKey: (alg: {}, ext: boolean, use: string[]) => {
            return Promise.resolve(new _CryptoKey(alg, ext, use, {}))
        },
        exportKey: (format, key: _CryptoKey) => {
            return Promise.resolve(key.keyData)
        },
        importKey: (format, keyData, algorithm, extractable, keyUsages) => {
            if (!extractable) {
                keyData = {}
            }
            testKeys.push({ format, keyData, algorithm, extractable, keyUsages })
            return Promise.resolve(new _CryptoKey(algorithm, extractable, keyUsages, keyData))
        }
    }
} 
class _CryptoKey { type; extractable; algorithm; usages; keyData; constructor(alg, ext, use, kd) { this.type = 'secret', this.algorithm = alg; this.extractable = ext; this.usages = use; this.keyData = kd } }
export const browserShim = {
    DOMPointReadOnly: _DOMPointReadOnly,
    DOMPoint: _DOMPoint,
    DOMRectReadOnly: _DOMRectReadOnly,
    DOMRect: _DOMRect,
    DOMMatrixReadOnly: _DOMMatrixReadOnly,
    DOMMatrix: _DOMMatrix,
    DOMQuad: _DOMQuad,
    Blob: _Blob,
    File: _File,
    ImageData: _ImageData,
    crypto: _crypto,
    CryptoKey: _CryptoKey
} as unknown as Window & typeof globalThis
export let browser = typeof self != 'undefined' ? self : browserShim
export const setBrowser = (b: Window & typeof globalThis) => browser = b

export const encodeBlob = (a: Blob) => {
    return { arrayBuffer: a[asyncCacheSymbol], type: a.type }
}
export const encodeFile = (a: File) => {
    return { arrayBuffer: a[asyncCacheSymbol], type: a.type, name: a.name, lastModified: a.lastModified }
}
export const encodeImageData = (a: ImageData) => {
    return { data: a.data, width: a.width }
}
export const encodeRegEx = (a: RegExp) => {
    return { source: a.source, flags: a.flags }
}
export const encodeCryptoKey = (a: CryptoKey) => {
    return a[asyncCacheSymbol]
}
export const encodeDOMPointReadOnly = (a: DOMPointReadOnly) => {
    return { x: a.x, y: a.y, z: a.z, w: a.w }
}
export const encodeDOMPoint = (a: DOMPoint) => {
    return { x: a.x, y: a.y, z: a.z, w: a.w }
}
export const encodeDOMRectReadOnly = (a: DOMRectReadOnly) => {
    return { x: a.x, y: a.y, width: a.width, height: a.height }
}
export const encodeDOMRect = (a: DOMRect) => {
    return { x: a.x, y: a.y, width: a.width, height: a.height }
}
export const encodeDOMMatrixReadOnly = (a: DOMMatrixReadOnly) => {
    return [a.m11, a.m12, a.m13, a.m14, a.m21, a.m22, a.m23, a.m24, a.m31, a.m32, a.m33, a.m34, a.m41, a.m42, a.m43, a.m44]
}
export const encodeDOMMatrix = (a: DOMMatrix) => {
    return [a.m11, a.m12, a.m13, a.m14, a.m21, a.m22, a.m23, a.m24, a.m31, a.m32, a.m33, a.m34, a.m41, a.m42, a.m43, a.m44]
}
export const encodeDOMQuad = (a: DOMQuad) => {
    return { p1: a.p1, p2: a.p2, p3: a.p3, p4: a.p4 }
}
export type Output = core.EncoderState & { shared: Map<any, number>, hasWTF8?: boolean, useWTF8: boolean, ws: WeakSet<any> }
export type CryptoKeyTemp = { type: KeyType, extractable: boolean, algorithm: KeyAlgorithm, usages: KeyUsage[], keyData: JsonWebKey }

export async function traverse(d) {
    const ws = new WeakSet()
    const stack = [d]
    while (stack.length > 0) {
        let v = stack.pop()
        if (ws.has(v)) {
            if (!v[tagSymbol]) {
                v[tagSymbol] = [tags.shareable]
            }
            continue
        }
        if (typeof v == 'object' && v !== null) {
            ws.add(v)
            if (v instanceof browser.Blob || v instanceof browser.File) {
                v[asyncCacheSymbol] = await v.arrayBuffer()
            }
            else if (v instanceof browser.CryptoKey) {
                const k: CryptoKeyTemp = { type: v.type, extractable: v.extractable, algorithm: v.algorithm, usages: v.usages, keyData: undefined }
                if (v.extractable) {
                    k.keyData = await browser.crypto.subtle.exportKey('jwk', v)
                }
                v[asyncCacheSymbol] = k
            }
            if (v instanceof Map) {
                const ks = Array.from(v.entries())
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(ks[i][1])
                    stack.push(ks[i][0])
                }
            }
            else if (v instanceof Set) {
                const ks = Array.from(v.values())
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(ks[i])
                }
            }
            else if (Array.isArray(v)) {
                for (let i = v.length - 1; i >= 0; i--) {
                    stack.push(v[i])
                }
            }
            else {
                const ks = Object.keys(v)
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(v[ks[i]])
                }
            }
        }
    }
    return d
}
export function traverseSync(d) {
    const ws = new WeakSet()
    const stack = [d]
    while (stack.length > 0) {
        let v = stack.pop()
        if (ws.has(v)) {
            if (!v[tagSymbol]) {
                v[tagSymbol] = [tags.shareable]
            }
            continue
        }
        if (typeof v == 'object' && v !== null) {
            ws.add(v)
            if (v instanceof browser.Blob || v instanceof browser.File) {
                throw new Error('Blob and File types not supported in sync mode')
            }
            else if (v instanceof browser.CryptoKey) {
                const k = { type: v.type, extractable: v.extractable, algorithm: v.algorithm, usages: v.usages, keyData: undefined }
                if (v.extractable) {
                    throw new Error('CryptoKey not supported in sync mode')
                }
                v[asyncCacheSymbol] = k
            }
            if (v instanceof Map) {
                const ks = Array.from(v.entries())
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(ks[i][1])
                    stack.push(ks[i][0])
                }
            }
            else if (v instanceof Set) {
                const ks = Array.from(v.values())
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(ks[i])
                }
            }
            else if (Array.isArray(v)) {
                for (let i = v.length - 1; i >= 0; i--) {
                    stack.push(v[i])
                }
            }
            else {
                const ks = Object.keys(v)
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(v[ks[i]])
                }
            }
        }
    }
    return d
}
export const hasBadSurrogates = (s: string): boolean => {
    let low = false
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i)
        if (c >= 0xD800 && c <= 0xDBFF) {
            if (low) {
                return true
            }
            low = true
        }
        else if (c >= 0xDC00 && c <= 0xDFFF) {
            if (!low) {
                return true
            }
            low = false
        }
        else {
            if (low) {
                return true
            }
            low = false
        }
    }
    return low
}
export const altEncodeFunc = (value, stack: any[], out: Output): boolean => {
    if (out.useWTF8 && (typeof value == 'string' || value instanceof String) && hasBadSurrogates(value.valueOf())) {
        if (value instanceof String) {
            tagItem(tags.JSStringObject, out)
        }
        out.hasWTF8 = true
        tagItem(tags.WTF8, out)
        binaryItem(wtf8.encode(value), out)
        return true
    }
}
export type Input = core.Input & { opt: { metaData?: { cryptoKeysTemp: CryptoKeyTemp[], cryptoKeys: (CryptoKey | CryptoKeyPair)[], shareable: any[] } } }