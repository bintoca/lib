import { evaluateAll, parse, r, u, write, finishWrite, EncoderState, multiple_symbol, Item, createDecoder, continueDecode, read, createEncoder, writeBuffer, ParseType, write_checked, ParseOp, Scope, zigzagEncode, zigzagDecode, unicodeToText, textToUnicode, choice_symbol } from '@bintoca/dbuf'

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
            write_checked(es, x)
        }
    }
    finishWrite(es)
    return es.buffers[0]
}
const op1 = (p: ParseType): ParseOp => { return { type: p } }
const plan1 = (p: ParseType) => { return { index: 1, ops: [{ type: p }] } }
const planOp = (p: ParseOp | ParseOp[]) => { return { index: Array.isArray(p) ? p.length : 1, ops: Array.isArray(p) ? p : [p] } }
const planB = (size: number) => { return { index: 1, ops: [{ type: ParseType.block, size }] } }
const plan_value = plan1(ParseType.value)
const bind_uint_in = [r.bind, r.uint, 2]
const bind_uint_out = { type: r.bind, needed: 2, items: [r.uint, 2], plan: plan_value }
const u8 = new Uint8Array([1, 2, 3, 4])
const text_e_in = [u.text, u.e, u.end_scope]
const text_e_out = { type: u.text, needed: 0, inText: true, items: [u.e] }
const bind = (items: Item[], plan) => { return { type: r.bind, needed: items.length, items, plan } }
const need0 = (type: r | u, items: Item[], op?: ParseOp) => { return { type, needed: 0, items, op } }
const need1 = (type: r | u | symbol, items: Item[], op?: ParseOp) => { return { type, needed: 1, items, op } }
const opB = (n: number): ParseOp => { return { type: ParseType.block, size: n } }
const opC = (n: ParseOp[]): ParseOp => { return { type: ParseType.choice, ops: n } }
const opM = (n: ParseOp[]): ParseOp => { return { type: ParseType.multiple, ops: n } }
const need2 = (type: r | symbol, items: Item[]) => { return { type, needed: 2, items } }
const opSc = (s: Scope): ParseOp => { return { type: ParseType.scope, scope: s } }
const sTex = (items: Item[]): Scope => { return { type: u.text, needed: 0, inText: true, items } }
const srTex = (items: Item[]): Scope => { return { type: u.text, needed: 0, inText: true, richText: true, items } }
const bText = (items: Item[]) => bind([r.text, sTex(items)], { index: 1, ops: [{ type: ParseType.scope, scope: sTex(items) }] })
const brText = (items: Item[]) => bind([r.rich_text, srTex(items)], { index: 1, ops: [{ type: ParseType.scope, scope: srTex(items) }] })
test.each([
    [[r.IPv4, r.back_ref, 0, ...bind_uint_in], [r.IPv4, r.IPv4, bind_uint_out]],
    [[r.IPv4, r.bind, r.text, u.a, ...text_e_in, u.back_ref, 0, u.end_scope, r.bind, r.rich_text, u.a, u.non_text, ...bind_uint_in, u.end_scope, u.end_scope], [r.IPv4, bText([u.a, text_e_out, text_e_out]), brText([u.a, need0(u.non_text, [bind_uint_out])])]],
    [[r.bind, r.vIEEE_binary, 0, u8], [bind([r.vIEEE_binary, u8], plan1(ParseType.vblock))]],
    [[r.bind, r.type_sub, r.vIEEE_binary, r.bind, r.block, 0, r.end_scope, u8], [bind([need0(r.type_sub, [r.vIEEE_binary, bind([r.block, 0], plan_value)], opB(0)), u8], planB(0))]],
    [[r.bind, r.type_sub, r.vIEEE_binary, r.end_scope, 0, u8], [bind([need0(r.type_sub, [r.vIEEE_binary], op1(ParseType.vblock)), u8], plan1(ParseType.vblock))]],
    [[r.bind, r.type_sub, r.uint, r.end_scope, 5], [bind([need0(r.type_sub, [r.uint], op1(ParseType.value)), 5], plan1(ParseType.value))]],
    [[r.bind, r.type_sub, r.uint, r.block, r.end_scope, 0, u8], [bind([need0(r.type_sub, [r.uint, r.block], op1(ParseType.vblock)), u8], plan1(ParseType.vblock))]],
    [[...bind_uint_in, r.bind, r.type_sub, r.uint, r.item_, r.end_scope, r.back_ref, 0], [bind_uint_out, bind([need0(r.type_sub, [r.uint, r.item_], op1(ParseType.item)), bind_uint_out], plan1(ParseType.item))]],
    [[r.bind, r.type_sub, r.text, r.end_scope, u.e, u.end_scope], [bind([need0(r.type_sub, [r.text], opSc(sTex([u.e]))), sTex([u.e])], planOp(opSc(sTex([u.e]))))]],
    [[...bind_uint_in, r.bind, r.type_sub, r.uint, r.next_singular, r.back_ref, r.end_scope, 0], [bind_uint_out, bind([need0(r.type_sub, [r.uint, need1(r.next_singular, [r.back_ref])], op1(ParseType.back)), bind_uint_out], plan1(ParseType.back))]],
    [[r.bind, r.TAI_seconds, u8], [bind([r.TAI_seconds, u8], planB(0))]],
    [[r.bind, r.type_sum, r.IPv4, r.IPv6, r.end_scope, 1], [bind([need0(r.type_sum, [r.IPv4, r.IPv6], opC([op1(ParseType.none), op1(ParseType.none)])), need1(choice_symbol, [1])], planOp(opC([op1(ParseType.none), op1(ParseType.none)])))]],
    [[r.bind, r.type_sum, r.context_symbol, r.vIEEE_binary, r.context_symbol, r.uint, r.end_scope, 1, 2],
    [bind([need0(r.type_sum, [r.context_symbol, r.vIEEE_binary, r.context_symbol, r.uint], opC([op1(ParseType.vblock), op1(ParseType.value)])), need2(choice_symbol, [1, 2])], planOp(opC([op1(ParseType.vblock), op1(ParseType.value)])))]],
    [[r.bind, r.type_product, r.vIEEE_binary, r.uint, r.end_scope, 0, u8, 1], [bind([need0(r.type_product, [r.vIEEE_binary, r.uint], opM([op1(ParseType.vblock), op1(ParseType.value)])), u8, 1], planOp([op1(ParseType.vblock), op1(ParseType.value)]))]],
])('parse(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        if (s.slots[s.slots.length - 1] == r.placeholder) {
            s.slots.pop()
        }
        expect(s.slots).toEqual(o)
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
test.each([
    [[r.function, r.end_scope, r.end_scope], 'top of scope_stack invalid for end_scope'],
    [[r.back_ref, 0], 'invalid back_ref'],
    [[r.bind, r.text, u.non_text, u.end_scope], 'non_text not allowed'],
    [[r.IPv4, r.bind, r.text, u.back_ref, 0, u.end_scope], 'rich text not allowed in plain text'],
])('parseError(%#)', (i, o) => {
    let er
    try {
        parse(writer(i))
    }
    catch (e) {
        er = e
    }
    expect(er?.message).toEqual(o)
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
    if (o[o.length - 1] == r.placeholder) {
        o.pop()
    }
    expect(o).toEqual(i)
})
test.each([[[-2, -1, 0, 1, 2, 2147483647, -2147483648]]])('zigzag', (i) => {
    const es = createEncoder()
    for (let x of i) {
        write(es, zigzagEncode(x))
    }
    finishWrite(es)
    const ds = createDecoder(es.buffers[0])
    const o = []
    while (continueDecode(ds)) {
        o.push(zigzagDecode(read(ds)))
    }
    if (o[o.length - 1] == r.placeholder) {
        o.pop()
    }
    expect(o).toEqual(i)
})
test('stringText', () => {
    for (let i = 0; i < 256; i++) {
        expect(textToUnicode(unicodeToText(i))).toBe(i)
    }
    const a = []
    for (let x of ' aeot\n!,-.?ABCXYZabcxyz\0~') {
        a.push(unicodeToText(x.codePointAt(0)))
    }
    expect(a).toEqual([3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 39, 40, 41, 4, 42, 43, 61, 62, 63, 64, 131])
})