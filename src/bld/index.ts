export type DecoderState = {
    position: number, decodeItemFunc: (op: r, additionalInformation: number, dv: DataView, src: DecoderState) => any, decodeMainFunc: (dv: DataView, state: DecoderState) => any,
    queue: BufferSource[], stopPosition?: number, tempBuffer: Uint8Array
}
export const bufferSourceToDataView = (b: BufferSource, offset: number = 0, length?: number): DataView => b instanceof ArrayBuffer ? new DataView(b, offset, length !== undefined ? length : b.byteLength - offset) : new DataView(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufferSourceToUint8Array = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => b instanceof ArrayBuffer ? new Uint8Array(b, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const decodeLoop = (state: DecoderState) => {
    let dv: DataView
    const first = state.queue[0]
    if (first) {
        if (first.byteLength < state.tempBuffer.byteLength) {
            let count = 0
            let i = 0
            while (count < state.tempBuffer.byteLength && i < state.queue.length) {
                const b = state.queue[i]
                const d = bufferSourceToDataView(b)
                for (let j = 0; j < b.byteLength; j++) {
                    if (count < state.tempBuffer.byteLength) {
                        state.tempBuffer[count] = d.getUint8(j)
                        count++
                    }
                }
                i++
            }
            dv = bufferSourceToDataView(state.tempBuffer, 0, count)
        }
        else {
            dv = bufferSourceToDataView(first)
        }
    }
    else {
        throw new Error('no data supplied to decodeLoop')
    }
    const start = state.position = 0
    state.stopPosition = undefined
    let result
    const dm = state.decodeMainFunc
    while (state.position < dv.byteLength) {
        result = dm(dv, state)
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
            state.queue[0] = bufferSourceToUint8Array(x, newOffset)
        }
    }
    return result
}
export const decodeMain = (dv: DataView, state: DecoderState): any => {
    const c = dv.getUint8(state.position)
    state.position++;
    const p = c >> 5
    const op = c & 31
    state.decodeItemFunc(op, p, dv, state)
}
export const enum r {
    end_scope,
    unicode, //end_scope
    back_ref, //(v4)
    run_length_encoding, //(v4,any)
    placeholder,
    next_describe, //(any, v4|Uint8Array)


    conditional, //(condition, true_op, false_op)
    function, //implies one item pushed to reuse stack for param, end_scope
    statement_block, //end_scope
    call, //func, param
    call_sync, //func, param
    prop_accessor, //object, prop
    prop_has, //object, prop
    nominal_type,
    id,
    unit,
    entity, //pairs, end_scope
    template,
    reify,
    merge,
    subset,
    choice,

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

    filter,
    map,
    reduce,
    skip,
    take,
    min,
    max,

    uint,
    size_bits1,
    bld_idna_utf4,
    embedded_bld,
    float2_exponent, //default bias: 9
    float10_exponent, //default bias: 9
    extra_bias,
    normalized,

    next_singular,
    next_scope,
    private_namespace, //(v4)

    //12-bit
    reuse_buffer_window, //(v4)
    module, //implies one item pushed to reuse stack for param
    try,
    catch,
    finally,
    throw,
    promise_all,
    promise_all_settled,
    promise_any,
    promise_race,
    remainder,

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
    imul,//??
    log,
    log1p,
    log10,
    log2,
    pow,
    round,
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
    port,
    IPv6,
    UUID,
    sha256,
    IRI_utf4,
    OID,
    relative_OID,
    content_type_utf4,

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
type scope = { type: r, needed: number, items: slot[], result?, ref?: slot, isFuncParam?: boolean }
type slot = scope | number | Uint8Array
type code = number | Uint8Array
export const parse = (code: code[]) => {
    const slots: slot[] = []
    const scope_stack: scope[] = []
    let next_literal_item: boolean
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
                        let back = y.items[0] as number
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
                    else if (t.type == r.next_describe) {
                        next_literal_item = false
                    }
                }
                else {
                    if (t.type == r.next_describe && t.items.length == 1) {
                        next_literal_item = true
                    }
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
        if (x instanceof Uint8Array) {
            collapse_scope(x)
        }
        else if (next_literal_item) {
            next_literal_item = false
            collapse_scope(x + 1)
        }
        else if (scope_stack.filter(x => x.type == r.unicode).length) {
            switch (x) {
                case r.unicode: {
                    scope_stack.push({ type: x, needed: 0, items: [] })
                    break
                }
                case r.run_length_encoding: {
                    next_literal_item = true
                    scope_stack.push({ type: x, needed: 2, items: [] })
                    break
                }
                case r.back_ref: {
                    next_literal_item = true
                    scope_stack.push({ type: x, needed: 1, items: [] })
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
                case r.function: {
                    if (scope_stack.length) {
                        throw new Error('functions can only be declared in top level scope')
                    }
                    scope_stack.push({ type: x, needed: 0, items: [] })
                    break
                }
                case r.unicode: {
                    scope_stack.push({ type: x, needed: 0, items: [] })
                    break
                }
                case r.end_scope: {
                    const top = scope_stack.pop()
                    if (!top || top.needed) {
                        throw new Error('top of scope_stack invalid for end_scope')
                    }
                    if (top.items.length == 0) {
                        throw new Error('end_scope cannot be empty')
                    }
                    collapse_scope(top)
                    break
                }
                case r.next_describe: {
                    scope_stack.push({ type: x, needed: 2, items: [] })
                    break
                }
                case r.run_length_encoding: {
                    next_literal_item = true
                    scope_stack.push({ type: x, needed: 2, items: [] })
                    break
                }
                case r.back_ref: {
                    next_literal_item = true
                    scope_stack.push({ type: x, needed: 1, items: [] })
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
            else if (typeof f == 'object') {
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
            return typeof last == 'object' && last.result ? last.result : last
        }
        default:
            throw new Error('not implemented' + x.type)
    }
}
export const evaluateAll = (slots: slot[]) => {
    for (let x of slots) {
        if (x instanceof Uint8Array) {

        }
        else if (typeof x == 'object' && x.type == r.call) {
            evaluate(x)
        }
    }
}
type State = { out: code[], prev: number, prevSize: number, dv: DataView, offset: number, max: number, type: number }
export const decodeChunk = (s: State) => {
    const x = s.dv.getUint32(s.offset)
    s.type = x >>> 30
    const mesh = (x >>> 24) & 63
    if (mesh < 32 && s.prevSize) {
        s.out.push(s.prev)
    }
    switch (mesh) {
        case 0: {
            s.prev = x & 0xFFFFFF
            s.prevSize = 6
            break
        }
        case 1: {
            s.out.push((x & 0xFFFFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 2: {
            s.out.push((x & 0xFFFF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 3: {
            s.out.push((x & 0xFFFF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 4: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 5: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 6: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 7: {
            s.out.push((x & 0xFFF000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 8: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 9: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 10: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 11: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 12: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 13: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 14: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 15: {
            s.out.push((x & 0xFF0000) >>> 16)
            s.prev = x & 0xFFFF
            s.prevSize = 4
            break
        }
        case 16: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.prev = x & 0xFFFF
            s.prevSize = 4
            break
        }
        case 17: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 18: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 19: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 20: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 21: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 22: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 23: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 24: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 25: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 26: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 27: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 28: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FFF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 29: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FFF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 30: {
            s.out.push((x & 0xF00000) >>> 20)
            s.out.push((x & 0x0FFFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 31: {
            s.out.push((x & 0xF00000) >>> 20)
            s.prev = x & 0xFFFFF
            s.prevSize = 5
            break
        }
        case 32: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.prev = x & 0xFFFFF
            s.prevSize = 5
            break
        }
        case 33: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FFFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 34: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FFF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 35: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FFF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 36: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 37: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 38: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FF000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 39: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0FF000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 40: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 41: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 42: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 43: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 44: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 45: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 46: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.out.push((x & 0x00FFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 47: {
            const a = 1
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xF00000) >>> 20))
            s.out.push((x & 0x0F0000) >>> 16)
            s.prev = x & 0xFFFF
            s.prevSize = 4
            break
        }
        case 48: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.prev = x & 0xFFFF
            s.prevSize = 4
            break
        }
        case 49: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00FFF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 50: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00FF00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 51: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00FF00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 52: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 53: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 54: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00F000) >>> 12)
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 55: {
            const a = 2
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFF0000) >>> 16))
            s.out.push((x & 0x00F000) >>> 12)
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 56: {
            const a = 3
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFF000) >>> 12))
            s.prev = x & 0xFFF
            s.prevSize = 3
            break
        }
        case 57: {
            const a = 3
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFF000) >>> 12))
            s.out.push((x & 0x000FF0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 58: {
            const a = 3
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFF000) >>> 12))
            s.out.push((x & 0x000F00) >>> 8)
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 59: {
            const a = 3
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFF000) >>> 12))
            s.out.push((x & 0x000F00) >>> 8)
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 60: {
            const a = 4
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFFF00) >>> 8))
            s.prev = x & 0xFF
            s.prevSize = 2
            break
        }
        case 61: {
            const a = 4
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFFF00) >>> 8))
            s.out.push((x & 0x0000F0) >>> 4)
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 62: {
            const a = 5
            checkMax(s, a)
            s.out.push(s.prev * 2 ** (a * 4) + ((x & 0xFFFFF0) >>> 4))
            s.prev = x & 0xF
            s.prevSize = 1
            break
        }
        case 63: {
            const a = 6
            checkMax(s, a)
            s.prev = s.prev * 2 ** (a * 4) + (x & 0xFFFFFF)
            s.prevSize += a
            break
        }
    }
}
export const checkMax = (s: State, add: number) => {
    if (s.prevSize + add > s.max) {
        throw new Error('too many continuation chunks')
    }
}
export const decode = (b: BufferSource) => {
    if (b.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes')
    }
    const s: State = { out: [], prev: 0, prevSize: 0, dv: bufferSourceToDataView(b), offset: 0, max: 13, type: 0 }
    while (s.offset < s.dv.byteLength) {
        decodeChunk(s)
        switch (s.type) {
            case 1: {
                s.offset = s.dv.byteLength
                break
            }
            case 2: {
                s.prevSize = 0
                break
            }
            case 3: {
                s.out.push(new Uint8Array(s.dv.buffer, s.dv.byteOffset + s.offset + 4, s.prev * 4))
                s.prevSize = 0
                s.offset += s.prev * 4
                break
            }
        }
        s.offset += 4
    }
    if (s.prevSize) {
        s.out.push(s.prev)
    }
    return s.out
}
export const encode = (code: code[]) => {
    const len = code.map(x => x instanceof Uint8Array ? x.byteLength + 4 : 4).reduce((a, b) => a + b, 0)
    const dv = new DataView(new ArrayBuffer(len))
    let o = 0
    for (let x of code) {
        if (x instanceof Uint8Array) {
            dv.setUint32(o, (x.byteLength / 4) + 0xc0000000)
            o += 4
            const d2 = bufferSourceToDataView(x)
            for (let i = 0; i < d2.byteLength; i += 4) {
                dv.setUint32(o, d2.getUint32(i))
                o += 4
            }
        }
        else {
            dv.setUint32(o, x)
            o += 4
        }
    }
    return dv
}