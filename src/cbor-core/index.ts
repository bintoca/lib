const TE = new TextEncoder()
const TD = new TextDecoder('utf-8', { fatal: true })
export const num32 = 0x100000000
/**
 * get the additional information from a number or length to be combined with a major type
 * @param n number or length
 * @returns 0-27
 */
export const encodeAdditionalInformation = (n: number) => {
    if (n < 24) {
        return n
    } else if (n < 0x100) {
        return 24
    } else if (n < 0x10000) {
        return 25
    } else if (n < 0x100000000) {
        return 26
    }
    return 27
}
export type Output = { buffer: ArrayBuffer, length: number }
/**
 * expand buffer if necessary for new length
 * @param out Output object
 * @param length additional length to check
 */
export const checkBuffer = (out: Output, length: number) => {
    if (out.buffer.byteLength < out.length + length) {
        const nb = new ArrayBuffer(Math.max(out.buffer.byteLength * 2, out.length + length + 2000))
        new Uint8Array(nb).set(new Uint8Array(out.buffer))
        out.buffer = nb
    }
}
export const appendBuffer = (out: Output, b: BufferSource) => {
    checkBuffer(out, b.byteLength)
    new Uint8Array(out.buffer).set(b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength), out.length)
    out.length += b.byteLength
}
/**
 * write an item to Output
 * @param major cbor major type 0-7
 * @param additionalInformation 
 * @param out Output object
 */
