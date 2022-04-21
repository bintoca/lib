import { evaluateAll, parse, r, u, write, finishWrite, EncoderState, createDecoder, continueDecode, read, createEncoder } from '@bintoca/bld'

const dv = new DataView(new ArrayBuffer(8))
test('float', () => {
    dv.setFloat32(0, 1, true)
    //console.log(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
    expect(dv.getUint8(0)).toBe(0)
    expect(dv.getUint8(1)).toBe(0)
    expect(dv.getUint8(2)).toBe(128)
    expect(dv.getUint8(3)).toBe(63)
})
// test.each([
//     //[[r.type_hint_value_quotient_uint, 0, new Uint8Array(12), 0xFFFF, 0xFFFFFF], [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }, new Uint8Array(12), 0xFFFF, 0xFFFFFF, r.placeholder, r.placeholder]],
//     //[[r.type_hint_value, r.uint, 0, [new Uint8Array(12), 0xFFFF, 0xFFFFFF]], [{ type: r.type_hint_value, items: [r.uint, 0], needed: 2, next_literal_item: false }, [new Uint8Array(12), 0xFFFF, 0xFFFFFF, r.placeholder, r.placeholder]]],
//     //[[r.run_length_encoding, 0, r.type_hint_value_quotient_uint, 0], [{ type: r.run_length_encoding, items: [0, { type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }], needed: 2, next_literal_item: false }, r.placeholder, r.placeholder]],
//     //[[r.type_hint_value_quotient_uint, 0, new Uint8Array(256 * 4), 0xFFFFF, 0xFFFFFF, 0xFFFFFFF, 0xFFFFFFFFFF, BigInt(0xFFFFFFFFFF) * BigInt(2 ** 16), 0xFFFFFF], [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }, new Uint8Array(256 * 4), 0xFFFFF, 0xFFFFFF, 0xFFFFFFF, 0xFFFFFFFFFF, BigInt(0xFFFFFFFFFF) * BigInt(2 ** 16), 0xFFFFFF]],
// ])('parse', (i, o) => {
//     const b = encode(i)
//     const di = decode(b)
//     const s = parse(di)
//     expect(s.slots).toEqual(o)
// })
// test.each([
//     [[r.function, r.end_scope, r.end_scope], 'top of scope_stack invalid for end_scope'],
// ])('parseError', (i, o) => {
//     expect(() => parse(i)).toThrowError(o)
// })
// test.each([
//     //[[r.function, r.type_hint_value_quotient_uint, 0, r.end_scope, r.call, r.back_ref, 0, r.end_scope], [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }]],
//     //[[r.function, r.unicode, u.a, u.placeholder, r.type_hint_value_quotient_uint, 0, u.end_scope, u.e, u.end_scope, r.end_scope, r.call, r.back_ref, 0, r.end_scope],
//     //[{ type: u.unicode, items: [u.a, { type: u.placeholder, items: [{ type: r.type_hint_value_quotient_uint, items: [0], needed: 1, next_literal_item: false }], needed: 0 }, u.e], needed: 0, inUnicode: true }]],
//     //[[r.function, r.unicode, u.a, u.unicode, u.e, u.end_scope, u.i, u.back_ref, 0, r.end_scope, r.end_scope, r.call, r.back_ref, 0, r.end_scope],
//     //[{ type: r.unicode, needed: 0, inUnicode: true, items: [u.a, { type: u.unicode, needed: 0, inUnicode: true, items: [u.e] }, u.i, { type: u.back_ref, needed: 1, inUnicode: true, items: [0], next_literal_item: false, ref: { type: u.unicode, needed: 0, inUnicode: true, items: [u.e] } }] }]],
// ])('evaluate', (i, o) => {
//     const b = encode(i)
//     const s = parse(decode(b[0]))
//     evaluateAll(s.slots)
//     expect(s.slots.map(x => typeof x == 'object' && !(x instanceof Uint8Array) && !Array.isArray(x) && x.result ? x.result : null).filter(x => x)).toEqual(o)
// })
// test.each([
//     [[r.call, 6000, r.end_scope], 'not implemented x1 6000'],
// ])('evaluateError', (i, o) => {
//     const s = parse(i)
//     expect(() => evaluateAll(s.slots)).toThrowError(o)
// })
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
    while (continueDecode(ds)) {
        o.push(read(ds))
    }
    for (let i = 0; i < 7; i++) {
        if (o[o.length - 1] == 0) {
            o.pop()
        }
    }
    expect(o).toEqual(i)
})