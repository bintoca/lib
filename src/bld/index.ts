export const enum op {
    setSourcePlane, //(i:vint)
    setDestinationPlane, //(i:vint)
    setSourceList, //(i:vint)
    setDestinationList, //(i:vint)
    setOffset, //(i:vint)
    setComponentType, //(c:vint)
    shortenComponent, //(count:vint)
    append_offset_range, //(range:vint)
    uint, //(i:vint)
    array, //(size:vint)
    uft8, //(size:vint, bytes:u8[])
    append_offset, //(size:vint, bytes:u8[])
    extendComponent, //(size:vint, bytes:u8[])
    special, //D_13
    setOffset_scale, //(scalingFactor:vint4, i:vint)
    append_offset_range_scale, //(scalingFactor:vint4, range:vint)
}
export const enum D_13 {
    noop, //()
    incrementDestinationList, //()
    nint, //(i:svint)
    map, //(size:vint)
    byteString, //(size:vint, bytes:u8[])
    renderPack, //(size:vint, bytes:u8[])
    append_offset_many, //(count:vint, size:vint, bytes:(count*size):u8[])
    append_offset_many_sizes, //(count:vint, bytes:count*(size:vint,u8[]))
    extendComponent_bits, //(bitCount:vint, size:vint, bytes:u8[])
    magicNumber, //always 7 bytes //0xD9D9F8 (non-unicode bytes derived from cbor tag 55800) + 0x42494E4C44 ("BINLD") or ("BXXLD") for beta
    false, //()
    true, //()
    null, //()
    extendedOps0param, //(i:vint)
    extendedOps1param, //(i:vint, p1:vint)
    extendedOpsNparam, //(i:vint, n:vint, p...)
}
export const enum extendedOps0param {
    undefined, //()
    indefiniteLength_Bytes, //()
    indefiniteLength_UTF8, //()
    indefiniteLength_Array, //()
    indefiniteLength_Map, //()
    endIndefiniteLength, //()
    garbageCollect, //() dest -> src
    setComponentIANAPrivateEnterpriseOID, //() 1.3.6.1.4.1
}
export const enum extendedOps1param {
    shortenComponent_bits, //(count:vint)
    draftRevision, //(i:vint)
    cborTag, //(i:vint)
    cborSimple, //(i:vint)
    IEEE754_binary_v, //(i:vint) [f16, 3 bytes] [f32, 5 bytes] [f64, 10 bytes] [f128, 19 bytes] [f256, 37 bytes]
}
export const enum plane {
    standard,
    sha,
    constructed,
    pack,
    context,
}
export const enum standard {
    uint,
    neg,
    registry,
    unicode,
    component,
}
export const enum sha {
    sha256
}
export const enum component {
    ObjectIdentifier, //ASN.1 BER rules [X.690] [RFC6256] 
    scheme,
    DNS,
    pathHierarchy,
    IPv6,

    pathString = 8,
    query,
    fragment,
    port,
    user,
    IPv4,
    language,
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
