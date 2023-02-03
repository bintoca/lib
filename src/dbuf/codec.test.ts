import { parse, write, finishWrite, map_sym, Item, createDecoder, read, createEncoder, writeBuffer, write_checked, Scope, choice_sym, array_sym, array_stream_sym, bits_sym, isError, ParseType, choice_append_sym, string_stream_sym, string_sym, block_stream_sym } from '@bintoca/dbuf/codec'
import { r, u } from '@bintoca/dbuf/registry'
import { zigzagEncode, zigzagDecode, unicodeToText, textToUnicode, getLeap_millis, getLeap_millis_tai, strip, debug, setDebug } from '@bintoca/dbuf/util'
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
    function f(y: NumOrBuf) {
        if (y instanceof Uint8Array) {
            writeBuffer(es, y)
        }
        else if (Array.isArray(y)) {
            for (let j of y) {
                f(j)
            }
        }
        else if (typeof y == 'object') {
            if (y.debug) {
                setDebug(y.debug)
            }
            else {
                write_checked(es, y.num, y.size)
            }
        }
        else if (y !== undefined) {
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
    dv.setUint32(0, 0x80FFFFFF)
    dv.setUint32(4, 0x80000000)
    dv.setUint32(8, 0x81000010)
    expect(read(createDecoder(dv))).toBe(2)
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
    const s = ' aeinost\n!"\',-./:;?ABCDEFGHIJKLMNOPQRSTUVWXYZbcdfghjklmpqruvwxyz\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f#$%&()*+0123456789<=>@[\\]^_`{|}~\x7f😀'
    for (let x of s) {
        a.push(unicodeToText(x.codePointAt(0)))
    }
    const a1 = []
    for (let i = 0; i < 128; i++) {
        a1.push(i)
    }
    a1.push(128512)
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
                const d: Scope = { type: x.type, items: x.items.map(y => strip(y)), needed: x.needed, op: undefined }
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
type NumOrBuf = number | Uint8Array | { num?: number, size?: number, debug?: string[] } | NumOrBuf[]
const b = (a: NumOrBuf, ...b: NumOrBuf[]) => [r.bind, a, ...b]
const tc = (...a: NumOrBuf[]) => [r.type_choice, ...a, r.end_scope]
const tcb = (...a: NumOrBuf[]) => [r.type_choice_bit, ...a, r.end_scope]
const tm = (...a: NumOrBuf[]) => [r.type_map, ...a, r.end_scope]
const cs = (a: Item, b?: Item) => { return { type: choice_sym, items: b === undefined ? [a] : [a, b], op: undefined } }
const tp = (...a: number[]) => { return { type: string_sym, needed: a.length, items: a, op: undefined } }
const tps = (...a: Item[]) => { return { type: string_stream_sym, items: [...a], op: undefined } }
const ms = (...a: Item[]) => { return { type: map_sym, items: [...a], op: undefined } }
const aos = (...a: Item[]) => { return { type: array_sym, items: [...a], op: undefined } }
const ass = (...a: Item[]) => { return { type: array_stream_sym, items: [...a], op: undefined } }
const bo = (...a: Item[]) => { return { type: r.bind, items: [...a], op: undefined } }
const mo = (...a: Item[]) => { return { type: r.type_map, items: [...a], op: undefined } }
const ao = (...a: Item[]) => { return { type: r.type_array, items: [...a], op: undefined } }
const ci = (...a: Item[]) => { return { type: r.type_choice_indexer, items: [...a], op: undefined } }
const ca = (...a: Item[]) => { return { type: choice_append_sym, items: [...a], op: undefined } }
const bs = (...a: number[]) => { return { type: bits_sym, items: [...a], op: undefined } }
const bv = (...a: Item[]) => { return { type: block_stream_sym, items: [...a], op: undefined } }
const dg = (x: string | string[]) => { return { debug: Array.isArray(x) ? x : [x] } }
test.each([
    [[r.bind, r.end_scope], r.error_invalid_end_scope],
    [[r.bind, r.type_choice, r.IEEE_754_binary32, r.end_scope, 3], r.error_invalid_choice_index],
    [[r.bind, r.type_choice_indexer, 0], r.error_invalid_choice_indexer],
    [[r.bind, r.type_choice, r.parse_varint], r.error_unfinished_parse_stack],
    [[r.bind, r.IEEE_754_binary32], r.error_unfinished_parse_stack],
    [[0xFFFFFF], r.error_invalid_registry_value],
])('parseError(%#)', (i, o) => {
    const er = parse(writer(i))
    if (!isError(er)) { console.log(er['items']) }
    expect((er as any).items[1].items[1].items[0]).toEqual(o)
})

test.each([
    [b(b(r.IEEE_754_binary32, u8), r.IPv4), r.IPv4],
    [b(r.parse_block_size, 0, u8), u8],
    [b(r.parse_block_variable, 1, u8), u8],
    [b(r.parse_block_variable, 0, 1, 1, 0, u8, u8), bv(u8, u8)],
    [b(r.parse_bit_variable, 8, u8), 2],
    [b(r.parse_item, r.IPv4), r.IPv4],
    [b(r.parse_varint_plus_block, 2, u8), new Uint8Array([0, 0, 0, 2, 1, 2, 3, 4])],
    [b(r.bool_bit, u8), 0],
    [b(tc()), r.placeholder],
    [b(tm()), r.placeholder],
    [b(tc(r.id, r.denominator), 1), cs(1, r.denominator)],
    [b(tm(r.id), r.denominator), ms(r.denominator)],
    [b(tm(r.id, tc(r.denominator)), r.IPv4, 0, r.IPv6), ms(r.IPv4, cs(0, r.IPv6))],
    [b(tm(b(r.id, r.parse_varint)), 2), ms(2)],
    [b(tm(b(r.id, b(r.denominator, r.parse_varint))), 2), ms(2)],
    [b(tc(r.id, b(r.denominator, r.denominator)), 1), cs(1, bo(r.denominator, r.denominator))],
    [b(tm(b(r.denominator, r.denominator)), r.IPv4), ms(r.IPv4)],
    [b(tm(b(r.text_unicode, 1, u.a)), r.IPv4), ms(r.IPv4)],
    [b(tc(r.id, b(r.text_unicode, 1, u.a)), 1), cs(1, bo(r.text_unicode, tp(u.a)))],
    [b(tc(r.id, b(tm(r.text_unicode), 1, u.a)), 1), cs(1, bo(mo(r.text_unicode), ms(tp(u.a))))],
    [b(tc(r.id, b(r.type_array, r.text_unicode), 1, 1, u.a), 1), cs(1, bo(ao(r.text_unicode), aos(tp(u.a))))],
    [b(tc(r.id, b(r.type_array, r.text_unicode), 0, 1, 1, u.a, 0), 1), cs(1, bo(ao(r.text_unicode), ass(aos(tp(u.a)))))],
    [b(r.parse_none, b(r.IEEE_754_binary32, u8)), bo(r.IEEE_754_binary32, u8)],
    [b(tc(r.parse_varint, r.type_choice_indexer), 1, 0, 2), cs(1, ci(cs(0, 2)))],
    [b(tc(r.parse_varint, tc(r.text_unicode, r.type_choice_indexer)), 1, 1, 0, 1, u.a), cs(1, cs(1, ci(cs(0, tp(u.a)))))],
    [b(tc(r.parse_varint, tm(tc(r.text_unicode, r.type_choice_indexer), r.type_choice_indexer)), 1, 1, 0, 1, u.e, 0, 5), cs(1, ms(cs(1, ci(cs(0, tp(u.e)))), ci(cs(0, 5))))],
    [b(tc(r.IEEE_754_binary32, tc(r.parse_varint, r.integer_signed)), 1, 1), cs(1, cs(1, 0))],
    [b(r.type_array, r.parse_varint, 0, 2, 3, 4, 1, 5, 0), ass(aos(3, 4), aos(5))],
    [b(r.type_array, tm(r.IEEE_754_binary32, tc(r.parse_varint, r.integer_signed)), 1, u8, 1), aos(ms(u8, cs(1, 0)))],
    [b(tm(r.IEEE_754_binary32, r.type_array, tc(r.parse_varint, r.integer_signed)), u8, 2, 0, 5, 1), ms(u8, aos(cs(0, 5), cs(1, 0)))],
    [b(tm(r.parse_varint, r.parse_bit_size, 7, r.parse_bit_size, 7, r.parse_bit_size, 23, r.parse_bit_size, 47, r.parse_varint, r.parse_bit_size, 7), 3, u8, u8, u8, 4, u8), ms(3, 1, 2, 0x030401, bs(0x02030401, 0x0203, 16), 4, 1)],
    [b(tc(r.parse_bit_size, 7, r.parse_bit_size, 5), 0, u8), cs(0, 1)],
    [b(tcb(r.parse_bit_size, 7, r.parse_bit_size, 5), u8), cs(0, 2)],
    [b(tm(b(r.parse_varint, 14)), b(r.parse_varint, 2)), ms(bo(r.parse_varint, 2))],
    [b(tm(b(r.id, r.parse_none, b(r.text_unicode, 1, u.a)))), ms(bo(r.text_unicode, tp(u.a)))],
    [b(tm(b(r.id, r.type_array, r.parse_varint), r.denominator), 2, 3, 4, r.IPv4), ms(aos(3, 4), r.IPv4)],
    [b(tc(r.parse_varint, b(r.id, r.type_choice_indexer)), 1, 0, 2), cs(1, ci(cs(0, 2)))],
    [b(r.type_array, r.placeholder, 1, r.IPv4), aos(r.IPv4)],
    [b(b(r.quote_next, r.IEEE_754_binary32, r.parse_varint), 3), 3],
    [b(b(r.quote_next, r.IEEE_754_binary32, r.parse_item), r.IPv4), r.IPv4],
    [b(b(b(r.offset_add, b(r.parse_varint, 5)), r.IEEE_754_binary32), u8), u8],
    [b(r.type_array, tc(r.parse_varint, b(r.delta, r.parse_varint), b(r.delta, r.integer_negative), r.repeat_count), 4, 0, 5, 1, 2, 2, 1, 5), aos(cs(0, 5), cs(1, 2), cs(2, 1), cs(5, 2))],
    [b(r.type_array, tc(r.parse_varint, r.type_choice_append), 3, 1, r.IEEE_754_binary32, 2, u8, 0, 4), aos(cs(1, ca(r.IEEE_754_binary32)), cs(2, u8), cs(0, 4))],
    [b(r.text_unicode, 5, u.a, u.e, u.i, u.n, u.o), tp(u.a, u.e, u.i, u.n, u.o)],
    [b(r.text_unicode, 0, 5, u.a, u.e, u.i, u.n, u.o, 3, u.a, u.n, u.o, 0), tps(tp(u.a, u.e, u.i, u.n, u.o), tp(u.a, u.n, u.o))],
])('parse_strip(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        if (typeof s == 'number') {
            expect(s).toEqual(o)
        }
        else if (isError(s)) {
            expect('error ' + (s as any).items[1].items[1].items).toEqual(strip(o))
        }
        else {
            const ou = (s as Scope).items[1]
            expect(strip(ou)).toEqual(strip(o))
        }
    }
    catch (e) {
        debug('parse_strip', w)
        throw e
    }
})