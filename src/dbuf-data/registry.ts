export const symbolPrefix = 'dbuf_'
const symbolMap = new Map<number, symbol>()
const symbolReverseMap = new Map<symbol, number>()
export const getRegistrySymbol = (r: number): symbol => {
    const sym = Symbol.for(symbolPrefix + r)
    symbolMap.set(r, sym)
    symbolReverseMap.set(sym, r)
    return sym
}
export const isRegistrySymbol = (s: symbol) => symbolReverseMap.has(s)
export const getRegistryIndex = (s: symbol) => { if (symbolReverseMap.has(s)) { return symbolReverseMap.get(s) } else { throw 'registry symbol not found' } }
export const enum r {
    type_map,
    type_array,
    type_choice,
    type_optional,
    parse_varint,
    parse_bit_size,
    parse_text,
    parse_type_data_immediate,

    type_array_bit,
    type_array_fixed,
    type_array_chunk,
    type_choice_shared,
    type_choice_select,
    parse_align,
    parse_type_data,
    parse_bytes,
    little_endian_marker,

    nonexistent = 17,
    describe_no_value,
    false,
    true,
    value,
    integer_signed,
    IEEE_754_binary16,
    IEEE_754_binary32,
    IEEE_754_binary64,
    exponent_base2,
    exponent_base10,
    text,
    bytes,
    epoch_seconds_continuous,
    registry,
    error,
    copyable,
    copy_length,
    copy_distance,
    flatten_array,
    delta,
    delta_double,
    offset_add,
    unit,
    format,
    prefix,
    suffix,
    prefix_delta,

    error_internal = 64,
    incomplete_stream,
    registry_symbol_not_accepted,
    registry_symbol_not_accepted_as_array_type,
    stream_position,

    sign,
    denominator,
    complex_i,
    quaternion_j,
    quaternion_k,

    instant,
    implied_interval,
    duration,
    start,
    end,

    year,
    month,
    day,
    hour,
    minute,
    second,
}