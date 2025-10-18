import { r } from '@bintoca/dbuf-registry'
import { bit_val, val, littleEndianPrefix, magicNumberPrefix, Node, ParseMode } from '@bintoca/dbuf-codec/common'
import { createEncoder, finishWrite } from '@bintoca/dbuf-codec/encode'
import { readFileSync } from 'fs'
import * as pa from 'path'
import { string } from '@bintoca/dbuf-data/text'
import { writeNode, type_array, type_choice, choice, array, root, type_map, map, parse_bit_size, parse_type_data_immediate, align, type_array_bit, array_bit, type_array_fixed, array_fixed, type_array_chunk, array_chunk, chunk, type_choice_shared, type_choice_select, choice_select, parse_align, choice_shared, type_choice_array, type_choice_shared_array, type_optional, parse_type_data, bytes } from '../dbuf-codec/encode'

export type RegistryLink = { rid: number }
export type ParseModeLink = { pid: ParseMode }
export type ListItem = { item: Paragraph, parseMode?: ParseMode }
export type Paragraph = (string | RegistryLink | ParseModeLink | ListItem)[]
export type Section = { paragraphs: Paragraph[], title: string, heading: number, id: number[] }
export type Doc = { sections: Section[] }

export const parseEnum = (fn: string, enumName: string) => {
    const txt = readFileSync(pa.join('./src', fn), 'utf8')
    const syms = txt.split(`const enum ${enumName} {`)[1].split('}')[0].split(',').map(x => x.trim()).filter(x => x).map(x => {
        const i = x.split('=')
        return { n: i[0].trim(), id: parseInt(i[1]) }
    })
    let i = 0
    for (let x of syms) {
        if (x.id) {
            i = x.id
        }
        else {
            x.id = i
        }
        i++
    }
    const symNamesById = {}
    for (let x of syms) {
        symNamesById[x.id] = x.n
    }
    return symNamesById
}
export function dbufWrite(d: Node) {
    const es = createEncoder()
    writeNode(es, d)
    finishWrite(es)
    return es.buffers[0]
}
export const dbufWriteToArray8 = (d: Node) => {
    const b = dbufWrite(d)
    return bytes(b)
}
export const registryEnum = {}
for (let k in r) {
    registryEnum[r[k]] = k
}
const getReg = (r: number) => registryEnum[r]
export const registry: { [key: number]: { paragraphs: Paragraph[], parseRules?: boolean, examples: { description: string, dbuf: Node, unpack?}[] } } = {
    [r.nonexistent]: {
        paragraphs: [
            ['Used as a placeholder for sparse arrays and optional map keys.'],
            ['When used as a value in a key/value pair of a ', { rid: r.type_map }, ', it is equivalent to the key being absent from that entity. If an empty value that preserves the key\'s presence is desired, use ', { rid: r.describe_no_value }, ' instead.']
        ],
        examples: [
            { description: 'Sparse array', dbuf: root(type_array(type_choice(r.nonexistent, r.parse_varint)), array(choice(bit_val(0, 1)), choice(bit_val(1, 1), 5))), unpack: [, 5] },
            { description: 'Map with optional key', dbuf: root(type_map(r.value, type_choice(r.nonexistent, r.true)), map(choice(bit_val(0, 1)))), unpack: {} }
        ]
    },
    [r.true]: {
        paragraphs: [
            ['Boolean true value.'],
        ],
        examples: [
            { description: 'Map with optional key', dbuf: root(type_map(r.value, type_choice(r.nonexistent, r.true)), map(choice(bit_val(1, 1)))), unpack: { [getReg(r.value)]: true } }
        ]
    },
    [r.type_map]: {
        paragraphs: [
            ['Defines a collection of key/value pairs.'],
            ['Consumes one varint specifying the number of pairs to parse. All the keys come first followed by all the values.'],
            ['When encountered in the parsing of a data component: Each key or value that has data component parsing rules is executed.'],
            ['Type component values and data component values combine to form a logical map. If an array of maps all have the same value for a key, that value can be specified once in the type component and omittted in the data component.'],
            ['If the same key is specified more than once, the unpacking procedure combines the values into an array. If the first value is an array, the following values are appended to the first array. If following values are arrays, they are appended as nested, not flattened into the first array.'],
        ],
        parseRules: true,
        examples: [
            { description: 'Two keys with unsigned integer values', dbuf: root(type_map(r.denominator, r.value, r.parse_varint, r.parse_varint), map(3, 4)), unpack: { [getReg(r.denominator)]: 3, [getReg(r.value)]: 4 } },
            { description: 'Array of maps with value in the type component', dbuf: root(type_array(type_map(r.denominator, r.value, parse_type_data_immediate(r.parse_varint, 2), r.parse_varint)), array(map(4), map(7))), unpack: [{ [getReg(r.denominator)]: 2, [getReg(r.value)]: 4 }, { [getReg(r.denominator)]: 2, [getReg(r.value)]: 7 }] },
            { description: 'Key specified twice', dbuf: root(type_map(r.denominator, r.value, r.denominator, r.parse_varint, r.parse_varint, r.parse_varint), map(3, 4, 5)), unpack: { [getReg(r.denominator)]: [3, 5], [getReg(r.value)]: 4 } },
            { description: 'Key specified twice with array as first value', dbuf: root(type_map(r.denominator, r.value, r.denominator, type_array(r.parse_varint), r.parse_varint, r.parse_varint), map(array(3), 4, 5)), unpack: { [getReg(r.denominator)]: [3, 5], [getReg(r.value)]: 4 } },
        ]
    },
    [r.type_array]: {
        paragraphs: [
            ['Defines a collection.'],
            ['Consumes one symbol defining the type of the array.'],
            ['When encountered in the parsing of a data component: Consumes one varint specifying the length of the array. If the array type has data component parsing rules, they are executed for each item.'],
            ['Implementations must take care not to allocate resources proportional to the length of the array when the array type does not consume additional bits. This represents attack surface where malicious data could specify a very large array length to cause denial of service.']
        ],
        parseRules: true,
        examples: [
            { description: 'Array of unsigned integers', dbuf: root(type_array(r.parse_varint), array(3, 4)), unpack: [3, 4] }
        ]
    },
    [r.type_choice]: {
        paragraphs: [
            ['Defines a list of options that can be selected by an index.'],
            ['Consumes one varint "x"'],
            ['If x equals zero, consume one varint "y", then consume one symbol specifying the type of options to follow, then consume one varint specifying the number of options to follow offset by one, then consume the options, then consume y symbols as additional options.'],
            ['If x is not zero, consume x plus one symbols as the options.'],
            ['The values for number of options use offsets so that the minimum number of options is one. This is to avoid ambiguities in the meaning of a choice with zero options.'],
            ['When encountered in the parsing of a data component: Consumes the least number of bits that can represent the number of options. ',
                'The value consumed is a zero based index into the options. If the index is greater than the index of the last option, the last option is selected.']
        ],
        parseRules: true,
        examples: [
            { description: 'Array of integers with different sizes', dbuf: root(type_array(type_choice(parse_bit_size(3), parse_bit_size(16))), array(choice(bit_val(0, 1), bit_val(5, 3)), choice(bit_val(1, 1), bit_val(20000, 16)))), unpack: [5, 20000] },
            { description: 'Index greater than the number of options', dbuf: root(type_array(type_choice(r.value, r.parse_varint, parse_bit_size(7))), array(choice(bit_val(3, 2), bit_val(120, 7)))), unpack: [120] },
            { description: 'Array of unsigned integers with options sharing a common type (x equals zero pattern in above specs)', dbuf: root(type_array(type_choice_array(r.parse_varint, [4, 5, 6], r.describe_no_value)), array(choice(bit_val(1, 2)))), unpack: [5] }
        ]
    },
    [r.type_optional]: {
        paragraphs: [
            ['Defines a choice of two options with the first option implied as ', { rid: r.nonexistent }],
            ['Consumes one symbol defining the second option.'],
            ['When encountered in the parsing of a data component: Consumes one bit as the selected choice.']
        ],
        parseRules: true,
        examples: [
            { description: 'Sparse array', dbuf: root(type_array(type_optional(r.parse_varint)), array(choice(bit_val(0, 1)), choice(bit_val(1, 1), 5))), unpack: [, 5] },
            { description: 'Map with optional key', dbuf: root(type_map(r.value, type_optional(r.true)), map(choice(bit_val(0, 1)))), unpack: {} }
        ]
    },
    [r.parse_varint]: {
        paragraphs: [
            ['Unsigned integer type with varint encoding.'],
            ['When encountered in the parsing of a data component: Consumes one varint.'],
            ['Can be used as a base type for other kinds of numbers such as signed integers and floats.'],
        ],
        parseRules: true,
        examples: [
            { description: 'Array of unsigned integers', dbuf: root(type_array(r.parse_varint), array(3, 4)), unpack: [3, 4] },
            { description: 'Array of signed integers', dbuf: root(type_array(type_map(r.integer_signed, r.parse_varint)), array(map(3), map(4))), unpack: [3, -4] }
        ]
    },
    [r.parse_bit_size]: {
        paragraphs: [
            ['Unsigned integer type with specified width.'],
            ['Consumes one varint specifying the number of bits offset by one, meaning a literal value of zero equals one bit and therefore the lowest number of bits is one.'],
            ['When encountered in the parsing of a data component: Consumes the specified number of bits.'],
            ['Can be used as a base type for other kinds of numbers such as signed integers and floats.'],
            ['The S-expression examples show the number of bits without an offset.']
        ],
        parseRules: true,
        examples: [
            { description: 'Array of unsigned integers', dbuf: root(type_array(parse_bit_size(4)), array(bit_val(5, 4), bit_val(6, 4))), unpack: [5, 6] },
            { description: 'Array of signed integers', dbuf: root(type_array(type_map(r.integer_signed, parse_bit_size(4))), array(map(bit_val(5, 4)), map(bit_val(6, 4)))), unpack: [5, 6] }
        ]
    },
    [r.parse_text]: {
        paragraphs: [
            ['Symbol for parsing text as a string of UTF8 bytes.'],
            ['When encountered in the parsing of a data component: Consumes one varint specifying the length in bytes, then the number of bytes starting from the next 8-bit alignment.'],
        ],
        parseRules: true,
        examples: [
            { description: 'String of text', dbuf: root(r.parse_text, string('hello world')), unpack: 'hello world' },
        ]
    },
    [r.text]: {
        paragraphs: [
            ['Used to describe a nested entity as text.'],
            ['Semantically equivalent to ', { rid: r.parse_text }, ' but provides more flexibility in encoding options.'],
            ['If the nested entity is an array of non-negative integers less than 256, it is interpreted as a string of UTF8 bytes.'],
            ['If the nested entity is a single non-negative integer, it is interpreted as a Unicode code point.'],
        ],
        examples: [
            { description: 'Text as array of integers corresponding to UTF8 bytes', dbuf: root(type_map(r.text, type_array(r.parse_varint)), map(array(81, 82, 83))), unpack: 'QRS' },
            { description: 'Single integer corresponding to unicode code point', dbuf: root(type_map(r.text, r.parse_varint), map(0x1f601)), unpack: '😁' },
        ]
    },
    [r.parse_bytes]: {
        paragraphs: [
            ['Symbol for parsing binary data as a sequence of bytes.'],
            ['When encountered in the parsing of a data component: Consumes one varint specifying the length in bytes, then the number of bytes starting from the next 8-bit alignment.'],
        ],
        parseRules: true,
        examples: [
            { description: '3 bytes', dbuf: root(r.parse_bytes, bytes(new Uint8Array([1, 2, 3]))), unpack: new Uint8Array([1, 2, 3]) },
        ]
    },
    [r.bytes]: {
        paragraphs: [
            ['Used to describe a nested entity as bytes.'],
            ['Semantically equivalent to ', { rid: r.parse_bytes }, ' but provides more flexibility in encoding options.'],
            ['If the nested entity is an array of non-negative integers less than 256, it is interpreted as a sequence bytes.'],
        ],
        examples: [
            { description: 'Bytes as array of integers', dbuf: root(type_map(r.bytes, type_array(r.parse_varint)), map(array(81, 82, 83))), unpack: new Uint8Array([81, 82, 83]) },
        ]
    },
    [r.type_array_bit]: {
        paragraphs: [
            ['Defines a collection where the length has a size expressed in bits.'],
            ['Consumes one varint specifying the number of bits offset by one (meaning a literal value of zero equals one bit and therefore the lowest number of bits is one) and one symbol defining the type of the array.'],
            ['When encountered in the parsing of a data component: Consumes the specified number of bits as the length of the array. If the array type has data component parsing rules, they are executed for each item.'],
            ['Implementations must take care not to allocate resources proportional to the length of the array when the array type does not consume additional bits. This represents attack surface where malicious data could specify a very large array length to cause denial of service.']
        ],
        parseRules: true,
        examples: [
            { description: 'Array of unsigned integers', dbuf: root(type_array_bit(4, r.parse_varint), array_bit(4, 3, 2)), unpack: [3, 2] }
        ]
    },
    [r.type_array_fixed]: {
        paragraphs: [
            ['Defines a collection with a fixed length.'],
            ['Consumes one varint specifying the length and one symbol defining the type of the array.'],
            ['When encountered in the parsing of a data component: If the array type has data component parsing rules, they are executed for each item.'],
            ['Implementations must take care not to allocate resources proportional to the length of the array when the array type does not consume additional bits. This represents attack surface where malicious data could specify a very large array length to cause denial of service.']
        ],
        parseRules: true,
        examples: [
            { description: 'Array of unsigned integers', dbuf: root(type_array_fixed(2, r.parse_varint), array_fixed(3, 2)), unpack: [3, 2] }
        ]
    },
    [r.type_array_chunk]: {
        paragraphs: [
            ['Defines a collection that is separated into chunks. Useful for streaming scenarios where the total length is not known at the start.'],
            ['Consumes one varint specifying the number of bits representing the chunk length offset by one (meaning a literal value of zero equals one bit and therefore the lowest number of bits is one) and one symbol defining the type of the array.'],
            ['When encountered in the parsing of a data component: Consumes the specified number of bits as the length of a chunk. If the array type has data component parsing rules, they are executed for each item of the chunk. ',
                'Repeats the behavior for successive chunks until a chunk length of zero ends the array.'],
            ['Implementations must take care not to allocate resources proportional to the length of the array when the array type does not consume additional bits. This represents attack surface where malicious data could specify a very large array length to cause denial of service.']
        ],
        parseRules: true,
        examples: [
            { description: 'Array of unsigned integers', dbuf: root(type_array_chunk(4, r.parse_varint), array_chunk(chunk(4, 3, 2), chunk(4))), unpack: [3, 2] }
        ]
    },
    [r.type_choice_shared]: {
        paragraphs: [
            ['Defines a list of options that can be selected by an index.'],
            ['Functions nearly identically to ', { rid: r.type_choice }, ' except the options can interact with ', { rid: r.type_choice_select }, ' to create recursive structures.'],
            ['Consumes one varint "x"'],
            ['If x equals zero, consume one varint "y", then consume one symbol specifying the type of options to follow, then consume one varint specifying the number of options to follow offset by one, then consume the options, then consume y symbols as additional options.'],
            ['If x is not zero, consume x symbols as the options.'],
            ['The values for number of options use offsets so that the minimum number of options is one. This is to avoid ambiguities in the meaning of a choice with zero options.'],
            ['When encountered in the parsing of a data component: If number of options equals one, consumes zero bits and selects the single option, otherwise consumes the least number of bits that can represent the number of options. ',
                'The value consumed is a zero based index into the options. If the index is greater than the index of the last option, the last option is selected. ',
                'Then the list is pushed on to the shared choice stack, which is subsequently poped after the data component rules of the selected option have been executed.']
        ],
        parseRules: true,
        examples: [
            { description: 'Index greater than the number of options', dbuf: root(type_array(type_choice_shared(r.value, r.parse_varint, parse_bit_size(7))), array(choice_shared(bit_val(3, 2), bit_val(120, 7)))), unpack: [120] },
            { description: 'Recursive array', dbuf: root(type_choice_shared(type_array(type_choice(r.parse_varint, type_choice_select(0)))), choice_shared(bit_val(0, 0), array(choice(bit_val(1, 1), choice_select(array(choice(bit_val(0, 1), 5))))))), unpack: [[5]] },
            { description: 'Recursive map', dbuf: root(type_choice_shared(type_map(r.value, type_choice(type_choice_select(0), type_choice_select(1))), r.parse_varint), choice_shared(bit_val(0, 1), map(choice(bit_val(0, 1), choice_select(map(choice(bit_val(1, 1), choice_select(6)))))))), unpack: { [getReg(r.value)]: { [getReg(r.value)]: 6 } } },
            { description: 'Array of unsigned integer with options sharing a common type', dbuf: root(type_array(type_choice_shared_array(r.parse_varint, [4, 5, 6], r.describe_no_value)), array(choice_shared(bit_val(1, 2)))), unpack: [5] },
        ]
    },
    [r.type_choice_select]: {
        paragraphs: [
            ['Defines the selection of an option in an enclosing ', { rid: r.type_choice_shared }, '. Useful for creating recursive structures.'],
            ['Consumes one varint specifying a zero based index.'],
            ['When encountered in the parsing of a data component: Selects an option by the specified index from the top item of the shared choice stack. ',
                'If the selected option is a ', { rid: r.type_choice_select }, ' use its index to select from the next item down in the shared choice stack. ',
                'If this iteration continues past the bottom of the shared choice stack, the selection is interpreted as ', { rid: r.nonexistent }]
        ],
        parseRules: true,
        examples: [
            { description: 'Recursive map', dbuf: root(type_choice_shared(type_map(r.value, type_choice(type_choice_select(0), type_choice_select(1))), r.parse_varint), choice_shared(bit_val(0, 1), map(choice(bit_val(0, 1), choice_select(map(choice(bit_val(1, 1), choice_select(6)))))))), unpack: { [getReg(r.value)]: { [getReg(r.value)]: 6 } } },
            { description: 'Recursive shared', dbuf: root(type_choice_shared(type_map(r.value, type_choice_shared(type_map(r.denominator, type_choice_select(1)), type_choice_select(1))), r.parse_varint), choice_shared(bit_val(0, 1), map(choice_shared(bit_val(0, 1), map(choice_select(6)))))), unpack: { [getReg(r.value)]: { [getReg(r.denominator)]: 6 } } },
            { description: 'Missing shared', dbuf: root(type_map(r.denominator, type_choice_select(1)), map(choice_select())), unpack: {} },
        ]
    },
    [r.parse_type_data_immediate]: {
        paragraphs: [
            ['Defines a parsing context that begins with a type component followed by a data component conforming to that type. The parsing context begins immediately after this symbol.'],
            ['The semantics are identical to the root structure of a DBUF stream.'],
        ],
        parseRules: true,
        examples: [
            { description: 'Map with its second value defined in the type component', dbuf: root(type_map(r.denominator, r.value, r.parse_varint, parse_type_data_immediate(r.parse_varint, 4)), map(3)), unpack: { [getReg(r.denominator)]: 3, [getReg(r.value)]: 4 } },
        ]
    },
    [r.parse_align]: {
        paragraphs: [
            ['Defines an instruction to align the parser to a multiple of bits.'],
            ['Consumes one varint specifying the power of two number of bits, offset by one. (E.g. 0 = 2 bits, 1 = 4 bits, 2 = 8 bits, etc). Then consumes one symbol defining the nested type.'],
            ['When encountered in the parsing of a data component: Consumes the least number of bits that bring the parser into the specified alignment. Then executes any data component parsing rules of the nested type.']
        ],
        parseRules: true,
        examples: [
            { description: 'Align to 32 bits before parsing varint', dbuf: root(parse_align(32, r.parse_varint), align(32, 5)), unpack: 5 },
        ]
    },
    [r.parse_type_data]: {
        paragraphs: [
            ['Defines a parsing context that begins with a type component followed by a data component conforming to that type.'],
            ['When encountered in the parsing of a data component: Consumes a type and data component with semantics identical to the root structure of a DBUF stream.'],
            ['Useful for values that can be of any type.']
        ],
        parseRules: true,
        examples: [
            { description: 'Map with type information not known until the data component', dbuf: root(type_map(r.denominator, r.parse_type_data), map(parse_type_data(r.parse_varint, 3))), unpack: { [getReg(r.denominator)]: 3 } },
        ]
    },
    [r.little_endian_marker]: {
        paragraphs: [
            ['Placeholder symbol to avoid collisions with the bit order optional prefix at the beginning of a stream.'],
        ],
        examples: [
            { description: 'Stream with prefix', dbuf: root(type_map(r.denominator, r.parse_varint), map(3), true), unpack: { [getReg(r.denominator)]: 3 } },
            { description: 'Normal symbol usage', dbuf: root(type_map(r.denominator, r.little_endian_marker), map()), unpack: { [getReg(r.denominator)]: getReg(r.little_endian_marker) } },
        ]
    },
    [r.describe_no_value]: {
        paragraphs: [
            ['Used as a placeholder for an empty value.'],
            ['When used in a ', { rid: r.type_map }, ', it preserves the key\'s presence, in contrast to ', { rid: r.nonexistent }, ' which implies the key is absent.']
        ],
        examples: [
            { description: 'Empty value', dbuf: root(type_map(r.denominator, r.describe_no_value), map()), unpack: { [getReg(r.denominator)]: getReg(r.describe_no_value) } },
            { description: 'Empty value with error as the reason it is empty', dbuf: root(type_map(r.denominator, type_map(r.describe_no_value, r.error)), map(map())), unpack: { [getReg(r.denominator)]: { [getReg(r.describe_no_value)]: getReg(r.error) } } },
        ]
    },
    [r.false]: {
        paragraphs: [
            ['Boolean false value'],
        ],
        examples: [
            { description: 'Map with boolean value', dbuf: root(type_map(r.value, type_choice(r.false, r.true)), map(choice(bit_val(1, 1)))), unpack: { [getReg(r.value)]: true } }
        ]
    },
    [r.integer_signed]: {
        paragraphs: [
            ['Classifies a number as a signed integer.'],
            ['Used in a map with one key and a value type of ', { rid: r.parse_varint }, ' or ', { rid: r.parse_bit_size }],
            ['The bits of the value are interpreted as two\'s complement format.'],
            ['The S-expression examples show the unsigned value.']
        ],
        examples: [
            { description: 'Integer with value -2', dbuf: root(type_map(r.integer_signed, r.parse_varint), map(6)), unpack: -2 },
            { description: 'Integer with value -3', dbuf: root(type_map(r.integer_signed, parse_bit_size(12)), map(bit_val(0x0FFD, 12))), unpack: -3 },
            { description: 'Integer with value -2 little endian', dbuf: root(type_map(r.integer_signed, r.parse_varint), map(6), true), unpack: -2 },
            { description: 'Integer with value -3 little endian', dbuf: root(type_map(r.integer_signed, parse_bit_size(12)), map(bit_val(0x0FFD, 12)), true), unpack: -3 },
        ]
    },
    [r.IEEE_754_binary16]: {
        paragraphs: [
            ['Classifies a number as floating point with IEEE 754 binary16 format.'],
            ['Used in a map with one key and a value type of ', { rid: r.parse_varint }, ' or ', { rid: r.parse_bit_size }],
            ['If the size of the number is less than 16 bits, the bits are interpreted as the most significant bits of the IEEE 754 binary16 format.'],
            ['If the size of the number is greater than 16 bits, the least significant 16 bits (according to the bit order of the stream) are regarded as the value and remaining bits must be ignored.'],
            ['The S-expression examples show the unsigned integer value.']
        ],
        examples: [
            { description: 'Floating point with value 1', dbuf: root(type_map(r.IEEE_754_binary16, r.parse_varint), map(0b0011110000000)), unpack: 1 },
            { description: 'Floating point with value -1', dbuf: root(type_map(r.IEEE_754_binary16, parse_bit_size(12)), map(bit_val(0b101111000000, 12))), unpack: -1 },
            { description: 'Floating point with value 1 little endian', dbuf: root(type_map(r.IEEE_754_binary16, r.parse_varint), map(0b0011110000000), true), unpack: 1 },
            { description: 'Floating point with value -1 little endian', dbuf: root(type_map(r.IEEE_754_binary16, parse_bit_size(12)), map(bit_val(0b101111000000, 12)), true), unpack: -1 },
            { description: 'Floating point with value -1 oversized', dbuf: root(type_map(r.IEEE_754_binary16, parse_bit_size(20)), map(bit_val(0b1011110000000000, 20))), unpack: -1 },
            { description: 'Floating point with value -1 oversized little endian', dbuf: root(type_map(r.IEEE_754_binary16, parse_bit_size(20)), map(bit_val(0b1011110000000000, 20)), true), unpack: -1 },
        ]
    },
    [r.IEEE_754_binary32]: {
        paragraphs: [
            ['Classifies a number as floating point with IEEE 754 binary32 format.'],
            ['Used in a map with one key and a value type of ', { rid: r.parse_varint }, ' or ', { rid: r.parse_bit_size }],
            ['If the size of the number is less than 32 bits, the bits are interpreted as the most significant bits of the IEEE 754 binary32 format.'],
            ['If the size of the number is greater than 32 bits, the least significant 32 bits (according to the bit order of the stream) are regarded as the value and remaining bits must be ignored.'],
            ['The S-expression examples show the unsigned integer value.']
        ],
        examples: [
            { description: 'Floating point with value 1', dbuf: root(type_map(r.IEEE_754_binary32, r.parse_varint), map(0b0011111110000)), unpack: 1 },
            { description: 'Floating point with value -1', dbuf: root(type_map(r.IEEE_754_binary32, parse_bit_size(12)), map(bit_val(0b101111111000, 12))), unpack: -1 },
            { description: 'Floating point with value 1 little endian', dbuf: root(type_map(r.IEEE_754_binary32, r.parse_varint), map(0b0011111110000), true), unpack: 1 },
            { description: 'Floating point with value -1 little endian', dbuf: root(type_map(r.IEEE_754_binary32, parse_bit_size(12)), map(bit_val(0b101111111000, 12)), true), unpack: -1 },
        ]
    },
    [r.IEEE_754_binary64]: {
        paragraphs: [
            ['Classifies a number as floating point with IEEE 754 binary64 format.'],
            ['Used in a map with one key and a value type of ', { rid: r.parse_varint }, ' or ', { rid: r.parse_bit_size }],
            ['If the size of the number is less than 64 bits, the bits are interpreted as the most significant bits of the IEEE 754 binary64 format.'],
            ['If the size of the number is greater than 64 bits, the least significant 64 bits (according to the bit order of the stream) are regarded as the value and remaining bits must be ignored.'],
            ['The S-expression examples show the unsigned integer value.']
        ],
        examples: [
            { description: 'Floating point with value 1', dbuf: root(type_map(r.IEEE_754_binary64, r.parse_varint), map(0b0011111111110)), unpack: 1 },
            { description: 'Floating point with value -1', dbuf: root(type_map(r.IEEE_754_binary64, parse_bit_size(12)), map(bit_val(0b101111111111, 12))), unpack: - 1 },
            { description: 'Floating point with value 1 little endian', dbuf: root(type_map(r.IEEE_754_binary64, r.parse_varint), map(0b0011111111110), true), unpack: 1 },
            { description: 'Floating point with value -1 little endian', dbuf: root(type_map(r.IEEE_754_binary64, parse_bit_size(12)), map(bit_val(0b101111111111, 12)), true), unpack: -1 },
        ]
    },
    [r.value]: {
        paragraphs: [
            ['Generic symbol used to hold data in a map when another symbol describes the type of the map.'],
        ],
        examples: [
            { description: 'Rational number with value 1/3', dbuf: root(type_map(r.denominator, r.value, r.parse_varint, r.parse_varint), map(3, 1)), unpack: { [getReg(r.denominator)]: 3, [getReg(r.value)]: 1 } }
        ]
    },
    [r.denominator]: {
        paragraphs: [
            ['Used for the denomiator term in rational numbers.'],
            ['The ', { rid: r.value }, ' symbol is used for the numerator.']
        ],
        examples: [
            { description: 'Rational number with value 1/3', dbuf: root(type_map(r.denominator, r.value, r.parse_varint, r.parse_varint), map(3, 1)), unpack: { [getReg(r.denominator)]: 3, [getReg(r.value)]: 1 } }
        ]
    },
    [r.complex_i]: {
        paragraphs: [
            ['Used for the imaginary part of complex numbers.'],
            ['A complex number is structured as a map with ', { rid: r.value }, ' representing the real part of the number.']
        ],
        examples: [
            { description: 'Complex number with value 2 + 3i', dbuf: root(type_map(r.complex_i, r.value, r.parse_varint, r.parse_varint), map(3, 2)), unpack: { [getReg(r.complex_i)]: 3, [getReg(r.value)]: 2 } }
        ]
    },
    [r.quaternion_j]: {
        paragraphs: [
            ['Used for the j part of quaternion numbers.'],
            ['A quaternion number is structured as a map with ', { rid: r.quaternion_k }, ', ', { rid: r.quaternion_j },
                ', ', { rid: r.complex_i }, ' and ', { rid: r.value }, ' for the real part of the number.']
        ],
        examples: [
            { description: 'Quaternion number with value 2 + 3i + 4j + 5k', dbuf: root(type_map(r.quaternion_k, r.quaternion_j, r.complex_i, r.value, r.parse_varint, r.parse_varint, r.parse_varint, r.parse_varint), map(5, 4, 3, 2)), unpack: { [getReg(r.quaternion_k)]: 5, [getReg(r.quaternion_j)]: 4, [getReg(r.complex_i)]: 3, [getReg(r.value)]: 2 } }
        ]
    },
    [r.quaternion_k]: {
        paragraphs: [
            ['Used for the k part of quaternion numbers.'],
            ['A quaternion number is structured as a map with ', { rid: r.quaternion_k }, ', ', { rid: r.quaternion_j },
                ', ', { rid: r.complex_i }, ' and ', { rid: r.value }, ' for the real part of the number.']
        ],
        examples: [
            { description: 'Quaternion number with value 2 + 3i + 4j + 5k', dbuf: root(type_map(r.quaternion_k, r.quaternion_j, r.complex_i, r.value, r.parse_varint, r.parse_varint, r.parse_varint, r.parse_varint), map(5, 4, 3, 2)), unpack: { [getReg(r.quaternion_k)]: 5, [getReg(r.quaternion_j)]: 4, [getReg(r.complex_i)]: 3, [getReg(r.value)]: 2 } }
        ]
    },
    [r.exponent_base2]: {
        paragraphs: [
            ['Used for the exponent of binary floating point numbers with arbitrary range and precision.'],
            ['A binary floating point number is structured as a map with ', { rid: r.value }, ' representing the mantissa of the number.']
        ],
        examples: [
            { description: 'Binary floating point with value 2.125', dbuf: root(type_map(r.exponent_base2, r.value, type_map(r.integer_signed, r.parse_varint), parse_bit_size(5)), map(map(0b001), bit_val(0b00010, 5))), unpack: 2.125 }
        ]
    },
    [r.exponent_base10]: {
        paragraphs: [
            ['Used for the exponent of decimal floating point numbers with arbitrary range and precision.'],
            ['A decimal floating point number is structured as a map with ', { rid: r.value }, ' representing the mantissa of the number.']
        ],
        examples: [
            { description: 'Decimal floating point with value 1.01', dbuf: root(type_map(r.exponent_base10, r.value, type_map(r.integer_signed, r.parse_varint), parse_bit_size(8)), map(map(0b110), bit_val(101, 8))), unpack: 1.01 }
        ]
    },
    [r.sign]: {
        paragraphs: [
            ['Used for the positive or negative sign of a number.'],
            ['A sign/magnitude number is structured as a map with additional keys representing the magnitude.']
        ],
        examples: [
            { description: 'Number with value -2', dbuf: root(type_map(r.sign, r.value, parse_bit_size(1), r.parse_varint), map(bit_val(1, 1), 2)), unpack: -2 },
            { description: 'Number with value -2 with boolean choice', dbuf: root(type_map(r.sign, r.value, type_choice(r.false, r.true), r.parse_varint), map(choice(bit_val(1, 1)), 2)), unpack: -2 },
        ]
    },
    [r.registry]: {
        paragraphs: [
            ['Classifies a number as a DBUF symbol registry id.'],
            ['Used to represent symbol ids above the max value of a varint or symbols that have parsing rules.']
        ],
        examples: [
            { description: 'Symbol id 2', dbuf: root(type_map(r.registry, r.parse_varint), map(2)), unpack: getReg(r.type_choice) },
        ]
    },
    [r.error]: {
        paragraphs: [
            ['Used as a key in a map to identify error information.'],
            [{ rid: r.error }, ' must be the first key in a map with more than one key.']
        ],
        examples: [
            { description: 'Internal error', dbuf: root(type_map(r.error, r.error_internal), map()), unpack: { [getReg(r.error)]: getReg(r.error_internal) } },
        ]
    },
    [r.error_internal]: {
        paragraphs: [
            ['Error for unexpected conditions within an implementation when no other symbol is applicable.'],
        ],
        examples: [
            { description: 'Internal error', dbuf: root(type_map(r.error, r.error_internal), map()), unpack: { [getReg(r.error)]: getReg(r.error_internal) } },
        ]
    },
    [r.incomplete_stream]: {
        paragraphs: [
            ['Error for a DBUF stream that ended without completing the semantic root structure.'],
        ],
        examples: [
            { description: 'Incomplete stream error', dbuf: root(type_map(r.error, r.incomplete_stream), map()), unpack: { [getReg(r.error)]: getReg(r.incomplete_stream) } },
        ]
    },
    [r.delta]: {
        paragraphs: [
            ['Used for compression of similar values in arrays by specifing the change from the previous item.'],
        ],
        examples: [
            { description: 'Array with values (100, 102)', dbuf: root(type_array(type_choice(r.parse_varint, type_map(r.delta, r.parse_varint))), array(choice(bit_val(0, 1), 100), choice(bit_val(1, 1), map(2)))), unpack: [100, 102] },
        ]
    },
    [r.delta_double]: {
        paragraphs: [
            ['Used for compression of similar values in arrays by specifing the change of the delta from the previous item.'],
        ],
        examples: [
            { description: 'Array with values (100, 210, 320)', dbuf: root(type_array(type_choice(r.parse_varint, type_map(r.delta_double, r.parse_varint))), array(choice(bit_val(0, 1), 100), choice(bit_val(1, 1), map(10)), choice(bit_val(1, 1), map(0)))), unpack: [100, 210, 320] },
        ]
    },
    [r.epoch_seconds_continuous]: {
        paragraphs: [
            ['Used for specifying an instant in time as the number of SI seconds since January 1st 2018 UTC.'],
        ],
        examples: [
            { description: 'January 1st 2018 00:01:20 UTC', dbuf: root(type_map(r.epoch_seconds_continuous, r.parse_varint), map(80)), unpack: new Date(Date.UTC(2018, 0, 1, 0, 1, 20)) },
        ]
    },
    [r.duration]: {
        paragraphs: [
            ['Used for describing a nested entity as a duration of time.'],
            ['If the nested entity is only composed of seconds, the seconds are considered continuous similar to the TAI time scale.'],
            ['If the nested entity is composed of other time elements, the duration may have to consider the semantics of calendars.']
        ],
        examples: [
            { description: 'Duration of 2 seconds', dbuf: root(type_map(r.duration, type_map(r.second, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.second)]: 2 } } },
            { description: 'Duration of one month and 2 seconds', dbuf: root(type_map(r.duration, type_map(r.month, r.second, r.parse_varint, r.parse_varint)), map(map(1, 2))), unpack: { [getReg(r.duration)]: { [getReg(r.month)]: 1, [getReg(r.second)]: 2 } } },
        ]
    },
    [r.instant]: {
        paragraphs: [
            ['Used for describing a nested entity as an instant in time.'],
        ],
        examples: [
            { description: 'Instant 2 seconds after the start of a minute', dbuf: root(type_map(r.instant, type_map(r.second, r.parse_varint)), map(map(2))), unpack: { [getReg(r.instant)]: { [getReg(r.second)]: 2 } } },
            { description: 'Instant January 1st 2038 without timezone', dbuf: root(type_map(r.instant, type_map(r.year, r.parse_varint)), map(map(20))), unpack: new Date('2038-01-01T00:00:00'), }
        ]
    },
    [r.implied_interval]: {
        paragraphs: [
            ['Used for describing a nested entity as an interval in a singluar way instead of a start and end.'],
            ['The boundary sementics are inclusive at the start, exclusive at the end. (E.g. 2019-01-01T00:00:00 <= [Interval of year 2019] < 2020-01-01T00:00:00)']
        ],
        examples: [
            { description: 'Interval from 2 to 3 seconds after the start of a minute', dbuf: root(type_map(r.implied_interval, type_map(r.second, r.parse_varint)), map(map(2))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.second)]: 2 } } },
            { description: 'Interval of year 2019', dbuf: root(type_map(r.implied_interval, type_map(r.year, r.parse_varint)), map(map(1))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.year)]: 1 } } },
        ]
    },
    [r.start]: {
        paragraphs: [
            ['Used for describing a nested entity as an instant that begins an interval.'],
        ],
        examples: [
            { description: 'Start January 1st 2019', dbuf: root(type_map(r.start, type_map(r.year, r.parse_varint)), map(map(1))), unpack: { [getReg(r.start)]: { [getReg(r.year)]: 1 } } },
        ]
    },
    [r.end]: {
        paragraphs: [
            ['Used for describing a nested entity as an instant that ends an interval.'],
        ],
        examples: [
            { description: 'End January 1st 2019', dbuf: root(type_map(r.end, type_map(r.year, r.parse_varint)), map(map(1))), unpack: { [getReg(r.end)]: { [getReg(r.year)]: 1 } } },
        ]
    },
    [r.second]: {
        paragraphs: [
            ['SI unit of time.'],
        ],
        examples: [
            { description: 'Duration of 2 seconds', dbuf: root(type_map(r.second, r.parse_varint), map(2)), unpack: { [getReg(r.second)]: 2 } },
            { description: 'Duration of 2 seconds', dbuf: root(type_map(r.duration, type_map(r.second, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.second)]: 2 } } },
            { description: 'Instant 2 seconds after the start of a minute', dbuf: root(type_map(r.instant, type_map(r.second, r.parse_varint)), map(map(2))), unpack: { [getReg(r.instant)]: { [getReg(r.second)]: 2 } } },
            { description: 'Interval from 2 to 3 seconds after the start of a minute', dbuf: root(type_map(r.implied_interval, type_map(r.second, r.parse_varint)), map(map(2))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.second)]: 2 } } },
        ]
    },
    [r.minute]: {
        paragraphs: [
            ['Unit of time equal to 60 seconds or 1/60th of an hour.'],
        ],
        examples: [
            { description: 'Duration of 2 minutes', dbuf: root(type_map(r.minute, r.parse_varint), map(2)), unpack: { [getReg(r.minute)]: 2 } },
            { description: 'Duration of 2 minutes', dbuf: root(type_map(r.duration, type_map(r.minute, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.minute)]: 2 } } },
            { description: 'Instant 2 minutes after the start of an hour', dbuf: root(type_map(r.instant, type_map(r.minute, r.parse_varint)), map(map(2))), unpack: { [getReg(r.instant)]: { [getReg(r.minute)]: 2 } } },
            { description: 'Interval from 2 to 3 minutes after the start of an hour', dbuf: root(type_map(r.implied_interval, type_map(r.minute, r.parse_varint)), map(map(2))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.minute)]: 2 } } },
        ]
    },
    [r.hour]: {
        paragraphs: [
            ['Unit of time equal to 60 minutes or 1/24th of a day.'],
        ],
        examples: [
            { description: 'Duration of 2 hours', dbuf: root(type_map(r.hour, r.parse_varint), map(2)), unpack: { [getReg(r.hour)]: 2 } },
            { description: 'Duration of 2 hours', dbuf: root(type_map(r.duration, type_map(r.hour, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.hour)]: 2 } } },
            { description: 'Instant 2 hours after the start of a day', dbuf: root(type_map(r.instant, type_map(r.hour, r.parse_varint)), map(map(2))), unpack: { [getReg(r.instant)]: { [getReg(r.hour)]: 2 } } },
            { description: 'Interval from 2 to 3 hours after the start of a day', dbuf: root(type_map(r.implied_interval, type_map(r.hour, r.parse_varint)), map(map(2))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.hour)]: 2 } } },
        ]
    },
    [r.day]: {
        paragraphs: [
            ['Unit of time equal to 24 hours or one rotation of the earth.'],
        ],
        examples: [
            { description: 'Duration of 2 days', dbuf: root(type_map(r.day, r.parse_varint), map(2)), unpack: { [getReg(r.day)]: 2 } },
            { description: 'Duration of 2 days', dbuf: root(type_map(r.duration, type_map(r.day, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.day)]: 2 } } },
            { description: 'Instant 2 days after the start of a month', dbuf: root(type_map(r.instant, type_map(r.day, r.parse_varint)), map(map(2))), unpack: { [getReg(r.instant)]: { [getReg(r.day)]: 2 } } },
            { description: 'Interval from 2 to 3 days after the start of a month', dbuf: root(type_map(r.implied_interval, type_map(r.day, r.parse_varint)), map(map(2))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.day)]: 2 } } },
        ]
    },
    [r.month]: {
        paragraphs: [
            ['Unit of time according to the Gregorian calendar.'],
        ],
        examples: [
            { description: 'Duration of 2 months', dbuf: root(type_map(r.month, r.parse_varint), map(2)), unpack: { [getReg(r.month)]: 2 } },
            { description: 'Duration of 2 months', dbuf: root(type_map(r.duration, type_map(r.month, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.month)]: 2 } } },
            { description: 'Instant 2 months after the start of a year', dbuf: root(type_map(r.instant, type_map(r.month, r.parse_varint)), map(map(2))), unpack: { [getReg(r.instant)]: { [getReg(r.month)]: 2 } } },
            { description: 'Interval from 2 to 3 months after the start of a year', dbuf: root(type_map(r.implied_interval, type_map(r.month, r.parse_varint)), map(map(2))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.month)]: 2 } } },
        ]
    },
    [r.year]: {
        paragraphs: [
            ['Unit of time according to the Gregorian calendar.'],
            ['For instants and intervals a value of zero (meaning the epoch) is the year 2018']
        ],
        examples: [
            { description: 'Duration of 2 years', dbuf: root(type_map(r.year, r.parse_varint), map(2)), unpack: { [getReg(r.year)]: 2 } },
            { description: 'Duration of 2 years', dbuf: root(type_map(r.duration, type_map(r.year, r.parse_varint)), map(map(2))), unpack: { [getReg(r.duration)]: { [getReg(r.year)]: 2 } } },
            { description: 'Instant January 1st 2038 without timezone', dbuf: root(type_map(r.instant, type_map(r.year, r.parse_varint)), map(map(20))), unpack: new Date('2038-01-01T00:00:00'), },
            { description: 'Interval of year 2019', dbuf: root(type_map(r.implied_interval, type_map(r.year, r.parse_varint)), map(map(1))), unpack: { [getReg(r.implied_interval)]: { [getReg(r.year)]: 1 } } },
        ]
    },
    [r.magic_number]: {
        paragraphs: [
            ['Placeholder symbol to avoid collisions with the magic number optional prefix at the beginning of a stream.'],
        ],
        examples: [
            { description: 'Stream with prefix', dbuf: root(type_map(r.value, r.parse_varint), map(2), false, true), unpack: { [getReg(r.value)]: 2 } },
            { description: 'Normal symbol usage', dbuf: root(type_map(r.value, r.magic_number), map()), unpack: { [getReg(r.value)]: getReg(r.magic_number) } },
        ]
    },
    [r.offset_add]: {
        paragraphs: [
            ['When used in a map with ', { rid: r.value }, ' describes a number that must be added to obtain the actual value.'],
            ['Useful for compressing values in a narrow range.']
        ],
        examples: [
            { description: 'Array of numbers near 100', dbuf: root(type_array(type_map(r.offset_add, r.value, parse_type_data_immediate(r.parse_varint, 100), r.parse_varint)), array(map(2), map(3))), unpack: [102, 103] },
        ]
    },
    [r.flatten_array]: {
        paragraphs: [
            ['Signifies a nested array should be interpreted as flattened into the parent array.'],
            ['Useful for compression of a large array when sections of the array have greater commonality.']
        ],
        examples: [
            { description: 'Array of numbers with a size of 2 bits in one section and a size of 16 bits in another section', dbuf: root(type_array(type_map(r.flatten_array, type_choice(type_array(parse_bit_size(2)), type_array(parse_bit_size(16))))), array(map(choice(bit_val(0, 1), array(bit_val(1, 2), bit_val(2, 2)))), map(choice(bit_val(1, 1), array(bit_val(10000, 16), bit_val(20000, 16)))))), unpack: [1, 2, 10000, 20000] },
        ]
    },
    [r.copyable]: {
        paragraphs: [
            ['Signifies a nested entity may be repeated later in the DBUF stream.'],
            ['The sequence of copyable entities form a logical buffer that can be referenced by ', { rid: r.copy_distance }, ' and ' + { rid: r.copy_length }],
        ],
        examples: [
            {
                description: 'Copying 3 values, skipping non-copyable values.', dbuf: root(type_array(type_choice(r.parse_varint, type_map(r.copyable, r.parse_varint), type_map(r.copy_length, r.parse_varint))),
                    array(choice(bit_val(1, 2), map(2)), choice(bit_val(1, 2), map(3)), choice(bit_val(1, 2), map(4)), choice(bit_val(0, 2), 5), choice(bit_val(2, 2), map(2)))),
                unpack: [2, 3, 4, 5, 4, 4, 4]
            },
            {
                description: 'Copy 4 values', dbuf: root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.copy_length, r.parse_varint, r.parse_varint))),
                    array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(0, 1), map(4)), choice(bit_val(1, 1), map(1, 3)))),
                unpack: [2, 3, 4, 3, 4, 3, 4]
            },
        ]
    },
    [r.copy_length]: {
        paragraphs: [
            ['Specifies a count of values to copy from the ', { rid: r.copyable }, ' buffer of a stream.'],
            ['Nested value must be an unsigned integer.'],
            ['Count is offset by one.'],
            ['Copying begins from the most recent', { rid: r.copyable }, ' item.'],
            ['Copied values are also appended to the ', { rid: r.copyable }, ' buffer.'],
            ['Can be composed with ', { rid: r.copy_distance }, ' for copying a range of values.'],
        ],
        examples: [
            {
                description: 'Copying 3 values, skipping non-copyable values.', dbuf: root(type_array(type_choice(r.parse_varint, type_map(r.copyable, r.parse_varint), type_map(r.copy_length, r.parse_varint))),
                    array(choice(bit_val(1, 2), map(2)), choice(bit_val(1, 2), map(3)), choice(bit_val(1, 2), map(4)), choice(bit_val(0, 2), 5), choice(bit_val(2, 2), map(2)))),
                unpack: [2, 3, 4, 5, 4, 4, 4]
            },
            {
                description: 'Copy 4 values', dbuf: root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.copy_length, r.parse_varint, r.parse_varint))),
                    array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(0, 1), map(4)), choice(bit_val(1, 1), map(1, 3)))),
                unpack: [2, 3, 4, 3, 4, 3, 4]
            },
        ]
    },
    [r.copy_distance]: {
        paragraphs: [
            ['Specifies an offset into the ', { rid: r.copyable }, ' buffer of a stream.'],
            ['Nested value must be an unsigned integer.'],
            ['A value of zero refers to the most recent ', { rid: r.copyable }, ' item.'],
            ['Copied values are also appended to the ', { rid: r.copyable }, ' buffer.'],
            ['If offset exceeds the size of the ', { rid: r.copyable }, ' buffer, the copied value is interpreted as ', { rid: r.nonexistent }],
            ['Can be composed with ', { rid: r.copy_length }, ' for copying a range of values.'],
        ],
        examples: [
            {
                description: 'Copying a value at a distance of 2, skipping non-copyable values.', dbuf: root(type_array(type_choice(r.parse_varint, type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.parse_varint))),
                    array(choice(bit_val(1, 2), map(2)), choice(bit_val(1, 2), map(3)), choice(bit_val(1, 2), map(4)), choice(bit_val(0, 2), 5), choice(bit_val(2, 2), map(2)))),
                unpack: [2, 3, 4, 5, 2]
            },
            {
                description: 'Copying a previously copied value', dbuf: root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.parse_varint))),
                    array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(0, 1), map(4)), choice(bit_val(1, 1), map(2)), choice(bit_val(1, 1), map(0)))),
                unpack: [2, 3, 4, 2, 2]
            },
            {
                description: 'Copy distance out of range', dbuf: root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.parse_varint))),
                    array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(1, 1), map(5)), choice(bit_val(0, 1), map(4)))),
                unpack: [2, 3, , 4]
            },
            {
                description: 'Copy 4 values', dbuf: root(type_array(type_choice(type_map(r.copyable, r.parse_varint), type_map(r.copy_distance, r.copy_length, r.parse_varint, r.parse_varint))),
                    array(choice(bit_val(0, 1), map(2)), choice(bit_val(0, 1), map(3)), choice(bit_val(0, 1), map(4)), choice(bit_val(1, 1), map(1, 3)))),
                unpack: [2, 3, 4, 3, 4, 3, 4]
            },
        ]
    },
    [r.unit]: {
        paragraphs: [
            ['When used in a map with ', { rid: r.value }, ' describes the unit of that value.'],
        ],
        examples: [
            { description: '2 meters', dbuf: root(type_map(r.unit, r.value, r.second, r.parse_varint), map(2)), unpack: { [getReg(r.unit)]: getReg(r.second), [getReg(r.value)]: 2 } },
        ]
    },
    [r.format]: {
        paragraphs: [
            ['Describes a data format.'],
            ['When used in a map with ', { rid: r.value }, ' describes the format of that value.'],
            ['If the format value is a fixed bit width unsigned integer or an array of fixed bit width unsigned integers, the bits are interpreted as the type component of a distinct DBUF stream. Any associated ', { rid: r.value }, ' is interpeted as the data component of a DBUF stream.'],
            ['If the format value is the ', { rid: r.format }, ' symbol, the format is a complete DBUF stream.'],
        ],
        examples: [
            { description: 'Format for a DBUF type_array of varints', dbuf: root(type_map(r.format, r.parse_bytes), map(dbufWriteToArray8(type_array(r.parse_varint)))), unpack: { [getReg(r.format)]: new Uint8Array([20]) } },
            { description: 'Format for a DBUF type_array of varints with array of varints (1,2,3) packed as bytes', dbuf: root(type_map(r.format, r.value, r.parse_bytes, r.parse_bytes), map(dbufWriteToArray8(type_array(r.parse_varint)), dbufWriteToArray8(array(1, 2, 3)))), unpack: { [getReg(r.format)]: new Uint8Array([20]), [getReg(r.value)]: new Uint8Array([49, 35]) } },
            { description: 'Format for a DBUF stream', dbuf: root(type_map(r.format, r.format), map()), unpack: { [getReg(r.format)]: getReg(r.format) } },
            { description: 'Format for a DBUF stream with type and array of varints (1,2,3) packed as bytes', dbuf: root(type_map(r.format, r.value, r.format, r.parse_bytes), map(dbufWriteToArray8(root(type_array(r.parse_varint), array(1, 2, 3))))), unpack: { [getReg(r.format)]: getReg(r.format), [getReg(r.value)]: new Uint8Array([20, 49, 35]) } },
        ]
    },
    [r.stream_position]: {
        paragraphs: [
            ['Symbol for describing a position in a data stream as a number of bits.'],
        ],
        examples: [
            { description: '5 bits from the start of a stream', dbuf: root(type_map(r.stream_position, r.parse_varint), map(5)), unpack: { [getReg(r.stream_position)]: 5 } },
        ]
    },
    [r.registry_symbol_not_accepted]: {
        paragraphs: [
            ['Symbol for validation errors caused by a specific registry symbol during parsing.'],
            ['Specifications may limit accepted registry symbols to reduce parser complexity and resource usage.'],
            ['A related stream position includes the bits of the offending symbol.']
        ],
        examples: [
            { description: 'Error stating a symbol is not accepted at bit position 12', dbuf: root(type_map(r.error, r.stream_position, r.registry_symbol_not_accepted, r.parse_varint), map(12)), unpack: { [getReg(r.error)]: getReg(r.registry_symbol_not_accepted), [getReg(r.stream_position)]: 12 } },
        ]
    },
    [r.registry_symbol_not_accepted_as_array_type]: {
        paragraphs: [
            ['Symbol for validation errors caused by a specific registry symbol during parsing of array types.'],
            ['Specifications may limit accepted registry symbols to reduce parser complexity and resource usage.'],
            ['A related stream position includes the bits of the offending symbol.']
        ],
        examples: [
            { description: 'Error stating a symbol is not accepted at bit position 12', dbuf: root(type_map(r.error, r.stream_position, r.registry_symbol_not_accepted_as_array_type, r.parse_varint), map(12)), unpack: { [getReg(r.error)]: getReg(r.registry_symbol_not_accepted_as_array_type), [getReg(r.stream_position)]: 12 } },
        ]
    },
    [r.prefix]: {
        paragraphs: [
            ['Used for compression of strings that begin with the same substring.'],
            ['When used in a map with ', { rid: r.value }, ' the unpacked value is a concatenation of the bytes of prefix and value'],
        ],
        examples: [
            { description: 'String "world" with prefix "hello "', dbuf: root(type_map(r.prefix, r.value, r.parse_text, r.parse_text), map(string('hello '), string('world'))), unpack: 'hello world' },
        ]
    },
    [r.suffix]: {
        paragraphs: [
            ['Used for compression of strings that end with the same substring.'],
            ['When used in a map with ', { rid: r.value }, ' the unpacked value is a concatenation of the bytes of value and suffix'],
        ],
        examples: [
            { description: 'String "hello " with suffix "world"', dbuf: root(type_map(r.value, r.suffix, r.parse_text, r.parse_text), map(string('hello '), string('world'))), unpack: 'hello world' },
            { description: 'String "wo" with prefix "hello " and suffix "rld"', dbuf: root(type_map(r.prefix, r.value, r.suffix, r.parse_text, r.parse_text, r.parse_text), map(string('hello '), string('wo'), string('rld'))), unpack: 'hello world' },
        ]
    },
    [r.prefix_delta]: {
        paragraphs: [
            ['Used for compression of an array of strings that begin with similar substrings.'],
            ['When used in a map with ', { rid: r.value }, ' the unpacked value is a concatenation of the bytes of the previous value in the array minus the number of bytes specified by the delta and value'],
        ],
        examples: [
            { description: 'Array of strings with partial shared prefixes', dbuf: root(type_array(type_map(r.prefix_delta, r.value, r.parse_varint, r.parse_text)), array(map(0, string('abcd')), map(1, string('efgh')), map(5, string('ijk')))), unpack: ['abcd', 'abcefgh', 'abijk'] },
        ]
    },
    // [r.preamble_max_size_exceeded]: {
    //     paragraphs: [
    //         ['Symbol for a size validation error of a server request preamble.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the request preamble is too large', dbuf: root(type_map(r.error, r.preamble_max_size_exceeded), map()), unpack: { [getReg(r.error)]: getReg(r.preamble_max_size_exceeded) } },
    //     ]
    // },
    // [r.body_max_size_exceeded]: {
    //     paragraphs: [
    //         ['Symbol for a size validation error of a server request body.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the request body is too large', dbuf: root(type_map(r.error, r.body_max_size_exceeded), map()), unpack: { [getReg(r.error)]: getReg(r.body_max_size_exceeded) } },
    //     ]
    // },
    // [r.data_type_not_accepted]: {
    //     paragraphs: [
    //         ['Symbol for data type validation errors.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the data type of the operation field is not accepted', dbuf: root(type_map(r.error, r.data_path, r.data_type_not_accepted, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.operation, true))))), unpack: { [getReg(r.error)]: getReg(r.data_type_not_accepted), [getReg(r.data_path)]: [getReg(r.operation)] } },
    //     ]
    // },
    // [r.data_value_not_accepted]: {
    //     paragraphs: [
    //         ['Symbol for data value validation errors.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the data value of the operation field is not accepted', dbuf: root(type_map(r.error, r.data_path, r.data_value_not_accepted, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.operation, true))))), unpack: { [getReg(r.error)]: getReg(r.data_value_not_accepted), [getReg(r.data_path)]: [getReg(r.operation)] } },
    //     ]
    // },
    // [r.data_path]: {
    //     paragraphs: [
    //         ['Symbol for describing a position in a hierarchy of nested maps and arrays as an array of map keys and array indexes.'],
    //         ['An empty array signifies the root object.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the data type of the operation field is not accepted', dbuf: root(type_map(r.error, r.data_path, r.data_type_not_accepted, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.operation, true))))), unpack: { [getReg(r.error)]: getReg(r.data_type_not_accepted), [getReg(r.data_path)]: [getReg(r.operation)] } },
    //     ]
    // },
    // [r.required_field_missing]: {
    //     paragraphs: [
    //         ['Symbol for missing field validation errors'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the operation field is missing', dbuf: root(type_map(r.error, r.data_path, r.required_field_missing, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.operation, true))))), unpack: { [getReg(r.error)]: getReg(r.required_field_missing), [getReg(r.data_path)]: [getReg(r.operation)] } },
    //     ]
    // },
    // [r.field_not_accepted]: {
    //     paragraphs: [
    //         ['Symbol for validation errors caused by extraneous fields.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the operation field is not accepted', dbuf: root(type_map(r.error, r.data_path, r.field_not_accepted, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.operation, true))))), unpack: { [getReg(r.error)]: getReg(r.field_not_accepted), [getReg(r.data_path)]: [getReg(r.operation)] } },
    //     ]
    // },
    // [r.field_order_not_accepted]: {
    //     paragraphs: [
    //         ['Symbol for validation errors caused by fields appearing out of order according to some specication.'],
    //     ],
    //     examples: [
    //         { description: 'Error stating the position of the operation field is not accepted', dbuf: root(type_map(r.error, r.data_path, r.field_order_not_accepted, type_array(r.parse_type_data)), map(array(parse_type_data(val(r.operation, true))))), unpack: { [getReg(r.error)]: getReg(r.field_order_not_accepted), [getReg(r.data_path)]: [getReg(r.operation)] } },
    //     ]
    // },
    // [r.reference]: {
    //     paragraphs: [
    //         ['Used for describing a resolvable reference.'],
    //         ['Text values are considered IRI references.']
    //     ],
    //     examples: [
    //         { description: 'Reference to https://example.com/hey', dbuf: root(type_map(r.reference, r.parse_text), map(string('https://example.com/hey'))), unpack: { [getReg(r.reference)]: 'https://example.com/hey' } },
    //     ]
    // },
    // [r.operation]: {
    //     paragraphs: [
    //         ['Used for specifying an operation in a request'],
    //     ],
    //     examples: [
    //         { description: 'Operation 3 with parameter 5', dbuf: root(type_map(r.operation, r.value, r.parse_varint, r.parse_varint), map(3, 5)), unpack: { [getReg(r.operation)]: 3, [getReg(r.value)]: 5 } },
    //     ]
    // },
}
export const codec: Doc = {
    sections: [
        {
            title: 'DBUF Codec', heading: 1, id: [], paragraphs: [
                ['DBUF is structured as a stream of binary integers. The first few values in a stream correspond to symbols in the [Registry](./registry/README.md) that describe the size and meaning of values later in the stream. ',
                    'The symbols also compose in ways that can describe nested or repeating patterns with dense packing.'],
            ]
        },
        {
            title: 'Varints', heading: 2, id: [1], paragraphs: [
                ['Several areas of the DBUF spec refer to a default variable length integer encoding or "varint" for short. The following bit patterns specify the 5 possible bit widths:'],
                [{ item: ['Leading bit 0 - 3 data bits'] }, { item: ['Leading bits 10 - 6 data bits'] }, { item: ['Leading bits 110 - 13 data bits'] }, { item: ['Leading bits 1110 - 20 data bits'] }, { item: ['Leading bits 1111 - 32 data bits'] }],
                ['The leading bits may be the most or least significant bits as defined by the optional prefixes at the beginning of the stream. Likewise, the data bits will follow the same convention of most or least significant first.']
            ]
        },
        {
            title: 'Optional Prefixes', heading: 2, id: [2], paragraphs: [
                ['The first 4 bytes of a stream may contain the magic number 0x' + magicNumberPrefix.toString(16).toUpperCase() + '. This value is unique among publicly known magic numbers and will not collide with any valid unicode encoding. ',
                    'It is also the same as two consecutive instances of the most significant bit encoding of ', { rid: r.magic_number }, ' so it will not collide with any valid DBUF data. Any other occurences of ',
                { rid: r.magic_number }, ' are treated as a normal symbol without special semantics.'],
                ['The first byte (or fifth byte if the 4 byte magic number was present) may contain the value 0x' + littleEndianPrefix.toString(16).toUpperCase() + '. The presence of this value indicates a bit order of least significant bit first.',
                ' The absence of this value indicates a bit order of most significant bit first. 0x' + littleEndianPrefix.toString(16).toUpperCase() + ' is the most significant bit encoding of ', { rid: r.little_endian_marker },
                    ' so it will not collide with any valid DBUF data. Any other occurences of ', { rid: r.little_endian_marker }, ' are treated as a normal symbol without special semantics.']
            ]
        },
        {
            title: 'Root Structure', heading: 2, id: [3], paragraphs: [
                ['After the optional prefixes, a DBUF stream consists of two parts, a type component that defines a structure and a data component with data that conforms to the type component.'],
                ['Some symbols consume additional bits and/or additional symbols which create nested structures. The type component consists of one symbol and its nested children. ',
                    'The data component begins directly after, following the rules of the root symbol of the type component.'],
                ['The end of the data component is considered the end of the DBUF stream. Any data in the bit stream after this point MUST be ignored. ',
                    'A DBUF stream contains exactly one type component and one data component, never a sequence of type/data components. If a sequence is desired, the type component should use an appropriate structure such as ', { rid: r.type_array }]
            ]
        },
        {
            title: 'Symbols with unique parsing rules', heading: 2, id: [4], paragraphs: [
                Object.keys(registry).sort((a, b) => parseInt(a) - parseInt(b)).filter(x => registry[x].parseRules).map(x => { return { item: [], registry: parseInt(x) } }),
            ]
        },
    ]
}