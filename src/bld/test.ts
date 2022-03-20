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
    [[r.next_v4, 0, r.uint, new Uint8Array(12)], [{ type: r.next_v4, items: [1, r.uint], needed: 2 }, new Uint8Array(12)]],
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
    [[r.function, r.next_v4, 0, r.uint, r.end_scope, r.call, r.back_ref, 0, r.placeholder], [{ type: r.next_v4, items: [1, r.uint], needed: 2 }]],
    [[r.function, r.unicode, u.a, u.unicode, u.e, u.end_scope, u.i, u.back_ref, 0, r.end_scope, r.end_scope, r.call, r.back_ref, 0, r.placeholder],
    [{ type: r.unicode, needed: 0, items: [u.a, { type: u.unicode, needed: 0, items: [u.e] }, u.i, { type: u.back_ref, needed: 1, items: [1], ref: { type: u.unicode, needed: 0, items: [u.e] } }] }]],
])('evaluate', (i, o) => {
    const s = parse(decode(encode(i)))
    evaluateAll(s.slots)
    expect(s.slots.map(x => typeof x == 'object' && !(x instanceof Uint8Array) && x.result ? x.result : null).filter(x => x)).toEqual(o)
})
test.each([
    [[r.call, 6000, r.placeholder], 'not implemented x1 6000'],
])('evaluateError', (i, o) => {
    const s = parse(i)
    expect(() => evaluateAll(s.slots)).toThrowError(o)
})