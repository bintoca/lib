export const bufToDV = (b: BufferSource, offset: number = 0, length?: number): DataView => b instanceof ArrayBuffer ? new DataView(b, offset, length !== undefined ? length : b.byteLength - offset) : new DataView(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufToU8 = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => b instanceof ArrayBuffer ? new Uint8Array(b, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const enum a {
    add,//*
    subtract,//*
    multiply,//*
    divide,//*
    remainder,//*

    abs,//*
    acos,//*
    acosh,//*
    asin,//*
    asinh,//*
    atan,//*
    atanh,//*
    atan2,//*
    cbrt,//*
    ceil,//*
    cos,//*
    cosh,//*
    exp,//*
    expm1,//*
    floor,//*
    fround,//*
    hypot,//*
    log,//*
    log1p,//*
    log10,//*
    log2,//*
    pow,//*
    round,//*
    sign,//*
    sin,//*
    sinh,//*
    sqrt,//*
    tan,//*
    tanh,//*
    trunc,//*

    TAI,
    UTC_posix,
    UTC_leap_adjustment,
    local_time,
    timezoneOffset,
    location,
    years,
    months,
    days,
    hours,
    minutes,
    seconds,
    weeks,
    dateTimeStart,
    dateTimeEnd,
    duration, //nominal_type or attribute of interval entity
    timePeriod, //nomimal_type or attribute for singular symbol
    //RFC 5545 and updates for recurrence and calendaring

    //latitude, //reference ellipsoids?
    //longitude,
    //other geometric structures

    //TODO language tags BCP47
}
export const enum r {
    placeholder,
    end_scope,
    back_ref,
    type_sub,
    type_sum,
    type_product,
    type_path,
    bind,

    run_length_encoding,
    function,
    call,

    text,
    rich_text,


    concat,
    chain,

    equal,
    not_equal,
    greater_than,
    greater_than_or_equal,
    less_than,
    less_than_or_equal,
    logical_and,
    logical_or,
    logical_not,

    next_singular,

    //singular
    value_,
    collection_,
    item_,

    uint,
    sint,
    vIEEE_binary,
    vIEEE_decimal_DPD,
    dns_idna,

    first_param,
    second_param,
    size_bits1,
    buffer,

    filter,
    map,
    reduce,
    skip,
    take,
    groupKey,
    groupItems,
    count,

    locator,
    integrity,
    sub_authority,
    all_data,

    numerator = 64,
    denominator,
    complex_i,
    quaternion_i,
    quaternion_j,
    quaternion_k,
    Math_E,
    Math_LN10,
    Math_LN2,
    Math_LOG10E,
    Math_LOG2E,
    Math_PI,
    Math_SQRT1_2,
    Math_SQRT2,
    unorm,
    snorm,

    IPv4,
    IPv6,
    port,
    UUID,
    sha256,

    second,
    meter,
    kilogram,
    ampere,
    kelvin,
    mole,
    candela,
    radians,

    red,
    green,
    blue,
    alpha,
    depth,
    stencil,


}
export const enum u {
    text,
    end_scope,
    back_ref,
    space,
    a,
    e,
    o,
    t,

    run_length_encoding,
    non_text,
    line_feed,
    exclamation,
    period,
    comma,
    hyphen,
    question,
    //remaining A-Z,a-z
    null = 64,
    //remaining ascii then continue according to unicode
}
type Scope = { type: r | u, needed: number, items: Item[], result?, ref?: Item, inText?: boolean, plan?: ParsePlan }
type Slot = Scope | number
type Item = Slot | Uint8Array
const enum ParseType { value, vbuf, buf, item, scope, collection }
type ParseOp = { type: ParseType, size?: number, scope?: Scope }
type ParsePlan = { types: ParseOp[], index: number }
export const parse = (b: BufferSource) => {
    const slots: Slot[] = []
    const scope_stack: Scope[] = []
    const scope_top = () => scope_stack[scope_stack.length - 1]
    function collapse_scope(x: Item) {
        let loop = true
        let i = x
        while (loop) {
            const t = scope_top()
            if (t) {
                t.items.push(i)
                if (t.type == r.bind) {
                    if (t.plan) {
                        t.plan.index++
                        if (t.plan.index == t.plan.types.length) {
                            t.plan.index = 0
                        }
                    }
                    else {
                        if (typeof i == 'object') {
                            const s = i as Scope

                        }
                        else {
                            switch (i) {
                                case r.uint:
                                case r.sint:
                                case r.buffer: {
                                    t.plan = { types: [{ type: ParseType.value }], index: 0 }
                                    break
                                }
                                case r.vIEEE_decimal_DPD:
                                case r.vIEEE_binary: {
                                    t.plan = { types: [{ type: ParseType.vbuf }], index: 0 }
                                    break
                                }
                                case r.text:
                                case r.dns_idna:
                                case r.rich_text: {
                                    scope_stack.push({ type: i, needed: 0, items: [], inText: true })
                                    break
                                }
                                default:
                                    throw 'not implemented bind: ' + i
                            }
                            t.needed = 2
                        }
                    }
                }
                if (t.items.length == t.needed) {
                    const y = scope_stack.pop()
                    i = y
                    if (y.type == r.back_ref) {
                        const scopeItems = scope_stack.filter(x => !x.needed)
                        let back = y.items[0] as number + 1
                        for (let l = scopeItems.length - 1; l >= 0; l--) {
                            const s = scopeItems[l]
                            if (s.type == r.text) {
                                const scopes = s.items.filter(x => typeof x == 'object')
                                if (scopes.length >= back) {
                                    y.ref = scopes[scopes.length - back]
                                    break
                                }
                                back -= scopes.length
                            }
                            else {
                                if (s.items.length >= back) {
                                    y.ref = s.items[s.items.length - back]
                                    break
                                }
                                back -= s.items.length
                            }
                        }
                        if (!y.ref) {
                            if (slots.length >= back) {
                                y.ref = slots[slots.length - back]
                            }
                            else {
                                throw new Error('invalid back_ref')
                            }
                        }
                    }
                }
                else {
                    loop = false
                }
            }
            else {
                if (i instanceof Uint8Array) {
                    throw 'invalid slot'
                }
                slots.push(i)
                loop = false
            }
        }
    }
    const ds = createDecoder(b)
    while (continueDecode(ds)) {
        const top = scope_top()
        const op = top?.plan.types[top.plan.index]
        if (op?.type != ParseType.item) {
            switch (op.type) {
                case ParseType.value: {
                    collapse_scope(read(ds))
                    break
                }
                case ParseType.buf: {
                    collapse_scope(readBuffer(ds, op.size))
                    break
                }
                case ParseType.vbuf: {
                    collapse_scope(readBuffer(ds, read(ds)))
                    break
                }
                case ParseType.scope: {
                    scope_stack.push(op.scope)
                    break
                }
                case ParseType.collection: {
                    op.scope.needed = read(ds) * op.scope.plan.types.length
                    scope_stack.push(op.scope)
                    break
                }
                default:
                    throw 'not implemented ParseType: ' + op.type
            }
        }
        else if (top?.inText) {
            const x = read(ds)
            switch (x) {
                case u.text: {
                    scope_stack.push({ type: x, needed: 0, items: [], inText: true })
                    break
                }
                case u.run_length_encoding: {
                    scope_stack.push({ type: x, needed: 2, items: [read(ds)], inText: true })
                    break
                }
                case u.back_ref: {
                    collapse_scope({ type: x, needed: 1, items: [read(ds)], inText: true })
                    break
                }
                case u.non_text: {
                    if (top.type == r.rich_text) {
                        scope_stack.push({ type: x, needed: 0, items: [] })
                    }
                    else {
                        collapse_scope(x)
                    }
                    break
                }
                case u.end_scope: {
                    collapse_scope(scope_stack.pop())
                    break
                }
                default:
                    collapse_scope(x)
            }
        }
        else {
            const x = read(ds)
            switch (x) {
                case r.function:
                case r.call:
                case r.logical_and:
                case r.logical_or:
                case r.type_sub:
                case r.type_product:
                case r.type_sum:
                case r.type_path:
                case r.bind:
                case r.concat: {
                    scope_stack.push({ type: x, needed: 0, items: [] })
                    break
                }
                case r.end_scope: {
                    if (!top || top.needed) {
                        throw new Error('top of scope_stack invalid for end_scope')
                    }
                    collapse_scope(scope_stack.pop())
                    break
                }
                case r.run_length_encoding: {
                    scope_stack.push({ type: x, needed: 2, items: [read(ds)] })
                    break
                }
                case r.back_ref:
                case r.next_singular: {
                    collapse_scope({ type: x, needed: 1, items: [read(ds)] })
                    break
                }
                case r.logical_not: {
                    scope_stack.push({ type: x, needed: 1, items: [] })
                    break
                }
                case r.equal:
                case r.not_equal:
                case r.greater_than:
                case r.greater_than_or_equal:
                case r.less_than:
                case r.less_than_or_equal: {
                    scope_stack.push({ type: x, needed: 2, items: [] })
                    break
                }
                default:
                    collapse_scope(x)
            }
        }
    }
    return { slots }
}
export const evaluate = (x: Scope, ...p: Item[]) => {
    switch (x.type) {
        case r.call: {
            const f = x.items[0]
            if (f instanceof Uint8Array) {
                throw new Error('not implemented x0 ' + f)
            }
            else if (typeof f == 'object' && !Array.isArray(f)) {
                switch (f.type) {
                    case r.back_ref: {
                        x.result = evaluate(f.ref as Scope, ...x.items.slice(1))
                        break
                    }
                    default:
                        throw new Error('not implemented x3 ' + f.type.toString())
                }
            }
            else {
                switch (f) {
                    case 222: {
                        break
                    }
                    default:
                        throw new Error('not implemented x1 ' + f)
                }
            }
            break
        }
        case r.function: {
            evaluateAll(x.items)
            const last = x.items[x.items.length - 1]
            if (last instanceof Uint8Array) {
                throw new Error('not implemented x2 ' + last)
            }
            return typeof last == 'object' && !Array.isArray(last) && last.result ? last.result : last
        }
    }
}
export const evaluateAll = (slots: Item[]) => {
    for (let x of slots) {
        if (x instanceof Uint8Array) {

        }
        else if (typeof x == 'object' && !Array.isArray(x)) {
            evaluate(x)
        }
    }
}
export const shiftInit = [
    [8, 29], [8, 26], [8, 23], [8, 20], [8, 17], [8, 14], [8, 11], [8, 8],//7
    [11, 29], [11, 26], [11, 23], [11, 20], [11, 17], [11, 14], [11, 11],//14
    [14, 29], [14, 26], [14, 23], [14, 20], [14, 17], [14, 14],//20
    [17, 29], [17, 26], [17, 23], [17, 20], [17, 17],//25
    [20, 29], [20, 26], [20, 23], [20, 20],//29
    [23, 29], [23, 26], [23, 23],//32
    [26, 29], [26, 26],//34
    [29, 29]//35
]
export const shiftMap = [
    [7], [6, 35], [5, 33, 35], [5, 34], [4, 30, 34], [4, 30, 33, 35], [4, 31, 35], [4, 32],
    [3, 26, 32], [3, 26, 31, 35], [3, 26, 30, 33, 35], [3, 26, 30, 34], [3, 27, 34], [3, 27, 33, 35], [3, 28, 35], [3, 29],
    [2, 21, 29], [2, 21, 28, 35], [2, 21, 27, 33, 35], [2, 21, 27, 34], [2, 21, 26, 30, 34], [2, 21, 26, 30, 33, 35], [2, 21, 26, 31, 35], [2, 21, 26, 32],
    [2, 22, 32], [2, 22, 31, 35], [2, 22, 30, 33, 35], [2, 22, 30, 34], [2, 23, 34], [2, 23, 33, 35], [2, 24, 35], [2, 25],
    [1, 15, 25], [1, 15, 24, 35], [1, 15, 23, 33, 35], [1, 15, 23, 34], [1, 15, 22, 30, 34], [1, 15, 22, 30, 33, 35], [1, 15, 22, 31, 35], [1, 15, 22, 32],
    [1, 15, 21, 26, 32], [1, 15, 21, 26, 31, 35], [1, 15, 21, 26, 30, 33, 35], [1, 15, 21, 26, 30, 34], [1, 15, 21, 27, 34], [1, 15, 21, 27, 33, 35], [1, 15, 21, 28, 35], [1, 15, 21, 29],
    [1, 16, 29], [1, 16, 28, 35], [1, 16, 27, 33, 35], [1, 16, 27, 34], [1, 16, 26, 30, 34], [1, 16, 26, 30, 33, 35], [1, 16, 26, 31, 35], [1, 16, 26, 32],
    [1, 17, 32], [1, 17, 31, 35], [1, 17, 30, 33, 35], [1, 17, 30, 34], [1, 18, 34], [1, 18, 33, 35], [1, 19, 35], [1, 20],
    [0, 8, 20], [0, 8, 19, 35], [0, 8, 18, 33, 35], [0, 8, 18, 34], [0, 8, 17, 30, 34], [0, 8, 17, 30, 33, 35], [0, 8, 17, 31, 35], [0, 8, 17, 32],
    [0, 8, 16, 26, 32], [0, 8, 16, 26, 31, 35], [0, 8, 16, 26, 30, 33, 35], [0, 8, 16, 26, 30, 34], [0, 8, 16, 27, 34], [0, 8, 16, 27, 33, 35], [0, 8, 16, 28, 35], [0, 8, 16, 29],
    [0, 8, 15, 21, 29], [0, 8, 15, 21, 28, 35], [0, 8, 15, 21, 27, 33, 35], [0, 8, 15, 21, 27, 34], [0, 8, 15, 21, 26, 30, 34], [0, 8, 15, 21, 26, 30, 33, 35], [0, 8, 15, 21, 26, 31, 35], [0, 8, 15, 21, 26, 32],
    [0, 8, 15, 22, 32], [0, 8, 15, 22, 31, 35], [0, 8, 15, 22, 30, 33, 35], [0, 8, 15, 22, 30, 34], [0, 8, 15, 23, 34], [0, 8, 15, 23, 33, 35], [0, 8, 15, 24, 35], [0, 8, 15, 25],
    [0, 9, 25], [0, 9, 24, 35], [0, 9, 23, 33, 35], [0, 9, 23, 34], [0, 9, 22, 30, 34], [0, 9, 22, 30, 33, 35], [0, 9, 22, 31, 35], [0, 9, 22, 32],
    [0, 9, 21, 26, 32], [0, 9, 21, 26, 31, 35], [0, 9, 21, 26, 30, 33, 35], [0, 9, 21, 26, 30, 34], [0, 9, 21, 27, 34], [0, 9, 21, 27, 33, 35], [0, 9, 21, 28, 35], [0, 9, 21, 29],
    [0, 10, 29], [0, 10, 28, 35], [0, 10, 27, 33, 35], [0, 10, 27, 34], [0, 10, 26, 30, 34], [0, 10, 26, 30, 33, 35], [0, 10, 26, 31, 35], [0, 10, 26, 32],
    [0, 11, 32], [0, 11, 31, 35], [0, 11, 30, 33, 35], [0, 11, 30, 34], [0, 12, 34], [0, 12, 33, 35], [0, 13, 35], [0, 14]
]
export const shiftLookup = shiftMap.map(x => x.map(y => shiftInit[y]))
export type DecoderState = { partial: number, partialBit: number, temp: number[], tempCount: number, tempIndex: number, dv: DataView, dvOffset: number }
export const decodeChunk = (s: DecoderState, x: number) => {
    let mesh = x >>> 24
    const nextPartialBit = mesh & 1
    const continueBit = mesh >>> 7
    if (continueBit) {
        mesh = mesh ^ 255
    }
    const a = shiftLookup[mesh]
    if (continueBit == s.partialBit) {
        if (a.length == 1) {
            s.tempCount = 0
            s.partial = ((s.partial << 24) >>> 0) + (x & 0xFFFFFF)
        }
        else {
            s.temp[0] = ((s.partial << (32 - a[0][1])) >>> 0) + ((x << a[0][0]) >>> a[0][1])
            s.tempCount = a.length - 1
            for (let i = 1; i < a.length - 1; i++) {
                s.temp[i] = (x << a[i][0]) >>> a[i][1]
            }
            const an = a[a.length - 1]
            s.partial = (x << an[0]) >>> an[1]
        }
    }
    else {
        s.temp[0] = s.partial
        s.tempCount = a.length
        for (let i = 0; i < a.length - 1; i++) {
            s.temp[i + 1] = (x << a[i][0]) >>> a[i][1]
        }
        const an = a[a.length - 1]
        s.partial = (x << an[0]) >>> an[1]
    }
    s.partialBit = nextPartialBit
}
export const createDecoder = (b: BufferSource): DecoderState => {
    if (b.byteLength == 0 || b.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes')
    }
    const dv = bufToDV(b)
    return { partial: 0, partialBit: dv.getUint8(0) >>> 7, temp: Array(8), tempCount: 0, tempIndex: 0, dv, dvOffset: 0 }
}
export const read = (s: DecoderState): number => {
    while (s.tempCount == 0) {
        decodeChunk(s, s.dv.getUint32(s.dvOffset))
        s.dvOffset += 4
        if (s.dv.byteLength == s.dvOffset) {
            s.temp[s.tempCount] = s.partial
            s.tempCount++
        }
    }
    const v = s.temp[s.tempIndex]
    s.tempIndex++
    if (s.tempIndex == s.tempCount) {
        s.tempCount = s.tempIndex = 0
    }
    return v
}
export const readBuffer = (s: DecoderState, n: number) => {
    const l = (n + 1) * 4
    const v = bufToU8(s.dv, s.dvOffset, l)
    s.dvOffset += l
    return v
}
export const continueDecode = (s: DecoderState): boolean => s.tempCount != 0 || s.dv.byteLength != s.dvOffset
export type EncoderState = { buffers: Uint8Array[], dv: DataView, offset: number, mesh: number, mesh1: boolean, chunk: number, chunkSpace: number, queue: BufferSource[] }
export const createEncoder = (): EncoderState => {
    return { buffers: [], dv: new DataView(new ArrayBuffer(4096)), offset: 0, mesh: 0, mesh1: false, chunk: 0, chunkSpace: 8, queue: [] }
}
export const maxInteger = 0xFFFFFFFF
export const sizeLookup = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 10]
export const maskLookup = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((x, i) => i == 0 ? maxInteger : 2 ** ((11 - i) * 3) - 1)
export const write = (st: EncoderState, x: number) => {
    if (x < 0 || Math.floor(x) !== x || x > maxInteger || isNaN(x) || !isFinite(x)) {
        throw new Error('invalid number')
    }
    let i = sizeLookup[Math.clz32(x)]
    while (true) {
        const remaining = 11 - i
        const len = st.chunkSpace > remaining ? remaining : st.chunkSpace
        const s1 = st.chunkSpace - len
        st.chunk += ((x & maskLookup[i]) >>> ((remaining - len) * 3)) << s1 * 3
        if (st.mesh1) {
            st.mesh += ((1 << len) - 1) << s1
        }
        st.chunkSpace -= len
        i += len
        if (st.chunkSpace == 0) {
            if (st.dv.byteLength == st.offset) {
                st.buffers.push(bufToU8(st.dv))
                st.dv = new DataView(new ArrayBuffer(4096))
                st.offset = 0
            }
            st.dv.setUint32(st.offset, (st.mesh << 24) + st.chunk)
            st.offset += 4
            st.chunkSpace = 8
            st.chunk = 0
            st.mesh = 0
            if (st.queue.length) {
                for (let b of st.queue) {
                    const dv = bufToDV(b)
                    let off = 0
                    while (off < dv.byteLength) {
                        if (st.dv.byteLength == st.offset) {
                            st.buffers.push(bufToU8(st.dv))
                            st.dv = new DataView(new ArrayBuffer(4096))
                            st.offset = 0
                        }
                        st.dv.setUint32(st.offset, dv.getUint32(off))
                        st.offset += 4
                        off += 4
                    }
                }
                st.queue = []
            }
        }
        if (i == 11) {
            st.mesh1 = !st.mesh1
            break
        }
    }
}
export const writeBuffer = (st: EncoderState, x: BufferSource) => {
    if (x.byteLength == 0 || x.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes')
    }
    st.queue.push(x)
}
export const finishWrite = (s: EncoderState) => {
    if (s.chunkSpace != 8) {
        const n = s.chunkSpace
        for (let i = 0; i < n; i++) {
            write(s, 0)
        }
    }
    s.buffers.push(bufToU8(s.dv, 0, s.offset))
}