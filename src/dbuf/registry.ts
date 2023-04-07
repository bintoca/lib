export const enum under_consideration {
    type_path,
    equal,
    not_equal,
    greater_than,
    greater_than_or_equal,
    less_than,
    less_than_or_equal,
    logical_and,
    logical_or,
    logical_not,

    unit,
    first_param,
    second_param,

    filter,
    map,
    reduce,
    skip,
    take,
    groupKey,
    groupItems,
    count,

    locator,
    integrity,
    sub_authority,
    all_data,
    location,

    stream_props,
    session_props,

    back_ref_hint,
    TAI_epoch_shift,

    repeat,
    repeat_n,
    initial_value,
    seek,
    delta,
    doubleDelta,

    dateTimeStart,
    dateTimeEnd,
    duration,
    timePeriod,

    license,
    Apache_LLVM,

    add,//*
    subtract,//*
    multiply,//*
    divide,//*
    remainder,//*

    complex_i,
    quaternion_i,
    quaternion_j,
    quaternion_k,
    Math_E,
    Math_LN10,
    Math_LN2,
    Math_LOG10E,
    Math_LOG2E,
    Math_PI,
    Math_SQRT1_2,
    Math_SQRT2,
    unorm,
    snorm,

    red,
    green,
    blue,
    alpha,
    depth,
    stencil,

    abs,//*
    acos,//*
    acosh,//*
    asin,//*
    asinh,//*
    atan,//*
    atanh,//*
    atan2,//*
    cbrt,//*
    ceil,//*
    cos,//*
    cosh,//*
    exp,//*
    expm1,//*
    floor,//*
    fround,//*
    hypot,//*
    log,//*
    log1p,//*
    log10,//*
    log2,//*
    pow,//*
    round,//*
    sign,//*
    sin,//*
    sinh,//*
    sqrt,//*
    tan,//*
    tanh,//*
    trunc,//*

    UTC_posix_smear_seconds, //24-hour leap smear
    timezoneOffset,

    //RFC 5545 and updates for recurrence and calendaring

    //latitude, //reference ellipsoids?
    //longitude,
    //other geometric structures

    //TODO language tags BCP47
}
export const enum r {
    placeholder,
    type_choice,
    type_map,
    type_array,
    type_kind,
    parse_varint,
    parse_bit_size,
    bind,

    flush_bits = 8,
    type_choice_indexer,
    type_choice_bit,
    type_map_columns,
    type_array_bit,
    type_array_fixed,
    parse_item,

    registry,
    bool,
    integer_signed,
    IEEE_754_binary16,
    IEEE_754_binary32,
    IEEE_754_binary64,
    value,
    unit,
    exponent_base2,
    exponent_base10,
    text_unicode,
    text_iri_no_scheme,
    error,
    sub_authority,
    id,
    transclusion,
    array_splice,
    array_relative_reference,
    call,
    parameters,
    repeat_count,
    shared,
    stream,

    timezone,
    year,
    month,
    day,
    hour,
    minute,
    second,

    meter,
    kilogram,
    ampere,
    kelvin,
    mole,
    candela,
    IPv4,
    IPv6,
    IP_port,
    UUID,
    SHA256,
    day_of_week,
    half,
    quarter,
    temporal_start,
    temporal_end,
    temporal_period,
    duration,
    
    text_iri_scheme,
    denominator,
    delta,
    delta_double,
    infinity,
    infinity_negative,
    zero_negative,
    nan_quiet,
    nan_signal,

    error_internal = 512,
    error_invalid_choice_index,
    error_invalid_choice_indexer,
    error_unfinished_parse_stack,
    error_invalid_text_value,
    error_invalid_registry_value,
}
export const enum u {
    space,
    a,
    e,
    i,
    n,
    o,
    s,
    t,

    line_feed,
    exclamation,
    double_quote,
    single_quote,
    comma,
    hyphen,
    period,
    forward_slash,
    colon,
    semi_colon,
    question,
    //remaining A-Z,a-z
    null = 64,
    //remaining ascii then continue according to unicode
}