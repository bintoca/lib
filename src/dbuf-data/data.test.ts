import { r } from '../dbuf-codec/registryEnum'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { string, char, bits_le, u8Text_chunks, parse_type_data, parse_align, array_no_children, type_array_bit, array_chunk, type_array_chunk, type_array_fixed, type_choice, type_optional, type_choice_select, type_choice_shared, type_choice_array, type_choice_shared_array, chunk, choice, map, choice_shared, choice_select, array, bits, align, array_bit, array_fixed, cycle, bytes, u8Text, nodeOrNum, root, parse_type_data_immediate, parse_bit_size, type_map, type_array, byte_chunks } from '@bintoca/dbuf-codec/encode'
import { bit_val, val_size, val } from '../dbuf-codec/common'
import { valSymbol, bitSizeSymbol, cycleSymbol, unpack } from './unpack'
import { refineValues } from './refine'
import { pack } from './pack'
import { getLeap_millis, getLeap_millis_tai } from './time'
import { getFloat16PolyFill } from '../dbuf-spec/float16'
const f16Shim = getFloat16PolyFill

const sym_value = getRegistrySymbol(r.value)
const sym_denominator = getRegistrySymbol(r.denominator)
const ss = getRegistrySymbol
const ob = (keys, ...values) => {
    const o = {}
    if (Array.isArray(keys)) {
        if (values.length != keys.length) {
            throw 'key value mismatch'
        }
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            const v = values[i]
            if (typeof k == 'number') {
                o[ss(k)] = v
            }
            else {
                o[k] = v
            }
        }
    }
    else {
        if (values.length != 1) {
            throw 'key value mismatch'
        }
        if (typeof keys == 'number') {
            o[ss(keys)] = values[0]
        }
        else {
            o[keys] = values[0]
        }
    }
    return o
}
const ema = (n: number) => {
    const a = []
    for (let i = 0; i < n; i++) {
        a.push(undefined)
        delete a[a.length - 1]
    }
    return a
}
const uint = (n: number | bigint, bitSize: number) => { return { [valSymbol]: n, [bitSizeSymbol]: bitSize } }
test.each([
    [root(r.parse_varint, 2), 2],
    [root(r.parse_text, string('ino')), 'ino'],
    [root(r.nonexistent), undefined],
    [root(type_map(r.describe_no_value, r.denominator), map()), ob([r.describe_no_value], ss(r.denominator))],
    [root(type_map(r.describe_no_value, r.describe_no_value, r.denominator, r.denominator), map()), ob([r.describe_no_value], [ss(r.denominator), ss(r.denominator)])],
    [root(type_map(r.describe_no_value, r.describe_no_value, r.nonexistent, r.denominator), map()), ob([r.describe_no_value], ss(r.denominator))],
    [root(type_map(r.describe_no_value, r.parse_type_data, r.denominator, r.denominator), map(parse_type_data(val(r.describe_no_value, true)))), ob([r.describe_no_value], [ss(r.denominator), ss(r.denominator)])],
    [root(type_map(r.describe_no_value, r.describe_no_value, type_array(r.parse_varint), r.denominator), map(array(2))), ob([r.describe_no_value], [2, ss(r.denominator)])],
    [root(type_map(r.describe_no_value, r.describe_no_value, type_array(r.parse_varint), type_array(r.parse_varint)), map(array(2), array(3))), ob([r.describe_no_value], [2, [3]])],
    [root(r.denominator), ss(r.denominator)],
    [root(parse_bit_size(3), bit_val(4, 3)), 4],
    [root(type_array(r.parse_varint), array(2, 3)), [2, 3]],
    [root(type_array(type_array(r.parse_varint)), array(array(2, 3), array(4, 5))), [[2, 3], [4, 5]]],
    [root(type_array(type_map(r.integer_signed, r.parse_varint)), array(map(2), map(val_size(6, 3)))), [2, -2]],
    [root(type_map(r.integer_signed, r.parse_varint), map(2)), 2],
    [root(type_map(r.integer_signed, r.denominator, r.parse_varint, r.false), map(2)), ob([r.integer_signed, r.denominator], 2, false)],
    [root(type_map(r.integer_signed, r.denominator, r.parse_varint, type_map(r.value, r.parse_varint)), map(2, map(3))), ob([r.integer_signed, r.denominator], 2, ob(r.value, 3))],
    [root(type_map(r.integer_signed, r.denominator, r.parse_varint, type_array(r.parse_varint)), map(2, array(3, 4))), ob([r.integer_signed, r.denominator], 2, [3, 4])],
    [root(type_map(r.integer_signed, parse_type_data_immediate(r.parse_varint, 3)), map()), 3],
    [root(type_map(r.integer_signed, parse_type_data_immediate(type_map(r.value, parse_type_data_immediate(r.parse_varint, 3)), map())), map()), ob(ss(r.integer_signed), ob(ss(r.value), 3))],
    [root(type_array(r.parse_varint), array()), []],
    [root(type_array(r.true), array_no_children(2)), [true, true]],
    [root(type_array(type_map(r.integer_signed, parse_type_data_immediate(r.parse_varint, 3))), array_no_children(2)), [3, 3]],
    [root(parse_align(4, type_array(r.parse_varint)), align(4, array(2))), [2]],
    [root(type_array_bit(2, r.parse_varint), array_bit(2, 2, 3)), [2, 3]],
    [root(type_array_fixed(2, r.parse_varint), array_fixed(2, 3)), [2, 3]],
    [root(type_array_chunk(2, r.parse_varint), array_chunk(chunk(2, 4, 5), chunk(2, 6, 7), chunk(2, 8))), [4, 5, 6, 7, 8]],
    [root(type_array(type_choice(r.parse_varint, parse_bit_size(3))), array(choice(bit_val(0, 1), 4), choice(bit_val(1, 1), bit_val(6, 3)))), [4, 6]],
    [root(type_array(type_choice(r.parse_varint, parse_bit_size(3), type_map(r.integer_signed, r.parse_varint))), array(choice(bit_val(2, 2), map(5)))), [5]],
    [root(type_array(type_choice(r.false, r.true)), array(choice(bit_val(0, 1)))), [false]],
    [root(type_array(type_choice(r.nonexistent, r.true)), array(choice(bit_val(0, 1)), choice(bit_val(1, 1)))), ema(1).concat([true])],
    [root(type_array(type_optional(r.true)), array(choice(bit_val(0, 1)))), ema(1)],
    [root(type_array(type_map(r.integer_signed, r.denominator, r.false, type_choice(r.nonexistent, r.true))), array(map(choice(bit_val(0, 1))), map(choice(bit_val(1, 1))))), [ob(r.integer_signed, false), ob([r.integer_signed, r.denominator], false, true)]],
    [root(type_array(type_map(r.integer_signed, r.denominator, r.false, type_optional(r.true))), array(map(choice(bit_val(0, 1))), map(choice(bit_val(1, 1))))), [ob(r.integer_signed, false), ob([r.integer_signed, r.denominator], false, true)]],
    [root(type_array(type_choice_shared(r.parse_varint, parse_bit_size(3))), array(choice_shared(bit_val(0, 1), 4), choice_shared(bit_val(1, 1), bit_val(6, 3)))), [4, 6]],
    [root(type_choice_select(10), choice_select()), undefined],
    [root(type_choice_shared(r.parse_varint, type_map(r.denominator, type_choice_shared(type_array(type_choice_select(0)), type_choice_select(1)))), choice_shared(bit_val(1, 1), map(choice_shared(bit_val(1, 1), choice_select(map(choice_shared(bit_val(0, 1), array(choice_select(array()))))))))), ob(r.denominator, ob(r.denominator, [[]]))],
    [root(type_choice_shared(r.parse_varint, type_map(r.denominator, r.value, type_choice(type_array(r.parse_varint), type_choice_select(1)), type_choice_select(0))), choice_shared(bit_val(1, 1), map(choice(bit_val(1, 1), choice_select(map(choice(bit_val(0, 1), array(2)), choice_select(3)))), choice_select(4)))), ob([r.denominator, r.value], ob([r.denominator, r.value], [2], 3), 4)],
    [root(type_choice_shared(type_array(type_choice(r.parse_varint, type_choice_select(0)))), choice_shared(bit_val(0, 0), array(choice(bit_val(1, 1), choice_select(array(choice(bit_val(0, 1), 3))))))), [[3]]],
    [root(type_choice_shared(type_map(r.denominator, type_choice_select(1)), parse_type_data_immediate(r.parse_varint, 1)), choice_shared(bit_val(0, 1), map(choice_select()))), ob(r.denominator, 1)],
    [root(type_choice_shared(type_map(r.denominator, type_choice_select(1)), type_map(r.value, type_choice_select(0))), choice_shared(bit_val(0, 1), map(choice_select(map(choice_select(map(cycle()))))))), ob(r.denominator, ob(r.value, ob(r.denominator, cycleSymbol)))],
    [root(type_array(type_choice_array(type_map(r.integer_signed, r.parse_varint), [map(4), map(5), map(6)], type_map(r.value, r.parse_varint))), array(choice(bit_val(1, 2)), choice(bit_val(3, 2), map(7)))), [5, ob(r.value, 7)]],
    [root(type_array(type_choice_shared_array(type_map(r.integer_signed, r.parse_varint), [map(4), map(5), map(6)], type_map(r.value, r.parse_varint))), array(choice_shared(bit_val(1, 2)), choice(bit_val(3, 2), map(7)))), [5, ob(r.value, 7)]],
    [root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_length, r.parse_varint))), array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(1, 1), map(4)))), [2, 3, 3, 3, 3, 3, 3]],
    [root(type_array(type_choice(r.parse_varint, type_map(r.copy_length, r.parse_varint))), array(choice(bit_val(1, 1), map(1)))), ema(2)],
    [root(type_array(type_choice(r.parse_varint, type_map(r.copy_distance, r.parse_varint))), array(choice(bit_val(0, 1), 2), choice(bit_val(0, 1), 3), choice(bit_val(1, 1), map(1)))), [2, 3].concat(ema(1))],
    [root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.parse_varint))), array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(1, 1), map(1)))), [2, 3, 2]],
    [root(type_array(type_choice(r.parse_varint, type_map(r.copy_distance, r.parse_varint))), array(choice(bit_val(1, 1), map(1)))), ema(1)],
    [root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.copy_length, r.parse_varint, r.parse_varint))), array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(1, 1), map(1, 4)))), [2, 3, 2, 3, 2, 3, 2]],
    [root(type_array(type_choice(r.parse_varint, type_map(r.copy_distance, r.copy_length, r.parse_varint, r.parse_varint))), array(choice(bit_val(1, 1), map(1, 3)))), ema(4)],
    [root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.copy_length, type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 2), r.parse_varint), type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 3), r.parse_varint)))), array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(0, 1), map(4)), choice(bit_val(0, 1), map(5)), choice(bit_val(1, 1), map(map(1), map(3))))), [2, 3, 4, 5, 2, 3, 4, 5, 2, 3, 4]],
    [root(parse_bit_size(80), bits(bit_val(1, 32), bit_val(2, 32), bit_val(3, 16))), 0x1000000020003n],
    [root(parse_bit_size(80), bits_le(bit_val(1, 32), bit_val(2, 32), bit_val(3, 16))), 0x30000000200000001n],
    [root(type_map(r.integer_signed, parse_bit_size(8)), map(bits(bit_val(8, 4), bit_val(3, 4)))), -125n],
    [root(type_map(r.integer_signed, parse_bit_size(8)), map(bits_le(bit_val(3, 4), bit_val(8, 4)))), -125n],
    [root(type_map(r.integer_signed, parse_bit_size(32)), map(bit_val(0xFFFFFFF0, 32))), -16],
    [root(type_map(r.registry, parse_bit_size(8)), map(bits(bit_val(8, 4), bit_val(3, 4)))), ss(131 as any)],
    [root(type_map(r.IEEE_754_binary64, parse_bit_size(48)), map(bits(bit_val(0x3FF00000, 32), bit_val(0, 16)))), 1],
    [root(type_map(r.IEEE_754_binary64, parse_bit_size(24)), map(bit_val(0x3FF000, 24))), 1],
    [root(type_map(r.IEEE_754_binary64, parse_bit_size(80)), map(bits(bit_val(0x12003FF0, 32), bit_val(0, 32), bit_val(0, 16)))), 1],
    [root(type_map(r.IEEE_754_binary32, parse_bit_size(24)), map(bit_val(0x3F8000, 24))), 1],
    [root(type_map(r.IEEE_754_binary32, parse_bit_size(48)), map(bits(bit_val(0x12003F80, 32), bit_val(0, 16)))), 1],
    [root(type_map(r.IEEE_754_binary16, parse_bit_size(12)), map(bit_val(0x3C0, 12))), 1],
    [root(type_map(r.IEEE_754_binary16, parse_bit_size(24)), map(bit_val(0x3C00, 24))), 1],
    [root(type_map(r.IEEE_754_binary16, parse_bit_size(48)), map(bits(bit_val(0x12000000, 32), bit_val(0x3C00, 16)))), 1],
    [root(type_map(r.IEEE_754_binary16, parse_bit_size(48)), map(bits_le(bit_val(0x12003C00, 32), bit_val(0, 16)))), 1],
    [root(type_map(r.exponent_base2, r.value, parse_bit_size(8), parse_bit_size(6)), map(bit_val(3, 8), bit_val(1, 6))), 8.125],
    [root(type_map(r.exponent_base2, r.value, parse_bit_size(8), parse_bit_size(64)), map(bit_val(3, 8), bits(bit_val(1, 32), bit_val(1, 32)))), ob([r.exponent_base2, r.value], uint(3, 8), uint(4294967297n, 64))],
    [root(type_map(r.sign, r.exponent_base2, r.value, r.true, parse_bit_size(8), parse_bit_size(6)), map(bit_val(3, 8), bit_val(1, 6))), -8.125],
    [root(type_map(r.exponent_base10, r.value, parse_bit_size(8), parse_bit_size(6)), map(bit_val(3, 8), bit_val(1, 6))), 1000],
    [root(type_map(r.exponent_base10, r.value, parse_bit_size(8), parse_bit_size(64)), map(bit_val(3, 8), bits(bit_val(1, 32), bit_val(1, 32)))), ob([r.exponent_base10, r.value], uint(3, 8), uint(4294967297n, 64))],
    [root(type_map(r.sign, r.exponent_base10, r.value, r.true, type_map(r.integer_signed, parse_bit_size(4)), parse_bit_size(6)), map(map(bit_val(14, 4)), bit_val(1, 6))), -0.01],
    [root(type_map(r.sign, r.value, r.true, parse_bit_size(6)), map(bit_val(12, 6))), -12],
    [root(type_map(r.sign, r.value, r.true, parse_bit_size(64)), map(bits(bit_val(0, 32), bit_val(12, 32)))), -12n],
    [root(type_array(type_choice(r.parse_varint, type_map(r.flatten_array, type_array(r.parse_varint)))), array(choice(bit_val(0, 1), 2), choice(bit_val(0, 1), 3), choice(bit_val(1, 1), map(array(5, 6))))), [2, 3, 5, 6]],
    [root(type_array(type_map(r.text, r.parse_varint)), array(char('a'), char('e'), char('i'))), ['a', 'e', 'i']],
    [root(type_array(type_map(r.text, type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 122), r.parse_varint))), array(map(map(1)), map(map(2)), map(map(3)))), ['{', '|', '}']],
    [root(type_map(r.text, type_array(type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 122), r.parse_varint))), map(array(map(1), map(2), map(3)))), '{|}'],
    [root(type_map(r.bytes, type_array(type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 122), r.parse_varint))), map(array(map(1), map(2), map(3)))), new Uint8Array([123, 124, 125])],
    [root(type_array(type_map(r.delta, r.parse_varint)), array(map(1), map(1), map(3))), [1, 2, 5]],
    [root(type_array(type_map(r.delta_double, r.parse_varint)), array(map(1), map(1), map(3))), [1, 3, 8]],
    [root(type_array(type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 3), r.parse_varint)), array(map(1), map(1), map(3))), [4, 4, 6]],
    [root(type_map(r.epoch_seconds_continuous, r.parse_varint), map(20)), new Date('2018-01-01T00:00:20Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.integer_signed, parse_bit_size(8))), map(map(bit_val(256 - 45, 8)))), new Date('2017-12-31T23:59:15Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.integer_signed, parse_bit_size(32))), map(map(bit_val(0xFFFFFFFF - ((45 * 365 + 11) * 86400 + 26), 32)))), new Date('1972-12-31T23:59:59Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.offset_add, r.value, type_map(r.IEEE_754_binary16, parse_bit_size(12)), type_map(r.integer_signed, parse_bit_size(32)))), map(map(map(bit_val(0xB80, 12)), map(bit_val(0xFFFFFFFF - ((45 * 365 + 11) * 86400 + 25), 32))))), new Date('1972-12-31T23:59:59.5Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.integer_signed, parse_bit_size(32))), map(map(bit_val(0xFFFFFFFF - ((45 * 365 + 11) * 86400 + 25), 32)))), new Date('1973-01-01T00:00:00Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.offset_add, r.value, type_map(r.IEEE_754_binary16, parse_bit_size(12)), type_map(r.integer_signed, parse_bit_size(32)))), map(map(map(bit_val(0xB80, 12)), map(bit_val(0xFFFFFFFF - ((45 * 365 + 11) * 86400 + 24), 32))))), new Date('1973-01-01T00:00:00.5Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.integer_signed, parse_bit_size(32))), map(map(bit_val(0xFFFFFFFF - ((45 * 365 + 11) * 86400 + 24), 32)))), new Date('1973-01-01T00:00:00Z')],
    [root(type_map(r.epoch_seconds_continuous, type_map(r.integer_signed, parse_bit_size(32))), map(map(bit_val(0xFFFFFFFF - ((45 * 365 + 11) * 86400 + 23), 32)))), new Date('1973-01-01T00:00:01Z')],
    [root(type_map(r.instant, type_map(r.year, r.month, r.day, r.hour, r.minute, r.second, r.parse_varint, r.parse_varint, r.parse_varint, r.parse_varint, r.parse_varint, r.parse_varint)), map(map(1, 2, 3, 4, 5, 6))), new Date('2019-03-04T04:05:06')],
    [root(type_map(parse_type_data_immediate(r.parse_text, string('key1')), r.parse_varint), map(3)), ob(['s_key1'], 3)],
    [root(type_map(parse_type_data_immediate(r.parse_varint, 2), r.parse_varint), map(3)), ob(['n_2'], 3)],
    [root(type_map(parse_type_data_immediate(parse_bit_size(64), bits(bit_val(1, 32), bit_val(1, 32))), r.parse_varint), map(3)), ob(['n_4294967297'], 3)],
    [root(type_map(parse_type_data_immediate(r.true)), map(3)), ob(['b_true'], 3)],
    [root(type_map(parse_type_data_immediate(r.false)), map(3)), ob(['b_false'], 3)],
    [root(type_map(parse_type_data_immediate(type_array(r.parse_varint), array(2))), map(3)), ob(['x_1'], 3)],
    [root(type_map(), map()), {}],
    [root(r.parse_bytes, bytes(new Uint8Array([1, 2, 3]))), new Uint8Array([1, 2, 3])],
    [root(r.parse_bytes, byte_chunks(bytes(new Uint8Array([1, 2, 3])), bytes(new Uint8Array([4, 5])))), new Uint8Array([1, 2, 3, 4, 5])],
    [root(r.parse_text, u8Text_chunks(string('abc'), string('xyz'))), 'abcxyz'],
    [root(type_map(r.prefix, r.value, r.parse_text, r.parse_text), map(string('hey'), string('yo'))), 'heyyo'],
    [root(type_map(r.suffix, r.value, r.parse_text, r.parse_text), map(string('hey'), string('yo'))), 'yohey'],
    [root(type_map(r.prefix, r.value, r.suffix, r.parse_text, r.parse_text, r.parse_text), map(string('hey'), string('yo'), string('suf'))), 'heyyosuf'],
    [root(type_array(type_map(r.prefix_delta, r.value, r.parse_varint, r.parse_text)), array(map(0, string('suf')), map(1, string('suf')), map(2, string('suf')))), ["suf", "susuf", "sussuf"]],
])('unpack(%#)', (i, o) => {
    const a = refineValues(unpack(i, true))
    expect(a).toStrictEqual(o)
})
test.each([
    [root(type_array(r.true), array_no_children(2)), []],
    [root(type_array(type_map(r.integer_signed, parse_type_data_immediate(r.parse_varint, 3))), array_no_children(2)), []],
    [root(type_array(type_choice(r.parse_varint, type_map(r.copy_length, r.parse_varint))), array(choice(bit_val(0, 1), 2), choice(bit_val(0, 1), 3), choice(bit_val(1, 1), map(4)))), [2, 3, ob(r.copy_length, 4)]],
])('unpack_safe(%#)', (i, o) => {
    const a = refineValues(unpack(i, false))
    expect(a).toStrictEqual(o)
})
test.each([
    [{ [getRegistrySymbol(r.error)]: 'hey' }, type_map(r.error, r.parse_text), map(string('hey'))],
    [{ [getRegistrySymbol(r.error)]: sym_value }, type_map(r.error, r.value), map()],
    [{ [getRegistrySymbol(r.error)]: sym_value, [sym_denominator]: [] }, type_map(r.error, r.denominator, r.value, type_array(r.parse_type_data)), map(array())],
    [{ [getRegistrySymbol(r.error)]: ['yo', sym_value] }, type_map(r.error, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.parse_text, true), string('yo')), parse_type_data(val(r.value, true))))],
])('pack(%#)', (i, t, d) => {
    const a = pack(i)
    expect(a).toStrictEqual(root(t, d))
})
test.each([['1970-01-01T00:00:00Z', 10], ['1972-12-31T23:59:59Z', 11], ['1973-01-01T00:00:00Z', 12]])('leap', (d, o) => {
    expect(getLeap_millis(Date.parse(d))).toBe(o * 1000)
})
test.each([['1970-01-01T00:00:00Z', 10], ['1972-12-31T23:59:59Z', (3 * 365 + 1) * 86400 + 11 - 1], ['1973-01-01T00:00:00Z', (3 * 365 + 1) * 86400 + 11], ['1973-01-01T00:00:00Z', (3 * 365 + 1) * 86400 + 12]])('leap_reverse', (d, o) => {
    expect(o * 1000 - getLeap_millis_tai(o * 1000)).toBe(Date.parse(d))
})
