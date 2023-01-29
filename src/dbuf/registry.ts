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
    id,
    bind,
    type_choice,
    type_choice_indexer,
    type_map,
    type_array,
    end_scope,

    parse_block_size,
    parse_bit_size,
    parse_none,
    text_plain,
    text_iri,
    text_idna,
    integer_unsigned,
    integer_signed,
    IEEE_754_binary32,
    IEEE_754_decimal32,
    IEEE_754_binary64,
    IEEE_754_decimal64,
    error,
    quote_next,
    sub_authority,
    bool,
    bool_bit,
    type_choice_bit,
    type_choice_append,
    type_parts,
    binary_string,
    
    parse_varint = 64,
    parse_item,
    parse_varint_plus_block,
    parse_block_variable,
    parse_bit_variable,
    integer_negative,
    IEEE_754_binary128,
    IEEE_754_decimal128,
    IEEE_754_binary256,
    denominator,
    exponent_base2,
    exponent_base10,
    offset_add,
    offset_subtract,
    delta,
    delta_double,
    repeat_count,

    IPv4,
    IPv6,
    IP_port,
    UUID,
    SHA256,

    years,
    months,
    days,
    hours,
    minutes,
    seconds,
    weeks,
    week_day,

    blocks_read = 512,
    block_varint_index,
    block_bits_remaining,
    error_internal,
    error_invalid_choice_index,
    error_invalid_choice_indexer,
    error_invalid_choice_append,
    error_invalid_end_scope,
    error_unfinished_parse_stack,
    error_invalid_text_value,
    error_invalid_registry_value,

    magic_number = 4473429
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