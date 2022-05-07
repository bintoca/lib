import { r, u } from '@bintoca/dbuf/registry'
import { bufToDV, bufToU8 } from '@bintoca/dbuf/util'

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
export const enum ParseType { value, vblock, block, bit, vbit, item, text, rich_text, collection, vCollection, choice, none, multiple, forward, v32_32 }
export type ParseOp = { type: ParseType, size?: number, ops?: ParseOp[], forward?: Scope }
export type ParsePlan = { ops: ParseOp[], index: number }
export type ParseState = { root: Scope, scope_stack: Scope[], decoder: DecoderState }
export type ParsePosition = { dvOffset: number, tempIndex: number, partialBlockRemaining: number }
export const createError = (er: r | Scope): Scope => { return { type: r.bind, items: [r.error, er] } }
export const isError = (x) => x.type == r.bind && Array.isArray(x.items) && x.items[0] == r.error
export const createStruct = (fields: Slot[], values: Item[]): Scope => { return { type: r.bind, items: [{ type: r.type_struct, items: fields }, { type: struct_sym, items: values }] } }
export const createWrap = (slots: Slot[]): Scope => { return { type: r.type_wrap, items: slots } }
export const parseError = (s: ParseState, regError: r) => parseErrorPos(createPosition(s.decoder), regError)
export const parseErrorPos = (pos: ParsePosition, regError: r) => {
    const fields = [r.error, createWrap([r.blocks_read, r.uint])]
    const values = [regError, pos.dvOffset / 4]
    if (pos.tempIndex !== undefined) {
        fields.push(createWrap([r.block_chunk_index, r.uint]))
        values.push(pos.tempIndex)
    }
    if (pos.partialBlockRemaining !== undefined) {
        fields.push(createWrap([r.block_bit_remaining, r.uint]))
        values.push(pos.partialBlockRemaining)
    }
    return createError(createStruct(fields, values))
}
export const back_ref = (s: ParseState, n: number) => {
    const scopeItems = s.scope_stack.filter(x => x.inText || x.type == non_text_sym || x.type == r.function)
    let back = n + 1
    for (let l = scopeItems.length - 1; l >= 0; l--) {
        const s = scopeItems[l]
        if (s.inText) {
            const scopes = s.items.filter(x => typeof x == 'object')
            if (scopes.length >= back) {
                return scopes[scopes.length - back]
            }
            back -= scopes.length
        }
        else {
            if (s.items.length >= back) {
                return s.items[s.items.length - back]
            }
            back -= s.items.length
        }
    }
}
export const resolveItemOp = (x: Item, none?: boolean) => {
    if (typeof x == 'object') {
        const s = x as Scope
        if (s.type == r.bind) {
            return { type: ParseType.item }
        }
        if (s.op) {
            return s.op
        }
    }
    else {
        switch (x) {
            case r.value_:
            case r.fixed_point_decimal_places:
            case r.years:
            case r.months:
            case r.days:
            case r.hours:
            case r.minutes:
            case r.seconds:
            case r.weeks:
            case r.port:
            case r.uint:
            case r.sint:
                return { type: ParseType.value }
            case r.vbit:
                return { type: ParseType.vbit }
            case r.vblock:
                return { type: ParseType.vblock }
            case r.vIEEE_decimal_DPD:
            case r.vIEEE_binary:
            case r.IPv4:
            case r.TAI_seconds:
                return { type: ParseType.block, size: 1 }
            case r.IPv6:
            case r.UUID:
                return { type: ParseType.block, size: 4 }
            case r.sha256:
                return { type: ParseType.block, size: 8 }
            case r.v32_32:
                return { type: ParseType.v32_32 }
            case r.text:
            case r.dns_idna:
                return { type: ParseType.text }
            case r.rich_text:
                return { type: ParseType.rich_text }
        }
    }
    return { type: none ? ParseType.none : ParseType.item }
}
export const resolveOp = (c: Scope) => {
    switch (c.type) {
        case r.type_collection:
            c.op = { type: ParseType.collection, ops: [resolveItemOp(c.items[c.items.length - 1])] }
            break
        case r.vCollection:
        case r.vCollection_merge:
            c.op = { type: ParseType.vCollection, ops: [resolveItemOp(c.items[c.items.length - 1])] }
            break
        case r.type_wrap:
            c.op = resolveItemOp(c.items[c.items.length - 1])
            break
        case r.type_choice:
            c.op = { type: ParseType.choice, ops: c.items.map(x => resolveItemOp(x, true)) }
            break
        case r.type_struct:
            c.op = { type: ParseType.multiple, ops: c.items.map(x => resolveItemOp(x)) }
            break
    }
}
export const isInvalidText = (n: number) => n > 0x10FFFF + 5
export const isInvalidRegistry = (n: number) => n > r.magicNumber || (n < r.magicNumber && n > 600) || (n < 512 && n > 200)
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
                if (t.type == r.bind && !t.op) {
                    t.op = resolveItemOp(i)
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
        function forward(op: ParseOp): Item {
            if (st.scope_stack.length > 1000) {
                throw parseError(st, r.error_max_forward_depth)
            }
            const t = op.forward.items
            return (t[0] as Scope).items[(t[1] as number) + (t[2] as number) + 1]
        }
        let position: ParsePosition
        const ds = st.decoder
        loop:
        while (continueDecode(ds)) {
            const top = scope_top()
            position = createPosition(ds)
            let op = top.ops ? top.ops[top.parseIndex] : top.op
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
                else if (op.type == ParseType.forward) {
                    const f = forward(op)
                    if (f === undefined) {
                        return parseError(st, r.error_invalid_forward_ref)
                    }
                    scope_push({ type: choice_sym, needed: 2, items: [c], op: resolveItemOp(f) })
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
            if (op?.type == ParseType.forward) {
                const f = forward(op)
                if (f === undefined) {
                    return parseError(st, r.error_invalid_forward_ref)
                }
                op = resolveItemOp(f)
            }
            if (op && op.type != ParseType.item) {
                switch (op.type) {
                    case ParseType.value: {
                        collapse_scope(read(ds))
                        break
                    }
                    case ParseType.block: {
                        collapse_scope(read_blocks(ds, op.size))
                        break
                    }
                    case ParseType.vblock: {
                        collapse_scope(read_blocks(ds, read(ds) + 1))
                        break
                    }
                    case ParseType.bit: {
                        collapse_scope(read_bits(ds, op.size))
                        break
                    }
                    case ParseType.vbit: {
                        collapse_scope(read_bits(ds, read(ds) + 1))
                        break
                    }
                    case ParseType.v32_32: {
                        const dv = new DataView(new ArrayBuffer(8))
                        dv.setUint32(0, read(ds))
                        dv.setUint32(4, ds.dv.getUint32(ds.dvOffset))
                        ds.dvOffset += 4
                        collapse_scope(bufToU8(dv))
                        break
                    }
                    case ParseType.multiple: {
                        scope_push({ type: struct_sym, needed: op.ops.length, items: [], ops: op.ops, parseIndex: 0 })
                        break
                    }
                    case ParseType.text: {
                        scope_push({ type: r.text, items: [], inText: true })
                        break
                    }
                    case ParseType.rich_text: {
                        scope_push({ type: r.rich_text, items: [], inText: true, richText: true })
                        break
                    }
                    case ParseType.collection: {
                        scope_push({ type: collection_sym, needed: read(ds) + 1, items: [], ops: op.ops, parseIndex: 0 })
                        break
                    }
                    case ParseType.vCollection: {
                        scope_push({ type: collection_sym, items: [], ops: op.ops, parseIndex: 0 })
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
                    case u.back_ref: {
                        const br = back_ref(st, read(ds)) as Slot
                        if (br === undefined) {
                            return parseError(st, r.error_invalid_back_ref)
                        }
                        if (!top.richText && (typeof br == 'number' || br.richText || !br.inText)) {
                            return parseError(st, r.error_rich_text_in_plain)
                        }
                        collapse_scope(br)
                        break
                    }
                    case u.non_text: {
                        if (top.richText) {
                            scope_push({ type: non_text_sym, items: [] })
                        }
                        else {
                            return parseError(st, r.error_non_text_in_plain)
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
                    case r.logical_and:
                    case r.logical_or:
                    case r.type_wrap:
                    case r.type_struct:
                    case r.type_choice:
                    case r.type_path:
                    case r.type_collection:
                    case r.vCollection:
                    case r.vCollection_merge:
                    case r.concat: {
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
                        resolveOp(top)
                        const t = st.scope_stack.pop()
                        if (st.scope_stack.length == 0) {
                            break loop
                        }
                        collapse_scope(t)
                        break
                    }
                    case r.back_ref: {
                        const br = back_ref(st, read(ds))
                        if (br === undefined) {
                            return parseError(st, r.error_invalid_back_ref)
                        }
                        collapse_scope(br)
                        break
                    }
                    case r.forward_ref: {
                        const s: Scope = { type: x, needed: 3, items: [top, top.items.length], op: { type: ParseType.forward } }
                        s.op.forward = s
                        scope_push(s)
                        collapse_scope(read(ds))
                        break
                    }
                    case r.bitSize: {
                        const s = read(ds) + 1
                        scope_push({ type: x, needed: 1, items: [], op: { type: ParseType.bit, size: s } })
                        collapse_scope(s)
                        break
                    }
                    case r.blockSize: {
                        const s = read(ds) + 1
                        scope_push({ type: x, needed: 1, items: [], op: { type: ParseType.block, size: s } })
                        collapse_scope(s)
                        break
                    }
                    case r.back_ref_hint:
                    case r.next_singular: {
                        scope_push({ type: x, needed: 1, items: [] })
                        collapse_scope(read(ds))
                        break
                    }
                    case r.unit:
                    case r.initial_value:
                    case r.seek:
                    case r.logical_not: {
                        scope_push({ type: x, needed: 1, items: [] })
                        break
                    }
                    case r.bind:
                    case r.equal:
                    case r.not_equal:
                    case r.greater_than:
                    case r.greater_than_or_equal:
                    case r.less_than:
                    case r.less_than_or_equal: {
                        scope_push({ type: x, needed: 2, items: [] })
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
                case r.logical_and:
                case r.logical_or:
                case r.type_wrap:
                case r.type_struct:
                case r.type_choice:
                case r.type_path:
                case r.type_collection:
                case r.vCollection:
                case r.vCollection_merge:
                case r.concat:
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