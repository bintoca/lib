const TE = new TextEncoder()
export const TD = new TextDecoder('utf-8', { fatal: true })
export const sharedRefSymbol = Symbol.for('https://github.com/bintoca/lib/cbor/sharedRef')
export const defaultBufferSize = 4096
export const defaultMinViewSize = 512
export type MajorTypes = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | -1
export type EncoderState = {
    view: DataView, length: number, stack: any[], buffers?: Uint8Array[], useWTF8?: { encode: (s: string) => string }, cycleMap?: WeakMap<any, number>, cycleSet?: WeakSet<any>, omitMapTag?: boolean,
    typeMap: WeakMap<Function, (a, out: EncoderState) => void>, backingView: ArrayBufferView, offset: number, newBufferSize: number, minViewSize: number, disableSharedReferences?: boolean,
    encodeItemFunc: (a, state: EncoderState) => void, resume?: { items?: { major: MajorTypes, adInfo: number, float?: boolean }[], buffer?: BufferSource, promise?: Promise<void> }, resumeFunc: (out: EncoderState) => void
}
export const appendBuffer = (state: EncoderState, b: BufferSource) => {
    if (state.resume) {
        state.resume.buffer = b
    }
    else {
        if (state.length + b.byteLength <= state.view.byteLength) {
            new Uint8Array(state.view.buffer, state.view.byteOffset, state.view.byteLength).set(b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength), state.length)
            state.length += b.byteLength
        }
        else {
            const len = state.view.byteLength - state.length
            new Uint8Array(state.view.buffer, state.view.byteOffset, state.view.byteLength).set(b instanceof ArrayBuffer ? new Uint8Array(b, 0, len) : new Uint8Array(b.buffer, b.byteOffset, len), state.length)
            state.length += len
            if (!state.resume) {
                state.resume = {}
            }
            state.resume.buffer = b instanceof ArrayBuffer ? new Uint8Array(b, len, b.byteLength - len) : new Uint8Array(b.buffer, b.byteOffset + len, b.byteLength - len)
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
export const writeItem = (major: MajorTypes, adInfo: number, state: EncoderState) => {
    const written = state.resume ? 0 : writeItemCore(major, adInfo, state.view, state.length)
    if (written) {
        state.length += written
    }
    else {
        if (!state.resume) {
            state.resume = {}
        }
        if (!state.resume.items) {
            state.resume.items = []
        }
        state.resume.items.push({ major, adInfo })
    }
}
export const integerItem = (value: number, state: EncoderState) => value >= 0 ? writeItem(0, value, state) : writeItem(1, -(value + 1), state)
export const nullItem = (state: EncoderState) => writeItem(7, 22, state)
export const undefinedItem = (state: EncoderState) => writeItem(7, 23, state)
export const booleanItem = (value: boolean, state: EncoderState) => writeItem(7, value ? 21 : 20, state)
export const binaryItem = (v: BufferSource, state: EncoderState) => {
    writeItem(2, v.byteLength, state)
    appendBuffer(state, v)
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
export const stringItemCopy = (s: string, state: EncoderState) => {
    let major: MajorTypes = 3
    if (state.useWTF8 && hasBadSurrogates(s)) {
        s = state.useWTF8.encode(s)
        tagItem(tags.WTF8, state)
        major = 2
    }
    const v = TE.encode(s)
    writeItem(major, v.byteLength, state)
    appendBuffer(state, v)
}
export const stringItem = (s: string, state: EncoderState) => {
    const maybeFitsView = state.length + s.length + 9 <= state.view.byteLength
    const start = state.length
    let fullEncode
    if (maybeFitsView) {
        const dv = state.view
        writeItem(3, s.length, state)
        const len = state.length
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
        state.length += s.length
    }
    else {
        stringItemCopy(s, state)
    }
    if (fullEncode) {
        state.length = start
        if (!state.useWTF8 && TE.encodeInto && maybeFitsView) {
            writeItem(3, s.length, state)
            const r = TE.encodeInto(s, new Uint8Array(state.view.buffer, state.view.byteOffset + state.length, state.view.byteLength - state.length))
            if (r.read == s.length) {
                if (r.written == s.length) {
                    state.length += r.written
                }
                else {
                    if (state.length - start == writeItemCore(3, r.written, state.view, start)) {
                        state.length += r.written
                    }
                    else {
                        state.length = start
                        stringItemCopy(s, state)
                    }
                }
            }
            else {
                state.length = start
                stringItemCopy(s, state)
            }
        }
        else {
            stringItemCopy(s, state)
        }
    }
}
export const arrayItem = (length: number, state: EncoderState) => writeItem(4, length, state)
export const mapItem = (length: number, state: EncoderState) => writeItem(5, length, state)
export const tagItem = (id: number, state: EncoderState) => writeItem(6, id, state)
export const numberItem = (val: number, state: EncoderState) => writeItem(-1, val, state)
export const indefiniteBinaryBegin = (state: EncoderState) => writeItem(2, -1, state)
export const indefiniteStringBegin = (state: EncoderState) => writeItem(3, -1, state)
export const indefiniteArrayBegin = (state: EncoderState) => writeItem(4, -1, state)
export const indefiniteMapBegin = (state: EncoderState) => writeItem(5, -1, state)
export const indefiniteEnd = (state: EncoderState) => writeItem(7, -1, state)
export const bigintItem = (val: bigint, state: EncoderState) => {
    tagItem(val >= 0 ? tags.positiveBigNum : tags.negativeBigNum, state)
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
    binaryItem(v.reverse(), state)
}
export const objectItem = (a: Object, state: EncoderState) => {
    if (a === null) {
        nullItem(state)
        return
    }
    if (!state.disableSharedReferences) {
        if (encodeShared(a, state)) {
            return
        }
    }
    const typ = state.typeMap.get(a.constructor || NullConstructor)
    if (typ) {
        typ(a, state)
    }
    else {
        throw new Error('type mapping not found: ' + a.constructor?.name)
    }
}
export const encodeItem = (a, state: EncoderState) => {
    if (typeof a == 'string') {
        stringItem(a, state)
    }
    else if (typeof a == 'number') {
        numberItem(a, state)
    }
    else if (typeof a == 'object') {
        objectItem(a, state)
    }
    else if (typeof a == 'boolean') {
        booleanItem(a, state)
    }
    else if (typeof a == 'bigint') {
        bigintItem(a, state)
    }
    else if (typeof a == 'undefined') {
        undefinedItem(state)
    }
    else {
        throw new Error('unsupported type: ' + typeof a)
    }
}
export const resumeItem = (state: EncoderState) => {
    if (state.resume) {
        const resume = state.resume
        state.resume = undefined
        if (resume.items) {
            for (let r of resume.items) {
                writeItem(r.major, r.adInfo, state)
            }
        }
        if (resume.buffer) {
            appendBuffer(state, resume.buffer)
        }
    }
}
export const encodeLoop = (state: EncoderState) => {
    state.resumeFunc(state)
    while (state.stack.length > 0 && !state.resume) {
        const a = state.stack.pop()
        state.encodeItemFunc(a, state)
    }
}
export const encodeObject = (a: Object, state: EncoderState) => {
    const ks = Object.keys(a)
    mapItem(ks.length, state)
    for (let i = ks.length - 1; i >= 0; i--) {
        state.stack.push(a[ks[i]])
        state.stack.push(ks[i])
    }
}
export const encodeShared = (a, state: EncoderState): boolean => {
    const shareIndex = state.cycleMap.get(a)
    if (shareIndex >= 0) {
        if (state.cycleSet.has(a)) {
            tagItem(tags.sharedRef, state)
            integerItem(shareIndex, state)
            return true
        }
        else {
            state.cycleSet.add(a)
            tagItem(tags.shareable, state)
        }
    }
}
export type EncodeSyncOptions = { sequence?: boolean }
export const encodeSync = (value, state: EncoderState, op?: EncodeSyncOptions): Uint8Array[] => {
    resetEncoder(state)
    const buf: Uint8Array[] = []
    state.buffers = buf
    detectShared(value, state)
    const seq = op?.sequence && Array.isArray(value)
    let seqIndex = 0
    state.stack = [seq ? value[seqIndex] : value]
    do {
        encodeLoop(state)
        if (state.resume?.promise) {
            throw new Error('promise based resume not allowed in sync mode')
        }
        if (seq) {
            const r = resetEncoder(state, null, true)
            if (r.newBackingView) {
                state.buffers.push(r.chunk)
                resetEncoder(state)
            }
            if (state.stack.length == 0) {
                seqIndex++
                if (seqIndex < value.length) {
                    state.stack.push(value[seqIndex])
                }
                else if (!r.newBackingView) {
                    state.buffers.push(r.chunk)
                }
            }
        }
        else {
            state.buffers.push(resetEncoder(state).chunk)
        }
    }
    while (state.resume || state.stack.length > 0)
    state.buffers = undefined
    return buf
}
export const resetEncoder = (state: EncoderState, view?: ArrayBufferView, skipView?: boolean): { newBackingView: boolean, chunk: Uint8Array } => {
    let newBackingView = false
    if (state.view.byteLength - state.length < state.minViewSize) {
        state.backingView = new Uint8Array(state.newBufferSize)
        state.offset = 0
        newBackingView = true
    }
    else {
        state.offset += state.length
    }
    const chunk = new Uint8Array(state.view.buffer, state.view.byteOffset, state.length)
    if (!skipView) {
        state.view = view ? new DataView(view.buffer, view.byteOffset, view.byteLength) : new DataView(state.backingView.buffer, state.backingView.byteOffset + state.offset, state.backingView.byteLength - state.offset)
        state.length = 0
    }
    return { newBackingView, chunk }
}
export const detectShared = (value, state: EncoderState) => {
    if (!state.disableSharedReferences) {
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
        state.cycleMap = w
        state.cycleSet = new WeakSet()
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
    buffer: BufferSource, position: number, stack: DecodeStackItem[], decodeItemFunc: (major: number, additionalInformation: number, dv: DataView, src: DecoderState) => any, decodeCyclesFunc: (value, state: DecoderState) => void,
    finishItemFunc: (state: DecoderState) => any, stopPosition?: number, decodeMainFunc: (dv: DataView, state: DecoderState) => any, tagMap: Map<number | bigint, (v, tag?: number | bigint) => any>, shared: any[], queue: BufferSource[],
    tempBuffer: Uint8Array, nonStringKeysToObject?: boolean, maxBytesPerItem?: number, currentItemByteCount: number
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
export const checkInput = (state: DecoderState, length: number, backtrack: number = 0): boolean => {
    if (state.position + length > state.buffer.byteLength) {
        state.stopPosition = state.position - 1 - backtrack
        state.position = state.buffer.byteLength
        return false
    }
    return true
}
export const decodeInfo = (major: number, ai: number, dv: DataView, state: DecoderState): number | bigint => {
    if (ai < 24) {
        return ai
    }
    switch (ai) {
        case 24:
            if (major == 7) {
                throw new Error('not implemented simple type 24')
            }
            if (checkInput(state, 1)) {
                const v = dv.getUint8(state.position);
                state.position++
                return v
            }
            break
        case 25:
            if (checkInput(state, 2)) {
                const v = major == 7 ? getFloat16(dv, state.position) : dv.getUint16(state.position);
                state.position += 2
                return v
            }
            break
        case 26:
            if (checkInput(state, 4)) {
                const v = major == 7 ? dv.getFloat32(state.position) : dv.getUint32(state.position);
                state.position += 4
                return v
            }
            break
        case 27:
            if (checkInput(state, 8)) {
                if (major == 7) {
                    const v = dv.getFloat64(state.position)
                    state.position += 8
                    return v
                }
                const hi = dv.getUint32(state.position)
                const lo = dv.getUint32(state.position + 4)
                let v
                if (hi > 0x1fffff) {
                    v = (BigInt(hi) * BigInt(0x100000000)) + BigInt(lo)
                }
                else {
                    v = hi * 0x100000000 + lo
                }
                state.position += 8
                if (major >= 2 && major <= 5) {
                    if (typeof v != 'number') {
                        throw new Error('value too large for length: ' + v)
                    }
                    checkInput(state, v, 8)
                }
                return v
            }
            break
        default:
            throw new Error('not implemented additional information: ' + ai)
    }
    return 0
}
export const slice = (length: number, state: DecoderState) => {
    const b = state.buffer instanceof ArrayBuffer ? state.buffer.slice(state.position, state.position + length) : state.buffer.buffer.slice(state.position + state.buffer.byteOffset, state.position + state.buffer.byteOffset + length)
    state.position += length;
    return b
}
export const decodeLoop = (state: DecoderState) => {
    state.stopPosition = undefined
    if (!state.buffer) {
        state.position = 0
        const first = state.queue[0]
        if (first) {
            if (first.byteLength < state.tempBuffer.byteLength) {
                let count = 0
                let i = 0
                while (count < state.tempBuffer.byteLength && i < state.queue.length) {
                    const b = state.queue[i]
                    const d = b instanceof ArrayBuffer ? new DataView(b) : new DataView(b.buffer, b.byteOffset, b.byteLength)
                    for (let j = 0; j < b.byteLength; j++) {
                        if (count < state.tempBuffer.byteLength) {
                            state.tempBuffer[count] = d.getUint8(j)
                            count++
                        }
                    }
                    i++
                }
                state.buffer = new Uint8Array(state.tempBuffer.buffer, 0, count)
            }
            else {
                state.buffer = first
            }
        }
        else {
            throw new Error('no data supplied to decodeLoop')
        }
    }
    const start = state.position
    const dv = state.buffer instanceof ArrayBuffer ? new DataView(state.buffer) : new DataView(state.buffer.buffer, state.buffer.byteOffset, state.buffer.byteLength)
    let result
    while (state.position < state.buffer.byteLength) {
        result = state.decodeMainFunc(dv, state)
        if (state.stack.length == 0) {
            break
        }
    }
    const consumed = (state.stopPosition === undefined ? state.position : state.stopPosition) - start
    let count = 0
    while (count < consumed) {
        const x = state.queue[0]
        if (x.byteLength + count <= consumed) {
            count += x.byteLength
            state.queue.shift()
        }
        else {
            const newOffset = consumed - count
            count = consumed
            state.queue[0] = x instanceof ArrayBuffer ? new Uint8Array(x, newOffset, x.byteLength - newOffset) : new Uint8Array(x.buffer, x.byteOffset + newOffset, x.byteLength - newOffset)
            state.buffer = undefined
        }
    }
    if (state.position == state.buffer?.byteLength) {
        state.buffer = undefined
    }
    state.currentItemByteCount += consumed
    if (state.maxBytesPerItem && state.currentItemByteCount > state.maxBytesPerItem) {
        throw new Error('current item consumed ' + state.currentItemByteCount + ' bytes')
    }
    if (state.stack.length == 0 && state.stopPosition === undefined) {
        state.currentItemByteCount = 0
    }
    return result
}
export const decodeMain = (dv: DataView, state: DecoderState): any => {
    const c = dv.getUint8(state.position)
    state.position++;
    const major = c >> 5
    const ai = c & 31
    let result = state.decodeItemFunc(major, ai, dv, state)
    let head = state.stack[state.stack.length - 1]
    if (head && (major < 4 || major == 7) && state.stopPosition === undefined) {
        head.temp.push(result)
    }
    while (head && head.length == head.temp.length) {
        result = state.finishItemFunc(state)
        state.stack.pop()
        head = state.stack[state.stack.length - 1]
        if (head) {
            head.temp.push(result)
        }
    }
    if (state.stack.length == 0) {
        if (state.shared.length > 0) {
            state.decodeCyclesFunc(result, state)
            state.shared = []
        }
    }
    return result
}
export const decodeShared = (value, state: DecoderState) => {
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
export const decodeItem = (major: number, ai: number, dv: DataView, state: DecoderState) => {
    let result
    switch (major) {
        case 0:
            result = decodeInfo(major, ai, dv, state)
            break
        case 1: {
            const a = decodeInfo(major, ai, dv, state)
            result = typeof a != 'number' ? BigInt(-1) - a : -1 - a
            break
        }
        case 2: {
            const a = decodeInfo(major, ai, dv, state) as number
            result = slice(a, state)
            break
        }
        case 3: {
            const a = decodeInfo(major, ai, dv, state) as number
            result = TD.decode(state.buffer instanceof ArrayBuffer ? new DataView(state.buffer, state.position, a) : new DataView(state.buffer.buffer, state.buffer.byteOffset + state.position, a))
            state.position += a;
            break
        }
        case 4: {
            const a = decodeInfo(major, ai, dv, state) as number
            state.stack.push({ major, length: a, temp: [] })
            break
        }
        case 5: {
            const a = decodeInfo(major, ai, dv, state) as number
            state.stack.push({ major, length: a * 2, temp: [] })
            break
        }
        case 6: {
            const a = decodeInfo(major, ai, dv, state)
            state.stack.push({ major, length: 1, temp: [], tag: a, shareableIndex: a == tags.shareable ? state.shared.length : undefined })
            if (a == tags.shareable) {
                state.shared.push(undefined)
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
                result = decodeInfo(major, ai, dv, state)
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
            if (parent?.tag == tags.Map || (!state.nonStringKeysToObject && head.temp.filter((x, i) => i % 2 == 0).some(x => typeof x != 'string'))) {
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
export type DecodeSyncOptions = { sequence?: boolean, allowExcessBytes?: boolean }
export const decodeSync = (buffers: BufferSource | BufferSource[], state: DecoderState, op?: DecodeSyncOptions): any => {
    state.queue = Array.isArray(buffers) ? buffers : [buffers]
    state.buffer = undefined
    state.currentItemByteCount = 0
    state.stack = []
    state.shared = []
    let result = op?.sequence ? [] : undefined
    if (op?.sequence) {
        let queueBytes = 0
        do {
            const r = decodeLoop(state)
            if (state.stack.length == 0 && state.stopPosition === undefined) {
                result.push(r)
            }
            const qb = state.queue.reduce((a, b) => a + b.byteLength, 0)
            if (queueBytes == qb) {
                break
            }
            queueBytes = qb
        }
        while (state.queue.length > 0)
    }
    else {
        do {
            result = decodeLoop(state)
        }
        while (state.stack.length > 0 && state.stopPosition !== undefined && state.queue.length > 0)
    }
    if (state.stack.length > 0) {
        throw new Error('unfinished stack depth: ' + state.stack.length)
    }
    if (state.stopPosition !== undefined) {
        throw new Error('unexpected end of buffer: ' + state.stopPosition)
    }
    if (!op?.allowExcessBytes && state.queue.length > 0) {
        throw new Error('excess bytes: ' + state.queue.reduce((a, b) => a + b.byteLength, 0))
    }
    return result
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
export type DecoderOptions = Partial<Omit<DecoderState, 'stack' | 'shared' | 'buffer' | 'position' | 'stopPosition' | 'currentItemByteCount'>>
export const setupDecoder = (op: DecoderOptions = {}): DecoderState => {
    op.decodeItemFunc = op.decodeItemFunc || decodeItem
    op.finishItemFunc = op.finishItemFunc || finishItem
    op.decodeCyclesFunc = op.decodeCyclesFunc || decodeShared
    op.decodeMainFunc = op.decodeMainFunc || decodeMain
    op.tagMap = op.tagMap || new Map(defaultTagMap)
    op.queue = op.queue || []
    op.tempBuffer = op.tempBuffer || new Uint8Array(16)
    const o = op as DecoderState
    o.stack = []
    o.shared = []
    o.currentItemByteCount = 0
    return o
}
export class TagHelper { constructor(t) { this.tag = t }; tag: number }
export class NullConstructor { }
export const defaultTypeMap = new Map<Function, (a, state: EncoderState) => void>([[Object, encodeObject], [NullConstructor, encodeObject], [ArrayBuffer, binaryItem],
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