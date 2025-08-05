import { r } from './registry'
import { Node, NodeType, ParseOp, ParseMode, magicNumberPrefix, littleEndianPrefix, val, val_size, bit_val } from './common'

export type DecoderState = { dv: DataView, dvOffset: number, partialBlock: number, partialBlockRemaining: number, bitNode?: Node, varintPrefix?: number, littleEndian?: boolean, initialized?: boolean, totalBitsRead: number, lastSize: number, endOfBuffer: boolean }
export const createDecoder = (): DecoderState => {
    return { dv: undefined, dvOffset: 0, partialBlock: 0, partialBlockRemaining: 0, totalBitsRead: 0, lastSize: 0, endOfBuffer: false }
}
export const readVarint = (s: DecoderState): number => {
    let size
    if (s.varintPrefix) {
        size = s.varintPrefix
        s.varintPrefix = 0
    }
    else {
        size = readBits32(s, 4)
    }
    if (s.endOfBuffer) {
        return 0
    }
    let result = 0
    let x = size
    if (s.littleEndian) {
        if (x & 1) {
            x = x >>> 1
            if (x & 1) {
                x = x >>> 1
                if (x & 1) {
                    x = x >>> 1
                    if (x & 1) {
                        s.lastSize = 32
                        result = readBits32(s, 32)
                    }
                    else {
                        s.lastSize = 20
                        result = readBits32(s, 20)
                    }
                }
                else {
                    s.lastSize = 13
                    result = (x >>> 1) + (readBits32(s, 12) << 1)
                }
            }
            else {
                s.lastSize = 6
                result = (x >>> 1) + (readBits32(s, 4) << 2)
            }
        }
        else {
            s.lastSize = 3
            result = x >>> 1
        }
    }
    else {
        if (x & 8) {
            if (x & 4) {
                if (x & 2) {
                    if (x & 1) {
                        s.lastSize = 32
                        result = readBits32(s, 32)
                    }
                    else {
                        s.lastSize = 20
                        result = readBits32(s, 20)
                    }
                }
                else {
                    s.lastSize = 13
                    result = ((x & 1) << 12) + readBits32(s, 12)
                }
            }
            else {
                s.lastSize = 6
                result = ((x & 3) << 4) + readBits32(s, 4)
            }
        }
        else {
            s.lastSize = 3
            result = x
        }
    }
    if (s.endOfBuffer) {
        s.varintPrefix = size
    }
    return result
}
export const readBits32 = (s: DecoderState, size: number): number => {
    if (s.littleEndian) {
        if (s.partialBlockRemaining >= size) {
            const shift = 32 - size
            const r = (s.partialBlock << shift) >>> shift
            s.partialBlockRemaining -= size
            s.partialBlock = s.partialBlock >>> size
            s.totalBitsRead += size
            return r
        }
        let r
        let sizeLeft = size - s.partialBlockRemaining
        while (sizeLeft) {
            if (s.dv.byteLength == s.dvOffset) {
                s.endOfBuffer = true
                return 0
            }
            const x = s.dv.getUint8(s.dvOffset)
            s.dvOffset++
            if (sizeLeft > 8) {
                s.partialBlock = s.partialBlock | (x << s.partialBlockRemaining)
                sizeLeft -= 8
                s.partialBlockRemaining += 8
            }
            else {
                const xshift = 32 - sizeLeft
                r = s.partialBlock | (((x << xshift) >>> xshift) << s.partialBlockRemaining)
                s.partialBlockRemaining = 8 - sizeLeft
                s.partialBlock = x >>> sizeLeft
                sizeLeft = 0
            }
        }
        s.totalBitsRead += size
        return r >>> 0
    }
    else {
        if (s.partialBlockRemaining >= size) {
            const r = s.partialBlock >>> (32 - size)
            s.partialBlockRemaining -= size
            s.partialBlock = s.partialBlock << size
            s.totalBitsRead += size
            return r
        }
        let r
        let sizeLeft = size - s.partialBlockRemaining
        while (sizeLeft) {
            if (s.dv.byteLength == s.dvOffset) {
                s.endOfBuffer = true
                return 0
            }
            const x = s.dv.getUint8(s.dvOffset)
            s.dvOffset++
            if (sizeLeft > 8) {
                sizeLeft -= 8
                s.partialBlockRemaining += 8
                s.partialBlock = s.partialBlock | (x << (32 - s.partialBlockRemaining))
            }
            else {
                r = (s.partialBlock >>> (32 - s.partialBlockRemaining - sizeLeft)) | (x >>> (8 - sizeLeft))
                s.partialBlockRemaining = 8 - sizeLeft
                s.partialBlock = (x << (32 - s.partialBlockRemaining))
                sizeLeft = 0
            }
        }
        s.totalBitsRead += size
        return r >>> 0
    }
}
export const readBitsLarge = (s: DecoderState, n: number): Node => {
    if (!s.bitNode) {
        s.bitNode = { type: NodeType.bits, children: [], bitSize: n, op: { type: ParseMode.none }, rootLittleEndian: s.littleEndian }
    }
    const sc = s.bitNode
    while (true) {
        if (sc.bitSize > 32) {
            const r = readBits32(s, 32)
            if (s.endOfBuffer) {
                return
            }
            sc.children.push(bit_val(r, 32))
            sc.bitSize -= 32
        }
        else {
            const r = readBits32(s, sc.bitSize)
            if (s.endOfBuffer) {
                return
            }
            sc.children.push(bit_val(r, sc.bitSize))
            break
        }
    }
    s.bitNode = null
    return sc
}
export const alignDecoder = (s: DecoderState, n: number) => {
    const current = (s.dvOffset * 8 - s.partialBlockRemaining) % n
    if (current) {
        const num = n - current
        num <= 32 ? readBits32(s, num) : readBitsLarge(s, num)
    }
}
export type ParseState = { container: Node, root: Node, nodeStack: Node[], decoder: DecoderState, sharedChoiceStack: ParseOp[], liteProfile?: boolean, codecError?: number, codecErrorValue?}
export const resolveParseOp = (x: Node): ParseOp => {
    if (x.type != NodeType.val) {
        return x.op
    }
    else {
        switch (x.val) {
            case r.parse_varint:
                return { type: ParseMode.varint }
            case r.parse_text:
                return { type: ParseMode.u8Text }
            case r.parse_bytes:
                return { type: ParseMode.bytes }
            case r.parse_type_data:
                return { type: ParseMode.parse_type_data }
        }
    }
    return { type: ParseMode.none }
}
export const resolveParseOpArray = (x: Node): ParseOp => {
    const op = resolveParseOp(x)
    if (op.type == ParseMode.none || (op.type == ParseMode.map && !op.ops.length)) {
        op.type = ParseMode.array_none
    }
    return op
}
export const getBytes = (s: ParseState, n: number): Uint8Array => {
    s.decoder.partialBlockRemaining = 0
    const start = s.decoder.dv.byteOffset + s.decoder.dvOffset
    s.decoder.dvOffset += n
    s.decoder.totalBitsRead += n * 8
    return new Uint8Array(s.decoder.dv.buffer.slice(start, start + n))
}
export const topNode = (st: ParseState) => st.nodeStack[st.nodeStack.length - 1]
export const pushNode = (s: Node, st: ParseState) => {
    st.nodeStack.push(s)
}
export const collapseNode = (x: Node, st: ParseState) => {
    let i = x
    while (true) {
        const t = topNode(st)
        t.children.push(i)
        if (t.children.length == t.needed) {
            switch (t.type) {
                case NodeType.parse_type_data: {
                    t.op = { type: ParseMode.none }
                    break
                }
                case NodeType.type_array: {
                    t.op = { type: ParseMode.array, op: resolveParseOpArray(i), arrayOffset: t.arrayOffset }
                    break
                }
                case NodeType.type_array_bit: {
                    t.op = { type: ParseMode.array_bit, op: resolveParseOpArray(i), bitSize: t.bitSize }
                    break
                }
                case NodeType.type_array_fixed: {
                    t.op = { type: ParseMode.array_fixed, op: resolveParseOpArray(i), bitSize: t.bitSize }
                    break
                }
                case NodeType.parse_align: {
                    t.op = { type: ParseMode.align, op: resolveParseOp(i), bitSize: t.bitSize }
                    break
                }
                case NodeType.type_array_chunk: {
                    t.op = { type: ParseMode.array_chunk, op: resolveParseOpArray(i), bitSize: t.bitSize }
                    break
                }
                case NodeType.type_choice:
                case NodeType.type_optional:
                case NodeType.type_choice_shared: {
                    const ops = t.choiceArray ? t.children[0].children[1].children.map(x => resolveParseOp(x)).concat(t.children.slice(1).map(x => resolveParseOp(x))) : t.children.map(x => resolveParseOp(x))
                    if (t.type == NodeType.type_optional) {
                        ops.unshift({ type: ParseMode.none })
                    }
                    t.op = { type: ParseMode.choice, ops, bitSize: (32 - Math.clz32(ops.length - 1)), shared: t.type == NodeType.type_choice_shared }
                    break
                }
                case NodeType.type_map: {
                    t.op = { type: ParseMode.map, ops: t.children.map(x => resolveParseOp(x)).filter(x => x.type != ParseMode.none) }
                    break
                }
                case NodeType.choice: {
                    if (t.choiceShared) {
                        st.sharedChoiceStack.pop()
                    }
                    break
                }
            }
            i = st.nodeStack.pop()
        }
        else {
            if (t.type == NodeType.parse_type_data) {
                t.op = resolveParseOp(i)
                if (t.op.type == ParseMode.none) {
                    t.needed = 1
                    i = st.nodeStack.pop()
                }
                else {
                    break
                }
            }
            else if (t.type == NodeType.map) {
                t.op = t.ops[t.children.length]
                break
            }
            else {
                break
            }
        }
    }
}
export const parseCore = (st: ParseState) => {
    const ds = st.decoder
    const top = topNode(st)
    const op = top.op
    let readNumber: number
    let readNode: Node
    switch (op.type) {
        case ParseMode.choice:
            readNumber = op.bitSize ? readBits32(ds, op.bitSize) : 0
            break;
        case ParseMode.bit_size:
            readNode = op.bitSize <= 32 ? bit_val(readBits32(ds, op.bitSize), op.bitSize) : readBitsLarge(ds, op.bitSize)
            break
        case ParseMode.varint:
        case ParseMode.array:
        case ParseMode.read_assign:
        case ParseMode.any:
        case ParseMode.bytes:
        case ParseMode.u8Text:
            readNumber = readVarint(ds)
            break
        case ParseMode.array_bit:
        case ParseMode.chunk:
            readNumber = readBits32(ds, op.bitSize)
            break
        case ParseMode.align:
            alignDecoder(ds, op.bitSize)
            break
        default:
            break;
    }
    if (ds.endOfBuffer) {
        return
    }
    switch (op.type) {
        case ParseMode.choice_select: {
            let stackIndex = st.sharedChoiceStack.length - 1
            let selectorOp = op
            let selectedOp: ParseOp
            while (true) {
                if (stackIndex < 0) {
                    selectedOp = { type: ParseMode.none }
                    break
                }
                const choiceOp = st.sharedChoiceStack[stackIndex]
                const index = choiceOp.ops.length <= selectorOp.index ? choiceOp.ops.length - 1 : selectorOp.index
                selectedOp = choiceOp.ops[index]
                if (selectedOp.type == ParseMode.choice_select) {
                    stackIndex--
                    selectorOp = selectedOp
                }
                else {
                    break
                }
            }
            if (selectedOp.type == ParseMode.none) {
                collapseNode({ type: NodeType.choice_select, needed: 0, children: [], op: selectedOp }, st)
            }
            else if (selectedOp.lastTotalBitsRead && selectedOp.lastTotalBitsRead == st.decoder.totalBitsRead) {
                collapseNode({ type: NodeType.cycle, needed: 0, children: [], op: selectedOp }, st)
            }
            else {
                selectedOp.lastTotalBitsRead = st.decoder.totalBitsRead
                pushNode({ type: NodeType.choice_select, needed: 1, children: [], op: selectedOp }, st)
            }
            break
        }
        case ParseMode.choice: {
            const c = readNumber
            if (op.shared) {
                st.sharedChoiceStack.push(op)
            }
            const index = op.ops.length <= c ? op.ops.length - 1 : c
            const selectedOp = op.ops[index]
            if (selectedOp.type == ParseMode.none) {
                collapseNode({ type: NodeType.choice, needed: 1, children: [bit_val(c, op.bitSize)], op: selectedOp, choiceShared: op.shared }, st)
            }
            else {
                pushNode({ type: NodeType.choice, needed: 2, children: [bit_val(c, op.bitSize)], op: selectedOp, choiceShared: op.shared }, st)
            }
            break
        }
        case ParseMode.varint: {
            collapseNode(val_size(readNumber, ds.lastSize), st)
            break
        }
        case ParseMode.bit_size: {
            collapseNode(readNode, st)
            break
        }
        case ParseMode.map: {
            const s: Node = { type: NodeType.map, needed: op.ops.length, children: [], op: op.ops[0], ops: op.ops }
            if (op.ops.length) {
                pushNode(s, st)
            }
            else {
                collapseNode(s, st)
            }
            break
        }
        case ParseMode.array: {
            const s: Node = { type: NodeType.array, needed: readNumber + (op.arrayOffset ? op.arrayOffset : 0), children: [], op: op.op, arrayOffset: op.arrayOffset }
            if (s.needed) {
                pushNode(s, st)
            }
            else {
                collapseNode(s, st)
            }
            break
        }
        case ParseMode.array_bit: {
            const s: Node = { type: NodeType.array_bit, needed: readNumber, children: [], op: op.op, bitSize: op.bitSize }
            if (s.needed) {
                pushNode(s, st)
            }
            else {
                collapseNode(s, st)
            }
            break
        }
        case ParseMode.array_fixed: {
            const s: Node = { type: NodeType.array_fixed, needed: op.bitSize, children: [], op: op.op }
            if (s.needed) {
                pushNode(s, st)
            }
            else {
                collapseNode(s, st)
            }
            break
        }
        case ParseMode.array_chunk: {
            pushNode({ type: NodeType.array_chunk, children: [], op: { type: ParseMode.chunk, op: op.op, bitSize: op.bitSize } }, st)
            break
        }
        case ParseMode.chunk: {
            const l = readNumber
            if (l) {
                pushNode({ type: NodeType.chunk, needed: l, children: [], op: op.op, bitSize: op.bitSize }, st)
            }
            else {
                top.children.push({ type: NodeType.chunk, children: [], bitSize: op.bitSize })
                collapseNode(st.nodeStack.pop(), st)
            }
            break
        }
        case ParseMode.array_none: {
            top.arraySize = top.needed
            collapseNode(st.nodeStack.pop(), st)
            break
        }
        case ParseMode.align: {
            pushNode({ type: NodeType.align, needed: 1, children: [], op: op.op, bitSize: op.bitSize }, st)
            break
        }
        case ParseMode.parse_type_data: {
            pushNode({ type: NodeType.parse_type_data, needed: 2, children: [], op: { type: ParseMode.any } }, st)
            break
        }
        case ParseMode.read_assign: {
            const s = readNumber
            st.nodeStack.pop()
            const top = topNode(st)
            switch (top.type) {
                case NodeType.type_map: {
                    top.needed = s * 2
                    if (top.needed == 0) {
                        st.nodeStack.pop()
                        top.op = { type: ParseMode.map, ops: [] }
                        collapseNode(top, st)
                    }
                    break
                }
                case NodeType.type_array_bit:
                case NodeType.type_array_chunk:
                case NodeType.parse_span: {
                    top.bitSize = s + 1
                    break
                }
                case NodeType.type_array_fixed: {
                    top.bitSize = s
                    break
                }
                case NodeType.type_choice:
                case NodeType.type_choice_shared: {
                    if (top.choiceArray) {
                        top.needed = s + 1
                        pushNode({ type: NodeType.parse_type_data, registry: r.parse_type_data_immediate, needed: 2, children: [], op: { type: ParseMode.any } }, st)
                        pushNode({ type: NodeType.type_array, registry: r.type_array, needed: 1, children: [], op: { type: ParseMode.any }, arrayOffset: 1 }, st)
                    }
                    else {
                        if (s) {
                            top.needed = top.type == NodeType.type_choice ? s + 1 : s
                        }
                        else {
                            top.choiceArray = true
                            pushNode({ type: NodeType.type_choice, children: [], op: { type: ParseMode.read_assign } }, st)
                        }
                    }
                    break
                }
                case NodeType.type_choice_select: {
                    top.op.index = s
                    top.children.push(val(s))
                    st.nodeStack.pop()
                    collapseNode(top, st)
                    break
                }
                case NodeType.parse_bit_size: {
                    top.bitSize = top.op.bitSize = s + 1
                    st.nodeStack.pop()
                    collapseNode(top, st)
                    break
                }
                case NodeType.parse_align: {
                    top.bitSize = top.op.bitSize = 2 << s
                    break
                }
                default:
                    throw 'Not Implemented read_assign ' + top.type
            }
            break
        }
        case ParseMode.bytes:
        case ParseMode.u8Text: {
            if (ds.dvOffset + readNumber <= ds.dv.byteLength) {
                collapseNode({ type: op.type == ParseMode.bytes ? NodeType.bytes : NodeType.u8Text, u8: getBytes(st, readNumber) }, st)
            }
            else {
                pushNode({ type: op.type == ParseMode.bytes ? NodeType.byte_chunks : NodeType.u8Text_chunks, needed: readNumber, children: [], op: { type: op.type == ParseMode.bytes ? ParseMode.byte_chunk : ParseMode.u8Text_chunk } }, st)
            }
            break
        }
        case ParseMode.byte_chunk:
        case ParseMode.u8Text_chunk: {
            const nt = op.type == ParseMode.byte_chunk ? NodeType.bytes : NodeType.u8Text
            const stillNeeded = top.needed - top.children.reduce((a, b) => a + b.u8.byteLength, 0)
            if (ds.dvOffset + stillNeeded <= ds.dv.byteLength) {
                const len = stillNeeded
                top.needed = top.children.length + 1
                collapseNode({ type: nt, u8: getBytes(st, len) }, st)
            }
            else {
                const len = ds.dv.byteLength - ds.dvOffset
                if (len) {
                    collapseNode({ type: nt, u8: getBytes(st, len) }, st)
                }
                else {
                    ds.endOfBuffer = true
                }
            }
            break
        }
        case ParseMode.any: {
            const x = readNumber
            if (st.liteProfile) {
                switch (x) {
                    case r.parse_varint:
                    case r.parse_bit_size:
                    case r.parse_text:
                    case r.parse_type_data:
                    case r.type_array:
                        break
                    case r.type_choice:
                    case r.type_optional:
                    case r.type_choice_shared:
                    case r.type_choice_select:
                    case r.nonexistent:
                    case r.parse_type_data_immediate:
                    case r.type_array_bit:
                    case r.type_array_fixed:
                    case r.type_array_chunk: {
                        st.codecError = r.registry_symbol_not_accepted
                        st.codecErrorValue = x
                        return
                    }
                    default:
                        if (top.type == NodeType.type_array) {
                            st.codecError = r.registry_symbol_not_accepted_as_array_type
                            st.codecErrorValue = x
                            return
                        }
                }
            }
            switch (x) {
                case r.type_map: {
                    pushNode({ type: NodeType.type_map, registry: x, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.type_map, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.type_choice: {
                    pushNode({ type: NodeType.type_choice, registry: x, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.type_choice, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.type_optional: {
                    pushNode({ type: NodeType.type_optional, registry: x, needed: 1, children: [], op: { type: ParseMode.any } }, st)
                    break
                }
                case r.type_choice_shared: {
                    pushNode({ type: NodeType.type_choice_shared, registry: x, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.type_choice_shared, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.type_choice_select: {
                    pushNode({ type: NodeType.type_choice_select, registry: x, children: [], op: { type: ParseMode.choice_select } }, st)
                    pushNode({ type: NodeType.type_choice_select, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.parse_bit_size: {
                    pushNode({ type: NodeType.parse_bit_size, registry: x, children: [], op: { type: ParseMode.bit_size } }, st)
                    pushNode({ type: NodeType.parse_bit_size, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.parse_align: {
                    pushNode({ type: NodeType.parse_align, registry: x, needed: 1, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.parse_align, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.type_array_bit: {
                    pushNode({ type: NodeType.type_array_bit, registry: x, needed: 1, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.type_array_bit, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.type_array_fixed: {
                    pushNode({ type: NodeType.type_array_fixed, registry: x, needed: 1, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.type_array_fixed, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.type_array_chunk: {
                    pushNode({ type: NodeType.type_array_chunk, registry: x, needed: 1, children: [], op: { type: ParseMode.any } }, st)
                    pushNode({ type: NodeType.type_array_chunk, registry: x, children: [], op: { type: ParseMode.read_assign } }, st)
                    break
                }
                case r.parse_type_data_immediate: {
                    pushNode({ type: NodeType.parse_type_data, registry: x, needed: 2, children: [], op: { type: ParseMode.any } }, st)
                    break
                }
                case r.type_array: {
                    pushNode({ type: NodeType.type_array, registry: x, needed: 1, children: [], op: { type: ParseMode.any } }, st)
                    break
                }
                default:
                    collapseNode(val_size(x, ds.lastSize, true), st)
            }
            break
        }
        default:
            throw { message: 'not implemented ParseType: ' + op.type, st }
    }
}
export const createParser = (liteProfile?: boolean): ParseState => {
    const container: Node = { type: NodeType.array, children: [], op: { type: ParseMode.any } }
    const root: Node = { type: NodeType.parse_type_data, children: [], needed: 2, op: { type: ParseMode.any } }
    return { container, root, nodeStack: [container, root], decoder: createDecoder(), sharedChoiceStack: [], liteProfile }
}
export const setParserBuffer = (b: ArrayBufferView, st: ParseState) => {
    st.decoder.dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
    st.decoder.dvOffset = 0
    st.decoder.endOfBuffer = false
    if (!st.decoder.initialized) {
        st.decoder.initialized = true
        if (st.decoder.dv.byteLength >= 4 && st.decoder.dv.getUint32(st.decoder.dvOffset) == magicNumberPrefix) {
            st.decoder.dvOffset = 4
            st.root.rootMagic = true
        }
        if (st.decoder.dv.byteLength && st.decoder.dv.getUint8(st.decoder.dvOffset) == littleEndianPrefix) {
            st.root.rootLittleEndian = true
            st.decoder.littleEndian = true
            st.decoder.dvOffset += 1
        }
    }
}