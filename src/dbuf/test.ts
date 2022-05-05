import { evaluateAll, parse, write, finishWrite, EncoderState, multiple_symbol, Item, createDecoder, continueDecode, read, createEncoder, writeBuffer, ParseType, write_checked, ParseOp, Scope, choice_symbol, non_text_symbol, Slot, collection_symbol, text_symbol, write_pad, bits_symbol } from '@bintoca/dbuf'
import { r, u } from '@bintoca/dbuf/registry'
import { zigzagEncode, zigzagDecode, unicodeToText, textToUnicode, getLeap_millis, getLeap_millis_tai, } from '@bintoca/dbuf/util'
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
test('overflow', () => {
    const dv = new DataView(new ArrayBuffer(12))
    dv.setUint32(0, 0xFFFFFFFF)
    dv.setUint32(4, 0xFF000000)
    dv.setUint32(8, 0xFE000010)
    expect(read(createDecoder(dv))).toBe(2)
})
test('write_pad', () => {
    const es = createEncoder()
    write(es, 1)
    write_pad(es, 18)
    write(es, 2)
    finishWrite(es)
    expect(es.buffers[0]).toEqual(new Uint8Array([0x7f, 0x20, 0, 0, 0xff, 0, 0, 0, 0xf0, 0, 0x20, 0]))
    const d = createDecoder(es.buffers[0])
    expect(read(d)).toBe(1)
    expect(read(d)).toBe(2)
    expect(read(d)).toBe(0)
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
test('magicNumber', () => {
    const dv = new DataView(new ArrayBuffer(4))
    dv.setUint8(1, 'D'.codePointAt(0))
    dv.setUint8(2, 'B'.codePointAt(0))
    dv.setUint8(3, 'U'.codePointAt(0))
    expect(dv.getUint32(0)).toBe(r.magicNumber)
})
test.each([[-(10 * 365) * 86400, -9], [0, -9], [(10 * 365 + 1) * 86400, -1], [(10 * 365 + 2) * 86400, 0], [(10 * 365 + 7) * 86400, 0], [(11 * 365 + 3 + 181) * 86400, 1]])('leap', (d, o) => {
    expect(getLeap_millis(d * 1000)).toBe(o * 1000)
})
test.each([[-(20 * 365) * 86400, -9], [-(6) * 86400, -1], [-1, 0], [0, 0], [(366 + 181 - 5) * 86400 + 1, 1]])('leap_reverse', (d, o) => {
    expect(getLeap_millis_tai(d * 1000)).toBe(o * 1000)
})
test.each([[[r.IPv4, r.end_scope], [r.IPv4]]])('early end', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        if (s.root.items[s.root.items.length - 1] == r.placeholder) {
            s.root.items.pop()
        }
        expect(s.scope_stack.length).toBe(0)
        expect(s.root.items).toEqual(o)
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
const op1 = (p: ParseType): ParseOp => { return { type: p } }
const opv = op1(ParseType.value)
const opvb = op1(ParseType.vblock)
const opvbi = op1(ParseType.vbit)
const opt = op1(ParseType.text)
const oprt = op1(ParseType.rich_text)
const bind_uint_in = [r.bind, r.uint, 2]
const bind_uint_out = { type: r.bind, needed: 2, items: [r.uint, 2], op: op1(ParseType.value) }
const u8 = new Uint8Array([1, 2, 3, 4])
const text_e_in = [u.text, u.e, u.end_scope]
const text_e_out = { type: text_symbol, needed: 0, inText: true, items: [u.e] }
const bind = (t: Slot, v: Item, p: ParseOp): Scope => { return { type: r.bind, needed: 2, items: [t, v], op: p } }
const bindO = (t: r, items: Item[], p: ParseOp, v: Item | Item[]): Scope => {
    if (Array.isArray(v)) {
        let i = 0
        function rr(op: ParseOp, tt: Item[]): Scope {
            if (op.type == ParseType.collection || op.type == ParseType.vCollection) {
                const it = []
                const x = op.ops[0]
                const z = tt[0]
                const count = v[i]
                i++
                for (let k = 0; k < count; k++) {
                    if (x.type == ParseType.multiple) {
                        it.push(rr(x, (tt[0] as Scope).items))
                    }
                    else {
                        it.push(v[i])
                        i++
                    }
                }
                if (typeof z == 'object' && !(z instanceof Uint8Array)) {
                    z.op = x
                }
                return { type: collection_symbol, needed: it.length, items: it, ops: op.ops, parseIndex: 0 }
            }
            const it = []
            let j = 0
            for (let x of op.ops) {
                const z = tt[j]
                if (x.type == ParseType.multiple) {
                    it.push(rr(x, (z as Scope).items))
                }
                else {
                    it.push(v[i])
                    i++
                }
                if (typeof z == 'object' && !(z instanceof Uint8Array)) {
                    z.op = x
                }
                j++
            }
            return { type: multiple_symbol, needed: op.ops.length, items: it, ops: op.ops, parseIndex: op.ops.length }
        }
        v = rr(p, items)
    }
    return { type: r.bind, needed: 2, items: [need0(t, items, p), v], op: p }
}
const need0 = (type: r | symbol, items: Item[], op?: ParseOp) => { return { type, needed: 0, items, op } }
const needN = (type: r | symbol, items: Item[], op?: ParseOp) => { return { type, needed: items.length, items, op } }
const opB = (n: number): ParseOp => { return { type: ParseType.block, size: n } }
const opBi = (n: number): ParseOp => { return { type: ParseType.bit, size: n } }
const opC = (n: ParseOp[]): ParseOp => { return { type: ParseType.choice, ops: n } }
const opCo = (n: ParseOp): ParseOp => { return { type: ParseType.collection, ops: [n] } }
const opvCo = (n: ParseOp): ParseOp => { return { type: ParseType.vCollection, ops: [n] } }
const opM = (n: ParseOp[]): ParseOp => { return { type: ParseType.multiple, ops: n } }
const sTex = (items: Item[]): Scope => { return { type: r.text, needed: 0, inText: true, items } }
const srTex = (items: Item[]): Scope => { return { type: r.rich_text, needed: 0, inText: true, richText: true, items } }
const bText = (items: Item[]) => bind(r.text, sTex(items), opt)
const brText = (items: Item[]) => bind(r.rich_text, srTex(items), oprt)
const ro: Scope = { type: non_text_symbol, needed: 0, items: [r.IPv4, null, bind_uint_out] }
const fo: Scope = { type: r.forward_ref, needed: 3, items: [ro, 1, 4], op: { type: ParseType.forward } }
ro.items[1] = fo
fo.op.forward = fo
test.each([
    [[r.IPv4, r.back_ref, 0, ...bind_uint_in], [r.IPv4, r.IPv4, bind_uint_out]],
    [[r.IPv4, r.forward_ref, 4, ...bind_uint_in], ro.items],
    [[r.bind, r.text, u.a, ...text_e_in, u.back_ref, 0, u.end_scope, r.bind, r.rich_text, u.a, u.non_text, ...bind_uint_in, u.end_scope, u.end_scope], [bText([u.a, text_e_out, text_e_out]), brText([u.a, need0(non_text_symbol, [bind_uint_out])])]],
    [[r.bind, r.vIEEE_binary, u8], [bind(r.vIEEE_binary, u8, opB(1))]],
    [[r.bind, r.bitSize, 19, u8], [bind(needN(r.bitSize, [20], opBi(20)), 32 + 4096, opBi(20))]],
    [[r.bind, r.v32_32, 2, u8], [bind(r.v32_32, new Uint8Array([0, 0, 0, 2, 1, 2, 3, 4]), op1(ParseType.v32_32))]],
    [[r.bind, r.type_wrap, r.vIEEE_binary, r.blockSize, 0, r.end_scope, u8], [bindO(r.type_wrap, [r.vIEEE_binary, needN(r.blockSize, [1], opB(1))], opB(1), u8)]],
    [[r.bind, r.type_wrap, r.vIEEE_binary, r.vblock, r.end_scope, 0, u8], [bindO(r.type_wrap, [r.vIEEE_binary, r.vblock], opvb, u8)]],
    [[r.bind, r.type_wrap, r.uint, r.end_scope, 5], [bindO(r.type_wrap, [r.uint], opv, 5)]],
    [[r.bind, r.type_wrap, r.uint, r.vbit, r.end_scope, 8, u8], [bindO(r.type_wrap, [r.uint, r.vbit], opvbi, 2)]],
    [[...bind_uint_in, r.bind, r.type_wrap, r.uint, r.item_, r.end_scope, r.back_ref, 0], [bind_uint_out, bindO(r.type_wrap, [r.uint, r.item_], op1(ParseType.item), bind_uint_out)]],
    [[r.bind, r.type_wrap, r.text, r.end_scope, u.e, u.end_scope], [bindO(r.type_wrap, [r.text], opt, sTex([u.e]))]],
    [[r.bind, r.TAI_seconds, u8], [bind(r.TAI_seconds, u8, opB(1))]],
    [[r.bind, r.type_choice, r.location, r.locator, r.end_scope, 1], [bindO(r.type_choice, [r.location, r.locator], opC([op1(ParseType.none), op1(ParseType.none)]), needN(choice_symbol, [1]))]],
    [[r.bind, r.type_choice, r.vIEEE_binary, r.uint, r.end_scope, 1, 2], [bindO(r.type_choice, [r.vIEEE_binary, r.uint], opC([opB(1), opv]), needN(choice_symbol, [1, 2]))]],
    [[r.bind, r.type_struct, r.vIEEE_binary, r.type_struct, r.uint, r.sint, r.end_scope, r.end_scope, u8, 1, 2], [bindO(r.type_struct, [r.vIEEE_binary, need0(r.type_struct, [r.uint, r.sint])], opM([opB(1), opM([opv, opv])]), [u8, 1, 2])]],
    [[r.bind, r.type_collection, r.uint, r.end_scope, 1, 3, 4], [bindO(r.type_collection, [r.uint], opCo(opv), [2, 3, 4])]],
    [[r.bind, r.vCollection, r.uint, r.end_scope, 3, 1, 4, 0], [bindO(r.vCollection, [r.uint], opvCo(opv), [2, 3, 4])]],
    [[r.bind, r.vCollection_merge, r.text, r.end_scope, u.e, u.end_scope, 1, u.a, u.end_scope, 0], [bindO(r.vCollection_merge, [r.text], opvCo(opt), [2, sTex([u.e]), sTex([u.a])])]],
])('parse(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        expect(s.scope_stack.length).toBe(1)
        expect(s.root.items).toEqual(o)
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
test.each([
    [[r.IPv4, r.forward_ref, 0, r.uint, r.bind, r.back_ref, 1, 2], 2],
    [[r.forward_ref, 0, r.type_wrap, r.uint, r.end_scope, r.bind, r.back_ref, 1, 2], 2],
    [[r.forward_ref, 0, r.type_choice, r.locator, r.back_ref, 0, r.end_scope, r.bind, r.back_ref, 0, 1, 1, 0], { type: choice_symbol, items: [1, { type: choice_symbol, items: [1, { type: choice_symbol, items: [0] }] }] }],
    [[r.bind, r.type_choice, r.vIEEE_binary, r.type_choice, r.uint, r.sint, r.end_scope, r.end_scope, 1, 1, 2], { type: choice_symbol, items: [1, { type: choice_symbol, items: [1, 2] }] }],
    [[r.bind, r.type_collection, r.type_struct, r.vIEEE_binary, r.type_choice, r.uint, r.sint, r.end_scope, r.end_scope, r.end_scope, 0, u8, 1, 2], { type: collection_symbol, items: [{ type: multiple_symbol, items: [u8, { type: choice_symbol, items: [1, 2] }] }] }],
    [[r.bind, r.type_struct, r.vIEEE_binary, r.type_collection, r.type_choice, r.uint, r.sint, r.end_scope, r.end_scope, r.end_scope, u8, 0, 1, 2], { type: multiple_symbol, items: [u8, { type: collection_symbol, items: [{ type: choice_symbol, items: [1, 2] }] }] }],
    [[r.bind, r.type_struct, r.uint, r.bitSize, 7, r.bitSize, 7, r.bitSize, 23, r.bitSize, 47, r.uint, r.bitSize, 7, r.end_scope, 3, u8, u8, u8, 4, u8], { type: multiple_symbol, items: [3, 1, 2, 0x030401, { type: bits_symbol, items: [0x02030401, 0x0203, 16] }, 4, 1] }],
])('parse_strip(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        expect(s.scope_stack.length).toBe(1)
        //console.log((s.root as any).items[0].items[1])
        const ou = (s.root.items[s.root.items.length - 1] as Scope).items[1]
        function strip(x: Slot) {
            if (typeof x == 'object') {
                if (x instanceof Uint8Array) {
                    return x
                }
                return { type: x.type, items: x.items.map(y => strip(y as Slot)) }
            }
            return x
        }
        expect(strip(ou as Slot)).toEqual(o)
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
test.each([
    [[r.bind, r.end_scope], 'top of scope_stack invalid for end_scope'],
    [[r.function, r.end_scope], 'empty end_scope'],
    [[r.end_scope], 'empty end_scope'],
    [[r.back_ref, 0], 'invalid back_ref'],
    [[r.forward_ref, 0, r.bind, r.back_ref, 0, 2], 'invalid forward index'],
    [[r.forward_ref, 1, r.bind, r.back_ref, 0, 2], 'invalid forward index'],
    [[r.forward_ref, 1, r.type_struct, r.back_ref, 0, r.end_scope, r.type_struct, r.back_ref, 1, r.end_scope, r.bind, r.back_ref, 1, 2], 'max forward depth'],
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