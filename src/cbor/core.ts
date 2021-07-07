const TE = new TextEncoder()
export const TD = new TextDecoder('utf-8', { fatal: true })
export const sharedRefSymbol = Symbol.for('https://github.com/bintoca/lib/cbor/sharedRef')
export const defaultBufferSize = 4096
export const defaultMinViewSize = 512
export type MajorTypes = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | -1
export type EncoderState = {
    view: DataView, length: number, stack: any[], buffers?: Uint8Array[], useWTF8?: { encode: (s: string) => string }, encodeCycles?: boolean, cycleMap?: WeakMap<any, number>, cycleSet?: WeakSet<any>, omitMapTag?: boolean,
    typeMap: WeakMap<Function, (a, out: EncoderState) => void>, backingView: ArrayBufferView, offset: number, newBufferSize: number, minViewSize: number,
    encodeItemFunc: (a, out: EncoderState) => void, resume?: { items?: { major: MajorTypes, adInfo: number, float?: boolean }[], buffer?: BufferSource, promise?: Promise<void> }, resumeFunc: (out: EncoderState) => void
}
export const appendBuffer = (out: EncoderState, b: BufferSource) => {
    if (out.resume) {
        out.resume.buffer = b
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
            if (!out.resume) {
                out.resume = {}
            }
            out.resume.buffer = b instanceof ArrayBuffer ? new Uint8Array(b, len, b.byteLength - len) : new Uint8Array(b.buffer, b.byteOffset + len, b.byteLength - len)
        }
    }
}
export const writeItemCore = (major: MajorTypes, adInfo: number, dv: DataView, offset: number): number => {
    if (major == -1) {
        if (isNaN(adInfo)) {
            if (offset + 3 > dv.byteLength) {
                return 0
            }
            dv.setUint8(offset, 0xf9)
            dv.setUint16(offset + 1, 0x7e00)
            return 3
        }
        if (!isFinite(adInfo)) {
            if (offset + 3 > dv.byteLength) {
                return 0
            }
            dv.setUint8(offset, 0xf9)
            dv.setUint16(offset + 1, adInfo < 0 ? 0xfc00 : 0x7c00)
            return 3
        }
        if (Object.is(adInfo, -0)) {
            if (offset + 3 > dv.byteLength) {
                return 0
            }
            dv.setUint8(offset, 0xf9)
            dv.setUint16(offset + 1, 0x8000)
            return 3
        }
        if (Math.floor(adInfo) !== adInfo || adInfo > Number.MAX_SAFE_INTEGER || adInfo < Number.MIN_SAFE_INTEGER) {
            if (Math.fround(adInfo) === adInfo) {
                if (offset + 5 > dv.byteLength) {
                    return 0
                }
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
            if (offset + 9 > dv.byteLength) {
                return 0
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
    if (adInfo == -1) {
        if (offset + 1 > dv.byteLength) {
            return 0
        }
        dv.setUint8(offset, majorShift | 31)
        return 1
    }
    else if (adInfo < 24) {
        if (offset + 1 > dv.byteLength) {
            return 0
        }
        dv.setUint8(offset, majorShift | adInfo)
        return 1
    } else if (adInfo < 0x100) {
        if (offset + 2 > dv.byteLength) {
            return 0
        }
        dv.setUint8(offset, majorShift | 24)
        dv.setUint8(offset + 1, adInfo)
        return 2
    } else if (adInfo < 0x10000) {
        if (offset + 3 > dv.byteLength) {
            return 0
        }
        dv.setUint8(offset, majorShift | 25)
        dv.setUint16(offset + 1, adInfo)
        return 3
    } else if (adInfo < 0x100000000) {
        if (offset + 5 > dv.byteLength) {
            return 0
        }
        dv.setUint8(offset, majorShift | 26)
        dv.setUint32(offset + 1, adInfo)
        return 5
    }
    if (offset + 9 > dv.byteLength) {
        return 0
    }
    dv.setUint8(offset, majorShift | 27)
    dv.setUint32(offset + 1, Math.floor(adInfo / 0x100000000))
    dv.setUint32(offset + 5, adInfo % 0x100000000)
    return 9
}
export const writeItem = (major: MajorTypes, adInfo: number, out: EncoderState) => {
    const written = out.resume ? 0 : writeItemCore(major, adInfo, out.view, out.length)
    if (written) {
        out.length += written
    }
    else {
        if (!out.resume) {
            out.resume = {}
        }
        if (!out.resume.items) {
            out.resume.items = []
        }
        out.resume.items.push({ major, adInfo })
    }
}
export const integerItem = (value: number, out: EncoderState) => value >= 0 ? writeItem(0, value, out) : writeItem(1, -(value + 1), out)
export const nullItem = (out: EncoderState) => writeItem(7, 22, out)
export const undefinedItem = (out: EncoderState) => writeItem(7, 23, out)
export const booleanItem = (value: boolean, out: EncoderState) => writeItem(7, value ? 21 : 20, out)
export const binaryItem = (v: BufferSource, out: EncoderState) => {
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
export const stringItemCopy = (s: string, out: EncoderState) => {
    let major: MajorTypes = 3
    if (out.useWTF8 && hasBadSurrogates(s)) {
        s = out.useWTF8.encode(s)
        tagItem(tags.WTF8, out)
        major = 2
    }
    const v = TE.encode(s)
    writeItem(major, v.byteLength, out)
    appendBuffer(out, v)
}
export const stringItem = (s: string, out: EncoderState) => {
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
        stringItemCopy(s, out)
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
                        stringItemCopy(s, out)
                    }
                }
            }
            else {
                out.length = start
                stringItemCopy(s, out)
            }
        }
        else {
            stringItemCopy(s, out)
        }
    }
}
export const arrayItem = (length: number, out: EncoderState) => writeItem(4, length, out)
export const mapItem = (length: number, out: EncoderState) => writeItem(5, length, out)
export const tagItem = (id: number, out: EncoderState) => writeItem(6, id, out)
export const numberItem = (val: number, out: EncoderState) => writeItem(-1, val, out)
export const indefiniteBinaryBegin = (out: EncoderState) => writeItem(2, -1, out)
export const indefiniteStringBegin = (out: EncoderState) => writeItem(3, -1, out)
export const indefiniteArrayBegin = (out: EncoderState) => writeItem(4, -1, out)
export const indefiniteMapBegin = (out: EncoderState) => writeItem(5, -1, out)
export const indefiniteEnd = (out: EncoderState) => writeItem(7, -1, out)
export const bigintItem = (val: bigint, out: EncoderState) => {
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
export const objectItem = (a: Object, out: EncoderState) => {
    if (a === null) {
        nullItem(out)
        return
    }
    if (out.encodeCycles) {
        if (encodeCycles(a, out)) {
            return
        }
    }
    const typ = out.typeMap.get(a.constructor || NullConstructor)
    if (typ) {
        typ(a, out)
    }
    else {
        throw new Error('type mapping not found: ' + a.constructor?.name)
    }
}
export const encodeItem = (a, out: EncoderState) => {
    if (typeof a == 'string') {
        stringItem(a, out)
    }
    else if (typeof a == 'number') {
        numberItem(a, out)
    }
    else if (typeof a == 'object') {
        objectItem(a, out)
    }
    else if (typeof a == 'boolean') {
        booleanItem(a, out)
    }
    else if (typeof a == 'bigint') {
        bigintItem(a, out)
    }
    else if (typeof a == 'undefined') {
        undefinedItem(out)
    }
    else {
        throw new Error('unsupported type: ' + typeof a)
    }
}
export const resumeItem = (out: EncoderState) => {
    if (out.resume) {
        const resume = out.resume
        out.resume = undefined
        if (resume.items) {
            for (let r of resume.items) {
                writeItem(r.major, r.adInfo, out)
            }
        }
        if (resume.buffer) {
            appendBuffer(out, resume.buffer)
        }
    }
}
export const encodeLoop = (out: EncoderState) => {
    out.resumeFunc(out)
    while (out.stack.length > 0 && !out.resume) {
        const a = out.stack.pop()
        out.encodeItemFunc(a, out)
    }
}
export const encodeObject = (a: Object, out: EncoderState) => {
    const ks = Object.keys(a)
    mapItem(ks.length, out)
    for (let i = ks.length - 1; i >= 0; i--) {
        out.stack.push(a[ks[i]])
        out.stack.push(ks[i])
    }
}
export const encodeCycles = (a, out: EncoderState): boolean => {
    const shareIndex = out.cycleMap.get(a)
    if (shareIndex >= 0) {
        if (out.cycleSet.has(a)) {
            tagItem(tags.sharedRef, out)
            integerItem(shareIndex, out)
            return true
        }
        else {
            out.cycleSet.add(a)
            tagItem(tags.shareable, out)
        }
    }
}
export const encodeSync = (value, out: EncoderState): Uint8Array[] => {
    resetOutput(out)
    const buf = []
    out.buffers = buf
    detectCycles(value, out)
    out.stack = [value]
    do {
        encodeLoop(out)
        out.buffers.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
        resetOutput(out)
        if (out.resume?.promise) {
            throw new Error('promise based resume not allowed in sync mode')
        }
    }
    while (out.resume)
    out.buffers = undefined
    return buf
}
export const resetOutput = (out: EncoderState, view?: ArrayBufferView) => {
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
export const detectCycles = (value, out: EncoderState) => {
    if (out.encodeCycles) {
        const w = new WeakMap()
        let index = 0
        const stack = [value]
        while (stack.length > 0) {
            let v = stack.pop()
            if (w.has(v)) {
                w.set(v, index)
                index++
                continue
            }
            if (typeof v == 'object' && v !== null) {
                w.set(v, -1)
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
        out.cycleMap = w
        out.cycleSet = new WeakSet()
    }
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
export type DecodeStackItem = { major: 4 | 5 | 6, length: number, temp: any[], tag?: number | bigint, shareableIndex?: number, container?: any }
export type DecoderState = {
    buffer: BufferSource, position: number, stack?: DecodeStackItem[], decodeItemFunc: (major: number, additionalInformation: number, dv: DataView, src: DecoderState) => any,
    finishItemFunc: (state: DecoderState) => any, stopPosition?: number, tagMap: Map<number | bigint, (v, tag?: number | bigint) => any>, shared?: any[]
}
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
export const checkInput = (src: DecoderState, length: number, backtrack: number = 0): boolean => {
    if (src.position + length > src.buffer.byteLength) {
        src.stopPosition = src.position - 1 - backtrack
        return false
    }
    return true
}
export const decodeInfo = (major: number, ai: number, dv: DataView, src: DecoderState): number | bigint => {
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
export const slice = (length: number, src: DecoderState) => {
    const b = src.buffer instanceof ArrayBuffer ? src.buffer.slice(src.position, src.position + length) : src.buffer.buffer.slice(src.position + src.buffer.byteOffset, src.position + src.buffer.byteOffset + length)
    src.position += length;
    return b
}
export const decodeLoop = (src: DecoderState) => {
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
        const result = src.decodeItemFunc(major, ai, dv, src)
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
                finishedItem = src.finishItemFunc(src)
                st.pop()
                head = st[st.length - 1]
                if (head) {
                    head.temp.push(finishedItem)
                }
            }
            if (st.length == 0) {
                if (src.shared.length > 0) {
                    decodeCycles(finishedItem, src)
                }
                return finishedItem
            }
        }
    }
}
export const decodeCycles = (value, state: DecoderState) => {
    const stack = [value]
    while (stack.length > 0) {
        let val = stack.pop()
        if (typeof val == 'object' && val !== null) {
            if (val instanceof Map) {
                const ks = Array.from(val.entries())
                for (let i = ks.length - 1; i >= 0; i--) {
                    let k = ks[i][0]
                    let v = ks[i][1]
                    let newK, newV
                    if (k && k[sharedRefSymbol] !== undefined) {
                        newK = true
                        k = state.shared[k[sharedRefSymbol]]
                    }
                    if (v && v[sharedRefSymbol] !== undefined) {
                        newV = true
                        v = state.shared[v[sharedRefSymbol]]
                    }
                    if (newK) {
                        val.delete(ks[i][0])
                        val.set(k, v)
                        if (!newV) {
                            stack.push(v)
                        }
                    }
                    else if (newV) {
                        val.set(k, v)
                        stack.push(k)
                    }
                }
            }
            else if (val instanceof Set) {
                const ks = Array.from(val.values())
                for (let i = ks.length - 1; i >= 0; i--) {
                    if (ks[i] && ks[i][sharedRefSymbol] !== undefined) {
                        val.delete(ks[i])
                        val.add(state.shared[ks[i][sharedRefSymbol]])
                    }
                    else {
                        stack.push(ks[i])
                    }
                }
            }
            else if (Array.isArray(val)) {
                for (let i = val.length - 1; i >= 0; i--) {
                    if (val[i] && val[i][sharedRefSymbol] !== undefined) {
                        val[i] = state.shared[val[i][sharedRefSymbol]]
                    }
                    else {
                        stack.push(val[i])
                    }
                }
            }
            else {
                const ks = Object.keys(val)
                for (let i = ks.length - 1; i >= 0; i--) {
                    if (val[ks[i]] && val[ks[i]][sharedRefSymbol] !== undefined) {
                        val[ks[i]] = state.shared[val[ks[i]][sharedRefSymbol]]
                    }
                    else {
                        stack.push(val[ks[i]])
                    }
                }
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
export const decodeItem = (major: number, ai: number, dv: DataView, src: DecoderState) => {
    let result
    switch (major) {
        case 0:
            result = decodeInfo(major, ai, dv, src)
            break
        case 1: {
            const a = decodeInfo(major, ai, dv, src)
            result = typeof a != 'number' ? BigInt(-1) - a : -1 - a
            break
        }
        case 2: {
            const a = decodeInfo(major, ai, dv, src) as number
            result = slice(a, src)
            break
        }
        case 3: {
            const a = decodeInfo(major, ai, dv, src) as number
            result = TD.decode(src.buffer instanceof ArrayBuffer ? new DataView(src.buffer, src.position, a) : new DataView(src.buffer.buffer, src.buffer.byteOffset + src.position, a))
            src.position += a;
            break
        }
        case 4: {
            const a = decodeInfo(major, ai, dv, src) as number
            src.stack.push({ major, length: a, temp: [] })
            break
        }
        case 5: {
            const a = decodeInfo(major, ai, dv, src) as number
            src.stack.push({ major, length: a * 2, temp: [] })
            break
        }
        case 6: {
            const a = decodeInfo(major, ai, dv, src)
            src.stack.push({ major, length: 1, temp: [], tag: a, shareableIndex: a == tags.shareable ? src.shared.length : undefined })
            if (a == tags.shareable) {
                src.shared.push(undefined)
            }
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
                result = decodeInfo(major, ai, dv, src)
            }
            break
        }
    }
    return result
}
export const finishItem = (state: DecoderState) => {
    const head = state.stack[state.stack.length - 1]
    const parent = state.stack[state.stack.length - 2]
    switch (head.major) {
        case 4:
            return parent?.tag == tags.Set ? new Set(head.temp) : head.temp
        case 5:
            if (parent?.tag == tags.Map || head.temp.filter((x, i) => i % 2 == 0).some(x => typeof x != 'string')) {
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
            if (head.tag == tags.shareable) {
                state.shared[head.shareableIndex] = v
                return v
            }
            else if (head.tag == tags.sharedRef) {
                return { [sharedRefSymbol]: v }
            }
            const tagFunc = state.tagMap.get(head.tag)
            return tagFunc ? tagFunc(v, head.tag) : v
    }
}
export const finalChecks = (src: DecoderState, op: { allowExcessBuffer?: boolean, endPosition?: number }) => {
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
    dateString = 0,
    datePOSIX = 1,
    positiveBigNum = 2,
    negativeBigNum = 3,
    typeConstructor = 27,
    shareable = 28,
    sharedRef = 29,
    uint8 = 64,
    uint16BE = 65,
    uint32BE = 66,
    uint64BE = 67,
    uint8Clamped = 68,
    uint16LE = 69,
    uint32LE = 70,
    uint64LE = 71,
    sint8 = 72,
    sint16BE = 73,
    sint32BE = 74,
    sint64BE = 75,
    sint16LE = 77,
    sint32LE = 78,
    sint64LE = 79,
    float32BE = 81,
    float64BE = 82,
    float32LE = 85,
    float64LE = 86,
    Set = 258,
    Map = 259,
    WTF8 = 273,

    extendedTime = 1001,
}
export type EncoderOptions = Partial<Omit<EncoderState, 'cycleMap' | 'cycleSet' | 'buffers'>>
export const setupEncoder = (op: EncoderOptions = {}): EncoderState => {
    op.backingView = op.backingView || new Uint8Array(op.newBufferSize || defaultBufferSize)
    op.offset = op.offset || 0
    op.newBufferSize = op.newBufferSize || defaultBufferSize
    op.minViewSize = op.minViewSize || defaultMinViewSize
    op.encodeItemFunc = op.encodeItemFunc || encodeItem
    op.resumeFunc = op.resumeFunc || resumeItem
    op.typeMap = op.typeMap || new WeakMap(defaultTypeMap)
    op.view = op.view || new DataView(op.backingView.buffer, op.backingView.byteOffset, op.backingView.byteLength)
    op.length = op.length || 0
    op.stack = op.stack || []
    return op as EncoderState
}
export type DecoderOptions = Partial<Omit<DecoderState, ''>>
export const setupDecoder = (op: DecoderOptions = {}): DecoderState => {
    op.decodeItemFunc = op.decodeItemFunc || decodeItem
    op.finishItemFunc = op.finishItemFunc || finishItem
    op.tagMap = op.tagMap || new Map(defaultTagMap)
    return op as DecoderState
}
export class TagHelper { constructor(t) { this.tag = t }; tag: number }
export class NullConstructor { }
export const defaultTypeMap = new Map<Function, (a, out: EncoderState) => void>([[Object, encodeObject], [NullConstructor, encodeObject], [ArrayBuffer, binaryItem],
[Array, (a: any[], out: EncoderState) => {
    arrayItem(a.length, out)
    for (let i = a.length - 1; i >= 0; i--) {
        out.stack.push(a[i])
    }
}],
[Map, (a: Map<any, any>, out: EncoderState) => {
    if (!out.omitMapTag) {
        tagItem(tags.Map, out)
    }
    mapItem(a.size, out)
    const ks = Array.from(a.entries())
    for (let i = ks.length - 1; i >= 0; i--) {
        out.stack.push(ks[i][1])
        out.stack.push(ks[i][0])
    }
}],
[Set, (a: Set<any>, out: EncoderState) => {
    tagItem(tags.Set, out)
    arrayItem(a.size, out)
    const ks = Array.from(a.values())
    for (let i = ks.length - 1; i >= 0; i--) {
        out.stack.push(ks[i])
    }
}],
[Date, (a: Date, out: EncoderState) => {
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
}],
[Uint8Array, (a: Uint8Array, out: EncoderState) => {
    tagItem(tags.uint8, out)
    binaryItem(a, out)
}],
[TagHelper, (a: TagHelper, out: EncoderState) => {
    tagItem(a.tag, out)
}],
[typeof Blob == 'function' ? Blob : () => { }, (a: Blob, out: EncoderState) => {
    out.resume = {
        promise: a.arrayBuffer().then(x => {
            out.stack.push(['Blob', [x], { type: a.type }])
            out.stack.push(new TagHelper(tags.typeConstructor))
        })
    }
}]
])
export const defaultTagMap = new Map<number | bigint, (v, tag?: number | bigint) => any>([[tags.dateString, (v) => new Date(v)], [tags.datePOSIX, (v) => new Date(v * 1000)], [tags.extendedTime, (v) => new Date((v.get(1) || 0) * 1000 + (v.get(-3) || 0))],
[tags.positiveBigNum, decodeBigInt], [tags.negativeBigNum, decodeBigInt],
[tags.Map, (v) => {
    if (v instanceof Map) {
        return v
    }
    throw new Error('invalid Map tag')
}],
[tags.Set, (v) => {
    if (v instanceof Set) {
        return v
    }
    throw new Error('invalid Set tag')
}],
[tags.uint8, (v) => new Uint8Array(v)]
])