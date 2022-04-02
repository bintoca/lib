export const bufferSourceToDataView = (b: BufferSource, offset: number = 0, length?: number): DataView => b instanceof ArrayBuffer ? new DataView(b, offset, length !== undefined ? length : b.byteLength - offset) : new DataView(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufferSourceToUint8Array = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => b instanceof ArrayBuffer ? new Uint8Array(b, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const enum r {
    end_scope,
    unicode, //end_scope
    back_ref, //(v4)
    run_length_encoding, //(v4,any)
    placeholder,
    uint,
    private_namespace, //(v4)

    conditional, //(condition, true_op, false_op)
    function, //implies one item pushed to reuse stack for param, end_scope
    call, //func, param
    entity, //keys, end_scope, values
    prop_accessor, //object, prop
    prop_has, //object, prop
    
    template,
    packed_data,
    choice,
    choice_type,
    size_bits1,
    merge,
    subset,

    nominal_type,
    id,
    unit,

    add,
    subtract,
    multiply,
    divide,
    equal,
    not_equal,
    greater_than,
    greater_than_or_equal,
    less_than,
    less_than_or_equal,
    logical_and,
    logical_or,
    logical_not,
    remainder,

    filter,
    map,
    reduce,
    skip,
    take,
    min,
    max,

    nint,
    sint,
    unorm,
    snorm,
    IEEE_binary32,
    IEEE_binary64,
    IEEE_decimal32_BID,
    IEEE_decimal64_BID,
    
    bld_idna,
    embedded_bld,
    binary_exponent,
    decimal_exponent,

    next_singular,
    next_scope,

    try,
    catch,
    finally,
    throw,
    promise_all,
    promise_all_settled,
    promise_any,
    promise_race,

    abs,
    acos,
    acosh,
    asin,
    asinh,
    atan,
    atanh,
    atan2,
    cbrt,
    ceil,
    clz32,
    cos,
    cosh,
    exp,
    expm1,
    floor,
    fround,
    hypot,
    log,
    log1p,
    log10,
    log2,
    pow,
    round,
    sign,
    sin,
    sinh,
    sqrt,
    tan,
    tanh,
    trunc,

    log_base,
    nth_root,

    Math_E,
    Math_LN10,
    Math_LN2,
    Math_LOG10E,
    Math_LOG2E,
    Math_PI,
    Math_SQRT1_2,
    Math_SQRT2,

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

    //????????????????????????
    collection,
    collection_ordered,
    collection_sorted,
    collection_unique,
    collection_ordered_sorted,
    collection_ordered_unique,
    collection_sorted_unique,
    collection_ordered_sorted_unique,

    request,
    response,
    locator,
    integrity,

    seconds,
    minutes,
    hours,
    days,
    months,
    years,
    timeScale, //default:UTC
    TAI,
    UTC, //if only seconds is specified apply posix rules
    leapSeconds,
    timezoneOffset,
    timezoneID,
    dateTime, //also used as start of interval
    dateTimeEnd,
    duration,
    intervalRepeat, //R[n]/ in ISO 8601
    timeInterval,
    timePeriod, //g types from xsd

    latitude, //reference ellipsoids?
    longitude,

    //TODO language tags BCP47
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
type scope = { type: r, needed: number, items: slot[], result?, ref?: slot, isFuncParam?: boolean, inUnicode?: boolean, next_literal_item?: boolean }
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
                                if (s.type == r.function) {
                                    if (back == 1) {
                                        y.ref = s
                                        y.isFuncParam = true
                                        break
                                    }
                                    back--
                                }
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
                    const top = scope_stack.pop()
                    if (top.items.length == 0) {
                        throw new Error('end_scope cannot be empty')
                    }
                    collapse_scope(top)
                    break
                }
                default:
                    collapse_scope(x)
            }
        }
        else {
            switch (x) {
                case r.function:
                case r.entity: {
                    scope_stack.push({ type: x, needed: 0, items: [] })
                    break
                }
                case r.unicode: {
                    scope_stack.push({ type: x, needed: 0, items: [], inUnicode: true })
                    break
                }
                case r.end_scope: {
                    if (!top || top.needed) {
                        throw new Error('top of scope_stack invalid for end_scope')
                    }
                    if (top.items.length == 0) {
                        throw new Error('end_scope cannot be empty')
                    }
                    if (top.type == r.entity) {
                        top.needed = top.items.length * 2
                    }
                    else {
                        collapse_scope(scope_stack.pop())
                    }
                    break
                }
                case r.run_length_encoding: {
                    scope_stack.push({ type: x, needed: 2, items: [], next_literal_item: true })
                    break
                }
                case r.back_ref:
                case r.uint:
                case r.nint:
                case r.unorm:
                case r.snorm:
                case r.IEEE_binary32:
                case r.IEEE_binary64:
                case r.IEEE_decimal32_BID:
                case r.IEEE_decimal64_BID: {
                    scope_stack.push({ type: x, needed: 1, items: [], next_literal_item: true })
                    break
                }
                case r.call: {
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
export const evaluate = (x: scope, funcParam?: slot) => {
    switch (x.type) {
        case r.call: {
            const f = x.items[0]
            if (f instanceof Uint8Array) {
                throw new Error('not implemented x0 ' + f)
            }
            else if (typeof f == 'object' && !Array.isArray(f)) {
                switch (f.type) {
                    case r.back_ref: {
                        x.result = evaluate(f.ref as scope, x.items[1])
                        break
                    }
                    default:
                        throw new Error('not implemented' + f.type)
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
        default:
            throw new Error('not implemented' + x.type)
    }
}
export const evaluateAll = (slots: slot[]) => {
    for (let x of slots) {
        if (x instanceof Uint8Array) {

        }
        else if (typeof x == 'object' && !Array.isArray(x) && x.type == r.call) {
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