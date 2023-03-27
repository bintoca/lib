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
    dv.setUint8(1, 0)
    dv.setUint8(2, 128)
    dv.setUint8(3, 8)
    expect(bufToU8(dv)).toEqual(writer([{ num: r.flush_bits, size: 4 }, { num: r.flush_bits, size: 4 }]))
})
const magicNumberTest = () => {
    for (let i = 8; i < 21; i++) {
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
const u8 = new Uint8Array([1, 2, 3, 4])
type NumOrBuf = number | Uint8Array | { num?: number, size?: number, debug?: string[] } | NumOrBuf[]
const a = (a: NumOrBuf, ...b: NumOrBuf[]) => [a, ...b]
const bi = (a: NumOrBuf, ...b: NumOrBuf[]) => [r.bind, a, ...b]
const tc = (len: number, ...a: NumOrBuf[]) => [r.type_choice, len, ...a]
const tcb = (size: number, len: number, ...a: NumOrBuf[]) => [r.type_choice_bit, size, len, ...a]
const tm = (len: number, ...a: NumOrBuf[]) => [r.type_map, len, ...a]
const tmc = (len: number, ...a: NumOrBuf[]) => [r.type_map_columns, len, ...a]
const cs = (a: Item, b?: Item) => { return { type: ScopeType.choice, items: b === undefined ? [a] : [a, b], op: undefined } }
const ms = (...a: Item[]) => { return { type: ScopeType.map, items: [...a], op: undefined } }
const aos = (...a: Item[]) => { return { type: ScopeType.array, items: [...a], op: undefined } }
const ass = (...a: Item[]) => { return { type: ScopeType.array_stream, items: [...a], op: undefined } }
const bo = (...a: Item[]) => { return { type: ScopeType.bind, items: [...a], op: undefined } }
const ci = (...a: Item[]) => { return { type: ScopeType.type_choice_indexer, items: [...a], op: undefined } }
const bs = (...a: number[]) => { return { type: ScopeType.bits, items: [...a], op: undefined } }
const fb = (...a: Item[]) => { return { type: ScopeType.flush_bits, items: [...a], op: undefined } }
const dg = (x: string | string[]) => { return { debug: Array.isArray(x) ? x : [x] } }
test.each([
    [[r.type_choice, 1, r.IEEE_754_binary32, 3], r.error_invalid_choice_index],
    [[r.type_choice_indexer, 0], r.error_invalid_choice_indexer],
    [[r.type_choice, 3], r.error_unfinished_parse_stack],
    [[0xFFFFFF], r.error_invalid_registry_value],
    [[r.type_choice_bit, 32], r.error_invalid_choice_bit_size],
    [[r.type_array_bit, 32], r.error_invalid_array_bit_size],
])('parseError(%#)', (i, o) => {
    const er = parse(writer(i))
    if (!isError(er)) { console.log(er['items']) }
    expect((er as any).items[1].items[0]).toEqual(o)
})
{

































}
test.each([
    [a(r.parse_bind, r.IPv4), bo(r.IPv4, r.IPv4)],
    [a(r.parse_varint, 2), 2],
    [a(r.type_parts, 1, r.parse_varint, 2), ms(2)],
    [a(tc(0, 0)), r.placeholder],
    [a(tm(0, 0)), r.placeholder],
    [a(r.type_array, r.id), r.placeholder],
    [a(r.flush_bits, r.parse_varint, 2), fb(2)],
    [a(tc(2, r.id, r.denominator), 1), cs(1, r.denominator)],
    [a(tm(1, r.id, r.denominator)), ms()],
    [a(tc(2, r.id, bi(r.denominator)), 1), cs(1, bo(r.denominator, r.denominator))],
    [a(tm(1, bi(r.parse_varint, 1), r.id)), ms()],
    [a(tc(2, r.parse_varint, r.type_choice_indexer), 1, 0, 2), cs(1, ci(cs(0, 2)))],
    [a(tc(2, r.parse_varint, tc(2, r.type_parts, 2, r.parse_varint, r.parse_varint, r.type_choice_indexer)), 1, 1, 0, 2, 3), cs(1, cs(1, ci(cs(0, ms(2, 3)))))],
    [a(tc(2, r.parse_varint, tm(1, tc(2, r.type_parts, 2, r.parse_varint, r.parse_varint, r.type_choice_indexer), r.type_choice_indexer)), 1, 1, 0, 2, 3, 0, 5), cs(1, ms(cs(1, ci(cs(0, ms(2, 3)))), ci(cs(0, 5))))],
    [a(r.type_array, r.parse_varint, 0, 2, 3, 4, 1, 5, 0), ass(aos(3, 4), aos(5))],
    [a(tc(2, r.parse_bit_size, 7, r.parse_bit_size, 5), 0, u8), cs(0, 1)],
    [a(tcb(0, 2, r.parse_bit_size, 7, r.parse_bit_size, 5), u8), cs(0, 2)],
    [a(tm(4, r.parse_varint, r.parse_bit_size, 7, r.parse_bit_size, 7, r.parse_bit_size, 23, r.parse_bit_size, 47, r.parse_varint, r.parse_bit_size, 7, r.id), 3, u8, 4, u8, u8), ms(3, 1, 2, 0x030401, bs(0x02030401, 0x0203, 16), 4, 4)],
    [a(tm(1, r.parse_bit_size, 7, r.flush_bits, r.parse_bit_size, 15), u8, u8), ms(1, fb(0x0102))],
    [a(tmc(1, r.id, r.denominator)), ms()],
    [a(r.type_array_bit, 7, r.parse_bit_size, 8, u8), aos(4)],
])('parse(%#)', (i, o) => {
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