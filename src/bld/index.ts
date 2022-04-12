export const bufferSourceToDataView = (b: BufferSource, offset: number = 0, length?: number): DataView => b instanceof ArrayBuffer ? new DataView(b, offset, length !== undefined ? length : b.byteLength - offset) : new DataView(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufferSourceToUint8Array = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => b instanceof ArrayBuffer ? new Uint8Array(b, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
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
    end_scope,
    unicode,
    back_ref,
    run_length_encoding,
    placeholder,
    type_sub,
    type_sum,
    type_product,
    type_path,
    bind,
    bind_uint,

    function,
    call,

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

    Math_E,
    Math_LN10,
    Math_LN2,
    Math_LOG10E,
    Math_LOG2E,
    Math_PI,
    Math_SQRT1_2,
    Math_SQRT2,
    Infinity,
    NegInfinity,
    NegZero,
    qNaN,
    uint,
    nint,//*
    sint,//*
    unorm,//*
    snorm,//*
    IEEE_binary32,//*
    IEEE_binary64,//*
    IEEE_decimal32_BID,//*
    IEEE_decimal64_BID,//*
    IPv4,//*
    IPv6,//*
    port,//*
    UUID,//*
    sha256,//*
    dns_idna,//*

    first_param,
    second_param,
    template,
    packed_data,
    size_bits1,
    s32,
    s64,
    u32,
    u64,

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
    binary_exponent,
    decimal_exponent,
    numerator,
    denominator,
    complex_i,
    quaternion_i,
    quaternion_j,
    quaternion_k,

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
    end_scope,
    unicode,
    back_ref, //(v4)
    run_length_encoding, //(v4,any)
    placeholder,
    a,
    e,
    i,
    o,
    u,
    y,
    space,
    dot,

    //2nd chunk - remaining ascii then continue according to unicode
}
type scope = { type: r, needed: number, items: slot[], result?, ref?: slot, inUnicode?: boolean, next_literal_item?: boolean }
type slot = scope | number | bigint | Uint8Array | code[]
type code = number | bigint | Uint8Array | code[]
export const parse = (code: code[]) => {
    const slots: slot[] = []
    const scope_stack: scope[] = []
    const scope_top = () => scope_stack[scope_stack.length - 1]
    function collapse_scope(x: slot) {
        let loop = true
        let i = x
        while (loop) {
            const t = scope_top()
            if (t) {
                t.items.push(i)
                if (t.items.length == t.needed) {
                    const y = scope_stack.pop()
                    i = y
                    if (y.type == r.back_ref) {
                        const scopeItems = scope_stack.filter(x => !x.needed)
                        let back = y.items[0] as number + 1
                        for (let l = scopeItems.length - 1; l >= 0; l--) {
                            const s = scopeItems[l]
                            if (s.type == r.unicode) {
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
                slots.push(i)
                loop = false
            }
        }
    }
    for (let x of code) {
        const top = scope_top()
        if (typeof x == 'object' || top?.next_literal_item) {
            collapse_scope(x)
            if (top?.next_literal_item) {
                top.next_literal_item = false
            }
        }
        else if (top?.inUnicode) {
            switch (x) {
                case r.unicode: {
                    scope_stack.push({ type: x, needed: 0, items: [], inUnicode: true })
                    break
                }
                case r.run_length_encoding: {
                    scope_stack.push({ type: x, needed: 2, items: [], inUnicode: true, next_literal_item: true })
                    break
                }
                case r.back_ref: {
                    scope_stack.push({ type: x, needed: 1, items: [], inUnicode: true, next_literal_item: true })
                    break
                }
                case r.placeholder: {
                    scope_stack.push({ type: x, needed: 0, items: [] })
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
            switch (x) {
                case r.function:
                case r.call:
                case r.logical_and:
                case r.logical_or:
                case r.type_sub:
                case r.type_product:
                case r.type_sum:
                case r.type_path:
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
                    scope_stack.push({ type: x, needed: 2, items: [], next_literal_item: true })
                    break
                }
                case r.back_ref:
                case r.bind_uint:
                case r.next_singular: {
                    scope_stack.push({ type: x, needed: 1, items: [], next_literal_item: true })
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
export const evaluate = (x: scope, ...p: slot[]) => {
    switch (x.type) {
        case r.call: {
            const f = x.items[0]
            if (f instanceof Uint8Array) {
                throw new Error('not implemented x0 ' + f)
            }
            else if (typeof f == 'object' && !Array.isArray(f)) {
                switch (f.type) {
                    case r.back_ref: {
                        x.result = evaluate(f.ref as scope, ...x.items.slice(1))
                        break
                    }
                    default:
                        throw new Error('not implemented x3 ' + f.type)
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
export const evaluateAll = (slots: slot[]) => {
    for (let x of slots) {
        if (x instanceof Uint8Array) {

        }
        else if (typeof x == 'object' && !Array.isArray(x)) {
            evaluate(x)
        }
    }
}
type State = { out: code[], last: number | bigint, lastSize: number, type: number, decodeContinue: (s: State, x: number, a: number) => any }
export const decodeChunk = (s: State, x: number) => {
    s.type = x >>> 30
    const mesh = (x >>> 24) & 63
    if (mesh < 32 && s.lastSize) {
        s.out.push(s.last)
    }
    switch (mesh) {
        case 0: {
            s.last = x & 0xFFFFFF
            s.lastSize = 6
            break
        }
        case 1: {
            s.out.push((x & 0xFFFFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 2: {
            s.out.push((x & 0xFFFF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 3: {
            s.out.push((x & 0xFFFF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 4: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 5: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 6: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 7: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 8: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 9: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 10: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 11: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 12: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 13: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 14: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 15: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.last = x & 0xFFFF
            s.lastSize = 4
            break
        }
        case 16: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.last = x & 0xFFFF
            s.lastSize = 4
            break
        }
        case 17: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 18: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 19: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 20: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 21: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 22: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 23: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 24: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 25: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 26: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 27: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 28: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FFF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 29: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FFF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 30: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FFFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 31: {
            s.out.push((x & 0xF00000) >>> 20)
            s.last = x & 0xFFFFF
            s.lastSize = 5
            break
        }
        case 32: {
            s.decodeContinue(s, x, 1)
            s.last = x & 0xFFFFF
            s.lastSize = 5
            break
        }
        case 33: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FFFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 34: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FFF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 35: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FFF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 36: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 37: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 38: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 39: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0FF000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 40: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 41: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 42: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 43: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 44: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 45: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 46: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 47: {
            s.decodeContinue(s, x, 1)
            s.out.push((x & 0x0F0000) >>> 16)
            s.last = x & 0xFFFF
            s.lastSize = 4
            break
        }
        case 48: {
            s.decodeContinue(s, x, 2)
            s.last = x & 0xFFFF
            s.lastSize = 4
            break
        }
        case 49: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 50: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 51: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00FF00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 52: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 53: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 54: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 55: {
            s.decodeContinue(s, x, 2)
            s.out.push((x & 0x00F000) >>> 12)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 56: {
            s.decodeContinue(s, x, 3)
            s.last = x & 0xFFF
            s.lastSize = 3
            break
        }
        case 57: {
            s.decodeContinue(s, x, 3)
            s.out.push((x & 0x000FF0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 58: {
            s.decodeContinue(s, x, 3)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 59: {
            s.decodeContinue(s, x, 3)
            s.out.push((x & 0x000F00) >>> 8)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 60: {
            s.decodeContinue(s, x, 4)
            s.last = x & 0xFF
            s.lastSize = 2
            break
        }
        case 61: {
            s.decodeContinue(s, x, 4)
            s.out.push((x & 0x0000F0) >>> 4)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 62: {
            s.decodeContinue(s, x, 5)
            s.last = x & 0xF
            s.lastSize = 1
            break
        }
        case 63: {
            s.decodeContinue(s, x, 6)
            break
        }
    }
}
export const decodeContinue = (s: State, x: number, a: number) => {
    const shift = a * 4
    const shift1 = 24 - shift
    const mask = (0xFFFFFF >>> shift1) << shift1
    if (s.lastSize + a > 13) {
        s.last = BigInt(s.last)
        if (a == 6) {
            s.last = s.last * BigInt(2) ** (BigInt(a) * BigInt(4)) + BigInt(x & 0xFFFFFF)
            s.lastSize += a
        }
        else {
            s.out.push(s.last * BigInt(2) ** BigInt(shift) + BigInt((x & mask) >>> shift1))
        }
    }
    else {
        if (a == 6) {
            s.last = s.last as number * 2 ** shift + (x & 0xFFFFFF)
            s.lastSize += a
        }
        else {
            s.out.push(s.last as number * 2 ** shift + ((x & mask) >>> shift1))
        }
    }
}
export const concat = (buffers: BufferSource[]): Uint8Array => {
    if (buffers.length == 1) {
        return buffers[0] instanceof Uint8Array ? buffers[0] : bufferSourceToUint8Array(buffers[0])
    }
    const u = new Uint8Array(buffers.reduce((a, b) => a + b.byteLength, 0))
    let offset = 0
    for (let b of buffers) {
        u.set(b instanceof Uint8Array ? b : bufferSourceToUint8Array(b), offset)
        offset += b.byteLength
    }
    return u
}
export const decode = (b: BufferSource | BufferSource[]) => {
    const buffers = Array.isArray(b) ? b : [b]
    const s: State = { out: [], last: 0, lastSize: 0, type: 0, decodeContinue }
    const outStack = []
    let nest = 0
    let nestU = 0
    let nestUall = false
    let nestUBuf
    for (let bu of buffers) {
        if (bu.byteLength % 4 != 0) {
            throw new Error('data must be multiple of 4 bytes')
        }
        const dv = bufferSourceToDataView(bu)
        let offset = 0
        while (offset < dv.byteLength) {
            if (nest) {
                if (nest > dv.byteLength - offset) {
                    const a = decode(bufferSourceToUint8Array(dv, dv.byteOffset + offset))
                    s.out.push(...a)
                    nest -= dv.byteLength - offset
                    offset = dv.byteLength
                }
                else {
                    const a = decode(bufferSourceToUint8Array(dv, dv.byteOffset + offset, nest))
                    s.out.push(...a)
                    offset += nest
                    nest = 0
                    const o = outStack.pop()
                    o.push(s.out)
                    s.out = o
                }
            }
            else if (nestU || nestUall) {
                if (nestU > dv.byteLength - offset || nestUall) {
                    nestUBuf = concat([nestUBuf, bufferSourceToUint8Array(dv, dv.byteOffset + offset)])
                    if (nestU) {
                        nestU -= dv.byteLength - offset
                    }
                    offset = dv.byteLength
                }
                else {
                    nestUBuf = concat([nestUBuf, bufferSourceToUint8Array(dv, dv.byteOffset + offset, nestU)])
                    offset += nestU
                    nestU = 0
                    s.out.push(nestUBuf)
                    nestUBuf = null
                }
            }
            else {
                decodeChunk(s, dv.getUint32(offset))
                switch (s.type) {
                    case 1: {
                        if (outStack.length) {
                            if (s.lastSize) {
                                s.out.push(s.last)
                                s.lastSize = 0
                            }
                            const o = outStack.pop()
                            o.push(s.out)
                            s.out = o
                        }
                        else {
                            offset = dv.byteLength
                        }
                        break
                    }
                    case 2: {
                        if (s.last as number != 0) {
                            nest = s.last as number * 4
                        }
                        outStack.push(s.out)
                        s.out = []
                        s.lastSize = 0
                        break
                    }
                    case 3: {
                        if (s.last as number != 0) {
                            nestU = s.last as number * 4
                        }
                        else {
                            nestUall = true
                        }
                        nestUBuf = new Uint8Array()
                        s.lastSize = 0
                        break
                    }
                }
                offset += 4
            }
        }
    }
    if (s.lastSize) {
        s.out.push(s.last)
    }
    if (nestUBuf) {
        s.out.push(nestUBuf)
    }
    return s.out
}
export const encode = (code: code[]) => {
    const buffers: Uint8Array[] = []
    let dv = new DataView(new ArrayBuffer(4096))
    let o = 0
    let chunkSpace = 6
    let chunk = 0
    let mesh = 0
    let mesh1 = false
    for (let x of code) {
        if (x instanceof Uint8Array) {
            if (x.byteLength == 0) {
                throw new Error('invalid Uint8Array')
            }
            let len = x.byteLength / 4
            let n = 8 - (Math.clz32(len) >>> 2)
            if (n > chunkSpace) {
                n = chunkSpace + (n > chunkSpace + 6 ? 12 : 6)
                chunk += len >>> ((n - chunkSpace) * 4)
                if (mesh1) {
                    mesh += (2 ** chunkSpace - 1)
                }
                n -= chunkSpace
                len = len & (2 ** (n * 4) - 1)
                dv.setUint32(o, (mesh << 24) + chunk)
                o += 4
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                }
                if (n == 12) {
                    dv.setUint32(o, (63 << 24) + (len >>> 24))
                    o += 4
                    len = len & 0xFFFFFF
                    if (dv.byteLength == o) {
                        buffers.push(new Uint8Array(dv.buffer))
                        dv = new DataView(new ArrayBuffer(4096))
                    }
                }
                dv.setUint32(o, (255 << 24) + len)
                o += 4
                chunkSpace = 6
                chunk = 0
                mesh = 0
                mesh1 = false
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                }
            }
            else {
                if (mesh1) {
                    mesh += (2 ** chunkSpace - 1)
                }
                dv.setUint32(o, ((192 + mesh) << 24) + chunk + len)
                o += 4
                chunkSpace = 6
                chunk = 0
                mesh = 0
                mesh1 = false
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                    o = 0
                }
            }
            const d2 = bufferSourceToDataView(x)
            for (let i = 0; i < d2.byteLength; i += 4) {
                dv.setUint32(o, d2.getUint32(i))
                o += 4
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                    o = 0
                }
            }
        }
        else if (Array.isArray(x)) {
            const b = encode(x)
            let len = b.reduce((a, b) => a + b.byteLength, 0) / 4
            let n = 8 - (Math.clz32(len) >>> 2)
            if (n > chunkSpace) {
                n = chunkSpace + (n > chunkSpace + 6 ? 12 : 6)
                chunk += len >>> ((n - chunkSpace) * 4)
                if (mesh1) {
                    mesh += (2 ** chunkSpace - 1)
                }
                n -= chunkSpace
                len = len & (2 ** (n * 4) - 1)
                dv.setUint32(o, (mesh << 24) + chunk)
                o += 4
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                    o = 0
                }
                if (n == 12) {
                    dv.setUint32(o, (63 << 24) + (len >>> 24))
                    o += 4
                    len = len & 0xFFFFFF
                    if (dv.byteLength == o) {
                        buffers.push(new Uint8Array(dv.buffer))
                        dv = new DataView(new ArrayBuffer(4096))
                        o = 0
                    }
                }
                dv.setUint32(o, (191 << 24) + len)
                o += 4
                chunkSpace = 6
                chunk = 0
                mesh = 0
                mesh1 = false
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                    o = 0
                }
            }
            else {
                if (mesh1) {
                    mesh += (2 ** chunkSpace - 1)
                }
                dv.setUint32(o, ((128 + mesh) << 24) + chunk + len)
                o += 4
                chunkSpace = 6
                chunk = 0
                mesh = 0
                mesh1 = false
                if (dv.byteLength == o) {
                    buffers.push(new Uint8Array(dv.buffer))
                    dv = new DataView(new ArrayBuffer(4096))
                    o = 0
                }
            }
            buffers.push(new Uint8Array(dv.buffer, 0, o))
            dv = new DataView(new ArrayBuffer(4096))
            o = 0
            buffers.push(...b)
        }
        else {
            if (x < 0 || (typeof x == 'number' && (x > Number.MAX_SAFE_INTEGER || isNaN(x) || !isFinite(x)))) {
                throw new Error('invalid number')
            }
            if (x <= 0xFFFFFFF) {
                let n = x == 0 ? 1 : 8 - (Math.clz32(x as number) >>> 2)
                if (n > chunkSpace) {
                    chunk += x as number >>> ((n - chunkSpace) * 4)
                    if (mesh1) {
                        mesh += (2 ** chunkSpace - 1)
                    }
                    n -= chunkSpace
                    x = (x as number) & (2 ** (n * 4) - 1)
                    dv.setUint32(o, (mesh << 24) + chunk)
                    o += 4
                    chunkSpace = 6
                    chunk = 0
                    mesh = 0
                    mesh1 = true
                    if (dv.byteLength == o) {
                        buffers.push(new Uint8Array(dv.buffer))
                        dv = new DataView(new ArrayBuffer(4096))
                        o = 0
                    }
                }
                chunk += x as number << ((chunkSpace - n) * 4)
                if (mesh1) {
                    mesh += (2 ** n - 1) << (chunkSpace - n)
                    mesh1 = false
                }
                else {
                    mesh1 = true
                }
                chunkSpace -= n
                if (chunkSpace == 0) {
                    dv.setUint32(o, (mesh << 24) + chunk)
                    o += 4
                    chunkSpace = 6
                    chunk = 0
                    mesh = 0
                    mesh1 = false
                    if (dv.byteLength == o) {
                        buffers.push(new Uint8Array(dv.buffer))
                        dv = new DataView(new ArrayBuffer(4096))
                        o = 0
                    }
                }
            }
            else {
                const s = x.toString(16)
                let i = 0
                while (true) {
                    const len = chunkSpace > s.length - i ? s.length - i : chunkSpace
                    chunk += parseInt(s.substring(i, i + len), 16) << ((chunkSpace - len) * 4)
                    if (mesh1) {
                        mesh += (2 ** len - 1) << (chunkSpace - len)
                    }
                    chunkSpace -= len
                    if (chunkSpace == 0) {
                        dv.setUint32(o, (mesh << 24) + chunk)
                        o += 4
                        chunkSpace = 6
                        chunk = 0
                        mesh = 0
                        mesh1 = true
                        if (dv.byteLength == o) {
                            buffers.push(new Uint8Array(dv.buffer))
                            dv = new DataView(new ArrayBuffer(4096))
                            o = 0
                        }
                    }
                    i += len
                    if (i == s.length) {
                        mesh1 = false
                        break
                    }
                }

            }
        }
    }
    if (chunkSpace < 6) {
        for (let i = chunkSpace - 1; i >= 0; i--) {
            chunk += r.placeholder << (i * 4)
            if (mesh1) {
                mesh += 2 ** i
            }
            mesh1 = !mesh1
        }
        dv.setUint32(o, (mesh << 24) + chunk)
        o += 4
    }
    if (o) {
        buffers.push(new Uint8Array(dv.buffer, 0, o))
    }
    return buffers
}
export const shi = [
    [8, 29], [8, 26], [8, 23], [8, 20], [8, 17], [8, 14], [8, 11], [8, 8],//7
    [11, 29], [11, 26], [11, 23], [11, 20], [11, 17], [11, 14], [11, 11],//14
    [14, 29], [14, 26], [14, 23], [14, 20], [14, 17], [14, 14],//20
    [17, 29], [17, 26], [17, 23], [17, 20], [17, 17],//25
    [20, 29], [20, 26], [20, 23], [20, 20],//29
    [23, 29], [23, 26], [23, 23],//32
    [26, 29], [26, 26],//34
    [29, 29]//35
]
export const shi1 = [
    [7], [6, 35], [5, 33, 35], [4, 34], [3, 30, 34], [2, 30, 33, 35]
]
export const shi2 = shi1.map(x => x.map(y => shi[y]))
export const d2 = (b: BufferSource | BufferSource[]) => {
    const buffers = Array.isArray(b) ? b : [b]
    const temp = Array(8)
    let last
    let lastSize
    const out = []
    for (let bu of buffers) {
        if (bu.byteLength % 4 != 0) {
            throw new Error('data must be multiple of 4 bytes')
        }
        const dv = bufferSourceToDataView(bu)
        let offset = 0
        while (offset < dv.byteLength) {
            const x = dv.getUint32(offset)
            let mesh = x >>> 24
            let count
            if (mesh >= 128) {
                mesh = mesh ^ 255
            }
            else {
                const a = shi2[mesh]
                let useLast = 0
                if (lastSize) {
                    useLast = 1
                    temp[0] = last
                    count = a.length
                }
                else {
                    count = a.length - 1
                }
                for (let i = 0; i < a.length - 1; i++) {
                    temp[i + useLast] = (x << a[i][0]) >>> a[i][1]
                }
                const an = a[a.length - 1]
                last = (x << an[0]) >>> an[1]
                lastSize = 32 - an[1]
            }
            out.push(...temp.slice(0, count))
            offset += 4
        }
    }
    if (lastSize) {
        out.push(last)
    }
    return out
}