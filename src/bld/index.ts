export type DecoderState = {
    position: number, decodeItemFunc: (op: registryID, additionalInformation: number, dv: DataView, src: DecoderState) => any, decodeMainFunc: (dv: DataView, state: DecoderState) => any,
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
type token = registryID | number | string | Uint8Array
const registry: token[] = []

export const enum registryID {
    //varint
    uintV,
    nintV,
    size_bits1,
    size_bytes1,
    globalSlot,
    localSlot,
    indexSlot,

    //varint length + 1
    utf8,
    idna_utf8,
    octetsTyped, //(len:vint, type:var, bytes:u8[])

    //end marker
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

    add,
    subtract,
    multiply,
    divide,
    exponent,
    logarithm,

    assignment,
    function,
    call,
    return,
    
    request,
    response,
    locator,
    integrity,
    
    hexDumpId, //put somewhere to make ascii
    
    //no value
    //-10 to 10
    end, //put somewhere to make ascii
    skip,
    type,
    id,
    false,
    true,
    
    uint, //blocks
    sint,

    boolean, //units
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
    imaginary,
    unicode,
    
    //no value
    Infinity = 128,
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
    IEEE754_binary16,
    IEEE754_binary32,
    IEEE754_binary64,
    IEEE754_binary128,
    IEEE754_binary256,
    IEEE754_decimal_BID32,
    IEEE754_decimal_BID64,
    IEEE754_decimal_BID128,
    IEEE754_decimal_DPD32,
    IEEE754_decimal_DPD64,
    IEEE754_decimal_DPD128,
    unorm,
    snorm,

    port, //big endian
    IPv4, //big endian
    IPv6, //big endian
    UUID,
    sha256,
    IRI_utf8,
    OID, //ASN.1 BER
    relative_OID,

    embedded_BLD,

    mediaType,
    encoding,
    
    //???
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