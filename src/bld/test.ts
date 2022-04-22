import { evaluateAll, parse, r, u, write, finishWrite, EncoderState, createDecoder, continueDecode, read, createEncoder, writeBuffer, ParseType } from '@bintoca/bld'

const dv = new DataView(new ArrayBuffer(8))
test('float', () => {
    dv.setFloat32(0, 1, true)
    //console.log(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
    expect(dv.getUint8(0)).toBe(0)
    expect(dv.getUint8(1)).toBe(0)
    expect(dv.getUint8(2)).toBe(128)
    expect(dv.getUint8(3)).toBe(63)
})
const writer = (i: (number | Uint8Array)[]) => {
    const es = createEncoder()
    for (let x of i) {
        if (x instanceof Uint8Array) {
            writeBuffer(es, x)
        }
        else {
            write(es, x)
        }
    }
    finishWrite(es)
    return es.buffers[0]
}
const bind_uint_in = [r.bind, r.uint, 2]
const bind_uint_out = { type: r.bind, needed: 2, items: [r.uint, 2], plan: { index: 1, types: [{ type: ParseType.value }] } }
const u8 = new Uint8Array([1, 2, 3, 4])
test.each([
    [[r.IPv4, r.run_length_encoding, 1, r.back_ref, 0, ...bind_uint_in],
    [r.IPv4, { type: r.run_length_encoding, needed: 2, items: [1, { type: r.back_ref, needed: 1, items: [0], ref: r.IPv4 }] }, bind_uint_out]],
    [[r.IPv4, r.bind, r.text, u.a, u.non_text, u.text, u.e, u.end_scope, u.back_ref, 1, u.end_scope, r.bind, r.rich_text, u.a, u.non_text, ...bind_uint_in, u.end_scope, u.end_scope],
    [r.IPv4, { type: r.bind, needed: 2, items: [r.text, { type: u.text, needed: 0, inText: true, items: [u.a, u.non_text, { type: u.text, needed: 0, inText: true, items: [u.e] }, { type: u.back_ref, needed: 1, inText: true, ref: r.IPv4, items: [1] }] }] },
    { type: r.bind, needed: 2, items: [r.rich_text, { type: u.text, needed: 0, inText: true, richText: true, items: [u.a, { type: u.non_text, needed: 0, items: [bind_uint_out] }] }] }]],
    [[r.bind, r.vIEEE_binary, u8], [{ type: r.bind, needed: 2, items: [r.vIEEE_binary, u8], plan: { index: 1, types: [{ type: ParseType.vbuf }] } }]],
])('parse', (i, o) => {
    const s = parse(writer(i))
    for (let i = 0; i < 7; i++) {
        if (s.slots[s.slots.length - 1] == r.placeholder) {
            s.slots.pop()
        }
    }
    expect(s.slots).toEqual(o)
})
test.each([
    [[r.function, r.end_scope, r.end_scope], 'top of scope_stack invalid for end_scope'],
    [[r.back_ref, 0], 'invalid back_ref'],
])('parseError', (i, o) => {
    expect(() => parse(writer(i))).toThrowError(o)
})
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
        if (o[o.length - 1] == r.placeholder) {
            o.pop()
        }
    }
    expect(o).toEqual(i)
})