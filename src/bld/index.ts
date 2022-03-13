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
    placeholder,
    set_slot, //(v4)
    get_slot, //(v4)
    back_ref, //(v4)
    run_length_encoding, //(v4)
    next_length, //(x:any, len:v4, val:u4[])
    next_v4, //(x:any, val:v4)

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
    utf4,
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
const enum unicode_shuffle {
    a,
    e,
    i,
    o,
    u,
    y,
    space,
    dot,

    //2nd chunk - numbers, most letters, most common puncuation

    //3rd chunk - remaining ascii then continue according to unicode

    //language tags composed by unit within unit of unicode
}
type scope = { type: 'set_slot' | 'function', needed: number, items: any[], p?: number }
export const interp = (code: any[]) => {
    const slots = []
    const scope_stack: scope[] = []
    let next_set_slot_index
    function check_top_scope() {
        if (scope_stack.length) {
            const top = scope_stack[scope_stack.length - 1]
            return top
        }
        throw new Error('empty scope_stack')
    }
    const scope_top = () => scope_stack[scope_stack.length - 1]
    function collapse_scope(x) {
        let loop = true
        let i = x
        while (loop) {
            const t = scope_top()
            if (t) {
                t.items.push(i)
                if (t.items.length == t.needed) {
                    const y = scope_stack.pop()
                    i = y
                    if (y.type == 'set_slot') {

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
        if (next_set_slot_index) {
            next_set_slot_index = false
            scope_stack.push({ type: 'set_slot', needed: 1, items: [], p: x })
        }
        else {
            switch (x) {
                case r.set_slot: {
                    next_set_slot_index = true
                    break
                }
                case r.function: {
                    scope_stack.push({ type: 'function', needed: 0, items: [] })
                    break
                }
                case r.end_scope: {
                    const top = scope_stack.pop()// check_top_scope()
                    if (!top || top.needed) {
                        throw new Error('top of scope_stack invalid for end_scope')
                    }
                    collapse_scope(top)
                    break
                }
                default:
                    collapse_scope(x)
            }
        }
    }
    return { slots }
}