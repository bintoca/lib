export const enum op {
    setStandard, //(i:vint)
    setSourceList, //(i:vint)
    addSourceList, //(i:vint)
    subSourceList, //(i:vint)
    setDestinationList, //(i:vint)
    addDestinationList, //(i:vint)
    subDestinationList, //(i:vint)

    append_single, //(i:vint)
    append_many, //(count:vint, i...)
    append_many_size, //(count:vint, size:vint, bytes:u8[])
    append_many_sizes, //(count:vint, [size:vint,bytes:u8[]]...)
    setSourceOffset_append_range, //(off:vint, range:vint)
    addSourceOffset_append_range, //(off:vint, range:vint)
    subSourceOffset_append_range, //(off:vint, range:vint)
    append_list_of_uint, //(bits:vint)
    append_list_of_sint, //(bits:vint)
    append_list_of_bit_standard, //(bitStandard:vint, bits:vint)

    setComponent, //(i:vint)
    extendComponent, //(size:vint, bytes:u8[])
    shortenComponent, //(count:vint)
    extendComponent_bits, //(count:vint, bits:vint)
    shortenComponent_bits, //(count:vint)

    load_links, //() all of destination list

    byteString, //(size:vint, bytes:u8[])
    garbageCollect, //() dest -> src

    magicNumber = 217, //always 7 bytes //0xD9D9F8 (non-unicode bytes derived from cbor tag 55800) + 0x42494E4C44 ("BINLD") or ("BXXLD") for beta
}
export const enum standard {
    setStandard_int, //()
    setStandard_registry, //()
    setStandard_unicode, //()
    setStandard_sha256, //()
}
export const enum bitStandard {
    append_list_of_IEEE754_binary, //(bits:vint)
    append_list_of_IEEE754_decimal_BID, //(bits:vint)
    append_list_of_IEEE754_decimal_DPD, //(bits:vint)
}
export const enum component {
    setComponent_OID, //() ASN.1 BER rules
    setComponent_scheme, //()
    setComponent_DNS, //()
    setComponent_path, //()

    setComponent_user, //()
    setComponent_IPv6, //()
    setComponent_IPv4, //()
    setComponent_port, //()
    setComponent_query, //()
    setComponent_fragment, //()
    setComponent_language, //()
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