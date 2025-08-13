import { createDecoder, DecoderState, setParserBuffer } from '@bintoca/dbuf-codec/decode'
import { bit_val, Node, NodeType, littleEndianPrefix, concatBuffers } from '@bintoca/dbuf-codec/common'
import { EncoderState, createEncoder, WriterToken, writer, writerPrefix, writeNode, parse_type_data, array_bit_no_children, array_no_children, array_fixed_no_children, array_chunk, chunk_no_children, chunk, choice, map, choice_shared, choice_select, array, bits, align, array_bit, array_fixed, cycle, bytes, u8Text, nodeOrNum, root, parse_type_data_immediate, parse_bit_size, type_map, type_array, byte_chunks } from '@bintoca/dbuf-codec/encode'
import { r } from '@bintoca/dbuf-codec/registry'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { createFullParser } from '@bintoca/dbuf-data/unpack'

const bi = (a: WriterToken, ...b: WriterToken[]) => [r.parse_type_data_immediate, a, ...b]
const tc = (len: number, ...a: WriterToken[]) => [r.type_choice, len - 1, ...a]
const tca = (...a: WriterToken[]) => [r.type_choice, 0, ...a]
const aa = (len: number, ...a: WriterToken[]) => [len - 1, ...a]
const asa = (len: number, ...a: WriterToken[]) => [len - 1, ...a]
const tcs = (len: number, ...a: WriterToken[]) => [r.type_choice_shared, len, ...a]
const tcsa = (...a: WriterToken[]) => [r.type_choice_shared, 0, ...a]
const tm = (len: number, ...a: WriterToken[]) => [r.type_map, len, ...a]
const pbs = (len: number): WriterToken[] => [r.parse_bit_size, len - 1]
const pa = (len: number) => [r.parse_align, 32 - Math.clz32(len / 2 - 1)]
const tab = (len: number) => [r.type_array_bit, len - 1]
const tac = (len: number) => [r.type_array_chunk, len - 1]
const taf = (len: number) => [r.type_array_fixed, len]
const tct = (len: number) => [r.type_choice_select, len]
const n = (x: number) => x
const wbs = (a: number, size: number): WriterToken => { return { bit: true, num: a, size } }
const b = (a: number) => wbs(a, 8)
export const strip = (x: Node): Node => {
    if (typeof x == 'object') {
        if (x.children) {
            return { type: x.type, children: x.children.map(y => strip(y)), arraySize: x.arraySize, bitSize: x.type == NodeType.bits ? undefined : x.bitSize, choiceShared: x.choiceShared ? true : undefined }
        }
        if (x.type == NodeType.val) {
            return { type: x.type, val: x.val }
        }
        if (x.type == NodeType.bit_val) {
            return { type: x.type, val: x.val, bitSize: x.bitSize }
        }
    }
    return x
}
export const testAlignDecoder = (test, expect, alignDecoder) => {
    test.each([
        [0, 0, 1, 0, 0],
        [0, 0, 2, 0, 0],
        [4, 4, 3, 4, 2],
        [4, 1, 3, 5, 7],
    ])('alignDecoder(%#)', (o, r, n, o1, r1) => {
        const d = createDecoder()
        d.littleEndian = true
        d.dv = new DataView(new ArrayBuffer(16))
        d.dvOffset = o
        d.partialBlockRemaining = r
        alignDecoder(d, n)
        expect(d.dvOffset).toBe(o1)
        expect(d.partialBlockRemaining).toBe(r1)
    })
}
export const testAlignEncoder = (test, expect, alignEncoder) => {
    test.each([
        [0, 0, 1, 0, 0],
        [0, 0, 2, 0, 0],
        [4, 3, 3, 4, 1],
        [4, 0, 3, 8, 30],
    ])('alignEncoder(%#)', (o, r, n, o1, r1) => {
        const d = createEncoder()
        d.dv = new DataView(new ArrayBuffer(16))
        d.offset = o
        d.bitsRemaining = r
        alignEncoder(d, n)
        expect(d.offset).toBe(o1)
        expect(d.bitsRemaining).toBe(r1)
    })
}
export const testParseError = (test, expect, parseError: (u8: Uint8Array) => object) => {
    test.each([
        [[r.type_map, 33], r.incomplete_stream],
        [[r.type_array, tm(1, r.error, r.error)], r.registry_symbol_not_accepted_as_array_type],
        [[r.type_array, r.parse_align, 5], r.registry_symbol_not_accepted_as_array_type],
        [[r.type_array, r.denominator], r.registry_symbol_not_accepted_as_array_type],
        [[r.type_choice], r.registry_symbol_not_accepted],
        [[r.type_choice_shared], r.registry_symbol_not_accepted],
        [[r.type_choice_select], r.registry_symbol_not_accepted],
        [[r.type_array_chunk], r.registry_symbol_not_accepted],
        [[r.type_array_bit], r.registry_symbol_not_accepted],
        [[r.type_array_fixed], r.registry_symbol_not_accepted],
        [[r.type_optional], r.registry_symbol_not_accepted],
        [[r.parse_type_data_immediate], r.registry_symbol_not_accepted],
        [[r.nonexistent], r.registry_symbol_not_accepted],
    ])('parseError(%#)', (i, o) => {
        function f(le) {
            const er = parseError(writer(writerPrefix(i, le)))
            expect(er).toEqual({ [getRegistrySymbol(r.error)]: getRegistrySymbol(o) })
        }
        f(true)
        f(false)
    })
}
const parseTests = [
    [[r.parse_type_data, r.denominator], parse_type_data(r.denominator)],
    [[r.parse_varint, n(2)], 2],
    [[r.nonexistent], r.nonexistent],
    [[r.type_array, r.error, n(3)], array_no_children(3)],
    [[tab(2), r.error, wbs(1, 2)], array_bit_no_children(2, 1)],
    [[taf(1), r.error], array_fixed_no_children(1)],
    [[tac(4), r.error, wbs(5, 4), wbs(0, 4)], array_chunk(chunk_no_children(4, 5), chunk(4))],
    [[tc(2, r.error, r.denominator), wbs(1, 1)], choice(bit_val(1, 1))],
    [[tm(1, r.error, r.denominator)], map()],
    [[tc(2, r.error, bi(r.denominator)), wbs(1, 1)], choice(bit_val(1, 1))],
    [[tm(1, bi(r.parse_varint, 1), r.error)], map()],
    [[tcs(2, r.parse_varint, tm(1, r.error, tcs(2, r.type_array, tct(0), tct(1)))), wbs(1, 1), wbs(1, 1), wbs(0, 1), n(1), n(0)], choice_shared(bit_val(1, 1), map(choice_shared(bit_val(1, 1), choice_select(map(choice_shared(bit_val(0, 1), array(choice_select(array()))))))))],
    [[tcs(2, r.parse_varint, tm(1, tc(2, r.type_array, r.parse_varint, tct(1)), tct(0))), wbs(1, 1), wbs(1, 1), wbs(0, 1), n(1), n(2), n(3), n(4)], choice_shared(bit_val(1, 1), map(choice(bit_val(1, 1), choice_select(map(choice(bit_val(0, 1), array(2)), choice_select(3)))), choice_select(4)))],
    [[r.type_array, r.parse_varint, n(2), n(3), n(4)], array(3, 4)],
    [[tc(2, pbs(8), pbs(6)), wbs(1, 1), wbs(1, 6)], choice(bit_val(1, 1), bit_val(1, 6))],
    [[tm(4, r.parse_varint, pbs(8), pbs(6), pbs(24), pbs(48), r.parse_varint, pbs(8), r.error), 3, wbs(1, 8), wbs(2, 6), wbs(0x010403, 24), wbs(0x01040302, 32), wbs(0x0302, 16), 4, wbs(1, 8)], map(3, bit_val(1, 8), bit_val(2, 6), bit_val(0x010403, 24), bits(bit_val(0x01040302, 32), bit_val(0x0302, 16)), 4, bit_val(1, 8))],
    [[pa(8), r.type_array, r.parse_varint, wbs(0, 4), 1, 2], align(8, array(2))],
    [[tac(4), r.parse_varint, wbs(1, 4), n(2), wbs(1, 4), n(3), wbs(0, 4)], array_chunk(chunk(4, 2), chunk(4, 3), chunk(4))],
    [[tab(2), r.parse_varint, wbs(2, 2), n(3), n(4)], array_bit(2, 3, 4)],
    [[taf(2), r.parse_varint, n(3), n(5)], array_fixed(3, 5)],
    [[tc(3, r.denominator, r.error, r.error_internal), wbs(3, 2)], choice(bit_val(3, 2))],
    [[tct(10)], choice_select()],
    [[r.type_array, tm(1, r.error, r.error), n(3)], array_no_children(3)],
    [[tcs(1, r.type_array, tc(2, r.parse_varint, tct(0))), n(1), wbs(1, 1), n(1), wbs(0, 1), n(3)], choice_shared(bit_val(0, 0), array(choice(bit_val(1, 1), choice_select(array(choice(bit_val(0, 1), 3))))))],
    [[r.type_optional, r.parse_varint, wbs(0, 1)], choice(bit_val(0, 1))],
    [[r.type_optional, r.parse_varint, wbs(1, 1), n(2)], choice(bit_val(1, 1), 2)],
    [[tcs(2, tm(1, r.error, tct(1)), bi(r.parse_varint, 1)), wbs(0, 1)], choice_shared(bit_val(0, 1), map(choice_select()))],
    [[tcs(2, tm(1, r.error, tct(1)), tm(1, r.denominator, tct(0))), wbs(0, 1)], choice_shared(bit_val(0, 1), map(choice_select(map(choice_select(map(cycle()))))))],
    [[tca(1, r.parse_varint, aa(3, 4, 5, 6), r.parse_varint), wbs(1, 2)], choice(bit_val(1, 2))],
    [[tcsa(1, r.parse_varint, asa(3, 4, 5, 6), r.parse_varint), wbs(1, 2)], choice_shared(bit_val(1, 2))],
    [[tm(0)], map()],
    [[r.type_array, r.parse_bytes, n(2), n(3), wbs(0, 4), b(2), b(3), b(4), n(2), wbs(0, 4), b(5), b(6)], array(bytes(new Uint8Array([2, 3, 4])), bytes(new Uint8Array([5, 6])))],
    [[r.type_array, r.parse_text, n(2), n(3), b(2), b(3), b(4), n(2), wbs(0, 4), b(5), b(6)], array(u8Text(new Uint8Array([2, 3, 4])), u8Text(new Uint8Array([5, 6])))],
]
export const testParse = (test, expect, parse: (u8: Uint8Array) => Node) => {
    test.each(parseTests as any)('parse(%#)', (i, o) => {
        function f(le) {
            const root = parse(writer(writerPrefix(i, le)))
            const data = root.children.length == 1 ? root.children[0] : root.children[1]
            expect(strip(data)).toEqual(strip(nodeOrNum(o)))
        }
        f(true)
        f(false)
    })
}
export const testParseChunks = (test, expect, parseChunks: (u8: Uint8Array) => Node) => {
    test.each([
        [[r.parse_varint, 2], root(r.parse_varint)],
        [[bi(r.parse_varint, 2 ** 16)], root(parse_type_data_immediate(r.parse_varint, 2 ** 16))],
        [[bi(r.parse_varint, 2 ** 13)], root(parse_type_data_immediate(r.parse_varint, 2 ** 13))],
        [[bi(r.parse_bit_size, 9), wbs(513, 10)], root(parse_type_data_immediate(parse_bit_size(10), bit_val(513, 10)))],
        [[bi(r.parse_bit_size, 39), wbs(67305985, 32), wbs(1, 8)], root(parse_type_data_immediate(parse_bit_size(40), bits(bit_val(67305985, 32), bit_val(1, 8))))],
        [[bi(tm(1, r.parse_bit_size, 9, r.parse_bit_size, 39)), wbs(513, 10), wbs(2143223616, 32), wbs(192, 8)], root(parse_type_data_immediate(type_map(parse_bit_size(10), parse_bit_size(40)), map(bit_val(513, 10), bits(bit_val(2143223616, 32), bit_val(192, 8)))))],
        [[bi(tm(1, r.parse_bit_size, 9, r.parse_bit_size, 25)), wbs(513, 10), wbs(4260032, 26)], root(parse_type_data_immediate(type_map(parse_bit_size(10), parse_bit_size(26)), map(bit_val(513, 10), bit_val(4260032, 26))))],
        [[bi(r.type_array, r.parse_bytes, n(2), n(4), b(2), b(3), b(4), b(5), n(2), wbs(0, 4), b(6), b(7))], root(parse_type_data_immediate(type_array(r.parse_bytes), array(byte_chunks(bytes(new Uint8Array([2])), bytes(new Uint8Array([3])), bytes(new Uint8Array([4])), bytes(new Uint8Array([5]))), byte_chunks(bytes(new Uint8Array([6])), bytes(new Uint8Array([7]))))))]
    ])('parse_chunks(%#)', (i, o) => {
        function f(le) {
            const root = parseChunks(writer(writerPrefix(i, le)))
            expect(strip(root)).toEqual(strip(nodeOrNum(o)))
        }
        f(true)
        f(false)
    })
}
export const testWriteNodeFull = (test, expect, parse: (u8: Uint8Array) => Node, writeNodeFull: (node: Node) => Uint8Array) => {
    test.each(parseTests as any)('writeNode(%#)', (i) => {
        function f(le) {
            const b = writer(writerPrefix(i, le))
            expect(b).toEqual(writeNodeFull(parse(b)))
        }
        f(true)
        f(false)
    })
}
export const testWriteBits = (test, expect, writeBits: (s: EncoderState, x: number, size: number) => void, finishWrite: (s: EncoderState) => void) => {
    test('writeBits_little_endian', () => {
        const en = createEncoder()
        writeNode(en, { type: NodeType.parse_type_data, rootLittleEndian: true })
        writeBits(en, 4, 3)
        writeBits(en, 2 ** 12, 32)
        writeBits(en, 5, 21)
        writeBits(en, 3, 32)
        writeBits(en, 0, 32)
        finishWrite(en)
        expect(en.buffers[0]).toEqual(new Uint8Array([littleEndianPrefix, 0x04, 0x80, 0, 0, 0x28, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0]))
    })
    test('writeBits', () => {
        const en = createEncoder()
        writeBits(en, 4, 3)
        writeBits(en, 2 ** 12, 32)
        writeBits(en, 5, 29)
        writeBits(en, 0, 32)
        finishWrite(en)
        expect(en.buffers[0]).toEqual(new Uint8Array([0x80, 0, 2, 0, 0, 0, 0, 5, 0, 0, 0, 0]))
    })
}
export const testWriteBytes = (test, expect, writeBytes: (s: EncoderState, u8: Uint8Array) => void, writeBits: (s: EncoderState, x: number, size: number) => void, finishWrite: (s: EncoderState) => void) => {
    test('writeBytes', () => {
        {
            const en = createEncoder(8)
            writeBits(en, 4, 3)
            writeBits(en, 5, 7)
            writeBytes(en, new Uint8Array([1, 2, 3, 4, 5, 6, 7]))
            writeBits(en, 3, 7)
            finishWrite(en)
            expect(concatBuffers(en.buffers)).toEqual(new Uint8Array([0x81, 0x40, 1, 2, 3, 4, 5, 6, 7, 0x06]))
        }
        {
            const en = createEncoder(8)
            en.littleEndian = true
            writeBits(en, 4, 3)
            writeBits(en, 5, 7)
            writeBytes(en, new Uint8Array([1, 2, 3, 4, 5, 6, 7]))
            writeBits(en, 3, 7)
            finishWrite(en)
            expect(concatBuffers(en.buffers)).toEqual(new Uint8Array([0x2C, 0x00, 1, 2, 3, 4, 5, 6, 7, 0x03]))
        }
    })
}
export const testReadBits32 = (test, expect, readBits32: (d: DecoderState, size: number) => number) => {
    test.each([
        new Uint8Array([littleEndianPrefix, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0]),
        new Uint8Array([0xDF, 0xDF, 0xDF, 0xDF, littleEndianPrefix, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0]),
        new Uint8Array([0x10, 0x40, 24, 20, 16, 12, 16, 14]),
    ])('readBits32(%#)', (b) => {
        const ps = createFullParser()
        setParserBuffer(b, ps)
        const d = ps.decoder
        expect(readBits32(d, 4)).toBe(1)
        expect(readBits32(d, 11)).toBe(32)
        expect(readBits32(d, 32)).toBe(3 * 2 + 4 * 512 + 5 * 2 ** 17 + 6 * 2 ** 25)
        expect(readBits32(d, 17)).toBe(7 * 2 + 8 * 512)
    })
}
export const testWriteVarint = (test, expect, writeVarint: (s: EncoderState, x: number) => void, finishWrite: (s: EncoderState) => void) => {
    test('writeVarint_little_endian', () => {
        const en = createEncoder()
        writeNode(en, { type: NodeType.parse_type_data, rootLittleEndian: true })
        writeVarint(en, 8)
        writeVarint(en, 64)
        writeVarint(en, 8192)
        writeVarint(en, 2 ** 20)
        writeVarint(en, 3)
        finishWrite(en)
        expect(en.buffers[0]).toEqual(new Uint8Array([littleEndianPrefix, 0x21, 0x03, 0x02, 0x07, 0x00, 2, 0x0f, 0, 0, 0x01, 0x60]))
    })
    test('writeVarint', () => {
        const en = createEncoder()
        writeVarint(en, 8)
        writeVarint(en, 64)
        writeVarint(en, 8192)
        writeVarint(en, 2 ** 20)
        writeVarint(en, 3)
        finishWrite(en)
        expect(en.buffers[0]).toEqual(new Uint8Array([0x88, 0xC0, 0x40, 0xE0, 0x20, 0, 0xF0, 1, 0, 0, 0x03]))
    })
}
export const testReadVarint = (test, expect, readVarint: (s: DecoderState) => number) => {
    test('readVarint_little_endian', () => {
        const d = createDecoder()
        d.littleEndian = true
        d.dv = new DataView(new Uint8Array([0x21, 0x03, 0x02, 0x07, 0x00, 2, 0x0f, 0, 0, 0x01, 0x60, 0]).buffer)
        expect(readVarint(d)).toBe(8)
        expect(readVarint(d)).toBe(64)
        expect(readVarint(d)).toBe(8192)
        expect(readVarint(d)).toBe(2 ** 20)
        expect(readVarint(d)).toBe(3)
    })
    test('readVarint', () => {
        const d = createDecoder()
        d.dv = new DataView(new Uint8Array([0x88, 0xC0, 0x40, 0xE0, 0x20, 0, 0xF0, 1, 0, 0, 0x03, 0]).buffer)
        expect(readVarint(d)).toBe(8)
        expect(readVarint(d)).toBe(64)
        expect(readVarint(d)).toBe(8192)
        expect(readVarint(d)).toBe(2 ** 20)
        expect(readVarint(d)).toBe(3)
    })
}