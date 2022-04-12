import { evaluateAll, parse, r, u, encode, decode, d2 } from '@bintoca/bld'

const dv = new DataView(new ArrayBuffer(8))
test('float', () => {
    dv.setFloat32(0, 1, true)
    //console.log(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
    expect(dv.getUint8(0)).toBe(0)
    expect(dv.getUint8(1)).toBe(0)
    expect(dv.getUint8(2)).toBe(128)
    expect(dv.getUint8(3)).toBe(63)
})
test.each([
    //[[r.type_hint_value_quotient_uint, 0, new Uint8Array(12), 0xFFFF, 0xFFFFFF], [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }, new Uint8Array(12), 0xFFFF, 0xFFFFFF, r.placeholder, r.placeholder]],
    //[[r.type_hint_value, r.uint, 0, [new Uint8Array(12), 0xFFFF, 0xFFFFFF]], [{ type: r.type_hint_value, items: [r.uint, 0], needed: 2, next_literal_item: false }, [new Uint8Array(12), 0xFFFF, 0xFFFFFF, r.placeholder, r.placeholder]]],
    //[[r.run_length_encoding, 0, r.type_hint_value_quotient_uint, 0], [{ type: r.run_length_encoding, items: [0, { type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }], needed: 2, next_literal_item: false }, r.placeholder, r.placeholder]],
    //[[r.type_hint_value_quotient_uint, 0, new Uint8Array(256 * 4), 0xFFFFF, 0xFFFFFF, 0xFFFFFFF, 0xFFFFFFFFFF, BigInt(0xFFFFFFFFFF) * BigInt(2 ** 16), 0xFFFFFF], [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }, new Uint8Array(256 * 4), 0xFFFFF, 0xFFFFFF, 0xFFFFFFF, 0xFFFFFFFFFF, BigInt(0xFFFFFFFFFF) * BigInt(2 ** 16), 0xFFFFFF]],
])('parse', (i, o) => {
    const b = encode(i)
    const di = decode(b)
    const s = parse(di)
    expect(s.slots).toEqual(o)
})
test.each([
    [[r.function, r.end_scope, r.end_scope], 'top of scope_stack invalid for end_scope'],
])('parseError', (i, o) => {
    expect(() => parse(i)).toThrowError(o)
})
test.each([
    //[[r.function, r.type_hint_value_quotient_uint, 0, r.end_scope, r.call, r.back_ref, 0, r.end_scope], [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }]],
    //[[r.function, r.unicode, u.a, u.placeholder, r.type_hint_value_quotient_uint, 0, u.end_scope, u.e, u.end_scope, r.end_scope, r.call, r.back_ref, 0, r.end_scope],
    //[{ type: u.unicode, items: [u.a, { type: u.placeholder, items: [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }], needed: 0 }, u.e], needed: 0, inUnicode: true }]],
    //[[r.function, r.unicode, u.a, u.unicode, u.e, u.end_scope, u.i, u.back_ref, 0, r.end_scope, r.end_scope, r.call, r.back_ref, 0, r.end_scope],
    //[{ type: r.unicode, needed: 0, inUnicode: true, items: [u.a, { type: u.unicode, needed: 0, inUnicode: true, items: [u.e] }, u.i, { type: u.back_ref, needed: 1, inUnicode: true, items: [0], next_literal_item: false, ref: { type: u.unicode, needed: 0, inUnicode: true, items: [u.e] } }] }]],
])('evaluate', (i, o) => {
    const b = encode(i)
    const s = parse(decode(b[0]))
    evaluateAll(s.slots)
    expect(s.slots.map(x => typeof x == 'object' && !(x instanceof Uint8Array) && !Array.isArray(x) && x.result ? x.result : null).filter(x => x)).toEqual(o)
})
test.each([
    [[r.call, 6000, r.end_scope], 'not implemented x1 6000'],
])('evaluateError', (i, o) => {
    const s = parse(i)
    expect(() => evaluateAll(s.slots)).toThrowError(o)
})
const be = (n: number[]) => {
    const dv = new DataView(new ArrayBuffer(n.length * 4))
    for (let i = 0; i < n.length; i++) {
        dv.setUint32(i * 4, n[i])
    }
    return dv
}
const mesh = [
    [[1, 6 + 5 * 2 ** 4 + 4 * 2 ** 8 + 3 * 2 ** 12 + 2 * 2 ** 16 + 2 ** 20]],
    [[1, 5 + 4 * 2 ** 4 + 3 * 2 ** 8 + 2 * 2 ** 12 + 2 ** 16, 6]],
    [[1, 4 + 3 * 2 ** 4 + 2 * 2 ** 8 + 2 ** 12, 5, 6]],
    [[1, 4 + 3 * 2 ** 4 + 2 * 2 ** 8 + 2 ** 12, 5 * 2 ** 4 + 6]],
    [[1, 3 + 2 * 2 ** 4 + 2 ** 8, 4, 6 + 5 * 2 ** 4]],
    [[1, 3 + 2 * 2 ** 4 + 2 ** 8, 4, 5, 6]],
    [[1, 3 + 2 * 2 ** 4 + 2 ** 8, 4 * 2 ** 4 + 5, 6]],
    [[1, 3 + 2 * 2 ** 4 + 2 ** 8, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[1, 2 + 2 ** 4, 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[1, 2 + 2 ** 4, 3, 4 * 2 ** 4 + 5, 6]],
    [[1, 2 + 2 ** 4, 3, 4, 5, 6]],
    [[1, 2 + 2 ** 4, 3, 4, 5 * 2 ** 4 + 6]],
    [[1, 2 + 2 ** 4, 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[1, 2 + 2 ** 4, 3 * 2 ** 4 + 4, 5, 6]],
    [[1, 2 + 2 ** 4, 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[1, 2 + 2 ** 4, 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[1, 1, 2, 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[1, 1, 2, 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[1, 1, 2, 3 * 2 ** 4 + 4, 5, 6]],
    [[1, 1, 2, 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[1, 1, 2, 3, 4, 5 * 2 ** 4 + 6]],
    [[1, 1, 2, 3, 4, 5, 6]],
    [[1, 1, 2, 3, 4 * 2 ** 4 + 5, 6]],
    [[1, 1, 2, 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[1, 1, 2 * 2 ** 4 + 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[1, 1, 2 * 2 ** 4 + 3, 4 * 2 ** 4 + 5, 6]],
    [[1, 1, 2 * 2 ** 4 + 3, 4, 5, 6]],
    [[1, 1, 2 * 2 ** 4 + 3, 4, 5 * 2 ** 4 + 6]],
    [[1, 1, 2 * 2 ** 8 + 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[1, 1, 2 * 2 ** 8 + 3 * 2 ** 4 + 4, 5, 6]],
    [[1, 1, 2 * 2 ** 12 + 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[1, 1, 2 * 2 ** 16 + 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2 * 2 ** 16 + 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2 * 2 ** 12 + 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[2 ** 4 + 1, 2 * 2 ** 8 + 3 * 2 ** 4 + 4, 5, 6]],
    [[2 ** 4 + 1, 2 * 2 ** 8 + 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2 * 2 ** 4 + 3, 4, 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2 * 2 ** 4 + 3, 4, 5, 6]],
    [[2 ** 4 + 1, 2 * 2 ** 4 + 3, 4 * 2 ** 4 + 5, 6]],
    [[2 ** 4 + 1, 2 * 2 ** 4 + 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2, 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2, 3, 4 * 2 ** 4 + 5, 6]],
    [[2 ** 4 + 1, 2, 3, 4, 5, 6]],
    [[2 ** 4 + 1, 2, 3, 4, 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2, 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[2 ** 4 + 1, 2, 3 * 2 ** 4 + 4, 5, 6]],
    [[2 ** 4 + 1, 2, 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[2 ** 4 + 1, 2, 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3 * 2 ** 4 + 4, 5, 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3, 4, 5 * 2 ** 4 + 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3, 4, 5, 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3, 4 * 2 ** 4 + 5, 6]],
    [[2 ** 8 + 2 ** 4 + 2, 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 12 + 2 ** 8 + 2 * 2 ** 4 + 3, 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[2 ** 12 + 2 ** 8 + 2 * 2 ** 4 + 3, 4 * 2 ** 4 + 5, 6]],
    [[2 ** 12 + 2 ** 8 + 2 * 2 ** 4 + 3, 4, 5, 6]],
    [[2 ** 12 + 2 ** 8 + 2 * 2 ** 4 + 3, 4, 5 * 2 ** 4 + 6]],
    [[2 ** 16 + 2 ** 12 + 2 * 2 ** 8 + 3 * 2 ** 4 + 4, 5 * 2 ** 4 + 6]],
    [[2 ** 16 + 2 ** 12 + 2 * 2 ** 8 + 3 * 2 ** 4 + 4, 5, 6]],
    [[2 ** 20 + 2 ** 16 + 2 * 2 ** 12 + 3 * 2 ** 8 + 4 * 2 ** 4 + 5, 6]],
    [[2 ** 24 + 2 ** 20 + 2 * 2 ** 16 + 3 * 2 ** 12 + 4 * 2 ** 8 + 5 * 2 ** 4 + 6]],
    [[BigInt(6) as any], be([0, 0x3F000000, 0x3F000006])],
    [[0, 0, [0, 6]], be([0, 0x8F000000, 0x4F000006])],
    [[0, 0, [0, 6]], be([0, 0x8F000001, 0x4F000006])],
]
for (let i = 0; i < 64; i++) {
    const dv = new DataView(new ArrayBuffer(8))
    dv.setUint32(0, 1)
    dv.setUint32(4, 6 + 5 * 2 ** 4 + 4 * 2 ** 8 + 3 * 2 ** 12 + 2 * 2 ** 16 + 2 ** 20 + i * 2 ** 24)
    mesh[i].push(dv as any)
}
test.each(mesh)('decode(%#)', (i, o) => {
    const di = decode(o as any)
    expect(di).toEqual(i)
})
export const shi = [
    0, 1, (1 << 3) + 2, (1 << 6) + (2 << 3) + 3, (1 << 9) + (2 << 6) + (3 << 3) + 4, (1 << 12) + (2 << 9) + (3 << 6) + (4 << 3) + 5, (1 << 15) + (2 << 12) + (3 << 9) + (4 << 6) + (5 << 3) + 6,
    (1 << 18) + (2 << 15) + (3 << 12) + (4 << 9) + (5 << 6) + (6 << 3) + 7,//7
    1, (1 << 3) + 2, (1 << 6) + (2 << 3) + 3, (1 << 9) + (2 << 6) + (3 << 3) + 4, (1 << 12) + (2 << 9) + (3 << 6) + (4 << 3) + 5, (1 << 15) + (2 << 12) + (3 << 9) + (4 << 6) + (5 << 3) + 6,
    (1 << 18) + (2 << 15) + (3 << 12) + (4 << 9) + (5 << 6) + (6 << 3) + 7,//14
    2, (2 << 3) + 3, (2 << 6) + (3 << 3) + 4, (2 << 9) + (3 << 6) + (4 << 3) + 5, (2 << 12) + (3 << 9) + (4 << 6) + (5 << 3) + 6, (2 << 15) + (3 << 12) + (4 << 9) + (5 << 6) + (6 << 3) + 7,//20
    3, (3 << 3) + 4, (3 << 6) + (4 << 3) + 5, (3 << 9) + (4 << 6) + (5 << 3) + 6, (3 << 12) + (4 << 9) + (5 << 6) + (6 << 3) + 7,//25
    4, (4 << 3) + 5, (4 << 6) + (5 << 3) + 6, (4 << 9) + (5 << 6) + (6 << 3) + 7,//29
    5, (5 << 3) + 6, (5 << 6) + (6 << 3) + 7,//32
    6, (6 << 3) + 7,//34
    7//35
]
export const shi1 = [
    [7], [6, 35], [5, 33, 35], [4, 34], [3, 30, 34], [2, 30, 33, 35]
]
const mesh2 = []
for (let i = 0; i < 6; i++) {
    const s = shi1[i].map(x => shi[x])
    if (i >= 128) {
        s[0] += 1 << (Math.clz32(i ^ 255) - 24)
    }
    mesh2[i] = []
    mesh2[i].push(i < 128 ? [1].concat(s) : s)
    const dv = new DataView(new ArrayBuffer(8))
    dv.setUint32(0, 1)
    dv.setUint32(4, i * 2 ** 24 + (1 << 18) + (2 << 15) + (3 << 12) + (4 << 9) + (5 << 6) + (6 << 3) + 7)
    mesh2[i].push(dv as any)
}
test.each(mesh2)('d2(%#)', (i, o) => {
    const di = d2(o as any)
    expect(di).toEqual(i)
})