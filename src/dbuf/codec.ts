import { r, u } from '@bintoca/dbuf/registry'
import { bufToDV, bufToU8 } from '@bintoca/dbuf/util'

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
export type DecoderState = { partial: number, partialBit: number, temp: number[], tempCount: number, tempIndex: number, dv: DataView, dvOffset: number, partialBlock: number, partialBlockRemaining: number }
export const decodeVarintBlock = (s: DecoderState, x: number) => {
    let mesh = x >>> 24
    const nextPartialBit = mesh & 1
    const continueBit = mesh >>> 7
    if (continueBit) {
        mesh = mesh ^ 255
    }
    const a = shiftLookup[mesh]
    if (continueBit == s.partialBit) {
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
    else {
        s.temp[0] = s.partial
        s.tempCount = a.length
        for (let i = 0; i < a.length - 1; i++) {
            s.temp[i + 1] = (x << a[i][0]) >>> a[i][1]
        }
        const an = a[a.length - 1]
        s.partial = (x << an[0]) >>> an[1]
    }
    s.partialBit = nextPartialBit
}
export const createDecoder = (b: BufferSource): DecoderState => {
    if (b.byteLength == 0 || b.byteLength % 4 != 0) {
        throw new Error('data must be multiple of 4 bytes, length: ' + b.byteLength)
    }
    const dv = bufToDV(b)
    return { partial: 0, partialBit: dv.getUint8(0) >>> 7, temp: Array(8), tempCount: 0, tempIndex: 0, dv, dvOffset: 0, partialBlock: 0, partialBlockRemaining: 0 }
}
export const read = (s: DecoderState): number => {
    while (s.tempCount == 0) {
        decodeVarintBlock(s, s.dv.getUint32(s.dvOffset))
        s.dvOffset += 4
        check_end(s)
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
    const v = bufToU8(s.dv, s.dvOffset, l)
    s.dvOffset += l
    s.partialBlockRemaining = 0
    check_end(s)
    return v
}
export const check_end = (s: DecoderState) => {
    if (s.dv.byteLength == s.dvOffset) {
        s.temp[s.tempCount] = s.partial
        s.tempCount++
    }
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
        check_end(s)
        return sc
    }
    const r = rb(s, n)
    check_end(s)
    return r
}
export const continueDecode = (s: DecoderState): boolean => s.tempCount != 0 || s.dv.byteLength != s.dvOffset
export const struct_sym = Symbol.for('https://bintoca.com/symbol/struct')
export const choice_sym = Symbol.for('https://bintoca.com/symbol/choice')
export const text_sym = Symbol.for('https://bintoca.com/symbol/text')
export const non_text_sym = Symbol.for('https://bintoca.com/symbol/nontext')
export const collection_sym = Symbol.for('https://bintoca.com/symbol/collection')
export const rle_sym = Symbol.for('https://bintoca.com/symbol/rle')
export const bits_sym = Symbol.for('https://bintoca.com/symbol/bits')
export type Scope = { type: r | symbol, needed?: number, items: Item[], result?, inText?: boolean, richText?: boolean, op?: ParseOp, ops?: ParseOp[], parseIndex?: number, start?: ParsePosition, end?: ParsePosition }
export type Slot = Scope | number
export type Item = Slot | Uint8Array
export const enum ParseType { varint, item, block_size, block_variable, bit_size, bit_variable, text_plain, text_rich, collection, collection_stream, choice, struct, varint_plus_block, none, back, forward, back_ref }
export type ParseOp = { type: ParseType, size?: number, ops?: ParseOp[], forward?: Scope, item?: Item, capture?: boolean, back_scope?: Scope, back_position?: number }
export type ParsePlan = { ops: ParseOp[], index: number }
export type ParseState = { root: Scope, scope_stack: Scope[], decoder: DecoderState }
export type ParsePosition = { dvOffset: number, tempIndex: number, partialBlockRemaining: number }
export const createError = (er: r | Scope): Scope => { return { type: r.bind, items: [r.error, er] } }
export const isError = (x) => x.type == r.bind && Array.isArray(x.items) && x.items[0] == r.error
export const createStruct = (fields: Slot[], values: Item[]): Scope => { return { type: r.bind, items: [{ type: r.type_struct, items: fields }, { type: struct_sym, items: values }] } }
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
export const back_ref = (s: ParseState, n: number) => {
    const scopeItems = s.scope_stack.filter(x => x.inText || x.type == non_text_sym || x.type == r.function)
    let back = n + 1
    let funcs = 0
    for (let l = scopeItems.length - 1; l >= 0; l--) {
        const s = scopeItems[l]
        if (s.type == r.function) {
            funcs++
        }
        if (s.inText) {
            const scopes = s.items.filter(x => typeof x == 'object')
            if (scopes.length >= back) {
                const position = scopes.length - back
                return { ref: scopes[position], capture: false, scope: s, position }
            }
            back -= scopes.length
        }
        else {
            if (s.items.length >= back) {
                const position = s.items.length - back
                return { ref: s.items[position], capture: s.type == r.function && funcs > 1, scope: s, position }
            }
            back -= s.items.length
        }
    }
}
export const forward_ref = (fr: Scope): Item => {
    const t = fr.op.forward.items
    return (t[0] as Scope).items[forward_ref_position(fr)]
}
export const forward_ref_position = (fr: Scope): number => {
    const t = fr.op.forward.items
    return (t[1] as number) + (t[2] as number) + 1
}
export const resolveRef = (st: ParseState, c: Item): Item | { returnError: r } => {
    let i = 0
    let x: Item = c
    while (true) {
        if (i >= 1000) {
            return { returnError: r.error_max_forward_depth }
        }
        if (typeof x == 'object') {
            const xs = x as Scope
            if (xs.type == r.back_reference) {
                x = xs.items[1]
            }
            else if (xs.type == r.forward_reference) {
                if (st.scope_stack.length >= 1000) {
                    return { returnError: r.error_max_forward_depth }
                }
                x = forward_ref(xs)
                if (x === undefined) {
                    return { returnError: r.error_invalid_forward_reference }
                }
            }
            else {
                return x
            }
        }
        else {
            return x
        }
        i++
    }
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
                return { type: ParseType.text_plain }
            case r.text_rich:
                return { type: ParseType.text_rich }
            case r.parse_back_reference:
                return { type: ParseType.back }
        }
    }
    return { type: ParseType.item }
}
export const resolveScopeOp = (c: Scope) => {
    switch (c.type) {
        case r.type_collection:
            c.op = { type: ParseType.collection, ops: [resolveItemOp(c.items[c.items.length - 1])] }
            break
        case r.type_collection_stream:
        case r.type_stream_merge:
            c.op = { type: ParseType.collection_stream, ops: [resolveItemOp(c.items[c.items.length - 1])] }
            break
        case r.type_wrap:
            c.op = resolveItemOp(c.items[c.items.length - 1])
            break
        case r.type_choice:
            c.op = { type: ParseType.choice, ops: c.items.map(x => resolveItemOp(x)) }
            break
        case r.type_struct:
            c.op = { type: ParseType.struct, ops: c.items.map(x => resolveItemOp(x)) }
            break
    }
}
export const isInvalidText = (n: number) => n > 0x10FFFF + 5
export const isInvalidRegistry = (n: number) => n > r.magic_number || (n < r.magic_number && n > 600) || (n < 512 && n > 200)
export const createPosition = (s: DecoderState): ParsePosition => { return { dvOffset: s.dvOffset, tempIndex: s.tempCount ? s.tempIndex : undefined, partialBlockRemaining: s.partialBlockRemaining ? s.partialBlockRemaining : undefined } }
export let log = (...x) => console.log(...x)
export const parse = (b: BufferSource): Scope => {
    const root = { type: non_text_sym, items: [] }
    const st: ParseState = { root, scope_stack: [root], decoder: createDecoder(b) }
    try {
        const scope_top = () => st.scope_stack[st.scope_stack.length - 1]
        const scope_push = (s: Scope) => {
            s.start = position
            st.scope_stack.push(s)
        }
        function collapse_scope(x: Item) {
            let loop = true
            let i = x
            while (loop) {
                const t = scope_top()
                t.items.push(i)
                if (t.ops) {
                    if (t.type == collection_sym) {
                        if (!t.needed && !read(ds)) {
                            t.needed = t.items.length
                        }
                    }
                    else {
                        t.parseIndex++
                    }
                }
                if (t.type == r.bind) {
                    t.op = t.items.length == 1 ? resolveItemOp(i) : { type: ParseType.item }
                }
                else if (t.type == r.parse_none) {
                    t.op = { type: ParseType.none, item: t.items[0] }
                }
                if (t.items.length == t.needed) {
                    t.end = createPosition(ds)
                    i = st.scope_stack.pop()
                }
                else {
                    loop = false
                }
            }
        }
        let position: ParsePosition
        const ds = st.decoder
        loop:
        while (continueDecode(ds)) {
            const top = scope_top()
            position = createPosition(ds)
            let op = top.ops ? top.ops[top.parseIndex] : top.op
            if (op?.type == ParseType.back_ref) {
                const b = resolveRef(st, op.item)
                if ((b as any).returnError) {
                    return parseError(st, (b as any).returnError)
                }
                op = resolveItemOp(b as Item)
            }
            if (op?.type == ParseType.choice) {
                const c = read(ds)
                if (op.ops.length <= c) {
                    return parseError(st, r.error_invalid_choice_index)
                }
                op = op.ops[c]
                if (op.type == ParseType.none) {
                    scope_push({ type: choice_sym, needed: 1, items: [] })
                    collapse_scope(c)
                    continue
                }
                else if (op.type == ParseType.back_ref) {
                    const b = resolveRef(st, op.item)
                    if ((b as any).returnError) {
                        return parseError(st, (b as any).returnError)
                    }
                    scope_push({ type: choice_sym, needed: 2, items: [c], op: resolveItemOp(b as Item) })
                    continue
                }
                else if (op.type == ParseType.choice) {
                    scope_push({ type: choice_sym, needed: 2, items: [c], op })
                    continue
                }
                else {
                    scope_push({ type: choice_sym, needed: 2, items: [c] })
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
                        scope_push({ type: struct_sym, needed: op.ops.length, items: [], ops: op.ops, parseIndex: 0 })
                        break
                    }
                    case ParseType.text_plain: {
                        scope_push({ type: r.text_plain, items: [], inText: true })
                        break
                    }
                    case ParseType.text_rich: {
                        scope_push({ type: r.text_rich, items: [], inText: true, richText: true })
                        break
                    }
                    case ParseType.collection: {
                        scope_push({ type: collection_sym, needed: read(ds) + 1, items: [], ops: op.ops, parseIndex: 0 })
                        break
                    }
                    case ParseType.collection_stream: {
                        scope_push({ type: collection_sym, items: [], ops: op.ops, parseIndex: 0 })
                        break
                    }
                    case ParseType.none: {
                        collapse_scope(op.item)
                        break
                    }
                    case ParseType.back: {
                        const d = read(ds)
                        const br = back_ref(st, d)
                        if (br === undefined) {
                            return parseError(st, r.error_invalid_back_reference)
                        }
                        const s: Scope = { type: r.back_reference, needed: 2, items: [d], op: { type: ParseType.back_ref, item: br.ref, capture: br.capture, back_scope: br.scope, back_position: br.position } }
                        scope_push(s)
                        collapse_scope(br.ref)
                        break
                    }
                    default:
                        throw { message: 'not implemented ParseType: ' + op.type, st }
                }
            }
            else if (top.inText) {
                const x = read(ds)
                switch (x) {
                    case u.text: {
                        scope_push({ type: text_sym, items: [], inText: true })
                        break
                    }
                    case u.repeat_n: {
                        scope_push({ type: rle_sym, needed: 1, items: [], inText: true })
                        collapse_scope(read(ds))
                        break
                    }
                    case u.back_reference: {
                        const d = read(ds)
                        const br = back_ref(st, d)
                        if (br === undefined) {
                            return parseError(st, r.error_invalid_back_reference)
                        }
                        const bt = br.ref as Slot
                        if (!top.richText && (typeof bt == 'number' || bt.richText || !bt.inText)) {
                            return parseError(st, r.error_text_rich_in_plain)
                        }
                        const s: Scope = { type: r.back_reference, needed: 2, items: [d], op: { type: ParseType.back_ref, item: br.ref, capture: br.capture, back_scope: br.scope, back_position: br.position } }
                        scope_push(s)
                        collapse_scope(br.ref)
                        break
                    }
                    case u.non_text: {
                        if (top.richText) {
                            scope_push({ type: non_text_sym, items: [] })
                        }
                        else {
                            return parseError(st, r.error_text_rich_in_plain)
                        }
                        break
                    }
                    case u.end_scope: {
                        if (top.items.length == 0) {
                            return parseError(st, r.error_empty_scope)
                        }
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
                    case r.function:
                    case r.call:
                    case r.type_wrap:
                    case r.type_struct:
                    case r.type_choice:
                    case r.type_collection:
                    case r.type_collection_stream:
                    case r.type_stream_merge: {
                        scope_push({ type: x, items: [] })
                        break
                    }
                    case r.end_scope: {
                        if (top.needed) {
                            return parseError(st, r.error_invalid_end_scope)
                        }
                        if (top.items.length == 0) {
                            return parseError(st, r.error_empty_scope)
                        }
                        top.end = createPosition(ds)
                        resolveScopeOp(top)
                        const t = st.scope_stack.pop()
                        if (st.scope_stack.length == 0) {
                            break loop
                        }
                        collapse_scope(t)
                        break
                    }
                    case r.back_reference: {
                        const d = read(ds)
                        const br = back_ref(st, d)
                        if (br === undefined) {
                            return parseError(st, r.error_invalid_back_reference)
                        }
                        const s: Scope = { type: x, needed: 2, items: [d], op: { type: ParseType.back_ref, item: br.ref, capture: br.capture, back_scope: br.scope, back_position: br.position } }
                        scope_push(s)
                        collapse_scope(br.ref)
                        break
                    }
                    case r.forward_reference: {
                        if (top.type != non_text_sym && top.type != r.function) {
                            return parseError(st, r.error_invalid_forward_reference)
                        }
                        const s: Scope = { type: x, needed: 3, items: [top, top.items.length], op: { type: ParseType.forward } }
                        s.op.forward = s
                        scope_push(s)
                        collapse_scope(read(ds))
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
                    case r.parse_none: {
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
        if (st.root.items[st.root.items.length - 1] === r.placeholder) {
            st.root.items.pop()
        }
        if (st.scope_stack.length > 1) {
            return parseError(st, r.error_unfinished_parse_stack)
        }
        return st.root
    }
    catch (e) {
        if (isError(e)) {
            return e
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
export const write_pad = (s: EncoderState, size: number) => {
    let remaining = size
    while (true) {
        const len = s.chunkSpace > remaining ? remaining : s.chunkSpace
        const s1 = s.chunkSpace - len
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
export const finishWrite = (s: EncoderState) => {
    if (s.chunkSpace != 8 || s.queue.length) {
        write(s, r.placeholder, s.chunkSpace)
    }
    s.buffers.push(bufToU8(s.dv, 0, s.offset))
}
export const write_scope = (s: Scope, e: EncoderState) => {
    for (let x of s.items) {
        if (x instanceof Uint8Array) {
            writeBuffer(e, x)
        }
        else if (typeof x == 'object') {
            let end = false
            switch (x.type) {
                case r.function:
                case r.call:
                case r.type_wrap:
                case r.type_struct:
                case r.type_choice:
                case r.type_collection:
                case r.type_collection_stream:
                case r.type_stream_merge:
                case text_sym:
                case non_text_sym:
                    end = true
                    break
            }
            if (typeof x.type == 'number') {
                write(e, x.type)
            }
            write_scope(x, e)
            if (end) {
                write(e, r.end_scope)
            }
        }
        else {
            write(e, x)
        }
    }
}