export const enum op {
    setDraftRevision, //(i:number) not present means official spec
    setUnicodeOffset, //(i:number) default:0
    setUnicodeSize1, //() default:1
    setUnicodeSize2, //() default:1
    setUnicodeSize3, //() default:1
    setIRIindex, //(i:number) default:0
    setIRIcomponentType, //(i:op) default:DNS, default scheme:https
    setIRIcomponent, //(count:number, bytes:currentEncoding) - vary by componentType
    extendIRIcomponent, //(count:number, bytes:currentEncoding) - vary by componentType
    shortenIRIcomponent, //(count:number) - vary by componentType
    setDestinationList, //(i:number) default:0
    setSourceList, //(i:number) default:0
    incrementDestinationList, //(size:number)
    append_IRI_suffixes, //(count:number, [count:number, bytes:currentEncoding][])
    append_IRI_range, //(offset:number, count:number)
    append_unicode, //(count:number)
    append_from_sourceList, //(offset:number, count:number)
    append_Uint, //(offset:number, bits:number)
    append_UintNeg, //(offset:number, bits:number)
    append_sha256, //(count:number, btyes:count*32)
    load_link, //(i:number)
    save_config, //(id:number)
    load_config, //(id:number)
    noop, //()

    false,
    true,
    null,
    undefined,
    bool, //[false, true]

    IEEE_binary16,
    IEEE_binary32,
    IEEE_binary64,

    Infinity,
    NegativeInfinity,
    sNaN,
    qNaN,
    NegativeZero,

    uint,
    biasedExponentBase2,
    biasedExponentWithSignBase2,
    biasedExponentBase10,
    biasedExponentWithSignBase10,

    seconds,
    minutes,
    hours,
    days,
    months,
    years,
    timeScale, //default:UTC
    TAI,
    UTC, //if only seconds is used apply posix rules
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

    Red,
    Green,
    Blue,
    Alpha,
    Depth,
    Stencil,

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

    magicNumber = 217, //0xD9D9F8 (non-unicode bytes derived from cbor tag 55800) + 0x42494E4C44 ("BINLD")
}