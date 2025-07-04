import { finishWrite, readVarint, createEncoder, NodeType, setParserBuffer, writeBits, createDecoder, readBits32, alignDecoder, alignEncoder, bit_val, val, val_size, littleEndianPrefix, parseCore, writeBytes } from '@bintoca/dbuf/codec'
import { getRegistrySymbol, registryError } from '@bintoca/dbuf/registry'
import { r } from './registryEnum'
import { getLeap_millis, getLeap_millis_tai, strip, bufToU8, bufToDV, concatBuffers } from '@bintoca/dbuf/util'
import { parseFull, createFullParser as createParser, WriterToken, writer, writerPrefix, writeNode, writeVarintChecked, nodeOrNum, array, chunk, chunk_no_children, array_bit, array_bit_no_children, array_fixed, array_fixed_no_children, align, array_no_children, array_chunk, parse_type_data_immediate, bits, choice_select, choice, map, type_map, parse_bit_size, root, unpack, type_array, cycle, parse_align, type_array_bit, type_array_fixed, type_array_chunk, type_choice, type_optional, type_choice_shared, type_choice_select, choice_shared, type_choice_array, type_choice_shared_array, cycleSymbol, bits_le, refineValues, valSymbol, bitSizeSymbol, string, char, parse_type_data, trimBuffer, pack, bytes, byte_chunks, u8Text, u8Text_chunks } from './pack'

