export const enum op {
    magicNumber_noop, //(count:vint, bytes:"BLD"[])
    setSourceList, //(i:vint)
    addSourceList, //(i:vint1)
    subSourceList, //(i:vint1)
    setSourceOffset, //(i:vint)
    addSourceOffset, //(i:vint1)
    subSourceOffset, //(i:vint1)
    setDestinationList, //(i:vint1)
    addDestinationList, //(i:vint1)
    subDestinationList, //(i:vint1)
    setDestinationOffset, //(i:vint)
    addDestinationOffset, //(i:vint1)
    subDestinationOffset, //(i:vint1)

    append_single, //(i:vint)
    append_single_size, //(size:vint1, bytes:u8[])
    append_many, //(count:vint1, i:vint...)
    append_many_size, //(count:vint1, size:vint1, bytes:u8[])
    append_many_size_count, //(size:vint1, count:vint1, bytes:u8[])
    append_many_sizes, //(count:vint1, [size:vint1, bytes:u8[]]...)
    append_range, //(range:vint1)
    append_list, //(negOffset:vint1)
    append_list_snapshot, //(negOffset:vint1)
    append_list_suffix, //(negOffset:vint1)
    nest_next_appends, //(i:vint1)
    nest_next_appends_deep, //(i:vint1)
    next_appends_insert_before, //(i:vint1)
    set_dest_offset_stack, //(count:vint1, i:vint...)
    push_dest_offset_stack, //(i:vint)
    push_dest_offset_stack_many, //(count:vint1, i:vint...)
    pop_dest_offset_stack, //(count:vint1)
    shorten_from_offset, //(count:vint1)

    data_frame, //(size:vint, bytes:u8[])
}
export type DecoderState = {
    position: number, decodeItemFunc: (op: op, additionalInformation: number, dv: DataView, src: DecoderState) => any, decodeMainFunc: (dv: DataView, state: DecoderState) => any,
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
export const enum frame {
    load_context, //(i:vint)
    save_context, //(i:vint)
    delete_context, //(i:vint)
    load_links,
    init_stream_context_list,
    encoded,
    embedded_stream,
    embedded_stream_encoded,
}
export const enum encoding {
    fixed_width_pack,
    fixed_width_multi_pack,
    compression_huffman,
    compression_arithmetic,
    encryption,
}
export const enum standard {
    setStandard_int, //()
    setStandard_registry, //()
    setStandard_unicode, //()
}
export const enum bitStandard {
    create_list_of_uint, //(bits:vint1)
    create_list_of_sint, //(bits:vint1)
    create_list_of_IEEE754_binary, //(bits:vint)
    append_list_of_IEEE754_decimal_BID, //(bits:vint)
    append_list_of_IEEE754_decimal_DPD, //(bits:vint)
    unorm,
    snorm,
}
export const enum component {
    setComponent_OID, //() ASN.1 BER rules
    setComponent_scheme, //()
    setComponent_DNS, //() and LDAP dc
    setComponent_path, //()
    UUID,
    BLD_blob,
    sha256,
    setComponent_query, //()
    setComponent_fragment, //()
    setComponent_IPv6, //()
    setComponent_IPv4, //()
    setComponent_port, //()
    setComponent_language, //()
    setComponent_user, //()
    ou, //LDAP organizational unit
    cn, //LDAP common name
    o, //LDAP organization
    c, //LDAP country
    l, //LDAP locality
}
export const enum ext {
    draftRevision, //(i:vint)
    majorVersion, //(i:vint)
    extendedOps0param, //(i:vint)
    extendedOps1param, //(i:vint, p1:vint)
    extendedOpsNparam, //(i:vint, n:vint, p...)
    extendedOps0paramPrivate, //(i:vint)
    extendedOps1paramPrivate, //(i:vint, p1:vint)
    extendedOpsNparamPrivate, //(i:vint, n:vint, p...)
}
export const enum registryID {
    id,
    type,
    container,
    set,
    list,

    false,
    true,
    null,
    undefined,

    numberStandard, //default:IEEE754
    IEEE754,
    IEEE754_decimal32_BID,
    IEEE754_decimal64_BID,
    IEEE754_decimal128_BID,
    IEEE754_decimal32_DPD,
    IEEE754_decimal64_DPD,
    IEEE754_decimal128_DPD,

    Infinity,
    NegativeInfinity,
    sNaN,
    qNaN,
    NegativeZero,

    uint,
    denominator, //use uint as numerator in rationals
    biasedExponentBase2,
    biasedExponentWithSignBase2,
    signed_normalized,
    unsigned_normalized,
    fixedPointScalingBase2,
    fixedPointScalingBase10,

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

    latitude,
    longitude,

    //TODO language tags BCP47

    linkIndex,
    deleteIndex,
    updateIndex,
    insertIndex,
    runCount,

    Math_E,
    Math_LN10,
    Math_LN2,
    Math_LOG10E,
    Math_LOG2E,
    Math_PI,
    Math_SQRT1_2,
    Math_SQRT2,

    CoordinateSystem,
    Quaternions,
    Cartesian,
    Cylindrical,
    Spherical,
    RGBA,
    DepthStencil,
    Origin,
    Coordinate1,
    Coordinate2,
    Coordinate3,
    Coordinate4,
    Orientation1,
    Orientation2,
    Orientation3,
    Orientation4,
    Unit,
    power,
    second,
    meter,
    kilogram,
    ampere,
    kelvin,
    mole,
    candela,

    scheme,
    authority,
    path,
    query,
    fragment,
    host,
    port,
    user,
    DNS,
    IPv4,
    IPv6,
    prefix,
    IPversion,
    IPvFuture,
}
type token = op | number | string | Uint8Array
const registry: token[] = []

export const enum r {
    //no value
    //0-20 subtract 10
    end = 21,
    false, 
    true, 
    null,
    rootIndex,

    //1 byte value
    uintLen1,
    nintLen1,

    //varint
    globalSlot,
    localSlot,

    //varint length
    uint,
    nint,
    sint,
    IEEE754_binary,
    IEEE754_decimal_BID,
    IEEE754_decimal_DPD,
    unorm,
    snorm,
    uintCents,
    nintCents,
    utf8,
    idna_utf8,
    embedded_BLD,
    octets, //(len:vint, bytes:u8[])
    octetsTyped, //(len:vint, type:var, bytes:u8[])
    size_bits1,
    size_bytes1,
    hexDumpId, // length 6 followed by ascii "BLDBLD"
    sha256,
    port,
    IPv4,
    IPv6,
    UUID,

    //end marker
    id,
    list,
    listTyped,
    listOfType,
    set,
    setTyped,
    setOfType,

    rational,
    complex,
    float, //(base2Exponent:var, m:var)
    decimal, //(base10Exponent:var, m:var)

    request,
    response,
    locator,
    integrity,

    assignment,
    function,
    call,
    return,
    

    //no value
    undefined = 128,
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

    IRI_utf8,
    OID, //ASN.1 BER
    relative_OID,

    mediaType,
    encoding,
    
    latitude,
    longitude,
}