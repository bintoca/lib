import { r, u } from '@bintoca/dbuf/registry'
import { bufToDV, bufToU8 } from '@bintoca/dbuf/util'

export const multiple_symbol = Symbol.for('https://bintoca.com/symbol/multiple')
export const choice_symbol = Symbol.for('https://bintoca.com/symbol/choice')
export const text_symbol = Symbol.for('https://bintoca.com/symbol/text')
export const non_text_symbol = Symbol.for('https://bintoca.com/symbol/nontext')
export const collection_symbol = Symbol.for('https://bintoca.com/symbol/collection')
export const rle_symbol = Symbol.for('https://bintoca.com/symbol/rle')
export const bits_symbol = Symbol.for('https://bintoca.com/symbol/bits')
export type Scope = { type: r | symbol, needed: number, items: Item[], result?, inText?: boolean, richText?: boolean, op?: ParseOp, ops?: ParseOp[], parseIndex?: number }
export type Slot = Scope | number
export type Item = Slot | Uint8Array
export const enum ParseType { value, vblock, block, bit, vbit, item, text, rich_text, collection, vCollection, choice, none, multiple, forward, v32_32 }
export type ParseOp = { type: ParseType, size?: number, ops?: ParseOp[], forward?: Scope }
export type ParsePlan = { ops: ParseOp[], index: number }
export type ParseState = { root: Scope, scope_stack: Scope[], decoder: DecoderState }
export const decoderError = (s: DecoderState, message: string) => { return { message, state: s } }
export const back_ref = (s: ParseState, n: number) => {
    const scopeItems = s.scope_stack.filter(x => x.inText || x.type == non_text_symbol || x.type == r.function)
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
    throw decoderError(s.decoder, 'invalid back_ref')
}
export const numOp = (i: number, choice: boolean): ParseOp => {
    switch (i) {
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
        case r.item_:
            return { type: ParseType.item }
        default:
            return { type: choice ? ParseType.none : ParseType.item }
    }
}
export const resolveItemOp = (x: Item, choice?: boolean) => typeof x == 'object' ? (x as Scope).op || { type: choice ? ParseType.none : ParseType.item } : numOp(x, choice)
export const resolveOp = (st: DecoderState, c: Scope) => {
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
export const parse = (b: BufferSource): ParseState => {
    const root = { type: non_text_symbol, needed: 0, items: [] }
    const st: ParseState = { root, scope_stack: [root], decoder: createDecoder(b) }
    const scope_stack = st.scope_stack
    const scope_top = () => st.scope_stack[st.scope_stack.length - 1]
    function collapse_scope(x: Item) {
        let loop = true
        let i = x
        while (loop) {
            const t = scope_top()
            t.items.push(i)
            if (t.ops) {
                if (t.type == collection_symbol) {
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
                i = scope_stack.pop()
            }
            else {
                loop = false
            }
        }
    }
    function forward(op: ParseOp): ParseOp {
        if (scope_stack.length > 1000) {
            throw decoderError(ds, 'max forward depth')
        }
        const t = op.forward.items
        const o = (t[0] as Scope).items[(t[1] as number) + (t[2] as number) + 1]
        if (o === undefined) {
            throw decoderError(ds, 'invalid forward index')
        }
        return resolveItemOp(o)
    }
    const ds = st.decoder
    while (continueDecode(ds)) {
        const top = scope_top()
        let op = top.ops ? top.ops[top.parseIndex] : top.op
        if (op?.type == ParseType.choice) {
            const c = read(ds)
            if (op.ops.length <= c) {
                throw decoderError(ds, 'invalid choice index')
            }
            op = op.ops[c]
            if (op.type == ParseType.none) {
                scope_stack.push({ type: choice_symbol, needed: 1, items: [] })
                collapse_scope(c)
                continue
            }
            else if (op.type == ParseType.forward) {
                scope_stack.push({ type: choice_symbol, needed: 2, items: [c], op: forward(op) })
                continue
            }
            else if (op.type == ParseType.choice) {
                scope_stack.push({ type: choice_symbol, needed: 2, items: [c], op })
                continue
            }
            else {
                scope_stack.push({ type: choice_symbol, needed: 2, items: [c] })
            }
        }
        if (op?.type == ParseType.forward) {
            op = forward(op)
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
                    scope_stack.push({ type: multiple_symbol, needed: op.ops.length, items: [], ops: op.ops, parseIndex: 0 })
                    break
                }
                case ParseType.text: {
                    scope_stack.push({ type: r.text, needed: 0, items: [], inText: true })
                    break
                }
                case ParseType.rich_text: {
                    scope_stack.push({ type: r.rich_text, needed: 0, items: [], inText: true, richText: true })
                    break
                }
                case ParseType.collection: {
                    scope_stack.push({ type: collection_symbol, needed: read(ds) + 1, items: [], ops: op.ops, parseIndex: 0 })
                    break
                }
                case ParseType.vCollection: {
                    scope_stack.push({ type: collection_symbol, needed: 0, items: [], ops: op.ops, parseIndex: 0 })
                    break
                }
                default:
                    throw 'not implemented ParseType: ' + op.type
            }
        }
        else if (top.inText) {
            const x = read(ds)
            switch (x) {
                case u.text: {
                    scope_stack.push({ type: text_symbol, needed: 0, items: [], inText: true })
                    break
                }
                case u.repeat_n: {
                    scope_stack.push({ type: rle_symbol, needed: 1, items: [], inText: true })
                    collapse_scope(read(ds))
                    break
                }
                case u.back_ref: {
                    const br = back_ref(st, read(ds)) as Slot
                    if (!top.richText && (typeof br == 'number' || br.richText || !br.inText)) {
                        throw decoderError(ds, 'rich text not allowed in plain text')
                    }
                    collapse_scope(br)
                    break
                }
                case u.non_text: {
                    if (top.richText) {
                        scope_stack.push({ type: non_text_symbol, needed: 0, items: [] })
                    }
                    else {
                        throw decoderError(ds, 'non_text not allowed')
                    }
                    break
                }
                case u.end_scope: {
                    if (top.items.length == 0) {
                        throw decoderError(ds, 'empty end_scope')
                    }
                    collapse_scope(scope_stack.pop())
                    break
                }
                default:
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
                    scope_stack.push({ type: x, needed: 0, items: [] })
                    break
                }
                case r.end_scope: {
                    if (top.needed) {
                        throw decoderError(ds, 'top of scope_stack invalid for end_scope')
                    }
                    if (top.items.length == 0) {
                        throw decoderError(ds, 'empty end_scope')
                    }
                    resolveOp(ds, top)
                    const t = scope_stack.pop()
                    if (scope_stack.length == 0) {
                        return st
                    }
                    collapse_scope(t)
                    break
                }
                case r.back_ref: {
                    collapse_scope(back_ref(st, read(ds)))
                    break
                }
                case r.forward_ref: {
                    const s: Scope = { type: x, needed: 3, items: [top, top.items.length], op: { type: ParseType.forward } }
                    s.op.forward = s
                    scope_stack.push(s)
                    collapse_scope(read(ds))
                    break
                }
                case r.bitSize: {
                    const s = read(ds) + 1
                    scope_stack.push({ type: x, needed: 1, items: [], op: { type: ParseType.bit, size: s } })
                    collapse_scope(s)
                    break
                }
                case r.blockSize: {
                    const s = read(ds) + 1
                    scope_stack.push({ type: x, needed: 1, items: [], op: { type: ParseType.block, size: s } })
                    collapse_scope(s)
                    break
                }
                case r.back_ref_hint:
                case r.next_singular: {
                    scope_stack.push({ type: x, needed: 1, items: [] })
                    collapse_scope(read(ds))
                    break
                }
                case r.unit:
                case r.initial_value:
                case r.seek:
                case r.logical_not: {
                    scope_stack.push({ type: x, needed: 1, items: [] })
                    break
                }
                case r.bind:
                case r.equal:
                case r.not_equal:
                case r.greater_than:
                case r.greater_than_or_equal:
                case r.less_than:
                case r.less_than_or_equal: {
                    scope_stack.push({ type: x, needed: 2, items: [] })
                    break
                }
                default:
                    collapse_scope(x)
            }
        }
    }
    return st
}
export const evaluate = (x: Scope, ...p: Item[]) => {
    switch (x.type) {
        case r.call: {
            const f = x.items[0]
            if (f instanceof Uint8Array) {
                throw new Error('not implemented x0 ' + f)
            }
            else if (typeof f == 'object' && !Array.isArray(f)) {
                x.result = evaluate(f, ...x.items.slice(1))
            }
            else {
                switch (f) {
                    case 222: {
                        break
                    }
                    default:
                        throw new Error('not implemented x1 ' + f)
                }
            }
            break
        }
        case r.function: {
            evaluateAll(x.items)
            const last = x.items[x.items.length - 1]
            if (last instanceof Uint8Array) {
                throw new Error('not implemented x2 ' + last)
            }
            return typeof last == 'object' && !Array.isArray(last) && last.result ? last.result : last
        }
    }
}
export const evaluateAll = (slots: Item[]) => {
    for (let x of slots) {
        if (x instanceof Uint8Array) {

        }
        else if (typeof x == 'object' && !Array.isArray(x)) {
            evaluate(x)
        }
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
export const decodeChunk = (s: DecoderState, x: number) => {
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
        throw new Error('data must be multiple of 4 bytes')
    }
    const dv = bufToDV(b)
    return { partial: 0, partialBit: dv.getUint8(0) >>> 7, temp: Array(8), tempCount: 0, tempIndex: 0, dv, dvOffset: 0, partialBlock: 0, partialBlockRemaining: 0 }
}
export const read = (s: DecoderState): number => {
    while (s.tempCount == 0) {
        decodeChunk(s, s.dv.getUint32(s.dvOffset))
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
        const sc: Scope = { type: bits_symbol, needed: 0, items: [] }
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