export const writeItem = (major: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, additionalInformation: number, out: Output) => {
    checkBuffer(out, 9)
    const ad = encodeAdditionalInformation(additionalInformation)
    var dv = new DataView(out.buffer)
    dv.setUint8(out.length, major << 5 | ad)
    out.length++
    if (ad == 24) {
        dv.setUint8(out.length, additionalInformation)
        out.length++
    }
    else if (ad == 25) {
        dv.setUint16(out.length, additionalInformation)
        out.length += 2
    }
    else if (ad == 26) {
        dv.setUint32(out.length, additionalInformation)
        out.length += 4
    }
    else if (ad == 27) {
        dv.setBigUint64(out.length, BigInt(additionalInformation))
        out.length += 8
    }
}
export const integerItem = (value: number, out: Output) => value >= 0 ? writeItem(0, value, out) : writeItem(1, -(value + 1), out)
export const binaryItem = (v: BufferSource, out: Output) => {
    writeItem(2, v.byteLength, out)
    appendBuffer(out, v)
}
export const textItem = (s: string, out: Output) => {
    const v = TE.encode(s)
    writeItem(3, v.byteLength, out)
    appendBuffer(out, v)
}
export const arrayItem = (length: number, out: Output) => writeItem(4, length, out)
export const mapItem = (length: number, out: Output) => writeItem(5, length, out)
export const tagItem = (id: number, out: Output) => writeItem(6, id, out)
export const primitiveItem = (id: number, out: Output) => writeItem(7, id, out)
export const numberItem = (val: number, out: Output) => {
    if (Math.floor(val) === val && val < num32 && val > -num32) {
        return integerItem(val, out)
    }
    checkBuffer(out, 9)
    const dv = new DataView(out.buffer)
    dv.setFloat32(out.length + 1, val)
    const v1 = dv.getFloat32(out.length + 1)
    if (v1 === val) {
        dv.setUint8(out.length, 7 << 5 | 26)
        out.length += 5
    }
    else {
        dv.setUint8(out.length, 7 << 5 | 27)
        dv.setFloat64(out.length + 1, val)
        out.length += 9
    }
}
export const bigintItem = (val: bigint, out: Output) => {
    tagItem(val >= 0 ? 2 : 3, out)
    let norm = val >= 0 ? val : -(val + BigInt(1))
    let len = 0
    if (norm > 0) {
        while (BigInt(2) ** (BigInt(len) * BigInt(8)) - BigInt(1) < norm) {
            len++
        }
    }
    const v = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
        v[i] = Number(norm % BigInt(256))
        norm = norm / BigInt(256)
    }
    writeItem(2, v.byteLength, out)
    appendBuffer(out, v.reverse())
}
export const encodeInternal = (value, out: Output) => {
    const stack = [value]
    const ws = new WeakSet()
    while (stack.length > 0) {
        const a = stack.pop()

        if (a === null) {
            primitiveItem(22, out)
        }
        else if (a === undefined) {
            primitiveItem(23, out)
        }
        else if (typeof a == 'object') {
            if (ws.has(a)) {
                continue
            }
            ws.add(a)
            const pr = Object.getPrototypeOf(a)
            if (pr === null || pr === Object.prototype) {
                const ks = Object.keys(a)
                mapItem(ks.length, out)
                for (let i = ks.length - 1; i >= 0; i--) {
                    stack.push(a[ks[i]])
                    stack.push(ks[i])
                }
            }
            else if (Array.isArray(a)) {
                arrayItem(a.length, out)
                for (let i = a.length - 1; i >= 0; i--) {
                    stack.push(a[i])
                }
            }
        }
        else if (typeof a == 'string') {
            textItem(a, out)
        }
        else if (typeof a == 'number') {
            numberItem(a, out)
        }
        else if (typeof a == 'boolean') {
            primitiveItem(a ? 21 : 20, out)
        }
        else if (typeof a == 'bigint') {
            bigintItem(a, out)
        }
        else {
            throw new Error('unsupported type')
        }
    }
}
export function encode(value, op?: { uint8?: true }): Uint8Array;
export function encode(value, op?: { uint8?: false | unknown }): ArrayBuffer {
    const out: Output = { buffer: new ArrayBuffer(4096), length: 0 }
    encodeInternal(value, out)
    return op?.uint8 ? new Uint8Array(out.buffer, 0, out.length) : out.buffer.slice(0, out.length)
}
export type DecodeStackItem = { major: 4 | 5 | 6, length: number, temp: any[], tagArray?: number[] }
export type Input = { buffer: BufferSource, position: number, stack?: DecodeStackItem[] }
export function decodeAdditionalInformation(ad: number, dv: DataView, src: Input): number | bigint {
    if (ad < 24) {
        return ad
    }
    else if (ad == 24) {
        const len = dv.getUint8(src.position);
        src.position++
        return len
    }
    else if (ad == 25) {
        const len = dv.getUint16(src.position);
        src.position += 2
        return len
    }
    else if (ad == 26) {
        const len = dv.getUint32(src.position);
        src.position += 4
        return len
    }
    else if (ad == 27) {
        const len = dv.getBigUint64(src.position)
        src.position += 8
        if (len <= Number.MAX_SAFE_INTEGER && len >= Number.MIN_SAFE_INTEGER) {
            return Number(len)
        }
        return len
    }
    else {
        throw new Error('invalid length encoding')
    }
}
export function decodeAdditionalInformationNumber(ad: number, dv: DataView, src: Input): number {
    const v = decodeAdditionalInformation(ad, dv, src)
    if (typeof v == 'bigint') {
        throw new Error('invalid bigint')
    }
    return v
}
export const slice = (length: number, src: Input) => {
    const b = src.buffer instanceof ArrayBuffer ? src.buffer.slice(src.position, src.position + length) : src.buffer.buffer.slice(src.position + src.buffer.byteOffset, src.position + src.buffer.byteOffset + length)
    src.position += length;
    return b
}
export function decodeInternal(src: Input) {
    const dv = src.buffer instanceof ArrayBuffer ? new DataView(src.buffer) : new DataView(src.buffer.buffer, src.buffer.byteOffset, src.buffer.byteLength)
    src.stack = []
    while (src.position < src.buffer.byteLength) {
        const c = dv.getUint8(src.position)
        src.position++;
        const major = c >> 5
        const ad = c & 31
        let result
        switch (major) {
            case 0:
                result = decodeAdditionalInformation(ad, dv, src)
                break
            case 1: {
                const a = decodeAdditionalInformation(ad, dv, src)
                result = typeof a == 'bigint' ? BigInt(-1) - a : -1 - a
                break
            }
            case 2: {
                const a = decodeAdditionalInformationNumber(ad, dv, src)
                result = slice(a, src)
                break
            }
            case 3: {
                const a = decodeAdditionalInformationNumber(ad, dv, src)
                result = TD.decode(slice(a, src))
                break
            }
            case 4: {
                const a = decodeAdditionalInformationNumber(ad, dv, src)
                src.stack.push({ major, length: a, temp: [] })
                break
            }
            case 5: {
                const a = decodeAdditionalInformationNumber(ad, dv, src)
                src.stack.push({ major, length: a * 2, temp: [] })
                break
            }
            case 6: {
                const tagArray = [decodeAdditionalInformationNumber(ad, dv, src)]
                while (dv.getUint8(src.position) >> 5 == 6) {
                    const ad = dv.getUint8(src.position) & 31
                    src.position++;
                    tagArray.push(decodeAdditionalInformationNumber(ad, dv, src))
                }
                src.stack.push({ major, length: 1, temp: [], tagArray })
                break
            }
            case 7: {
                switch (ad) {
                    case 20:
                        result = false
                        break
                    case 21:
                        result = true
                        break
                    case 22:
                        result = null
                        break
                    case 23:
                        result = undefined
                        break
                    case 26:
                        result = dv.getFloat32(src.position);
                        src.position += 4
                        break
                    case 27:
                        result = dv.getFloat64(src.position);
                        src.position += 8
                        break
                    default:
                        throw new Error('not implemented')
                }
                break
            }
            default:
                throw new Error('invalid major: ' + major)
        }
        let head = src.stack[src.stack.length - 1]
        if (major == 7 || major < 4) {
            if (head) {
                head.temp.push(result)
            }
            else {
                return result
            }
        }
        let finishedItem
        while (head && head.length == head.temp.length) {
            finishedItem = finish(src.stack)
            src.stack.pop()
            head = src.stack[src.stack.length - 1]
            if (head) {
                head.temp.push(finishedItem)
            }
        }
        if (src.stack.length == 0) {
            return finishedItem
        }
    }
}
export const finish = (stack: DecodeStackItem[]) => {
    const head = stack[stack.length - 1]
    switch (head.major) {
        case 4:
            return head.temp
        case 5:
            const o = {}
            for (let j = 0; j < head.length; j = j + 2) {
                o[head.temp[j]] = head.temp[j + 1]
            }
            return o
        case 6:
            return head.temp[0]
    }
}