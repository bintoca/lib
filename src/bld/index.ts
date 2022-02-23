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
type token = r | number | string | Uint8Array
const registry: token[] = []
const enum r {
    start_collection,
    end_collection,
    push_item,
    pop_item,
    reuse_stack_1,
    reuse_stack_2,
    reuse_stack_3,
    data_frame, //(type:var, len:v4+1, val:u4[])
    
    run_length_encoding, //(next_item_count:v4)
    function, //(param_count_push_slots:v4)
    conditional, //condition, true_op, false_op
    statement_block,
    call, //func, ...params
    call_sync, //func, ...params
    return, //single or collection
    prop_accessor, //object, prop
    
    size_bits1, //(v4+1)
    bld_utf4,
    bld_idna_utf4,
    embedded_bld,
    IEEE754_binary16,
    IEEE754_binary32,
    IEEE754_decimal_BID32,
    IEEE754_decimal_DPD32,
    IPv4,
    port,

    zero,
    one,
    _2,
    _3,
    _4,
    _5,
    _6,
    _7,
    _8,
    _9,
    _10,
    reuse_stack_4,
    reuse_stack_5,
    reuse_stack_6,
    reuse_stack_7,
    reuse_stack_8,

    add,
    subtract,
    multiply,
    divide,

    _11 = 64,
    _32 = 64 + 32 - 11,
    //
    n_16, 
    reuse_stack_16,
    
    module, //(param_count_push_slots:v4)
    try,
    catch,
    finally,
    throw,
    promise_all,
    promise_all_settled,
    promise_any,
    promise_race,

    exponent,
    logarithm,
    nth_root,
    sqrt,
    Infinity,
    NegativeInfinity,
    NegativeZero,
    sNaN,
    qNaN,
    Math_E,
    Math_LN10,
    Math_LN2,
    Math_LOG10E,
    Math_LOG2E,
    Math_PI,
    Math_SQRT1_2,
    Math_SQRT2,
    imaginary,
    IEEE754_binary64,
    IEEE754_binary128,
    IEEE754_binary256,
    IEEE754_decimal_BID64,
    IEEE754_decimal_BID128,
    IEEE754_decimal_DPD64,
    IEEE754_decimal_DPD128,
    unorm,
    snorm,
    uint,
    sint,
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

    private_namespace, //(v4)

    _33 = 512,
    _256 = 512 + 32 * 7 - 1,
    //
    n_128,
    reuse_stack_128,
    
    _257 = 4096,
    _2048 = 4096 + 256 * 7 - 1,
    //
    n_1024,
    reuse_stack_1024,

    //????????????????????????
    skip,
    type,
    id,
    false,
    true,
    boolean,
    unicode,

    collection,
    collection_ordered,
    collection_sorted,
    collection_unique,
    collection_ordered_sorted,
    collection_ordered_unique,
    collection_sorted_unique,
    collection_ordered_sorted_unique,
    dimension,
    unit,
    value,

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