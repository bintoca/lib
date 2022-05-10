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

    numerator,
    denominator,

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
    end_scope,
    back_reference,
    type_wrap,
    type_choice,
    type_struct,
    type_collection,
    bind,

    text,
    rich_text,
    function,
    call,

    next_singular,

    //singular
    value_,
    item_,
    vblock,
    vbit,

    uint,
    sint,
    vIEEE_binary,
    vIEEE_decimal_DPD,
    dns_idna,
    TAI_seconds,//unsigned
    
    bitSize,
    blockSize,
    error,
    
    forward_reference = 64,
    vCollection,
    vCollection_merge,
    v32_32,
    nint,
    return_early_error,
    fixed_point_decimal_places,

    IPv4,
    IPv6,
    port,
    UUID,
    sha256,

    years,
    months,
    days,
    hours,
    minutes,
    seconds,
    weeks,

    blocks_read = 512,
    block_chunk_index,
    block_bit_remaining,
    error_internal,
    error_invalid_back_ref,
    error_max_forward_depth,
    error_invalid_forward_ref,
    error_invalid_choice_index,
    error_rich_text_in_plain,
    error_non_text_in_plain,
    error_empty_scope,
    error_invalid_end_scope,
    error_unfinished_parse_stack,
    error_invalid_text_value,
    error_invalid_registry_value,

    magicNumber = 4473429
}
export const enum u {
    text,
    end_scope,
    back_ref,
    space,
    a,
    e,
    o,
    t,

    repeat_n,
    non_text,
    line_feed,
    exclamation,
    comma,
    hyphen,
    period,
    question,
    //remaining A-Z,a-z
    null = 64,
    //remaining ascii then continue according to unicode
}