import { evaluateAll, parse, r } from '@bintoca/bld'

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
    [[r.next_v4, 0, r.uint], [{ type: r.next_v4, items: [1, r.uint], needed: 2 }]],
])('parse', (i, o) => {
    const s = parse(i)
    expect(s.slots).toEqual(o)
})
test.each([
    [[r.function, r.end_scope], 'function body cannot be empty'],
])('parseError', (i, o) => {
    expect(() => parse(i)).toThrowError(o)
})
test.each([
    [[r.function, r.next_v4, 0, r.uint, r.end_scope, r.call, r.back_ref, 0, r.placeholder], [{ type: r.next_v4, items: [1, r.uint], needed: 2 }]],
])('evaluate', (i, o) => {
    const s = parse(i)
    evaluateAll(s.slots)
    expect(s.slots.map(x => typeof x == 'object' && x.result ? x.result : null).filter(x => x)).toEqual(o)
})
test.each([
    [[r.call, 6000, r.placeholder], 'not implemented x1 6000'],
])('evaluateError', (i, o) => {
    const s = parse(i)
    expect(() => evaluateAll(s.slots)).toThrowError(o)
})