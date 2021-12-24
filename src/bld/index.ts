export const enum op {
    magicNumber, //(count:vint1, bytes:"BLD"[])
    setStandard, //(i:vint)
    setSourceList, //(i:vint)
    addSourceList, //(i:vint1)
    subSourceList, //(i:vint1)
    setDestinationList, //(i:vint)
    addDestinationList, //(i:vint1)
    subDestinationList, //(i:vint1)

    append_single, //(i:vint)
    append_many, //(count:vint1, i...)
    append_many_size, //(count:vint1, size:vint, bytes:u8[])
    append_many_sizes, //(count:vint1, [size:vint,bytes:u8[]]...)
    setSourceOffset_append_range, //(i:vint, range:vint1)
    addSourceOffset_append_range, //(i:vint, range:vint1)
    subSourceOffset_append_range, //(i:vint, range:vint1)
    append_list_of_uint, //(bits:vint1)
    append_list_of_sint, //(bits:vint1)
    append_list_of_bit_standard, //(bitStandard:vint, bits:vint1)
    append_List, //(negOffset:vint1)
    create_prefix_list, //(i:vint)

    setComponent, //(i:vint)
    extendComponent, //(size:vint1, bytes:u8[])
    shortenComponent, //(count:vint1)
    //extendComponent_bits, //(count:vint1, bits:vint)
    //shortenComponent_bits, //(count:vint1)
    adjustComponent_bits, //shorten and extend

    compression, //(type:vint, size:vint, value:u8[])

    list_load_links, //(i:vint)

    setCount, //(i:vint)
    packedData, //(size:vint1, bytes:u8[])

    deleteList, //(i:vint)
    load_context, //(i:vint)
    save_context, //(i:vint)
    delete_context, //(i:vint)
}
export const enum standard {
    setStandard_int, //()
    setStandard_registry, //()
    setStandard_unicode, //()
}
export const enum bitStandard {
    
    append_list_of_IEEE754_binary, //(bits:vint)
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