const sym_value = getRegistrySymbol(r.value)
const sym_denominator = getRegistrySymbol(r.denominator)
test('magicNumber', () => {
    const dv = new DataView(new ArrayBuffer(4))
    dv.setUint8(0, 0xDF)
    dv.setUint8(1, 0xDF)
    dv.setUint8(2, 0xDF)
    dv.setUint8(3, 0xDF)
    expect(bufToU8(dv)).toEqual(writer([r.magic_number, r.magic_number]).slice(0, 4))
})
test.each([['1970-01-01T00:00:00Z', 10], ['1972-12-31T23:59:59Z', 11], ['1973-01-01T00:00:00Z', 12]])('leap', (d, o) => {
    expect(getLeap_millis(Date.parse(d))).toBe(o * 1000)
})
test.each([['1970-01-01T00:00:00Z', 10], ['1972-12-31T23:59:59Z', (3 * 365 + 1) * 86400 + 11 - 1], ['1973-01-01T00:00:00Z', (3 * 365 + 1) * 86400 + 11], ['1973-01-01T00:00:00Z', (3 * 365 + 1) * 86400 + 12]])('leap_reverse', (d, o) => {
    expect(o * 1000 - getLeap_millis_tai(o * 1000)).toBe(Date.parse(d))
})
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
test.each([
    [[r.type_choice, 33], r.incomplete_stream],
])('parseError(%#)', (i, o) => {
    {
        const st = createParser()
        setParserBuffer(writer(writerPrefix(i, false)), st)
        parseFull(st)
        if (!st.error) { console.log(st.container.children) }
        expect(st.error).toEqual(registryError(o))
    }
    {
        const st = createParser()
        setParserBuffer(writer(writerPrefix(i, true)), st)
        parseFull(st)
        if (!st.error) { console.log(st.container.children) }
        expect(st.error).toEqual(registryError(o))
    }
})
{



































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
    [[tc(3, r.IEEE_754_binary32, r.IEEE_754_binary64, r.IEEE_754_binary16), wbs(3, 2)], choice(bit_val(3, 2))],
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
test.each(parseTests as any)('parse(%#)', (i, o) => {
    {
        const st = createParser()
        const w = writer(writerPrefix(i, false))
        setParserBuffer(w, st)
        try {
            parseFull(st)
            const s = st.root
            if (st.error) {
                console.log(w, st.nodeStack, st.error)
                expect('error ' + st.error).toEqual(o)
            }
            else {
                const ou = s.children.length == 1 ? s.children[0] : s.children[1]
                //console.log(nodeToString(ou))
                expect(strip(ou)).toEqual(strip(nodeOrNum(o)))
            }
        }
        catch (e) {
            throw e
        }
    }
    {
        const st = createParser()
        const w = writer(writerPrefix(i, true))
        setParserBuffer(w, st)
        try {
            parseFull(st)
            const s = st.root
            if (st.error) {
                console.log(w, st.nodeStack, st.error)
                expect('error ' + st.error).toEqual(o)
            }
            else {
                const ou = s.children.length == 1 ? s.children[0] : s.children[1]
                //console.log(nodeToString(ou))
                expect(strip(ou)).toEqual(strip(nodeOrNum(o)))
            }
        }
        catch (e) {
            throw e
        }
    }
})
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
    {
        const w = writer(writerPrefix(i, false))
        try {
            const st = createParser()
            st.root.needed = 1
            const dvs = bufToDV(w)
            for (let i = 0; i < w.byteLength; i++) {
                const dvd = new DataView(new ArrayBuffer(1))
                dvd.setUint8(0, dvs.getUint8(i))
                setParserBuffer(dvd, st)
                st.error = undefined
                parseFull(st)
            }
            const s = st.root
            if (st.error) {
                console.log(w, st.error)
                expect('error ' + st.error).toEqual(o)
            }
            else {
                expect(strip(s)).toEqual(strip(o))
            }
        }
        catch (e) {
            throw e
        }
    }
    {
        const w = writer(writerPrefix(i, true))
        try {
            const st = createParser()
            st.root.needed = 1
            const dvs = bufToDV(w)
            for (let i = 0; i < w.byteLength; i++) {
                const dvd = new DataView(new ArrayBuffer(1))
                dvd.setUint8(0, dvs.getUint8(i))
                setParserBuffer(dvd, st)
                st.error = undefined
                parseFull(st)
            }
            const s = st.root
            if (st.error) {
                console.log(w)
                expect('error ' + st.error).toEqual(o)
            }
            else {
                expect(strip(s)).toEqual(strip(o))
            }
        }
        catch (e) {
            throw e
        }
    }
})
test.each(parseTests as any)('writeNode(%#)', (i) => {
    {
        const st = createParser()
        const w = writer(writerPrefix(i, false))
        setParserBuffer(w, st)
        try {
            parseFull(st)
            const s = st.root
            if (st.error) {
                console.log(w, st.nodeStack)
                throw st.error
            }
            else {
                const es = createEncoder()
                writeNode(es, s)
                finishWrite(es)
                //console.log(s.items[1])//, s.items[1])
                expect(w).toEqual(trimBuffer(es))
            }
        }
        catch (e) {
            throw e + '_be'
        }
    }
    {
        const st = createParser()
        const w = writer(writerPrefix(i, true))
        setParserBuffer(w, st)
        try {
            parseFull(st)
            const s = st.root
            if (st.error) {
                console.log(w, st.nodeStack)
                throw st.error
            }
            else {
                const es = createEncoder()
                writeNode(es, s)
                finishWrite(es)
                //console.log(s.items[1])//, s.items[1])
                expect(w).toEqual(trimBuffer(es))
            }
        }
        catch (e) {
            throw e + '_le'
        }
    }
})
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
test.each([
    new Uint8Array([littleEndianPrefix, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0]),
    new Uint8Array([0xDF, 0xDF, 0xDF, 0xDF, littleEndianPrefix, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0]),
    new Uint8Array([0x10, 0x40, 24, 20, 16, 12, 16, 14]),
])('readBits32', (b) => {
    const ps = createParser()
    setParserBuffer(b, ps)
    const d = ps.decoder
    expect(readBits32(d, 4)).toBe(1)
    expect(readBits32(d, 11)).toBe(32)
    expect(readBits32(d, 32)).toBe(3 * 2 + 4 * 512 + 5 * 2 ** 17 + 6 * 2 ** 25)
    expect(readBits32(d, 17)).toBe(7 * 2 + 8 * 512)
})
test('writeVarint_little_endian', () => {
    const en = createEncoder()
    writeNode(en, { type: NodeType.parse_type_data, rootLittleEndian: true })
    writeVarintChecked(en, 8)
    writeVarintChecked(en, 64)
    writeVarintChecked(en, 8192)
    writeVarintChecked(en, 2 ** 20)
    writeVarintChecked(en, 3)
    finishWrite(en)
    expect(en.buffers[0]).toEqual(new Uint8Array([littleEndianPrefix, 0x21, 0x03, 0x02, 0x07, 0x00, 2, 0x0f, 0, 0, 0x01, 0x60]))
})
test('writeVarint', () => {
    const en = createEncoder()
    writeVarintChecked(en, 8)
    writeVarintChecked(en, 64)
    writeVarintChecked(en, 8192)
    writeVarintChecked(en, 2 ** 20)
    writeVarintChecked(en, 3)
    finishWrite(en)
    expect(en.buffers[0]).toEqual(new Uint8Array([0x88, 0xC0, 0x40, 0xE0, 0x20, 0, 0xF0, 1, 0, 0, 0x03]))
})
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
    [[0x01, 0x02, 0x03, 0x04, 0x05, 0x06], false, 0x010203040506n],
    [[0x01, 0x02, 0x03, 0x04, 0x05, 0x06], true, 0x060504030201n],
])('unpack_bigint(%#)', (i, l, o) => {
    const st = createParser()
    setParserBuffer(writer(writerPrefix([pbs(48)].concat(i.map(x => wbs(x, 8))), l)), st)
    parseFull(st)
    const a = refineValues(unpack(st.root))
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
test.each([
    [[r.type_array, tm(1, r.error, r.error)], r.registry_symbol_not_accepted_as_array_type],
    [[r.type_array, r.parse_align, 5], r.registry_symbol_not_accepted_as_array_type],
    [[r.type_array, r.value], r.registry_symbol_not_accepted_as_array_type],
    [[r.type_choice], r.registry_symbol_not_accepted],
    [[r.type_choice_shared], r.registry_symbol_not_accepted],
    [[r.type_choice_select], r.registry_symbol_not_accepted],
    [[r.type_array_chunk], r.registry_symbol_not_accepted],
    [[r.type_array_bit], r.registry_symbol_not_accepted],
    [[r.type_array_fixed], r.registry_symbol_not_accepted],
    [[r.type_optional], r.registry_symbol_not_accepted],
    [[r.parse_type_data_immediate], r.registry_symbol_not_accepted],
    [[r.nonexistent], r.registry_symbol_not_accepted],
])('parseLite(%#)', (i, o) => {
    {
        const st = createParser()
        st.liteProfile = true
        const w = writer(writerPrefix(i, false))
        setParserBuffer(w, st)
        try {
            let max = 100
            while (max) {
                parseCore(st)
                if (st.codecError !== undefined) {
                    break
                }
                max--
            }
            expect(st.codecError).toEqual(o)
        }
        catch (e) {
            throw e
        }
    }
})