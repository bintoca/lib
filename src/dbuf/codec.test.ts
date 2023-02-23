import { parse, write, finishWrite, Item, createDecoder, read, createEncoder, writeBuffer, write_checked, Scope, isError, ScopeType } from '@bintoca/dbuf/codec'
import { r, u } from '@bintoca/dbuf/registry'
import { zigzagEncode, zigzagDecode, unicodeToText, textToUnicode, getLeap_millis, getLeap_millis_tai, strip, debug, setDebug, unicodeOrdering, bufToU8 } from '@bintoca/dbuf/util'
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
    const s = unicodeOrdering + '😀'
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
    dv.setUint8(0, 15)
    dv.setUint8(1, 4)
    dv.setUint8(2, '@'.codePointAt(0))
    dv.setUint8(3, 'D'.codePointAt(0))
    expect(bufToU8(dv)).toEqual(writer([{ num: r.magic_number, size: 4 }, { num: r.magic_number, size: 4 }]))
})
const magicNumberTest = () => {
    for (let i = 64; i < 128; i++) {
        const b = writer([{ num: i, size: 4 }, { num: i, size: 4 }])
        console.log(i, b, new TextDecoder().decode(b))
    }
}
//magicNumberTest()
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
    [[r.magic_number, r.IPv4], { type: ScopeType.magic_number, needed: 1, items: [r.IPv4] }],
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
const tmc = (...a: NumOrBuf[]) => [r.type_map_columns, ...a, r.end_scope]
const tb = (...a: NumOrBuf[]) => [r.type_bool, ...a, r.end_scope]
const cs = (a: Item, b?: Item) => { return { type: ScopeType.choice, items: b === undefined ? [a] : [a, b], op: undefined } }
const tp = (...a: number[]) => { return { type: ScopeType.string, needed: a.length, items: a, op: undefined } }
const tps = (...a: Item[]) => { return { type: ScopeType.string_stream, items: [...a], op: undefined } }
const ms = (...a: Item[]) => { return { type: ScopeType.map, items: [...a], op: undefined } }
const aos = (...a: Item[]) => { return { type: ScopeType.array, items: [...a], op: undefined } }
const ass = (...a: Item[]) => { return { type: ScopeType.array_stream, items: [...a], op: undefined } }
const bo = (...a: Item[]) => { return { type: ScopeType.bind, items: [...a], op: undefined } }
const ci = (...a: Item[]) => { return { type: ScopeType.type_choice_indexer, items: [...a], op: undefined } }
const bs = (...a: number[]) => { return { type: ScopeType.bits, items: [...a], op: undefined } }
const bv = (...a: Item[]) => { return { type: ScopeType.block_stream, items: [...a], op: undefined } }
const qn = (...a: Item[]) => { return { type: ScopeType.quote_next, items: [...a], op: undefined } }
const mn = (...a: Item[]) => { return { type: ScopeType.magic_number, items: [...a], op: undefined } }
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
    expect((er as any).items[1].items[1]).toEqual(o)
})
{


























































































}
test.each([
    [b(r.magic_number, r.IPv4), mn(r.IPv4)],
    [b(r.parse_block_size, 0, u8), u8],
    [b(r.parse_block_variable, 1, u8), u8],
    [b(r.parse_block_variable, 0, 1, u8, u8, 1, 0), bv(u8, u8)],
    [b(r.parse_bit_variable, 8, u8), 2],
    [b(r.parse_item, r.IPv4), r.IPv4],
    [b(r.parse_varint_plus_block, 2, u8), new Uint8Array([0, 0, 0, 2, 1, 2, 3, 4])],
    [b(r.bool_bit, u8), 0],
    [b(tc()), r.placeholder],
    [b(tm()), r.placeholder],
    [b(tc(r.id, r.denominator), 1), cs(1, r.denominator)],
    [b(tm(r.id)), ms(r.id)],
    [b(tm(r.id, r.parse_item, tc(r.denominator)), r.IPv4, 0), ms(r.id, r.IPv4, cs(0, r.denominator))],
    [b(tm(r.id, r.parse_varint), 2), ms(r.id, 2)],
    [b(tc(r.id, b(r.denominator)), 1), cs(1, bo(r.denominator, r.denominator))],
    [b(tm(b(r.text_unicode, 1, u.a))), ms(bo(r.text_unicode, tp(u.a)))],
    [b(tc(r.parse_varint, r.type_choice_indexer), 1, 0, 2), cs(1, ci(cs(0, 2)))],
    [b(tc(r.parse_varint, tc(r.text_unicode, r.type_choice_indexer)), 1, 1, 0, 1, u.a), cs(1, cs(1, ci(cs(0, tp(u.a)))))],
    [b(tc(r.parse_varint, tm(tc(r.text_unicode, r.type_choice_indexer), r.type_choice_indexer)), 1, 1, 0, 1, u.e, 0, 5), cs(1, ms(cs(1, ci(cs(0, tp(u.e)))), ci(cs(0, 5))))],
    [b(tc(r.IEEE_754_binary32, tc(r.parse_varint, r.integer_signed)), 1, 1), cs(1, cs(1, 0))],
    [b(r.type_array, r.parse_varint, 0, 2, 3, 4, 1, 5, 0), ass(aos(3, 4), aos(5))],
    [b(r.type_array, tm(r.IEEE_754_binary32, tc(r.parse_varint, r.integer_signed)), 1, u8, 1), aos(ms(u8, cs(1, 0)))],
    [b(tm(r.IEEE_754_binary32, r.type_array, tc(r.parse_varint, r.integer_signed)), u8, 2, 0, 5, 1), ms(u8, aos(cs(0, 5), cs(1, 0)))],
    [b(tc(r.parse_bit_size, 7, r.parse_bit_size, 5), 0, u8), cs(0, 1)],
    [b(tcb(r.parse_bit_size, 7, r.parse_bit_size, 5), u8), cs(0, 2)],
    [b(r.type_array, r.parse_item, 1, r.IPv4), aos(r.IPv4)],
    [b(r.parse_item, r.quote_next, r.type_choice), qn(r.type_choice)],
    [b(r.text_unicode, 5, u.a, u.e, u.i, u.n, u.o), tp(u.a, u.e, u.i, u.n, u.o)],
    [b(r.text_unicode, 0, 5, u.a, u.e, u.i, u.n, u.o, 3, u.a, u.n, u.o, 0), tps(tp(u.a, u.e, u.i, u.n, u.o), tp(u.a, u.n, u.o))],
    [b(tm(r.parse_varint, r.parse_bit_size, 7, r.parse_bit_size, 7, r.parse_bit_size, 23, r.parse_bit_size, 47, r.parse_varint, r.parse_bit_size, 7), u8, u8, u8, 3, 4), ms(3, 1, 2, 0x030401, bs(0x02030401, 0x0203, 16), 4, 4)],
    [b(tm(r.parse_bit_size, 7, r.flush_bits, r.parse_bit_size, 15), u8, u8), ms(1, r.flush_bits, 0x0102)],
    [b(tb(r.id, r.sub_authority), 2), 2],
    [b(tmc(r.id)), ms(r.id)],
])('parse_strip(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        if (typeof s == 'number') {
            expect(s).toEqual(o)
        }
        else if (isError(s)) {
            console.log(w)
            expect('error ' + (s as any).items[1].items).toEqual(strip(o))
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