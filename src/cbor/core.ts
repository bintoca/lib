import wtf8 from 'wtf-8'
const scratchDataView = new DataView(new ArrayBuffer(9))
const TE = new TextEncoder()
export const TD = new TextDecoder('utf-8', { fatal: true })
export const defaultBufferSize = 4096
export const defaultMinViewSize = 512
export const encodeAdditionalInformation = (n: number, float?: boolean) => {
    if (float) {
        scratchDataView.setFloat32(0, n)
        const v1 = scratchDataView.getFloat32(0)
        if (v1 === n) {
            return 26
        }
        return 27
    }
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
export const additionalInformationSize = (n: number) => {
    if (n < 24) {
        return 0
    } else if (n == 24) {
        return 1
    } else if (n == 25) {
        return 2
    } else if (n == 26) {
        return 4
    }
    return 8
}
export type MajorTypes = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | -1
export type Output = {
    view: DataView, length: number, stack: any[], buffers: Uint8Array[], useWTF8?: boolean, useRecursion?: boolean
    resumeItem?: { major: MajorTypes, adInfo: number, float?: boolean }[], resumeBuffer?: BufferSource, backingView: ArrayBufferView, offset: number, newBufferSize: number, minViewSize: number
}
export const appendBuffer = (out: Output, b: BufferSource) => {
    out.resumeBuffer = undefined
    if (out.resumeItem) {
        out.resumeBuffer = b
    }
    else {
        if (out.length + b.byteLength <= out.view.byteLength) {
            new Uint8Array(out.view.buffer, out.view.byteOffset, out.view.byteLength).set(b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength), out.length)
            out.length += b.byteLength
        }
        else {
            const len = out.view.byteLength - out.length
            new Uint8Array(out.view.buffer, out.view.byteOffset, out.view.byteLength).set(b instanceof ArrayBuffer ? new Uint8Array(b, 0, len) : new Uint8Array(b.buffer, b.byteOffset, len), out.length)
            out.length += len
            out.resumeBuffer = b instanceof ArrayBuffer ? new Uint8Array(b, len, b.byteLength - len) : new Uint8Array(b.buffer, b.byteOffset + len, b.byteLength - len)
            if (out.useRecursion) {
                out.buffers.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
                resetOutput(out)
                appendBuffer(out, out.resumeBuffer)
            }
        }
    }
}
export const writeItemCore = (major: MajorTypes, adInfo: number, dv: DataView, offset: number): number => {
    if (offset + 9 > dv.byteLength) {
        return 0
    }
    if (major == -1) {
        if (isNaN(adInfo)) {
            dv.setUint8(offset, 0xf9)
            dv.setUint16(offset + 1, 0x7e00)
            return 3
        }
        if (!isFinite(adInfo)) {
            dv.setUint8(offset, 0xf9)
            dv.setUint16(offset + 1, adInfo < 0 ? 0xfc00 : 0x7c00)
            return 3
        }
        if (Object.is(adInfo, -0)) {
            dv.setUint8(offset, 0xf9)
            dv.setUint16(offset + 1, 0x8000)
            return 3
        }
        if (Math.floor(adInfo) !== adInfo || adInfo > Number.MAX_SAFE_INTEGER || adInfo < Number.MIN_SAFE_INTEGER) {
            if (Math.fround(adInfo) === adInfo) {
                dv.setFloat32(offset + 1, adInfo)
                if (adInfo <= 65504 && adInfo >= -65504) {
                    const u32 = dv.getUint32(offset + 1)
                    if ((u32 & 0x1FFF) === 0) {
                        let s = (u32 >> 16) & 0x8000
                        const e = (u32 >> 23) & 0xff
                        const m = u32 & 0x7fffff
                        if ((e >= 113) && (e <= 142)) {
                            dv.setUint8(offset, 0xf9)
                            dv.setUint16(offset + 1, s + ((e - 112) << 10) + (m >> 13))
                            return 3
                        } else if ((e >= 103) && (e < 113) && !(m & ((1 << (126 - e)) - 1))) {
                            dv.setUint8(offset, 0xf9)
                            dv.setUint16(offset + 1, s + ((m + 0x800000) >> (126 - e)))
                            return 3
                        }
                    }
                }
                dv.setUint8(offset, 0xfa)
                return 5
            }
            dv.setUint8(offset, 0xfb)
            dv.setFloat64(offset + 1, adInfo)
            return 9
        }
        if (adInfo >= 0) {
            major = 0
        }
        else {
            major = 1
            adInfo = -(adInfo + 1)
        }
    }
    const majorShift = major << 5
    if (adInfo < 24) {
        dv.setUint8(offset, majorShift | adInfo)
        return 1
    } else if (adInfo < 0x100) {
        dv.setUint8(offset, majorShift | 24)
        dv.setUint8(offset + 1, adInfo)
        return 2
    } else if (adInfo < 0x10000) {
        dv.setUint8(offset, majorShift | 25)
        dv.setUint16(offset + 1, adInfo)
        return 3
    } else if (adInfo < 0x100000000) {
        dv.setUint8(offset, majorShift | 26)
        dv.setUint32(offset + 1, adInfo)
        return 5
    }
    dv.setUint8(offset, majorShift | 27)
    dv.setUint32(offset + 1, Math.floor(adInfo / 0x100000000))
    dv.setUint32(offset + 5, adInfo % 0x100000000)
    return 9
}
export const writeItem = (major: MajorTypes, adInfo: number, out: Output) => {
    const written = writeItemCore(major, adInfo, out.view, out.length)
    if (written) {
        out.length += written
    }
    else {
        if (out.useRecursion) {
            out.buffers.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
            resetOutput(out)
            writeItem(major, adInfo, out)
        }
        else {
            if (!out.resumeItem) {
                out.resumeItem = []
            }
            out.resumeItem.push({ major, adInfo })
        }
    }
}
export const integerItem = (value: number, out: Output) => value >= 0 ? writeItem(0, value, out) : writeItem(1, -(value + 1), out)
export const nullItem = (out: Output) => writeItem(7, 22, out)
export const undefinedItem = (out: Output) => writeItem(7, 23, out)
export const booleanItem = (value: boolean, out: Output) => writeItem(7, value ? 21 : 20, out)
export const binaryItem = (v: BufferSource, out: Output) => {
    writeItem(2, v.byteLength, out)
    appendBuffer(out, v)
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
export const textItemCopy = (s: string, out: Output) => {
    let major: MajorTypes = 3
    if (out.useWTF8 && hasBadSurrogates(s)) {
        s = wtf8.encode(s)
        tagItem(tags.WTF8, out)
        major = 2
    }
    const v = TE.encode(s)
    writeItem(major, v.byteLength, out)
    appendBuffer(out, v)
}
export const textItem = (s: string, out: Output) => {
    const maybeFitsView = out.length + s.length + 9 <= out.view.byteLength
    const start = out.length
    let fullEncode
    if (maybeFitsView) {
        const dv = out.view
        writeItem(3, s.length, out)
        const len = out.length
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i)
            if (ch < 128) {
                dv.setUint8(len + i, ch)
            }
            else {
                fullEncode = true
                break
            }
        }
        out.length += s.length
    }
    else {
        textItemCopy(s, out)
    }
    if (fullEncode) {
        out.length = start
        if (!out.useWTF8 && TE.encodeInto && maybeFitsView) {
            writeItem(3, s.length, out)
            const r = TE.encodeInto(s, new Uint8Array(out.view.buffer, out.view.byteOffset + out.length, out.view.byteLength - out.length))
            if (r.read == s.length) {
                if (r.written == s.length) {
                    out.length += r.written
                }
                else {
                    if (out.length - start == writeItemCore(3, r.written, out.view, start)) {
                        out.length += r.written
                    }
                    else {
                        out.length = start
                        textItemCopy(s, out)
                    }
                }
            }
            else {
                out.length = start
                textItemCopy(s, out)
            }
        }
        else {
            textItemCopy(s, out)
        }
    }
}
export const arrayItem = (length: number, out: Output) => writeItem(4, length, out)
export const mapItem = (length: number, out: Output) => writeItem(5, length, out)
export const tagItem = (id: number, out: Output) => writeItem(6, id, out)
export const numberItem = (val: number, out: Output) => {
    writeItem(-1, val, out)
}
export const bigintItem = (val: bigint, out: Output) => {
    tagItem(val >= 0 ? tags.positiveBigNum : tags.negativeBigNum, out)
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
    binaryItem(v.reverse(), out)
}
export const encodeArrayRecursive = (a: any[], out: Output) => {
    arrayItem(a.length, out)
    for (let k of a) {
        encodeRecursive(k, out)
    }
}
export const encodeObjectRecursive = (a, out: Output) => {
    const ks = Object.keys(a)
    mapItem(ks.length, out)
    for (let k of ks) {
        encodeRecursive(k, out)
        encodeRecursive(a[k], out)
    }
}
export const encodeMapRecursive = (a: Map<any, any>, out: Output) => {
    mapItem(a.size, out)
    for (let i of a.entries()) {
        encodeRecursive(i[0], out)
        encodeRecursive(i[1], out)
    }
}
export const encodeObjectFuncRecursive = (a, out: Output) => {
    if (a === null) {
        nullItem(out)
    }
    else if (Array.isArray(a)) {
        encodeArrayRecursive(a, out)
    }
    else if (a instanceof ArrayBuffer || ArrayBuffer.isView(a)) {
        binaryItem(a, out)
    }
    else if (a instanceof Date) {
        encodeDate(a, out)
    }
    else if (a instanceof Map) {
        encodeMapRecursive(a, out)
    }
    else {
        encodeObjectRecursive(a, out)
    }
}
export const encodeRecursive = (a, out: Output) => {
    if (typeof a == 'string') {
        textItem(a, out)
    }
    else if (typeof a == 'number') {
        numberItem(a, out)
    }
    else if (typeof a == 'object') {
        encodeObjectFuncRecursive(a, out)
    }
    else if (typeof a == 'boolean') {
        booleanItem(a, out)
    }
    else if (typeof a == 'bigint') {
        bigintItem(a, out)
    }
    else if (a === undefined) {
        undefinedItem(out)
    }
    else {
        throw new Error('unsupported type ' + typeof a)
    }
}
export type EncodeObjectFunc = (value, stack: any[], out: Output) => void
export type EncodeAltFunc = (value, stack: any[], out: Output) => boolean
export const encodeLoop = (out: Output, encodeObject: EncodeObjectFunc, alt?: EncodeAltFunc) => {
    const st = out.stack
    if (out.resumeItem) {
        const resume = out.resumeItem
        out.resumeItem = undefined
        for (let r of resume) {
            writeItem(r.major, r.adInfo, out)
        }
    }
    if (out.resumeBuffer) {
        appendBuffer(out, out.resumeBuffer)
    }
    while (st.length > 0 && !out.resumeItem && !out.resumeBuffer) {
        const a = st.pop()
        if (alt && alt(a, st, out)) {
        }
        else {
            if (typeof a == 'string') {
                textItem(a, out)
            }
            else if (typeof a == 'number') {
                numberItem(a, out)
            }
            else if (typeof a == 'object') {
                encodeObject(a, st, out)
            }
            else if (typeof a == 'boolean') {
                booleanItem(a, out)
            }
            else if (typeof a == 'bigint') {
                bigintItem(a, out)
            }
            else if (a === undefined) {
                undefinedItem(out)
            }
            else {
                throw new Error('unsupported type ' + typeof a)
            }
        }
    }
}
export const encodeArrayLoop = (a: any[], stack: any[], out: Output) => {
    arrayItem(a.length, out)
    for (let i = a.length - 1; i >= 0; i--) {
        stack.push(a[i])
    }
}
export const encodeObjectLoop = (a, stack: any[], out: Output) => {
    const ks = Object.keys(a)
    mapItem(ks.length, out)
    for (let i = ks.length - 1; i >= 0; i--) {
        stack.push(a[ks[i]])
        stack.push(ks[i])
    }
}
export const encodeMapLoop = (a: Map<any, any>, stack: any[], out: Output) => {
    mapItem(a.size, out)
    const ks = Array.from(a.entries())
    for (let i = ks.length - 1; i >= 0; i--) {
        stack.push(ks[i][1])
        stack.push(ks[i][0])
    }
}
export const encodeDate = (a, out: Output) => {
    if (a.getTime() % 1000 == 0) {
        tagItem(tags.datePOSIX, out)
        integerItem(a.getTime() / 1000, out)
    }
    else {
        tagItem(tags.extendedTime, out)
        mapItem(2, out)
        integerItem(1, out)
        integerItem(Math.floor(a.getTime() / 1000), out)
        integerItem(-3, out)
        integerItem(a.getTime() % 1000, out)
    }
}
export const encodeSetLoop = (a: Set<any>, stack: any[], out: Output) => {
    arrayItem(a.size, out)
    const ks = Array.from(a.values())
    for (let i = ks.length - 1; i >= 0; i--) {
        stack.push(ks[i])
    }
}
export const encodeObjectFuncLoop = (a, stack: any[], out: Output) => {
    if (a === null) {
        nullItem(out)
    }
    else if (Array.isArray(a)) {
        encodeArrayLoop(a, stack, out)
    }
    else if (a instanceof ArrayBuffer || ArrayBuffer.isView(a)) {
        binaryItem(a, out)
    }
    else if (a instanceof Date) {
        encodeDate(a, out)
    }
    else if (a instanceof Map) {
        encodeMapLoop(a, stack, out)
    }
    else {
        encodeObjectLoop(a, stack, out)
    }
}
export const encodeSync = (value, out: Output): Uint8Array[] => {
    resetOutput(out)
    out.buffers = []
    if (out.useRecursion) {
        encodeRecursive(value, out)
        out.buffers.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
        return out.buffers
    }
    out.stack = [value]
    return encodeSyncLoop(out)
}
export const encodeSyncLoop = (out: Output): Uint8Array[] => {
    do {
        encodeLoop(out, encodeObjectFuncLoop)
        out.buffers.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
        resetOutput(out)
    }
    while (out.resumeItem || out.resumeBuffer)
    return out.buffers
}
export const resetOutput = (out: Output, view?: ArrayBufferView) => {
    if (out.view.byteLength - out.length < out.minViewSize) {
        out.backingView = new Uint8Array(out.newBufferSize)
        out.offset = 0
    }
    else {
        out.offset += out.length
    }
    out.view = view ? new DataView(view.buffer, view.byteOffset, view.byteLength) : new DataView(out.backingView.buffer, out.backingView.byteOffset + out.offset, out.backingView.byteLength - out.offset)
    out.length = 0
}
export const concat = (buffers: Uint8Array[]): Uint8Array => {
    if (buffers.length == 1) {
        return buffers[0]
    }
    const u = new Uint8Array(buffers.reduce((a, b) => a + b.byteLength, 0))
    let offset = 0
    for (let b of buffers) {
        u.set(b, offset)
        offset += b.byteLength
    }
    return u
}
export type DecodeStackItem = { major: 4 | 5 | 6, length: number, temp: any[], tag?: number | bigint }
export type Input = { buffer: BufferSource, position: number, stack?: DecodeStackItem[], stopPosition?: number }
export const getFloat16 = (dv: DataView, offset: number, littleEndian?: boolean): number => {
    const leadByte = dv.getUint8(offset + (littleEndian ? 1 : 0))
    const sign = leadByte & 0x80 ? -1 : 1
    const exp = (leadByte & 0x7C) >> 2
    const mant = ((leadByte & 0x03) << 8) | dv.getUint8(offset + (littleEndian ? 0 : 1))
    if (!exp) {
        return sign * 5.9604644775390625e-8 * mant
    } else if (exp === 0x1f) {
        return sign * (mant ? 0 / 0 : 2e308)
    }
    return sign * Math.pow(2, exp - 25) * (1024 + mant)
}
export const checkInput = (src: Input, length: number, backtrack: number = 0): boolean => {
    if (src.position + length > src.buffer.byteLength) {
        src.stopPosition = src.position - 1 - backtrack
        return false
    }
    return true
}
export const decodeAdditionalInformation = (major: number, ai: number, dv: DataView, src: Input): number | bigint => {
    if (ai < 24) {
        return ai
    }
    switch (ai) {
        case 24:
            if (major == 7) {
                throw new Error('not implemented simple type 24')
            }
            if (checkInput(src, 1)) {
                const v = dv.getUint8(src.position);
                src.position++
                return v
            }
            break
        case 25:
            if (checkInput(src, 2)) {
                const v = major == 7 ? getFloat16(dv, src.position) : dv.getUint16(src.position);
                src.position += 2
                return v
            }
            break
        case 26:
            if (checkInput(src, 4)) {
                const v = major == 7 ? dv.getFloat32(src.position) : dv.getUint32(src.position);
                src.position += 4
                return v
            }
            break
        case 27:
            if (checkInput(src, 8)) {
                if (major == 7) {
                    const v = dv.getFloat64(src.position)
                    src.position += 8
                    return v
                }
                const hi = dv.getUint32(src.position)
                const lo = dv.getUint32(src.position + 4)
                let v
                if (hi > 0x1fffff) {
                    v = (BigInt(hi) * BigInt(0x100000000)) + BigInt(lo)
                }
                else {
                    v = hi * 0x100000000 + lo
                }
                src.position += 8
                if (major >= 2 && major <= 5) {
                    if (typeof v != 'number') {
                        throw new Error('value too large for length: ' + v)
                    }
                    checkInput(src, v, 8)
                }
                return v
            }
            break
        default:
            throw new Error('not implemented additional information: ' + ai)
    }
    return 0
}
export const slice = (length: number, src: Input) => {
    const b = src.buffer instanceof ArrayBuffer ? src.buffer.slice(src.position, src.position + length) : src.buffer.buffer.slice(src.position + src.buffer.byteOffset, src.position + src.buffer.byteOffset + length)
    src.position += length;
    return b
}
export type ParseItemFunc = (major: number, additionalInformation: number, dv: DataView, src: Input) => any
export type FinishItemFunc = (stack: DecodeStackItem[]) => any
export const decodeLoop = (src: Input, parseItem: ParseItemFunc, finishItem: FinishItemFunc) => {
    const dv = src.buffer instanceof ArrayBuffer ? new DataView(src.buffer) : new DataView(src.buffer.buffer, src.buffer.byteOffset, src.buffer.byteLength)
    if (!src.stack) {
        src.stack = []
    }
    const st = src.stack
    while (src.position < src.buffer.byteLength && src.stopPosition === undefined) {
        const c = dv.getUint8(src.position)
        src.position++;
        const major = c >> 5
        const ai = c & 31
        const result = parseItem(major, ai, dv, src)
        if (src.stopPosition === undefined) {
            let head = st[st.length - 1]
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
                finishedItem = finishItem(st)
                st.pop()
                head = st[st.length - 1]
                if (head) {
                    head.temp.push(finishedItem)
                }
            }
            if (st.length == 0) {
                return finishedItem
            }
        }
    }
}
export const decodeBigInt = (v: ArrayBuffer, lastTag: number) => {
    let norm = BigInt(0)
    let base = BigInt(1)
    const u = new Uint8Array(v).reverse()
    for (let i = 0; i < u.byteLength; i++) {
        norm = norm + base * BigInt(u[i])
        base = base * BigInt(256)
    }
    return lastTag == tags.negativeBigNum ? BigInt(-1) - norm : norm
}
export const parseItem: ParseItemFunc = (major: number, ai: number, dv: DataView, src: Input) => {
    let result
    switch (major) {
        case 0:
            result = decodeAdditionalInformation(major, ai, dv, src)
            break
        case 1: {
            const a = decodeAdditionalInformation(major, ai, dv, src)
            result = typeof a != 'number' ? BigInt(-1) - a : -1 - a
            break
        }
        case 2: {
            const a = decodeAdditionalInformation(major, ai, dv, src) as number
            result = slice(a, src)
            break
        }
        case 3: {
            const a = decodeAdditionalInformation(major, ai, dv, src) as number
            result = TD.decode(src.buffer instanceof ArrayBuffer ? new DataView(src.buffer, src.position, a) : new DataView(src.buffer.buffer, src.buffer.byteOffset + src.position, a))
            src.position += a;
            break
        }
        case 4: {
            const a = decodeAdditionalInformation(major, ai, dv, src) as number
            src.stack.push({ major, length: a, temp: [] })
            break
        }
        case 5: {
            const a = decodeAdditionalInformation(major, ai, dv, src) as number
            src.stack.push({ major, length: a * 2, temp: [] })
            break
        }
        case 6: {
            const a = decodeAdditionalInformation(major, ai, dv, src)
            src.stack.push({ major, length: 1, temp: [], tag: a })
            break
        }
        case 7: {
            if (ai < 24) {
                switch (ai) {
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
                    default:
                        throw new Error('not implemented additional information: ' + ai)
                }
            }
            else {
                result = decodeAdditionalInformation(major, ai, dv, src)
            }
            break
        }
    }
    return result
}
export const finishItem: FinishItemFunc = (stack: DecodeStackItem[]) => {
    const head = stack[stack.length - 1]
    switch (head.major) {
        case 4:
            return head.temp
        case 5:
            if (head.temp.filter((x, i) => i % 2 == 0).some(x => typeof x != 'string')) {
                const m = new Map()
                for (let j = 0; j < head.length; j = j + 2) {
                    m.set(head.temp[j], head.temp[j + 1])
                }
                return m
            }
            const o = {}
            for (let j = 0; j < head.length; j = j + 2) {
                o[head.temp[j]] = head.temp[j + 1]
            }
            return o
        case 6:
            const v = head.temp[0]
            let x
            switch (head.tag) {
                case tags.positiveBigNum:
                case tags.negativeBigNum: {
                    x = decodeBigInt(v, head.tag)
                    break
                }
                case tags.datePOSIX:
                    x = new Date(v * 1000)
                    break
                case tags.extendedTime:
                    x = new Date(v.get(1) * 1000 + v.get(-3))
                    break
            }
            return x
    }
}
export const finalChecks = (src: Input, op: { allowExcessBuffer?: boolean, endPosition?: number }) => {
    if (src.stack.length > 0) {
        throw new Error('unfinished depth: ' + src.stack.length)
    }
    if (src.stopPosition !== undefined) {
        throw new Error('unexpected end of buffer: ' + src.stopPosition)
    }
    if (!op?.allowExcessBuffer && src.position != src.buffer.byteLength) {
        throw new Error('length mismatch ' + src.position + ' ' + src.buffer.byteLength)
    }
    if (op) {
        op.endPosition = src.position
    }
}
export const enum tags {
    datePOSIX = 1,
    positiveBigNum = 2,
    negativeBigNum = 3,
    shareable = 28,
    sharedRef = 29,
    uint8 = 64,
    uint8Clamped = 68,
    uint16LE = 69,
    uint32LE = 70,
    uint64LE = 71,
    sint8 = 72,
    sint16LE = 77,
    sint32LE = 78,
    sint64LE = 79,
    float32LE = 85,
    float64LE = 86,
    Set = 258,
    Map = 259,
    WTF8 = 273,

    JSNumberObject = 300,
    JSStringObject = 301,
    JSBooleanObject = 302,
    JSBigIntObject = 303,
    JSBlob = 304,
    JSFile = 305,
    JSFileList = 306,
    JSDataView = 307,
    JSImageBitmap = 308,
    JSImageData = 309,
    JSCryptoKey = 310,
    JSError = 311,
    JSDOMPointReadOnly = 312,
    JSDOMPoint = 313,
    JSDOMRectReadOnly = 314,
    JSDOMRect = 315,
    JSDOMMatrixReadOnly = 316,
    JSDOMMatrix = 317,
    JSDOMQuad = 318,
    JSURLSearchParams = 319,
    JSRegExp = 320,

    extendedTime = 1001,
}
export type Options = { backingView?: ArrayBufferView, newBufferSize?: number, minViewSize?: number, useWTF8?: boolean, useRecursion?: boolean }