import { r, u } from '@bintoca/dbuf/registry'
import { bufToDV, bufToU8, log, debug } from '@bintoca/dbuf/util'

export const shiftInit = [
    [8, 29], [8, 26], [8, 23], [8, 20], [8, 17], [8, 14], [8, 11], [8, 8],//7
    [11, 29], [11, 26], [11, 23], [11, 20], [11, 17], [11, 14], [11, 11],//14
    [14, 29], [14, 26], [14, 23], [14, 20], [14, 17], [14, 14],//20
    [17, 29], [17, 26], [17, 23], [17, 20], [17, 17],//25
    [20, 29], [20, 26], [20, 23], [20, 20],//29
    [23, 29], [23, 26], [23, 23],//32
    [26, 29], [26, 26],//34
    [29, 29]//35
]
export const shiftMap = [
    [7], [6, 35], [5, 33, 35], [5, 34], [4, 30, 34], [4, 30, 33, 35], [4, 31, 35], [4, 32],
    [3, 26, 32], [3, 26, 31, 35], [3, 26, 30, 33, 35], [3, 26, 30, 34], [3, 27, 34], [3, 27, 33, 35], [3, 28, 35], [3, 29],
    [2, 21, 29], [2, 21, 28, 35], [2, 21, 27, 33, 35], [2, 21, 27, 34], [2, 21, 26, 30, 34], [2, 21, 26, 30, 33, 35], [2, 21, 26, 31, 35], [2, 21, 26, 32],
    [2, 22, 32], [2, 22, 31, 35], [2, 22, 30, 33, 35], [2, 22, 30, 34], [2, 23, 34], [2, 23, 33, 35], [2, 24, 35], [2, 25],
    [1, 15, 25], [1, 15, 24, 35], [1, 15, 23, 33, 35], [1, 15, 23, 34], [1, 15, 22, 30, 34], [1, 15, 22, 30, 33, 35], [1, 15, 22, 31, 35], [1, 15, 22, 32],
    [1, 15, 21, 26, 32], [1, 15, 21, 26, 31, 35], [1, 15, 21, 26, 30, 33, 35], [1, 15, 21, 26, 30, 34], [1, 15, 21, 27, 34], [1, 15, 21, 27, 33, 35], [1, 15, 21, 28, 35], [1, 15, 21, 29],
    [1, 16, 29], [1, 16, 28, 35], [1, 16, 27, 33, 35], [1, 16, 27, 34], [1, 16, 26, 30, 34], [1, 16, 26, 30, 33, 35], [1, 16, 26, 31, 35], [1, 16, 26, 32],
    [1, 17, 32], [1, 17, 31, 35], [1, 17, 30, 33, 35], [1, 17, 30, 34], [1, 18, 34], [1, 18, 33, 35], [1, 19, 35], [1, 20],
    [0, 8, 20], [0, 8, 19, 35], [0, 8, 18, 33, 35], [0, 8, 18, 34], [0, 8, 17, 30, 34], [0, 8, 17, 30, 33, 35], [0, 8, 17, 31, 35], [0, 8, 17, 32],
    [0, 8, 16, 26, 32], [0, 8, 16, 26, 31, 35], [0, 8, 16, 26, 30, 33, 35], [0, 8, 16, 26, 30, 34], [0, 8, 16, 27, 34], [0, 8, 16, 27, 33, 35], [0, 8, 16, 28, 35], [0, 8, 16, 29],
    [0, 8, 15, 21, 29], [0, 8, 15, 21, 28, 35], [0, 8, 15, 21, 27, 33, 35], [0, 8, 15, 21, 27, 34], [0, 8, 15, 21, 26, 30, 34], [0, 8, 15, 21, 26, 30, 33, 35], [0, 8, 15, 21, 26, 31, 35], [0, 8, 15, 21, 26, 32],
    [0, 8, 15, 22, 32], [0, 8, 15, 22, 31, 35], [0, 8, 15, 22, 30, 33, 35], [0, 8, 15, 22, 30, 34], [0, 8, 15, 23, 34], [0, 8, 15, 23, 33, 35], [0, 8, 15, 24, 35], [0, 8, 15, 25],
    [0, 9, 25], [0, 9, 24, 35], [0, 9, 23, 33, 35], [0, 9, 23, 34], [0, 9, 22, 30, 34], [0, 9, 22, 30, 33, 35], [0, 9, 22, 31, 35], [0, 9, 22, 32],
    [0, 9, 21, 26, 32], [0, 9, 21, 26, 31, 35], [0, 9, 21, 26, 30, 33, 35], [0, 9, 21, 26, 30, 34], [0, 9, 21, 27, 34], [0, 9, 21, 27, 33, 35], [0, 9, 21, 28, 35], [0, 9, 21, 29],
    [0, 10, 29], [0, 10, 28, 35], [0, 10, 27, 33, 35], [0, 10, 27, 34], [0, 10, 26, 30, 34], [0, 10, 26, 30, 33, 35], [0, 10, 26, 31, 35], [0, 10, 26, 32],
    [0, 11, 32], [0, 11, 31, 35], [0, 11, 30, 33, 35], [0, 11, 30, 34], [0, 12, 34], [0, 12, 33, 35], [0, 13, 35], [0, 14]
]
export const shiftLookup = shiftMap.map(x => x.map(y => shiftInit[y])).concat(shiftMap.map(x => x.map(y => shiftInit[y])))
export const meshMap = []
for (let i = 0; i < 128; i++) {
    const m = [0]
    let a = 128
    let last = false
    for (let j = 0; j < 8; j++) {
        const current = (a & i) > 0
        if (current != last) {
            m.push(j)
        }
        last = current
        a = a / 2
    }
    m.push(0)
    meshMap[i] = m
    meshMap[i + 128] = m
}
export const maskMap = [
    0b11111111111111111111111111111111,
    0b11111111000111111111111111111111,
    0b10111111000000111111111111111111,
    0b10011111000000000111111111111111,
    0b10001111000000000000111111111111,
    0b10000111000000000000000111111111,
    0b10000011000000000000000000111111,
    0b10000001000000000000000000000111,
    0b10000000000000000000000000000000,
]
export type DecoderState = { temp: number[], mesh: number, tempCount: number, tempIndex: number, dv: DataView, dvOffset: number, partialBlock: number, partialBlockRemaining: number, tempChoice?: number }
export const decodeVarintBlock = (s: DecoderState, x: number) => {
    let mesh = x >>> 24
    s.mesh = mesh
    const continueBit = mesh >>> 7
    const a = shiftLookup[mesh]
    s.temp[0] = ((s.temp[s.tempIndex] << (32 - a[0][1])) >>> 0) + ((x << a[0][0]) >>> a[0][1])
    for (let i = 1; i < a.length; i++) {
        s.temp[i] = (x << a[i][0]) >>> a[i][1]
    }
    s.temp[a.length] = 0
    s.tempCount = continueBit ? a.length - 1 : a.length
    s.tempIndex = 0
}
export const createDecoder = (b: BufferSource): DecoderState => {
    if (b.byteLength == 0 || b.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes, length: ' + b.byteLength)
    }
    const dv = bufToDV(b)
    return { temp: [0, 0, 0, 0, 0, 0, 0, 0, 0], mesh: 0, tempCount: 0, tempIndex: 0, dv, dvOffset: 0, partialBlock: 0, partialBlockRemaining: 0 }
}
const testDecoder = createDecoder(new ArrayBuffer(8))
decodeVarintBlock(testDecoder, 0xaf279000)
//console.log('testDecoder', testDecoder)
export const read = (s: DecoderState): number => {
    if (s.tempChoice !== undefined) {
        const v = s.tempChoice
        s.tempChoice = undefined
        return v
    }
    while (s.tempCount == 0) {
        decodeVarintBlock(s, s.dv.getUint32(s.dvOffset))
        s.dvOffset += 4
    }
    const v = s.temp[s.tempIndex]
    s.tempIndex++
    if (s.tempIndex == s.tempCount) {
        s.tempCount = 0
    }
    s.partialBlockRemaining = 0
    return v
}
export const read_blocks = (s: DecoderState, n: number) => {
    const l = n * 4
    let o = 0
    const d = new DataView(new ArrayBuffer(l))
    while (o < l) {
        d.setUint32(o, s.dv.getUint32(s.dvOffset))
        s.dvOffset += 4
        o += 4
    }
    s.partialBlockRemaining = 0
    return bufToU8(d)
}
export const read_bits = (s: DecoderState, n: number): number | Scope => {
    function rb(s: DecoderState, n: number) {
        if (s.partialBlockRemaining == 0) {
            s.partialBlock = s.dv.getUint32(s.dvOffset)
            s.dvOffset += 4
            s.partialBlockRemaining = 32
        }
        if (s.partialBlockRemaining >= n) {
            const r = (s.partialBlock << (32 - s.partialBlockRemaining)) >>> (32 - n)
            s.partialBlockRemaining -= n
            return r
        }
        if (n <= 32) {
            const c = n - s.partialBlockRemaining
            const hi = (s.partialBlock << (32 - s.partialBlockRemaining)) >>> (32 - n)
            s.partialBlock = s.dv.getUint32(s.dvOffset)
            s.dvOffset += 4
            s.partialBlockRemaining = 32
            const lo = (s.partialBlock >>> (32 - c))
            s.partialBlockRemaining -= c
            return hi | lo
        }
    }
    if (n > 32) {
        const sc: Scope = { type: bits_sym, items: [], op: { type: ParseType.bit_size } }
        while (true) {
            if (n > 32) {
                sc.items.push(rb(s, 32))
                n -= 32
            }
            else {
                sc.items.push(rb(s, n))
                sc.items.push(n)
                break
            }
        }
        return sc
    }
    const r = rb(s, n)
    return r
}
export const read_string = (ds: DecoderState): Uint8Array => {
    const begin = ds.tempCount == 0 ? ds.dvOffset : ds.dvOffset - 4
    const meshPosition = meshMap[ds.mesh][ds.tempIndex]
    const length = read(ds)
    if (length == 0) {
        return null
    }
    const lengthBeyondThisBlock = length - (8 - meshMap[ds.mesh][ds.tempIndex])
    const blocks = Math.ceil(lengthBeyondThisBlock / 8)
    const dv = new DataView(new ArrayBuffer(ds.dvOffset - begin + blocks * 4))
    let o = 0
    ds.dvOffset = begin
    let firstBlock = ds.dv.getUint32(ds.dvOffset)
    if (1 << (31 - meshPosition) & firstBlock) {
        firstBlock = firstBlock ^ 0x7f000000
    }
    dv.setUint32(o, firstBlock & maskMap[meshPosition])
    ds.dvOffset += 4
    o += 4
    while (o < dv.byteLength) {
        dv.setUint32(o, ds.dv.getUint32(ds.dvOffset))
        ds.dvOffset += 4
        o += 4
    }
    const endMeshPosition = lengthBeyondThisBlock < 0 ? (8 + lengthBeyondThisBlock) : lengthBeyondThisBlock % 8
    ds.dvOffset -= 4
    ds.tempCount = 0
    debug('read_text', length, meshPosition, lengthBeyondThisBlock, blocks, endMeshPosition, ds)
    read(ds)
    while (meshMap[ds.mesh][ds.tempIndex] < endMeshPosition) {
        read(ds)
    }
    return bufToU8(dv)
}
export const map_sym = Symbol.for('https://bintoca.com/symbol/map')
export const choice_sym = Symbol.for('https://bintoca.com/symbol/choice')
export const choice_append_sym = Symbol.for('https://bintoca.com/symbol/choice_append')
export const array_sym = Symbol.for('https://bintoca.com/symbol/array')
export const array_stream_sym = Symbol.for('https://bintoca.com/symbol/array_stream')
export const string_stream_sym = Symbol.for('https://bintoca.com/symbol/string_stream')
export const bits_sym = Symbol.for('https://bintoca.com/symbol/bits')
export type Scope = { type: r | symbol, needed?: number, items: Item[], result?, op: ParseOp, ops?: ParseOp[], start?: ParsePosition, end?: ParsePosition, parent?: Scope, parentIndex?: number }
export type Slot = Scope | number
export type Item = Slot | Uint8Array
export const enum ParseType { varint, item, item_or_none, block_size, block_variable, bit_size, bit_variable, string, string_stream, array, array_stream, choice, choice_index, choice_bit_size, choice_append, map, varint_plus_block, none }
export type ParseOp = { type: ParseType, size?: number, ops?: ParseOp[], op?: ParseOp, item?: Item, choiceRest?: boolean }
export type ParsePlan = { ops: ParseOp[], index: number }
export type ParseState = { root: Scope, scope_stack: Scope[], decoder: DecoderState, choice_stack: ParseOp[] }
export type ParsePosition = { dvOffset: number, tempIndex: number, partialBlockRemaining: number }
export const createError = (er: r | Scope): Scope => { return { type: r.bind, items: [r.error, er], op: undefined } }
export const isError = (x) => x.type == r.bind && Array.isArray(x.items) && x.items[0] == r.error
export const createStruct = (fields: Slot[], values: Item[]): Scope => { return { type: r.bind, items: [{ type: r.type_map, items: fields, op: undefined }, { type: map_sym, items: values, op: undefined }], op: undefined } }
export const createWrap = (slots: Slot[]): Scope => { return { type: r.bind, items: slots, op: undefined } }
export const parseError = (s: ParseState, regError: r) => parseErrorPos(createPosition(s.decoder), regError)
export const parseErrorPos = (pos: ParsePosition, regError: r) => {
    const fields = [r.error, createWrap([r.blocks_read, r.integer_unsigned,])]
    const values = [regError, pos.dvOffset / 4]
    if (pos.tempIndex !== undefined) {
        fields.push(createWrap([r.block_varint_index, r.integer_unsigned,]))
        values.push(pos.tempIndex)
    }
    if (pos.partialBlockRemaining !== undefined) {
        fields.push(createWrap([r.block_bits_remaining, r.integer_unsigned,]))
        values.push(pos.partialBlockRemaining)
    }
    return createError(createStruct(fields, values))
}
export const resolveItemOp = (x: Item): ParseOp => {
    if (typeof x == 'object') {
        const s = x as Scope
        return s.op
    }
    else {
        switch (x) {
            case r.parse_varint:
            case r.fixed_point_binary_places:
            case r.fixed_point_decimal_places:
            case r.years:
            case r.months:
            case r.days:
            case r.hours:
            case r.minutes:
            case r.seconds:
            case r.weeks:
            case r.week_day:
            case r.IP_port:
            case r.integer_unsigned:
            case r.integer_signed:
            case r.integer_negative:
            case r.blocks_read:
            case r.block_varint_index:
            case r.block_bits_remaining:
            case r.repeat_count:
            case r.bool:
            case r.offset_shift_left:
                return { type: ParseType.varint }
            case r.bool_bit:
                return { type: ParseType.bit_size, size: 1 }
            case r.parse_bit_variable:
                return { type: ParseType.bit_variable }
            case r.parse_block_variable:
                return { type: ParseType.block_variable }
            case r.IEEE_754_decimal32:
            case r.IEEE_754_binary32:
            case r.IPv4:
                return { type: ParseType.block_size, size: 1 }
            case r.IEEE_754_decimal64:
            case r.IEEE_754_binary64:
                return { type: ParseType.block_size, size: 2 }
            case r.IEEE_754_decimal128:
            case r.IEEE_754_binary128:
            case r.IPv6:
            case r.UUID:
                return { type: ParseType.block_size, size: 4 }
            case r.IEEE_754_binary256:
            case r.SHA256:
                return { type: ParseType.block_size, size: 8 }
            case r.parse_varint_plus_block:
                return { type: ParseType.varint_plus_block }
            case r.text_plain:
            case r.text_idna:
            case r.text_iri:
            case r.binary_string:
                return { type: ParseType.string }
            case r.parse_item:
                return { type: ParseType.item }
        }
    }
    return { type: ParseType.item_or_none, item: x }
}
export const isInvalidText = (n: number) => n > 0x10FFFF
export const isInvalidRegistry = (n: number) => n > r.magic_number || (n < r.magic_number && n > 600) || (n < 512 && n > 200)
export const createPosition = (s: DecoderState): ParsePosition => { return { dvOffset: s.dvOffset, tempIndex: s.tempCount ? s.tempIndex : undefined, partialBlockRemaining: s.partialBlockRemaining ? s.partialBlockRemaining : undefined } }
export const parseText = (b: BufferSource, st: ParseState): Item => {
    try {
        const decoder = createDecoder(b)
        const length = read(decoder)
        const endMeshPosition = (meshMap[decoder.mesh][decoder.tempIndex] + length) % 8;
        debug('parseText', length, endMeshPosition, decoder)
        const items = []
        while (true) {
            const x = read(decoder)
            if (isInvalidText(x)) {
                return parseError(st, r.error_invalid_text_value)
            }
            items.push(x)
            if (decoder.dvOffset == decoder.dv.byteLength && meshMap[decoder.mesh][decoder.tempIndex] >= endMeshPosition) {
                break
            }
        }
        return { type: r.text_plain, items, op: { type: ParseType.string } }
    }
    catch (e) {
        throw 'error parsing string: ' + e.message
    }
}
export const parse = (b: BufferSource): Item => {
    const root = { type: array_sym, items: [], op: { type: ParseType.item } }
    const st: ParseState = { root, scope_stack: [root], decoder: createDecoder(b), choice_stack: [] }
    try {
        const scope_top = () => st.scope_stack[st.scope_stack.length - 1]
        const scope_push = (s: Scope) => {
            s.start = position
            s.parent = scope_top()
            s.parentIndex = s.parent.items.length
            st.scope_stack.push(s)
        }
        const collapse_scope = (x: Item) => {
            let loop = true
            let i = x
            while (loop) {
                const t = scope_top()
                t.items.push(i)
                if (t.type == r.bind) {
                    if (t.items.length == 1) {
                        t.op = resolveItemOp(i)
                    }
                    else {
                        if (t.op.type == ParseType.item) {
                            t.op = resolveItemOp(i)
                        }
                        else {
                            t.op = { type: ParseType.item_or_none }
                        }
                        if (t.op.type == ParseType.item_or_none) {
                            t.op.item = t
                        }
                    }
                }
                else if (t.type == r.parse_none) {
                    t.op = { type: ParseType.none, item: t.items[0] }
                }
                else if (t.type == r.type_array) {
                    t.op = { type: ParseType.array, op: resolveItemOp(i) }
                }
                else if (t.type == map_sym) {
                    t.op = t.ops[t.items.length]
                }
                else if (t.type == choice_append_sym) {
                    st.choice_stack[st.choice_stack.length - 1].ops.push(resolveItemOp(i))
                }
                if (t.items.length == t.needed) {
                    t.end = createPosition(ds)
                    if (t.type == choice_sym) {
                        st.choice_stack.pop()
                    }
                    i = st.scope_stack.pop()
                }
                else {
                    loop = false
                }
            }
        }
        let position: ParsePosition
        const ds = st.decoder
        while (root.items.length == 0) {
            const top = scope_top()
            position = createPosition(ds)
            const op = top.op
            switch (op.type) {
                case ParseType.choice_index: {
                    if (st.choice_stack.length == 0) {
                        return parseError(st, r.error_invalid_choice_indexer)
                    }
                    scope_push({ type: r.type_choice_indexer, needed: 1, items: [], op: st.choice_stack[st.choice_stack.length - 1] })
                    break
                }
                case ParseType.choice_append: {
                    if (st.choice_stack.length == 0) {
                        return parseError(st, r.error_invalid_choice_append)
                    }
                    scope_push({ type: choice_append_sym, needed: 1, items: [], op: { type: ParseType.item } })
                    break
                }
                case ParseType.choice_bit_size: {
                    const c = read_bits(ds, op.item as number) as number
                    if (op.ops.length <= c) {
                        return parseError(st, r.error_invalid_choice_index)
                    }
                    scope_push({ type: choice_sym, needed: 2, items: [c], op: op.ops[c] })
                    break
                }
                case ParseType.choice: {
                    st.choice_stack.push(op)
                    const lop = op.ops[op.ops.length - 1]
                    const c = read(ds)
                    let cop: ParseOp
                    switch (lop.type) {
                        case ParseType.bit_size:
                        case ParseType.block_size:
                        case ParseType.choice:
                        case ParseType.choice_index:
                        case ParseType.choice_append:
                        case ParseType.array:
                        case ParseType.array_stream:
                        case ParseType.none:
                        case ParseType.map:
                            if (op.ops.length <= c) {
                                return parseError(st, r.error_invalid_choice_index)
                            }
                            cop = op.ops[c]
                            break
                        case ParseType.bit_variable:
                        case ParseType.block_variable:
                        case ParseType.item:
                        case ParseType.item_or_none:
                        case ParseType.string:
                        case ParseType.varint:
                        case ParseType.varint_plus_block:
                            if (op.ops.length - 1 <= c) {
                                ds.tempChoice = c - (op.ops.length - 1)
                                cop = lop
                            }
                            else {
                                cop = op.ops[c]
                            }
                            break
                        default:
                            throw 'not implemented ParseType: ' + lop.type
                    }
                    scope_push({ type: choice_sym, needed: 2, items: [c], op: cop })
                    break
                }
                case ParseType.item_or_none: {
                    op.type = top.type == choice_sym && top.parent.type != map_sym ? ParseType.none : ParseType.item
                    ds.tempChoice = undefined
                    break
                }
                case ParseType.varint: {
                    collapse_scope(read(ds))
                    break
                }
                case ParseType.block_size: {
                    collapse_scope(read_blocks(ds, op.size))
                    break
                }
                case ParseType.block_variable: {
                    collapse_scope(read_blocks(ds, read(ds) + 1))
                    break
                }
                case ParseType.bit_size: {
                    collapse_scope(read_bits(ds, op.size))
                    break
                }
                case ParseType.bit_variable: {
                    collapse_scope(read_bits(ds, read(ds) + 1))
                    break
                }
                case ParseType.varint_plus_block: {
                    const dv = new DataView(new ArrayBuffer(8))
                    dv.setUint32(0, read(ds))
                    dv.setUint32(4, ds.dv.getUint32(ds.dvOffset))
                    ds.dvOffset += 4
                    collapse_scope(bufToU8(dv))
                    break
                }
                case ParseType.map: {
                    scope_push({ type: map_sym, needed: op.ops.length, items: [], op: op.ops[0], ops: op.ops })
                    break
                }
                case ParseType.string: {
                    const s = read_string(ds)
                    if (s) {
                        collapse_scope(s)
                    }
                    else {
                        scope_push({ type: string_stream_sym, items: [], op: { type: ParseType.string_stream } })
                    }
                    break
                }
                case ParseType.string_stream: {
                    const s = read_string(ds)
                    if (s) {
                        collapse_scope(s)
                    }
                    else {
                        top.end = createPosition(ds)
                        collapse_scope(st.scope_stack.pop())
                    }
                    break
                }
                case ParseType.array: {
                    const l = read(ds)
                    if (l) {
                        scope_push({ type: array_sym, needed: l, items: [], op: op.op })
                    }
                    else {
                        scope_push({ type: array_stream_sym, items: [], op: { type: ParseType.array_stream, op: op.op } })
                    }
                    break
                }
                case ParseType.array_stream: {
                    const l = read(ds)
                    if (l) {
                        scope_push({ type: array_sym, needed: l, items: [], op: op.op })
                    }
                    else {
                        top.end = createPosition(ds)
                        collapse_scope(st.scope_stack.pop())
                    }
                    break
                }
                case ParseType.none: {
                    collapse_scope(op.item)
                    break
                }
                case ParseType.item: {
                    const x = read(ds)
                    switch (x) {
                        case r.type_map:
                        case r.type_parts:
                        case r.type_choice:
                        case r.type_choice_bit: {
                            scope_push({ type: x, items: [], op: { type: ParseType.item } })
                            break
                        }
                        case r.type_choice_indexer: {
                            collapse_scope({ type: x, items: [], op: { type: ParseType.choice_index } })
                            break
                        }
                        case r.type_choice_append: {
                            collapse_scope({ type: x, items: [], op: { type: ParseType.choice_append } })
                            break
                        }
                        case r.end_scope: {
                            if (top.needed) {
                                return parseError(st, r.error_invalid_end_scope)
                            }
                            top.end = createPosition(ds)
                            if (top.items.length) {
                                switch (top.type) {
                                    case r.type_choice:
                                        top.op = { type: ParseType.choice, ops: top.items.map(x => resolveItemOp(x)) }
                                        break
                                    case r.type_choice_bit:
                                        const ops = top.items.map(x => resolveItemOp(x))
                                        top.op = { type: ParseType.choice_bit_size, ops, item: Math.ceil(Math.log2(ops.length)) || 1 }
                                        break
                                    case r.type_map:
                                    case r.type_parts:
                                        top.op = { type: ParseType.map, ops: top.items.map(x => resolveItemOp(x)) }
                                        break
                                }
                            }
                            else {
                                top.op = { type: ParseType.none, item: r.placeholder }
                            }
                            const t = st.scope_stack.pop()
                            collapse_scope(t)
                            break
                        }
                        case r.parse_bit_size: {
                            const s = read(ds) + 1
                            scope_push({ type: x, needed: 1, items: [], op: { type: ParseType.bit_size, size: s } })
                            collapse_scope(s)
                            break
                        }
                        case r.parse_block_size: {
                            const s = read(ds) + 1
                            scope_push({ type: x, needed: 1, items: [], op: { type: ParseType.block_size, size: s } })
                            collapse_scope(s)
                            break
                        }
                        case r.quote_next: {
                            scope_push({ type: x, needed: 1, items: [], op: { type: ParseType.item } })
                            collapse_scope(read(ds))
                            break
                        }
                        case r.bind: {
                            scope_push({ type: x, needed: 2, items: [], op: { type: ParseType.item } })
                            break
                        }
                        case r.type_array:
                        case r.parse_none:
                        case r.magic_number: {
                            scope_push({ type: x, needed: 1, items: [], op: { type: ParseType.item } })
                            break
                        }
                        default:
                            if (isInvalidRegistry(x)) {
                                return parseError(st, r.error_invalid_registry_value)
                            }
                            collapse_scope(x)
                    }
                    break
                }
                default:
                    throw { message: 'not implemented ParseType: ' + op.type, st }
            }
        }
        return st.root.items[0]
    }
    catch (e) {
        if (isError(e)) {
            return e
        }
        if (e instanceof RangeError && e.message == 'Offset is outside the bounds of the DataView') {
            //console.log(st.scope_stack.slice(1).map(x => { return { type: x.type, items: x.items } }))
            return parseError(st, r.error_unfinished_parse_stack)
        }
        log(e, st)
        return parseError(st, r.error_internal)
    }
}
export type EncoderState = { buffers: Uint8Array[], dv: DataView, offset: number, mesh: number, meshBit: boolean, chunk: number, chunkSpace: number, queue: BufferSource[] }
export const createEncoder = (): EncoderState => {
    return { buffers: [], dv: new DataView(new ArrayBuffer(4096)), offset: 0, mesh: 0, meshBit: false, chunk: 0, chunkSpace: 8, queue: [] }
}
export const maxInteger = 0xFFFFFFFF
export const sizeLookup = [11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1]
export const maskLookup = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((x, i) => i == 11 ? maxInteger : 2 ** (i * 3) - 1)
export const write = (s: EncoderState, x: number, size?: number) => {
    let remaining = size || sizeLookup[Math.clz32(x)]
    while (true) {
        const len = s.chunkSpace > remaining ? remaining : s.chunkSpace
        const s1 = s.chunkSpace - len
        s.chunk += ((x & maskLookup[remaining]) >>> ((remaining - len) * 3)) << s1 * 3
        if (s.meshBit) {
            s.mesh += ((1 << len) - 1) << s1
        }
        s.chunkSpace -= len
        remaining -= len
        if (s.chunkSpace == 0) {
            if (s.dv.byteLength == s.offset) {
                s.buffers.push(bufToU8(s.dv))
                s.dv = new DataView(new ArrayBuffer(4096))
                s.offset = 0
            }
            if (remaining != 0) {
                s.mesh += 128
            }
            s.dv.setUint32(s.offset, (s.mesh << 24) + s.chunk)
            s.offset += 4
            s.chunkSpace = 8
            s.chunk = 0
            s.mesh = 0
            s.meshBit = false
            flushQueueBuffers(s)
        }
        else if (remaining == 0) {
            s.meshBit = !s.meshBit
            break
        }
        if (remaining == 0) {
            break
        }
    }
}
export const write_checked = (s: EncoderState, x: number, size?: number) => {
    if (x < 0 || Math.floor(x) !== x || x > maxInteger || isNaN(x) || !isFinite(x)) {
        throw new Error('invalid number')
    }
    if (size) {
        if (size < 0 || Math.floor(size) !== size || size > 11 || isNaN(size) || !isFinite(size)) {
            throw new Error('invalid size')
        }
    }
    write(s, x, size)
}
export const writeBuffer = (st: EncoderState, x: BufferSource) => {
    if (x.byteLength == 0 || x.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes')
    }
    st.queue.push(x)
}
export const flushQueueBuffers = (s: EncoderState) => {
    if (s.queue.length) {
        for (let b of s.queue) {
            const dv = bufToDV(b)
            let off = 0
            while (off < dv.byteLength) {
                if (s.dv.byteLength == s.offset) {
                    s.buffers.push(bufToU8(s.dv))
                    s.dv = new DataView(new ArrayBuffer(4096))
                    s.offset = 0
                }
                s.dv.setUint32(s.offset, dv.getUint32(off))
                s.offset += 4
                off += 4
            }
        }
        s.queue = []
    }
}
export const finishWrite = (s: EncoderState) => {
    if (s.chunkSpace != 8) {
        write(s, 0, s.chunkSpace)
    }
    flushQueueBuffers(s)
    s.buffers.push(bufToU8(s.dv, 0, s.offset))
}