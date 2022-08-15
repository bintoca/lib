import { parse, write, finishWrite, structure_sym, Item, createDecoder, continueDecode, read, createEncoder, writeBuffer, ParseType, write_checked, ParseOp, Scope, choice_sym, Slot, collection_sym, collection_stream_sym, bits_sym } from '@bintoca/dbuf/codec'
import { r, u } from '@bintoca/dbuf/registry'
import { zigzagEncode, zigzagDecode, unicodeToText, textToUnicode, getLeap_millis, getLeap_millis_tai, strip } from '@bintoca/dbuf/util'
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
    if (o[o.length - 1] == 0) {
        o.pop()
    }
    expect(o).toEqual(i)
})
test('overflow', () => {
    const dv = new DataView(new ArrayBuffer(12))
    dv.setUint32(0, 0x00FFFFFF)
    dv.setUint32(4, 0x00000000)
    dv.setUint32(8, 0x01000010)
    expect(read(createDecoder(dv))).toBe(2)
})
test('stream_start', () => {
    const dv = new DataView(new ArrayBuffer(12))
    dv.setUint32(0, 0x80000000)
    const er = parse(dv)
    expect((er as any).items[1].items[1].items[0]).toEqual(r.error_stream_start_bit)
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
    if (o[o.length - 1] == 0) {
        o.pop()
    }
    expect(o).toEqual(i)
})
test('stringText', () => {
    for (let i = 0; i < 256; i++) {
        expect(textToUnicode(unicodeToText(i))).toBe(i)
    }
    const a = []
    const s = ' aeinot\n!"\',-./:?ABCXYZabcxyz\0~😀'
    for (let x of s) {
        a.push(unicodeToText(x.codePointAt(0)))
    }
    const a1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 41, 42, 43, 2, 44, 45, 61, 62, 63, 64, 127, 128513]
    expect(a).toEqual(a1)
    expect(String.fromCodePoint(...a1.map(x => textToUnicode(x)))).toEqual(s)
})
test('magicNumber', () => {
    const dv = new DataView(new ArrayBuffer(4))
    dv.setUint8(1, 'D'.codePointAt(0))
    dv.setUint8(2, 'B'.codePointAt(0))
    dv.setUint8(3, 'U'.codePointAt(0))
    expect(dv.getUint32(0)).toBe(r.magic_number)
})
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
const op1 = (p: ParseType): ParseOp => { return { type: p } }
const opv = op1(ParseType.varint)
const opvb = op1(ParseType.block_variable)
const opvbi = op1(ParseType.bit_variable)
const opt = op1(ParseType.text_plain)
const bind_uint_in = [r.bind, r.integer_unsigned, 2]
const bind_uint_out = { type: r.bind, needed: 2, items: [r.integer_unsigned, 2], op: op1(ParseType.item) }
const u8 = new Uint8Array([1, 2, 3, 4])
const bind = (t: Slot, v: Item): Scope => { return { type: r.bind, needed: 2, items: [t, v], op: op1(ParseType.item) } }
const bindO = (t: r, items: Item[], p: ParseOp, v: Item | Item[]): Scope => {
    if (Array.isArray(v)) {
        let i = 0
        function rr(op: ParseOp, tt: Item[]): Scope {
            if (op.type == ParseType.collection || op.type == ParseType.collection_stream) {
                const it = []
                const x = op.ops[0]
                const z = tt[0]
                const count = v[i]
                i++
                for (let k = 0; k < count; k++) {
                    if (x.type == ParseType.struct) {
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
                return { type: collection_sym, needed: it.length, items: it, ops: op.ops, parseIndex: 0 }
            }
            const it = []
            let j = 0
            for (let x of op.ops) {
                const z = tt[j]
                if (x.type == ParseType.struct) {
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
            return { type: structure_sym, needed: op.ops.length, items: it, ops: op.ops, parseIndex: op.ops.length }
        }
        v = rr(p, items)
    }
    return { type: r.bind, needed: 2, items: [need0(t, items, p), v], op: op1(ParseType.item) }
}
const need0 = (type: r | symbol, items: Item[], op?: ParseOp) => { return { type, items, op } }
const needN = (type: r | symbol, items: Item[], op?: ParseOp) => { return { type, needed: items.length, items, op } }
const opB = (n: number): ParseOp => { return { type: ParseType.block_size, size: n } }
const opBi = (n: number): ParseOp => { return { type: ParseType.bit_size, size: n } }
const opC = (n: ParseOp[]): ParseOp => { return { type: ParseType.choice, ops: n } }
const opCo = (n: ParseOp): ParseOp => { return { type: ParseType.collection, ops: [n] } }
const opvCo = (n: ParseOp): ParseOp => { return { type: ParseType.collection_stream, ops: [n] } }
const opM = (n: ParseOp[]): ParseOp => { return { type: ParseType.struct, ops: n } }
const sTex = (items: Item[]): Scope => { return { type: r.text_plain, inText: true, items } }
const bText = (items: Item[]) => bind(r.text_plain, sTex(items))
test.each([
    [[r.IPv4], r.IPv4],
    [[r.magic_number, r.IPv4], needN(r.magic_number, [r.IPv4])],
    [[r.bind, r.text_plain, u.a, u.end_scope], bText([u.a])],
    [[r.bind, r.IEEE_754_binary, u8], bind(r.IEEE_754_binary, u8)],
    [[r.bind, r.bind, r.IEEE_754_binary, u8, r.IPv4], bind(bind(r.IEEE_754_binary, u8), r.IPv4)],
    [[r.bind, r.parse_none, r.bind, r.IEEE_754_binary, u8], bind(needN(r.parse_none, [bind(r.IEEE_754_binary, u8)], op1(ParseType.none)), bind(r.IEEE_754_binary, u8))],
    [[r.bind, r.parse_bit_size, 19, u8], bind(needN(r.parse_bit_size, [20], opBi(20)), 32 + 4096)],
    [[r.bind, r.parse_varint_plus_block, 2, u8], bind(r.parse_varint_plus_block, new Uint8Array([0, 0, 0, 2, 1, 2, 3, 4]))],
    [[r.bind, r.type_wrap, r.IEEE_754_binary, r.parse_block_size, 0, r.end_scope, u8], bindO(r.type_wrap, [r.IEEE_754_binary, needN(r.parse_block_size, [1], opB(1))], opB(1), u8)],
    [[r.bind, r.type_wrap, r.IEEE_754_binary, r.parse_block_variable, r.end_scope, 0, u8], bindO(r.type_wrap, [r.IEEE_754_binary, r.parse_block_variable], opvb, u8)],
    [[r.bind, r.type_wrap, r.integer_unsigned, r.end_scope, 5], bindO(r.type_wrap, [r.integer_unsigned,], opv, 5)],
    [[r.bind, r.type_wrap, r.integer_unsigned, r.parse_bit_variable, r.end_scope, 8, u8], bindO(r.type_wrap, [r.integer_unsigned, r.parse_bit_variable], opvbi, 2)],
    [[r.bind, r.type_wrap, r.integer_unsigned, r.parse_item, r.end_scope, ...bind_uint_in], bindO(r.type_wrap, [r.integer_unsigned, r.parse_item], op1(ParseType.item), bind_uint_out)],
    [[r.bind, r.type_wrap, r.text_plain, r.end_scope, u.e, u.end_scope], bindO(r.type_wrap, [r.text_plain], opt, sTex([u.e]))],
    [[r.bind, r.TAI_seconds, u8], bind(r.TAI_seconds, u8)],
    [[r.bind, r.type_choice, r.blocks_read, r.IEEE_754_binary, r.end_scope, 1, u8], bindO(r.type_choice, [r.blocks_read, r.IEEE_754_binary], opC([op1(ParseType.varint), opB(1)]), needN(choice_sym, [1, u8], opB(1)))],
    [[r.bind, r.type_choice, r.IEEE_754_binary, r.integer_unsigned, r.end_scope, 1], bindO(r.type_choice, [r.IEEE_754_binary, r.integer_unsigned], opC([opB(1), opv]), needN(choice_sym, [1, 0], opv))],
    [[r.bind, r.type_structure, r.IEEE_754_binary, r.type_structure, r.integer_unsigned, r.integer_signed, r.end_scope, r.end_scope, u8, 1, 2], bindO(r.type_structure, [r.IEEE_754_binary, need0(r.type_structure, [r.integer_unsigned, r.integer_signed])], opM([opB(1), opM([opv, opv])]), [u8, 1, 2])],
])('parse(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        function strip(x: Item) {
            if (typeof x == 'object') {
                if (x instanceof Uint8Array) {
                    return x
                }
                const d: Scope = { type: x.type, items: x.items.map(y => strip(y)), needed: x.needed, op: x.op, ops: x.ops, parseIndex: x.parseIndex, inText: x.inText }
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
test.each([
    [[r.bind, r.bind, r.IEEE_754_binary, u8, r.IPv4], r.IPv4],
    [[r.bind, r.type_wrap, r.integer_unsigned, r.end_scope, 2], 2],
    [[r.bind, r.type_choice, r.integer_unsigned, r.type_choice_index, r.end_scope, 1, 0, 2], { type: choice_sym, items: [1, { type: choice_sym, items: [0, 2] }] }],
    [[r.bind, r.type_choice, r.integer_unsigned, r.type_choice, r.text_plain, r.type_choice_index, r.end_scope, r.end_scope, 1, 1, 0, u.a, u.end_scope], { type: choice_sym, items: [1, { type: choice_sym, items: [1, { type: choice_sym, items: [0, { type: r.text_plain, items: [u.a] }] }] }] }],
    [[r.bind, r.type_choice, r.integer_unsigned, r.type_structure, r.type_choice, r.text_plain, r.type_choice_index, r.end_scope, r.type_choice_index, r.end_scope, r.end_scope, 1, 1, 0, u.e, u.end_scope, 0, 5], { type: choice_sym, items: [1, { type: structure_sym, items: [{ type: choice_sym, items: [1, { type: choice_sym, items: [0, { type: r.text_plain, items: [u.e] }] }] }, { type: choice_sym, items: [0, 5] }] }] }],
    [[r.bind, r.type_choice, r.IEEE_754_binary, r.type_choice, r.integer_unsigned, r.integer_signed, r.end_scope, r.end_scope, 1, 1], { type: choice_sym, items: [1, { type: choice_sym, items: [1, 0] }] }],
    [[r.bind, r.type_collection, r.integer_unsigned, 0, 2, 3, 4, 1, 5, 0], { type: collection_stream_sym, items: [{ type: collection_sym, items: [3, 4] }, { type: collection_sym, items: [5] }] }],
    [[r.bind, r.type_collection, r.type_structure, r.IEEE_754_binary, r.type_choice, r.integer_unsigned, r.integer_signed, r.end_scope, r.end_scope, 1, u8, 1], { type: collection_sym, items: [{ type: structure_sym, items: [u8, { type: choice_sym, items: [1, 0] }] }] }],
    [[r.bind, r.type_structure, r.IEEE_754_binary, r.type_collection, r.type_choice, r.integer_unsigned, r.integer_signed, r.end_scope, r.end_scope, u8, 1, 1], { type: structure_sym, items: [u8, { type: collection_sym, items: [{ type: choice_sym, items: [1, 0] }] }] }],
    [[r.bind, r.type_structure, r.integer_unsigned, r.parse_bit_size, 7, r.parse_bit_size, 7, r.parse_bit_size, 23, r.parse_bit_size, 47, r.integer_unsigned, r.parse_bit_size, 7, r.end_scope, 3, u8, u8, u8, 4, u8], { type: structure_sym, items: [3, 1, 2, 0x030401, { type: bits_sym, items: [0x02030401, 0x0203, 16] }, 4, 1] }],
])('parse_strip(%#)', (i, o) => {
    const w = writer(i)
    try {
        const s = parse(w)
        //console.log((s.root as any).items[0].items[1])
        if (typeof s == 'number') {
            expect(s).toEqual(o)
        }
        else {
            const ou = (s as Scope).items[1]
            expect(strip(ou)).toEqual(o)
        }
    }
    catch (e) {
        console.log(w)
        throw e
    }
})
test.each([
    [[r.bind, r.end_scope], r.error_invalid_end_scope],
    [[r.bind, r.type_choice, r.IEEE_754_binary, r.end_scope, 3], r.error_invalid_choice_index],
    [[r.bind, r.type_choice, r.integer_unsigned,], r.error_unfinished_parse_stack],
    [[r.bind, r.text_plain, 0xFFFFFF], r.error_invalid_text_value],
    [[0xFFFFFF], r.error_invalid_registry_value],
])('parseError(%#)', (i, o) => {
    const er = parse(writer(i))
    expect((er as any).items[1].items[1].items[0]).toEqual(o)
})