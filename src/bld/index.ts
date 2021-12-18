export const enum op {
    setDraftRevision, //(i:number) not present means official spec
    setUnicodeOffset, //(i:number) default:0
    setUnicodeSize1, //() default:1
    setUnicodeSize2, //() default:1
    setUnicodeSize3, //() default:1
    setIRIindex, //(i:number) default:0
    setIRIcomponentType, //(i:registry) default:DNS, default scheme:https
    setIRIcomponent, //(count:number, bytes:currentEncoding) - vary by componentType
    extendIRIcomponent, //(count:number, bytes:currentEncoding) - vary by componentType
    shortenIRIcomponent, //(count:number) - vary by componentType
    setDestinationList, //(i:number) default:0
    setSourceList, //(i:number) default:0
    incrementDestinationList, //(size:number)
    append_IRI_suffixes, //(count:number, [count:number, bytes:currentEncoding][])
    append_IRI_range, //(offset:number, count:number)
    append_unicode, //(count:number)
    append_registry, //(i:registry)
    append_from_sourceList, //(offset:number, count:number)
    append_Uint, //(offset:number, bits:number)
    append_UintNeg, //(offset:number, bits:number)
    append_sha256, //(count:number, btyes:count*32)
    load_link, //(i:number)
    save_config, //(id:number)
    load_config, //(id:number)
    noop, //()
    magicNumber = 217, //0xD9D9F8 (non-unicode bytes derived from cbor tag 55800) + 0x42494E4C44 ("BINLD") or ("BXXLD")
}
export const enum op2 {
    setSourcePlane, //(i:vint)
    setDestinationPlane, //(i:vint)
    setSourceList, //(i:vint)
    setDestinationList, //(i:vint)
    setOffset, //(i:vint)
    setOffset_scale, //(scalingFactor:vint4, i:vint)
    setComponentType, //(c:vint)
    extendComponent, //(count:vint, bytes:count*vint)
    shortenComponent, //(units:vint)
    append_offset_many, //(count:vint, bytes:count*specSize)
    append_offset_range, //(range:vint)
    append_offset_range_scale, //(scalingFactor:vint4, range:vint)
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
}
export const enum sha {
    sha256
}
export const enum component {
    ObjectIdentifier,
    scheme,
    DNS,
    path,
    query,
    fragment,
    port,
    IPv6,
    IPv4,
    user,
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
