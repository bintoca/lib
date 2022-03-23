import { evaluateAll, parse, r, u, encode, decode } from '@bintoca/bld'

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
    [[], []],
    [[r.next_describe, r.uint, 0, new Uint8Array(12)], [{ type: r.next_describe, items: [r.uint, 1], needed: 2 }, new Uint8Array(12)]],
])('parse', (i, o) => {
    const ei = encode(i)
    const di = decode(ei)
    const s = parse(di)
    expect(s.slots).toEqual(o)
})
test.each([
    [[r.function, r.end_scope], 'end_scope cannot be empty'],
])('parseError', (i, o) => {
    expect(() => parse(i)).toThrowError(o)
})
test.each([
    [[r.function, r.next_describe, r.uint, 0, r.end_scope, r.call, r.back_ref, 0, r.placeholder], [{ type: r.next_describe, items: [r.uint, 1], needed: 2 }]],
    [[r.function, r.unicode, u.a, u.unicode, u.e, u.end_scope, u.i, u.back_ref, 0, r.end_scope, r.end_scope, r.call, r.back_ref, 0, r.placeholder],
    [{ type: r.unicode, needed: 0, items: [u.a, { type: u.unicode, needed: 0, items: [u.e] }, u.i, { type: u.back_ref, needed: 1, items: [1], ref: { type: u.unicode, needed: 0, items: [u.e] } }] }]],
])('evaluate', (i, o) => {
    const s = parse(decode(encode(i)))
    evaluateAll(s.slots)
    expect(s.slots.map(x => typeof x == 'object' && !(x instanceof Uint8Array) && !Array.isArray(x) && x.result ? x.result : null).filter(x => x)).toEqual(o)
})
test.each([
    [[r.call, 6000, r.placeholder], 'not implemented x1 6000'],
])('evaluateError', (i, o) => {
    const s = parse(i)
    expect(() => evaluateAll(s.slots)).toThrowError(o)
})
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
    //[[2 ** 8 + 2 ** 4 + 2, 3, 4, 5, 6], new Uint8Array([])],
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