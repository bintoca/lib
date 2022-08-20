import { parse, write, finishWrite, structure_sym, Item, createDecoder, read, createEncoder, writeBuffer, write_checked, Scope, choice_sym, collection_sym, collection_stream_sym, bits_sym, isError } from '@bintoca/dbuf/codec'
import { r, u } from '@bintoca/dbuf/registry'
import { zigzagEncode, zigzagDecode, unicodeToText, textToUnicode, getLeap_millis, getLeap_millis_tai, strip } from '@bintoca/dbuf/util'
const dv = new DataView(new ArrayBuffer(8))
test('float', () => {
    dv.setFloat32(0, 1, true)
    //console.log(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
    expect(dv.getUint8(0)).toBe(0)
    expect(dv.getUint8(1)).toBe(0)
    expect(dv.getUint8(2)).toBe(128)
    expect(dv.getUint8(3)).toBe(63)
})
const writer = (x: NumOrBuf) => {
    const es = createEncoder()
    function f(y) {
        if (y instanceof Uint8Array) {
            writeBuffer(es, y)
        }
        else if (Array.isArray(y)) {
            for (let j of y) {
                f(j)
            }
        }
        else {
            write_checked(es, y)
        }
    }
    f(x)
    finishWrite(es)
    return es.buffers[0]
}
const mesh: number[][][] = []
for (let i = 0; i < 256; i++) {
    let x = 0
    let c = 0
    const n = []
    for (let j = 0; j < 8; j++) {
        if (x == (i >>> j) % 2) {
            c++
        }
        else {
            if (c) {
                n.push(c)
            }
            x = x == 0 ? 1 : 0
            c = 1
        }
    }
    n.push(c)
    if (n.reduce((a, b) => a + b) != 8) {
        throw n
    }
    mesh[i] = [[1].concat(n.map(x => 1 << ((x - 1) * 3)).concat(n.map(x => 1 << ((x - 1) * 3))))]
}
mesh.push([[1, 2, 3, 4, 5, 6, 7, 2 ** 32 - 1]])
test.each(mesh)('read/write(%#)', (i) => {
    const es = createEncoder()
    for (let x of i) {
        write(es, x)
    }
    finishWrite(es)
    const ds = createDecoder(es.buffers[0])
    const o = []
    while (o.length < i.length) {
        o.push(read(ds))
    }
    expect(o).toEqual(i)
})
test('overflow', () => {
    const dv = new DataView(new ArrayBuffer(12))
    dv.setUint32(0, 0x00FFFFFF)
    dv.setUint32(4, 0x00000000)
    dv.setUint32(8, 0x01000010)
    expect(read(createDecoder(dv))).toBe(2)
})
test('stream_start', () => {
    const dv = new DataView(new ArrayBuffer(12))
    dv.setUint32(0, 0x80000000)
    const er = parse(dv)
    expect((er as any).items[1].items[1].items[0]).toEqual(r.error_stream_start_bit)
})
test.each([[[-2, -1, 0, 1, 2, 2147483647, -2147483648]]])('zigzag', (i) => {
    const es = createEncoder()
    for (let x of i) {
        write(es, zigzagEncode(x))
    }
    finishWrite(es)
    const ds = createDecoder(es.buffers[0])
    const o = []
    while (o.length < i.length) {
        o.push(zigzagDecode(read(ds)))
    }
    expect(o).toEqual(i)
})
test('stringText', () => {
    for (let i = 0; i < 256; i++) {
        expect(textToUnicode(unicodeToText(i))).toBe(i)
    }
    const a = []
    const s = ' aeinot\n!"\',-./:?ABCXYZabcxyz\0~😀'
    for (let x of s) {
        a.push(unicodeToText(x.codePointAt(0)))
    }
    const a1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 41, 42, 43, 2, 44, 45, 61, 62, 63, 64, 127, 128513]
    expect(a).toEqual(a1)
    expect(String.fromCodePoint(...a1.map(x => textToUnicode(x)))).toEqual(s)
})
test('magicNumber', () => {
    const dv = new DataView(new ArrayBuffer(4))
    dv.setUint8(1, 'D'.codePointAt(0))
    dv.setUint8(2, 'B'.codePointAt(0))
    dv.setUint8(3, 'U'.codePointAt(0))
    expect(dv.getUint32(0)).toBe(r.magic_number)
})
test.each([[-(10 * 365) * 86400, -9], [0, -9], [(10 * 365 + 1) * 86400, -1], [(10 * 365 + 2) * 86400, 0], [(10 * 365 + 7) * 86400, 0], [(11 * 365 + 3 + 181) * 86400, 1]])('leap', (d, o) => {
    expect(getLeap_millis(d * 1000)).toBe(o * 1000)
})
test.each([[-(20 * 365) * 86400, -9], [-(6) * 86400, -1], [-1, 0], [0, 0], [(366 + 181 - 5) * 86400 + 1, 1]])('leap_reverse', (d, o) => {
    expect(getLeap_millis_tai(d * 1000)).toBe(o * 1000)
})
test.each([[[r.IPv4, r.end_scope], r.IPv4]])('early end', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        expect(s).toEqual(o)
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
const u8 = new Uint8Array([1, 2, 3, 4])
test.each([
    [[r.IPv4], r.IPv4],
    [[r.magic_number, r.IPv4], { type: r.magic_number, needed: 1, items: [r.IPv4] }],
])('parse(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        function strip(x: Item) {
            if (typeof x == 'object') {
                if (x instanceof Uint8Array) {
                    return x
                }
                const d: Scope = { type: x.type, items: x.items.map(y => strip(y)), needed: x.needed, op: x.op, ops: x.ops, inText: x.inText }
                if (d.op?.item) {
                    d.op.item = undefined
                }
                return d
            }
            return x
        }
        //console.log(s.items[0])
        expect(strip(s)).toEqual(o)
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
type NumOrBuf = number | Uint8Array | NumOrBuf[]
const b = (a: NumOrBuf, ...b: NumOrBuf[]) => [r.bind, a, ...b]
const tc = (...a: NumOrBuf[]) => [r.type_choice, ...a, r.end_scope]
const ts = (...a: NumOrBuf[]) => [r.type_structure, ...a, r.end_scope]
const cs = (a: number, b?: Item) => { return { type: choice_sym, items: b === undefined ? [a] : [a, b] } }
const tp = (...a: number[]) => { return { type: r.text_plain, items: [...a] } }
const ss = (...a: Item[]) => { return { type: structure_sym, items: [...a] } }
const cos = (...a: Item[]) => { return { type: collection_sym, items: [...a] } }
const css = (...a: Item[]) => { return { type: collection_stream_sym, items: [...a] } }
const bo = (...a: Item[]) => { return { type: r.bind, items: [...a] } }
const so = (...a: Item[]) => { return { type: r.type_structure, items: [...a] } }
const co = (...a: Item[]) => { return { type: r.type_collection, items: [...a] } }
const bs = (...a: number[]) => { return { type: bits_sym, items: [...a] } }
test.each([
    [b(b(r.IEEE_754_binary, u8), r.IPv4), r.IPv4],
    [b(r.parse_block_size, 0, u8), u8],
    [b(r.parse_block_variable, 0, u8), u8],
    [b(r.parse_bit_variable, 8, u8), 2],
    [b(r.parse_item, r.IPv4), r.IPv4],
    [b(r.parse_varint_plus_block, 2, u8), new Uint8Array([0, 0, 0, 2, 1, 2, 3, 4])],
    [b(r.TAI_seconds, u8), u8],
    [b(tc()), r.placeholder],
    [b(ts()), r.placeholder],
    [b(tc(r.numerator, r.denominator), 1), cs(1, r.denominator)],
    [b(ts(r.numerator), r.denominator), ss(r.denominator)],
    [b(ts(r.numerator, tc(r.denominator)), r.IPv4, 0, r.IPv6), ss(r.IPv4, cs(0, r.IPv6))],
    [b(ts(b(r.numerator, r.integer_unsigned)), 2), ss(2)],
    [b(ts(b(r.numerator, b(r.denominator, r.integer_unsigned))), 2), ss(2)],
    [b(tc(r.numerator, b(r.denominator, r.denominator)), 1), cs(1, bo(r.denominator, r.denominator))],
    [b(ts(b(r.denominator, r.denominator)), r.IPv4), ss(r.IPv4)],
    [b(ts(b(r.text_plain, u.a, u.end_scope)), r.IPv4), ss(r.IPv4)],
    [b(tc(r.numerator, b(r.text_plain, u.a, u.end_scope)), 1), cs(1, bo(r.text_plain, tp(u.a)))],
    [b(tc(r.numerator, b(ts(r.text_plain), u.a, u.end_scope)), 1), cs(1, bo(so(r.text_plain), ss(tp(u.a))))],
    [b(tc(r.numerator, b(r.type_collection, r.text_plain), 1, u.a, u.end_scope), 1), cs(1, bo(co(r.text_plain), cos(tp(u.a))))],
    [b(tc(r.numerator, b(r.type_collection, r.text_plain), 0, 1, u.a, u.end_scope, 0), 1), cs(1, bo(co(r.text_plain), css(cos(tp(u.a)))))],
    [b(r.parse_none, b(r.IEEE_754_binary, u8)), bo(r.IEEE_754_binary, u8)],
    [b(tc(r.integer_unsigned, r.type_choice_index), 1, 0, 2), cs(1, cs(0, 2))],
    [b(tc(r.integer_unsigned, tc(r.text_plain, r.type_choice_index)), 1, 1, 0, u.a, u.end_scope), cs(1, cs(1, cs(0, tp(u.a))))],
    [b(tc(r.integer_unsigned, ts(tc(r.text_plain, r.type_choice_index), r.type_choice_index)), 1, 1, 0, u.e, u.end_scope, 0, 5), cs(1, ss(cs(1, cs(0, tp(u.e))), cs(0, 5)))],
    [b(tc(r.IEEE_754_binary, tc(r.integer_unsigned, r.integer_signed)), 1, 1), cs(1, cs(1, 0))],
    [b(r.type_collection, r.integer_unsigned, 0, 2, 3, 4, 1, 5, 0), css(cos(3, 4), cos(5))],
    [b(r.type_collection, ts(r.IEEE_754_binary, tc(r.integer_unsigned, r.integer_signed)), 1, u8, 1), cos(ss(u8, cs(1, 0)))],
    [b(ts(r.IEEE_754_binary, r.type_collection, tc(r.integer_unsigned, r.integer_signed)), u8, 1, 1), ss(u8, cos(cs(1, 0)))],
    [b(ts(r.integer_unsigned, r.parse_bit_size, 7, r.parse_bit_size, 7, r.parse_bit_size, 23, r.parse_bit_size, 47, r.integer_unsigned, r.parse_bit_size, 7), 3, u8, u8, u8, 4, u8), ss(3, 1, 2, 0x030401, bs(0x02030401, 0x0203, 16), 4, 1)],
    [b(tc(r.parse_bit_size, 7, r.parse_bit_size, 5), u8), cs(0, 2)]
])('parse_strip(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        if (typeof s == 'number') {
            expect(s).toEqual(o)
        }
        else if (isError(s)) {
            expect('error ' + (s as any).items[1].items[1].items).toEqual(o)
        }
        else {
            const ou = (s as Scope).items[1]
            expect(strip(ou)).toEqual(o)
        }
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
test.each([
    [[r.bind, r.end_scope], r.error_invalid_end_scope],
    [[r.bind, r.type_choice, r.IEEE_754_binary, r.end_scope, 3], r.error_invalid_choice_index],
    [[r.bind, r.type_choice, r.integer_unsigned], r.error_unfinished_parse_stack],
    [[r.bind, r.IEEE_754_binary], r.error_unfinished_parse_stack],
    [[r.bind, r.text_plain, 0xFFFFFF], r.error_invalid_text_value],
    [[0xFFFFFF], r.error_invalid_registry_value],
])('parseError(%#)', (i, o) => {
    const er = parse(writer(i))
    expect((er as any).items[1].items[1].items[0]).toEqual(o)
})