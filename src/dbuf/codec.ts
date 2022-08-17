import { r, u } from '@bintoca/dbuf/registry'
import { bufToDV, bufToU8, log } from '@bintoca/dbuf/util'

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
export const shiftLookup = shiftMap.map(x => x.map(y => shiftInit[y]))
export type DecoderState = { partial: number, temp: number[], tempCount: number, tempIndex: number, dv: DataView, dvOffset: number, partialBlock: number, partialBlockRemaining: number, tempChoice?: number }
export const decodeVarintBlock = (s: DecoderState, x: number) => {
    let mesh = x >>> 24
    const newBit = mesh >>> 7
    if (newBit) {
        mesh = mesh ^ 255
    }
    const a = shiftLookup[mesh]
    if (newBit) {
        s.temp[0] = s.partial
        s.tempCount = a.length
        for (let i = 0; i < a.length - 1; i++) {
            s.temp[i + 1] = (x << a[i][0]) >>> a[i][1]
        }
        const an = a[a.length - 1]
        s.partial = (x << an[0]) >>> an[1]
    }
    else {
        if (a.length == 1) {
            s.tempCount = 0
            s.partial = ((s.partial << 24) >>> 0) + (x & 0xFFFFFF)
        }
        else {
            s.temp[0] = ((s.partial << (32 - a[0][1])) >>> 0) + ((x << a[0][0]) >>> a[0][1])
            s.tempCount = a.length - 1
            for (let i = 1; i < a.length - 1; i++) {
                s.temp[i] = (x << a[i][0]) >>> a[i][1]
            }
            const an = a[a.length - 1]
            s.partial = (x << an[0]) >>> an[1]
        }
    }
}
export const createDecoder = (b: BufferSource): DecoderState => {
    if (b.byteLength == 0 || b.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes, length: ' + b.byteLength)
    }
    const dv = bufToDV(b)
    return { partial: 0, temp: Array(8), tempCount: 0, tempIndex: 0, dv, dvOffset: 0, partialBlock: 0, partialBlockRemaining: 0 }
}
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
        s.tempCount = s.tempIndex = 0
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
        const sc: Scope = { type: bits_sym, items: [] }
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
export const structure_sym = Symbol.for('https://bintoca.com/symbol/structure')
export const choice_sym = Symbol.for('https://bintoca.com/symbol/choice')
export const collection_sym = Symbol.for('https://bintoca.com/symbol/collection')
export const collection_stream_sym = Symbol.for('https://bintoca.com/symbol/collection_stream')
export const bits_sym = Symbol.for('https://bintoca.com/symbol/bits')
export type Scope = { type: r | symbol, needed?: number, items: Item[], result?, inText?: boolean, op?: ParseOp, ops?: ParseOp[], start?: ParsePosition, end?: ParsePosition, parent?: Scope, parentIndex?: number }
export type Slot = Scope | number
export type Item = Slot | Uint8Array
export const enum ParseType { varint, item, block_size, block_variable, bit_size, bit_variable, text_plain, collection, collection_stream, choice, choice_index, struct, varint_plus_block, none }
export type ParseOp = { type: ParseType, size?: number, ops?: ParseOp[], op?: ParseOp, item?: Item, choiceRest?: boolean }
export type ParsePlan = { ops: ParseOp[], index: number }
export type ParseState = { root: Scope, scope_stack: Scope[], decoder: DecoderState, choice_stack: ParseOp[] }
export type ParsePosition = { dvOffset: number, tempIndex: number, partialBlockRemaining: number }
export const createError = (er: r | Scope): Scope => { return { type: r.bind, items: [r.error, er] } }
export const isError = (x) => x.type == r.bind && Array.isArray(x.items) && x.items[0] == r.error
export const createStruct = (fields: Slot[], values: Item[]): Scope => { return { type: r.bind, items: [{ type: r.type_structure, items: fields }, { type: structure_sym, items: values }] } }
export const createWrap = (slots: Slot[]): Scope => { return { type: r.type_wrap, items: slots } }
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
export const resolveItemOp = (x: Item) => {
    if (typeof x == 'object') {
        const s = x as Scope
        if (s.op) {
            return s.op
        }
    }
    else {
        switch (x) {
            case r.parse_varint:
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
            case r.blocks_read:
            case r.block_varint_index:
            case r.block_bits_remaining:
                return { type: ParseType.varint }
            case r.parse_bit_variable:
                return { type: ParseType.bit_variable }
            case r.parse_block_variable:
                return { type: ParseType.block_variable }
            case r.IEEE_754_decimal:
            case r.IEEE_754_binary:
            case r.IPv4:
            case r.TAI_seconds:
                return { type: ParseType.block_size, size: 1 }
            case r.IPv6:
            case r.UUID:
                return { type: ParseType.block_size, size: 4 }
            case r.SHA256:
                return { type: ParseType.block_size, size: 8 }
            case r.parse_varint_plus_block:
                return { type: ParseType.varint_plus_block }
            case r.text_plain:
            case r.text_dns:
            case r.text_uri:
                return { type: ParseType.text_plain }
        }
    }
    return { type: ParseType.item }
}
export const isInvalidText = (n: number) => n > 0x10FFFF + 1
export const isInvalidRegistry = (n: number) => n > r.magic_number || (n < r.magic_number && n > 600) || (n < 512 && n > 200)
export const createPosition = (s: DecoderState): ParsePosition => { return { dvOffset: s.dvOffset, tempIndex: s.tempCount ? s.tempIndex : undefined, partialBlockRemaining: s.partialBlockRemaining ? s.partialBlockRemaining : undefined } }
export const parse = (b: BufferSource): Item => {
    const root = { type: collection_sym, items: [] }
    const st: ParseState = { root, scope_stack: [root], decoder: createDecoder(b), choice_stack: [] }
    try {
        if (st.decoder.dv.getUint8(0) >>> 7) {
            return parseError(st, r.error_stream_start_bit)
        }
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
                    t.op = t.items.length == 1 ? resolveItemOp(i) : { type: ParseType.item }
                }
                else if (t.type == r.parse_none) {
                    t.op = { type: ParseType.none, item: t.items[0] }
                }
                else if (t.type == r.type_collection) {
                    t.op = { type: ParseType.collection, op: resolveItemOp(i) }
                }
                if (t.items.length == t.needed) {
                    t.end = createPosition(ds)
                    if (t.type == r.type_wrap) {
                        //t.op = resolveItemOp(i)
                    }
                    else if (t.type == choice_sym) {
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
            let op = top.ops ? top.ops[top.items.length] : top.op
            if (op?.type == ParseType.choice_index) {
                if (st.choice_stack.length == 0) {
                    return parseError(st, r.error_invalid_choice_index)
                }
                op = st.choice_stack[st.choice_stack.length - 1]
            }
            if (op?.type == ParseType.choice) {
                st.choice_stack.push(op)
                const lop = op.ops[op.ops.length - 1]
                const c = read(ds)
                switch (lop.type) {
                    case ParseType.bit_size:
                    case ParseType.block_size:
                    case ParseType.choice:
                    case ParseType.choice_index:
                    case ParseType.collection:
                    case ParseType.collection_stream:
                    case ParseType.none:
                    case ParseType.struct:
                        if (op.ops.length <= c) {
                            return parseError(st, r.error_invalid_choice_index)
                        }
                        op = op.ops[c]
                        break
                    case ParseType.bit_variable:
                    case ParseType.block_variable:
                    case ParseType.item:
                    case ParseType.text_plain:
                    case ParseType.varint:
                    case ParseType.varint_plus_block:
                        if (op.ops.length - 1 <= c) {
                            ds.tempChoice = c - (op.ops.length - 1)
                            op = lop
                            //throw 'sss'
                        }
                        else {
                            op = op.ops[c]
                        }
                        break
                    default:
                        throw 'not implemented ParseType'
                }
                if (op.type == ParseType.none) {
                    scope_push({ type: choice_sym, needed: 1, items: [], op })
                    collapse_scope(c)
                    continue
                }
                else {
                    scope_push({ type: choice_sym, needed: 2, items: [c], op })
                    continue
                }
            }
            if (op && op.type != ParseType.item) {
                switch (op.type) {
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
                    case ParseType.struct: {
                        scope_push({ type: structure_sym, needed: op.ops.length, items: [], ops: op.ops })
                        break
                    }
                    case ParseType.text_plain: {
                        scope_push({ type: r.text_plain, items: [], inText: true })
                        break
                    }
                    case ParseType.collection: {
                        const l = read(ds)
                        if (l) {
                            scope_push({ type: collection_sym, needed: l, items: [], op: op.op })
                        }
                        else {
                            scope_push({ type: collection_stream_sym, items: [], op: { type: ParseType.collection_stream, op: op.op } })
                        }
                        break
                    }
                    case ParseType.collection_stream: {
                        const l = read(ds)
                        if (l) {
                            scope_push({ type: collection_sym, needed: l, items: [], op: op.op })
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
                    default:
                        throw { message: 'not implemented ParseType: ' + op.type, st }
                }
            }
            else if (top.inText) {
                const x = read(ds)
                switch (x) {
                    case u.end_scope: {
                        top.end = createPosition(ds)
                        collapse_scope(st.scope_stack.pop())
                        break
                    }
                    default:
                        if (isInvalidText(x)) {
                            return parseError(st, r.error_invalid_text_value)
                        }
                        collapse_scope(x)
                }
            }
            else {
                const x = read(ds)
                switch (x) {
                    case r.type_wrap:
                    case r.type_structure:
                    case r.type_choice: {
                        scope_push({ type: x, items: [] })
                        break
                    }
                    case r.type_choice_index: {
                        collapse_scope({ type: x, items: [], op: { type: ParseType.choice_index } })
                        break
                    }
                    case r.end_scope: {
                        if (top.needed) {
                            return parseError(st, r.error_invalid_end_scope)
                        }
                        top.end = createPosition(ds)
                        switch (top.type) {
                            case r.type_wrap:
                                top.op = resolveItemOp(top.items[top.items.length - 1])
                                break
                            case r.type_choice:
                                top.op = { type: ParseType.choice, ops: top.items.map(x => resolveItemOp(x)) }
                                break
                            case r.type_structure:
                                top.op = { type: ParseType.struct, ops: top.items.map(x => resolveItemOp(x)) }
                                break
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
                    case r.next_singular: {
                        scope_push({ type: x, needed: 1, items: [] })
                        collapse_scope(read(ds))
                        break
                    }
                    case r.bind: {
                        scope_push({ type: x, needed: 2, items: [] })
                        break
                    }
                    case r.type_collection:
                    case r.parse_none:
                    case r.magic_number: {
                        scope_push({ type: x, needed: 1, items: [] })
                        break
                    }
                    default:
                        if (isInvalidRegistry(x)) {
                            return parseError(st, r.error_invalid_registry_value)
                        }
                        collapse_scope(x)
                }
            }
        }
        return st.root.items[0]
    }
    catch (e) {
        if (isError(e)) {
            return e
        }
        if (e instanceof RangeError && e.message == 'Offset is outside the bounds of the DataView') {
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
            s.dv.setUint32(s.offset, (s.mesh << 24) + s.chunk)
            s.offset += 4
            s.chunkSpace = 8
            s.chunk = 0
            s.mesh = 0
            s.meshBit = false
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
        if (remaining == 0) {
            s.meshBit = !s.meshBit
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
export const finishWrite = (s: EncoderState) => {
    write(s, 0, s.chunkSpace)
    s.buffers.push(bufToU8(s.dv, 0, s.offset))
}
export const flushWrite = (s: EncoderState) => {
    if (s.chunkSpace != 8 || s.queue.length) {
        write(s, 0, s.chunkSpace)
    }
    s.buffers.push(bufToU8(s.dv, 0, s.offset))
}