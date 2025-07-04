import { getRegistrySymbol, registryError, getRegistryIndex, isRegistrySymbol, symbolPrefix } from '@bintoca/dbuf/registry'
import { r } from './registryEnum'
import { createEncoder, finishWrite, EncoderState, NodeType, alignEncoder, Node, writeVarint, writeBits, val, resolveParseOp, ParseMode, ParseState, parseCore, littleEndianPrefix, magicNumberPrefix, createParser, writeBytes } from './codec'
import { concatBuffers, getLeap_millis_tai, tai_dbuf_epochOffset } from '@bintoca/dbuf/util'

const sym_nonexistent = getRegistrySymbol(r.nonexistent)
const sym_false = getRegistrySymbol(r.false)
const sym_true = getRegistrySymbol(r.true)
const sym_value = getRegistrySymbol(r.value)
const sym_integer_signed = getRegistrySymbol(r.integer_signed)
const sym_IEEE_754_binary16 = getRegistrySymbol(r.IEEE_754_binary16)
const sym_IEEE_754_binary32 = getRegistrySymbol(r.IEEE_754_binary32)
const sym_IEEE_754_binary64 = getRegistrySymbol(r.IEEE_754_binary64)
const sym_exponent_base2 = getRegistrySymbol(r.exponent_base2)
const sym_exponent_base10 = getRegistrySymbol(r.exponent_base10)
const sym_text = getRegistrySymbol(r.text)
const sym_bytes = getRegistrySymbol(r.bytes)
const sym_epoch_seconds_continuous = getRegistrySymbol(r.epoch_seconds_continuous)
const sym_registry = getRegistrySymbol(r.registry)
const sym_copyable = getRegistrySymbol(r.copyable)
const sym_copy_length = getRegistrySymbol(r.copy_length)
const sym_copy_distance = getRegistrySymbol(r.copy_distance)
const sym_flatten_array = getRegistrySymbol(r.flatten_array)
const sym_delta = getRegistrySymbol(r.delta)
const sym_delta_double = getRegistrySymbol(r.delta_double)
const sym_offset_add = getRegistrySymbol(r.offset_add)
const sym_sign = getRegistrySymbol(r.sign)
const sym_instant = getRegistrySymbol(r.instant)
const sym_year = getRegistrySymbol(r.year)
const sym_month = getRegistrySymbol(r.month)
const sym_day = getRegistrySymbol(r.day)
const sym_hour = getRegistrySymbol(r.hour)
const sym_minute = getRegistrySymbol(r.minute)
const sym_second = getRegistrySymbol(r.second)

export type ParseFullState = ParseState & { error?: object, internalError?: any }
export const createFullParser = (liteProfile?: boolean) => createParser(liteProfile) as ParseFullState
export const parseFull = (st: ParseFullState) => {
    try {
        while (true) {
            parseCore(st)
            if (st.decoder.endOfBuffer) {
                st.error = registryError(r.incomplete_stream)
                break
            }
            if (st.container.children.length) {
                break
            }
        }
    }
    catch (e) {
        st.error = registryError(r.error_internal)
        st.internalError = e
    }
    if (st.decoder.dv.byteLength == st.decoder.dvOffset) {
        st.decoder.dv = undefined
    }
}
export const maxInteger = 2 ** 32 - 1
export const isNotNonNegativeInteger = (x: number) => x < 0 || Math.floor(x) !== x || x > maxInteger || isNaN(x) || !isFinite(x)
export const writeVarintChecked = (s: EncoderState, x: number) => {
    if (isNotNonNegativeInteger(x)) {
        throw new Error('invalid number ' + x)
    }
    writeVarint(s, x)
}
export const writeBitsChecked = (s: EncoderState, x: number, size: number) => {
    if (size < 1 || Math.floor(size) !== size || size > 32 || isNaN(size) || !isFinite(size)) {
        throw new Error('invalid size ' + size)
    }
    if (x < 0 || Math.floor(x) !== x || x > (2 ** size - 1) || isNaN(x) || !isFinite(x)) {
        throw new Error('invalid number ' + x)
    }
    writeBits(s, x, size)
}
export type WriterToken = number | { num?: number, size?: number, debug?: string[], bit?: boolean } | WriterToken[]
export const trimBuffer = (es: EncoderState) => new Uint8Array(es.buffers[0].buffer, 0, es.bitsWritten / 8 + ((es.bitsWritten % 8) ? 1 : 0))
export const writer = (x: WriterToken) => trimBuffer(writerCore(x))
export const writerPrefix = (x: WriterToken, le: boolean, magic?: boolean): WriterToken => {
    if (le) {
        if (magic) {
            return [r.magic_number, r.magic_number, r.little_endian_marker, x]
        }
        return [r.little_endian_marker, x]
    }
    if (magic) {
        return [r.magic_number, r.magic_number, x]
    }
    return x
}
export const writerCore = (x: WriterToken) => {
    const es = createEncoder()
    if (Array.isArray(x)) {
        if (x[0] === r.magic_number && x[1] === r.magic_number) {
            es.dv.setUint32(0, magicNumberPrefix)
            es.offset = 4
            es.bitsWritten += 32
            x = x.slice(2)
        }
        if (x[0] === r.little_endian_marker) {
            es.littleEndian = true
            writeBitsChecked(es, littleEndianPrefix, 8)
            x = x.slice(1)
        }
    }
    function f(y: WriterToken) {
        if (Array.isArray(y)) {
            let i = 0
            for (let j of y) {
                f(j)
                i++
            }
        }
        else if (typeof y == 'object') {
            if (y.bit) {
                writeBitsChecked(es, y.num, y.size)
            }
            else {
                writeVarintChecked(es, y.num)
            }
        }
        else if (y !== undefined) {
            writeVarintChecked(es, y)
        }
    }
    f(x)
    finishWrite(es)
    return es
}
export const writerFull = (x: WriterToken, le: boolean, magic?: boolean) => {
    return concatBuffers(writerCore(writerPrefix(x, le, magic)).buffers)
}
export const writeNodeCore = (s: EncoderState) => {
    const stackProps = s.nodeStack[s.nodeStack.length - 1]
    let sc = stackProps.node
    if (stackProps.itemIndex === undefined) {
        if (sc.registry !== undefined) {
            writeVarintChecked(s, sc.registry)
        }
        switch (sc.type) {
            case NodeType.parse_type_data:
                if (!s.rootInitialized) {
                    s.rootInitialized = true
                    if (sc.rootMagic) {
                        s.dv.setUint32(0, magicNumberPrefix)
                        s.offset = 4
                        s.bitsWritten += 32
                    }
                    if (sc.rootLittleEndian) {
                        s.littleEndian = true
                        writeBitsChecked(s, littleEndianPrefix, 8)
                    }
                }
                break
            case NodeType.val:
                if (sc.registry === undefined) {
                    writeVarintChecked(s, sc.val)
                }
                break
            case NodeType.bit_val:
                if (sc.bitSize) {
                    writeBitsChecked(s, sc.val, sc.bitSize)
                }
                break
            case NodeType.type_choice:
            case NodeType.type_choice_shared:
                if (sc.choiceArray) {
                    writeVarintChecked(s, 0)
                    writeVarintChecked(s, sc.children.length - 1)
                    const pt = sc.children[0]
                    const nn: Node = { type: sc.type, children: [] }
                    nn.children.push(pt.children[0].children[0])
                    nn.children.push(pt.children[1])
                    nn.children.push(...sc.children.slice(1))
                    sc = nn
                    stackProps.node = nn
                }
                else {
                    writeVarintChecked(s, sc.type == NodeType.type_choice ? sc.children.length - 1 : sc.children.length)
                }
                break
            case NodeType.type_array_bit:
            case NodeType.type_array_chunk:
                writeVarintChecked(s, sc.bitSize - 1)
                break
            case NodeType.type_array_fixed:
                writeVarintChecked(s, sc.bitSize)
                break
            case NodeType.array:
                writeVarintChecked(s, sc.arraySize === undefined ? sc.children.length - (sc.arrayOffset ? sc.arrayOffset : 0) : sc.arraySize)
                break
            case NodeType.array_bit:
                writeBitsChecked(s, sc.arraySize === undefined ? sc.children.length : sc.arraySize, sc.bitSize)
                break
            case NodeType.chunk:
                writeBitsChecked(s, sc.arraySize === undefined ? sc.children.length : sc.arraySize, sc.bitSize)
                break
            case NodeType.type_map:
                writeVarintChecked(s, sc.children.length / 2)
                break
            case NodeType.parse_bit_size:
                writeVarintChecked(s, sc.bitSize - 1)
                break
            case NodeType.parse_align:
                writeVarintChecked(s, 32 - Math.clz32(sc.bitSize / 2 - 1))
                break
            case NodeType.align:
                alignEncoder(s, sc.bitSize)
                break
            case NodeType.bytes:
            case NodeType.u8Text:
                writeVarintChecked(s, sc.u8.byteLength)
                writeBytes(s, sc.u8)
                break
        }
        if (sc.children?.length) {
            stackProps.itemIndex = 0
            s.nodeStack.push({ node: sc.children[0] })
        }
        else {
            s.nodeStack.pop()
        }
    }
    else {
        stackProps.itemIndex++
        if (stackProps.itemIndex < sc.children.length) {
            s.nodeStack.push({ node: sc.children[stackProps.itemIndex] })
        }
        else {
            s.nodeStack.pop()
        }
    }
}
export const writeNode = (s: EncoderState, sc: Node) => {
    s.nodeStack.push({ node: sc })
    while (s.nodeStack.length) {
        writeNodeCore(s)
    }
}
export const writeNodeStream = async (s: EncoderState, sc: Node, stream: WritableStreamDefaultWriter<BufferSource>) => {
    s.nodeStack.push({ node: sc })
    while (s.nodeStack.length) {
        while (s.nodeStack.length && s.buffers.length == 0) {
            writeNodeCore(s)
        }
        if (s.buffers.length) {
            for (let b of s.buffers) {
                await stream.ready
                await stream.write(b)
            }
            s.buffers = []
        }
    }
}
export const writeNodeFull = (node: Node): Uint8Array => {
    const es = createEncoder()
    writeNode(es, node)
    finishWrite(es)
    return concatBuffers(es.buffers)
}
export type NodeOrNum = Node | number
export const nodeOrNum = (s: NodeOrNum): Node => typeof s == 'number' ? val(s) : s
export const nodeOrNumRegistry = (s: NodeOrNum): Node => typeof s == 'number' ? val(s, true) : s
export const nodeOrNums = (s: NodeOrNum[]): Node[] => s.map(x => nodeOrNum(x))
export const nodeOrNumsRegistry = (s: NodeOrNum[]): Node[] => s.map(x => nodeOrNumRegistry(x))
export const root = (a: NodeOrNum, b?: NodeOrNum, littleEndian?: boolean, magic?: boolean): Node => { return { type: NodeType.parse_type_data, children: b ? [nodeOrNumRegistry(a), nodeOrNum(b)] : [nodeOrNumRegistry(a)], rootLittleEndian: littleEndian, rootMagic: magic } }
export const parse_type_data = (a: NodeOrNum, b?: NodeOrNum): Node => { return { type: NodeType.parse_type_data, children: b ? [nodeOrNum(a), nodeOrNum(b)] : [nodeOrNum(a)] } }
export const parse_type_data_immediate = (a: NodeOrNum, b?: NodeOrNum, bRegistry?: boolean): Node => { return { type: NodeType.parse_type_data, children: b === undefined ? [nodeOrNumRegistry(a)] : [nodeOrNumRegistry(a), bRegistry ? nodeOrNumRegistry(b) : nodeOrNum(b)], registry: r.parse_type_data_immediate } }
export const type_array = (a: NodeOrNum): Node => { return { type: NodeType.type_array, children: [nodeOrNumRegistry(a)], registry: r.type_array } }
export const type_array_fixed = (size: number, a: NodeOrNum): Node => { return { type: NodeType.type_array_fixed, children: [nodeOrNumRegistry(a)], registry: r.type_array_fixed, bitSize: size } }
export const type_array_bit = (bitSize: number, a: NodeOrNum): Node => { return { type: NodeType.type_array_bit, children: [nodeOrNumRegistry(a)], bitSize, registry: r.type_array_bit } }
export const type_array_chunk = (bitSize: number, a: NodeOrNum): Node => { return { type: NodeType.type_array_chunk, children: [nodeOrNumRegistry(a)], bitSize, registry: r.type_array_chunk } }
export const type_map = (...a: NodeOrNum[]): Node => { return { type: NodeType.type_map, children: nodeOrNumsRegistry(a), registry: r.type_map } }
export const type_choice = (...a: NodeOrNum[]): Node => { return { type: NodeType.type_choice, children: nodeOrNumsRegistry(a), registry: r.type_choice } }
export const type_choice_array = (t: NodeOrNum, a: NodeOrNum[], ...b: NodeOrNum[]): Node => { return { type: NodeType.type_choice, children: [parse_type_data_immediate(type_array(nodeOrNumRegistry(t)), array_offset(1, ...a)), ...nodeOrNumsRegistry(b)], registry: r.type_choice, choiceArray: true } }
export const type_choice_shared = (...a: NodeOrNum[]): Node => { return { type: NodeType.type_choice_shared, children: nodeOrNumsRegistry(a), registry: r.type_choice_shared } }
export const type_choice_shared_array = (t: NodeOrNum, a: NodeOrNum[], ...b: NodeOrNum[]): Node => { return { type: NodeType.type_choice_shared, children: [parse_type_data_immediate(type_array(nodeOrNumRegistry(t)), array_offset(1, ...a)), ...nodeOrNumsRegistry(b)], registry: r.type_choice_shared, choiceArray: true } }
export const type_choice_select = (a: number): Node => { return { type: NodeType.type_choice_select, children: [nodeOrNum(a)], registry: r.type_choice_select } }
export const choice = (a: Node, b?: NodeOrNum) => { return { type: NodeType.choice, children: b === undefined ? [nodeOrNum(a)] : [nodeOrNum(a), nodeOrNum(b)] } }
export const choice_shared = (a: Node, b?: NodeOrNum): Node => { return { type: NodeType.choice, children: b === undefined ? [nodeOrNum(a)] : [nodeOrNum(a), nodeOrNum(b)], choiceShared: true } }
export const map = (...a: NodeOrNum[]): Node => { return { type: NodeType.map, children: nodeOrNums(a) } }
export const array = (...a: NodeOrNum[]): Node => { return { type: NodeType.array, children: nodeOrNums(a) } }
export const array_offset = (offset: number, ...a: NodeOrNum[]): Node => { return { type: NodeType.array, children: nodeOrNums(a), arrayOffset: offset } }
export const array_no_children = (size: number): Node => { return { type: NodeType.array, children: [], arraySize: size } }
export const array_bit = (bitSize: number, ...a: NodeOrNum[]): Node => { return { type: NodeType.array_bit, children: nodeOrNums(a), bitSize } }
export const array_bit_no_children = (bitSize: number, arraySize: number): Node => { return { type: NodeType.array_bit, children: [], bitSize, arraySize } }
export const array_fixed = (...a: NodeOrNum[]): Node => { return { type: NodeType.array_fixed, children: nodeOrNums(a) } }
export const array_fixed_no_children = (size: number): Node => { return { type: NodeType.array_fixed, children: [], arraySize: size } }
export const array_chunk = (...a: NodeOrNum[]): Node => { return { type: NodeType.array_chunk, children: nodeOrNums(a) } }
export const chunk = (bitSize: number, ...a: NodeOrNum[]): Node => { return { type: NodeType.chunk, children: nodeOrNums(a), bitSize } }
export const chunk_no_children = (bitSize: number, arraySize: number): Node => { return { type: NodeType.chunk, children: [], arraySize, bitSize } }
export const choice_select = (...a: NodeOrNum[]): Node => { return { type: NodeType.choice_select, children: nodeOrNums(a) } }
export const bits = (...a: Node[]): Node => { return { type: NodeType.bits, children: a } }
export const bits_le = (...a: Node[]): Node => { return { type: NodeType.bits, children: a, rootLittleEndian: true } }
export const parse_bit_size = (bitSize: number): Node => { return { type: NodeType.parse_bit_size, children: [], bitSize, registry: r.parse_bit_size } }
export const parse_align = (bitSize: number, a: NodeOrNum): Node => { return { type: NodeType.parse_align, children: [nodeOrNum(a)], bitSize, registry: r.parse_align } }
export const align = (bitSize: number, ...a: NodeOrNum[]): Node => { return { type: NodeType.align, children: nodeOrNums(a), bitSize } }
export const cycle = (): Node => { return { type: NodeType.cycle, children: [] } }
export const type_optional = (a: NodeOrNum): Node => { return { type: NodeType.type_optional, children: [nodeOrNumRegistry(a)], registry: r.type_optional } }
export const string = (s: string): Node => u8Text(new TextEncoder().encode(s))
export const char = (s: string): Node => map(s.codePointAt(0))
export const bytes = (u8: Uint8Array): Node => { return { type: NodeType.bytes, u8 } }
export const byte_chunks = (...a: Node[]): Node => { return { type: NodeType.byte_chunks, children: a } }
export const u8Text = (u8: Uint8Array): Node => { return { type: NodeType.u8Text, u8 } }
export const u8Text_chunks = (...a: Node[]): Node => { return { type: NodeType.u8Text_chunks, children: a } }
export const enum UnpackMode { type, data }
export type UnpackNode = Node & { ob?}
export type NodeIndex = { node: UnpackNode, itemIndex?: number }
export type ModeIndex = { mode: UnpackMode, typeStack: NodeIndex[], objectStack: any[] }
export type UnpackState = { nodeStack: NodeIndex[], modeStack: ModeIndex[], sharedChoiceStack: NodeIndex[], copyBuffer: any[], unsafeExpand?: boolean }
export const bitSizeSymbol = Symbol.for('bitSizeSymbol')
export const valSymbol = Symbol.for('valSymbol')
export const u8Symbol = Symbol.for('u8Symbol')
export const u8TextSymbol = Symbol.for('u8TextSymbol')
export const cycleSymbol = Symbol.for('dbuf_cycle')
export const mapMarkerSymbol = Symbol.for('mapMarkerSymbol')
export const assignPropNode = (ob, n: UnpackNode, state: UnpackState) => {
    let v
    switch (n.type) {
        case NodeType.val:
        case NodeType.bit_val:
            v = n.registry !== undefined ? getRegistrySymbol(n.registry) : { [valSymbol]: n.val, [bitSizeSymbol]: n.bitSize || 32 }
            break
        case NodeType.bits:
            let bv = 0n
            let bs = 0
            const ch = n.rootLittleEndian ? n.children.slice().reverse() : n.children
            for (let x of ch) {
                bv = (bv << BigInt(x.bitSize)) + BigInt(x.val)
                bs += x.bitSize
            }
            v = { [valSymbol]: bv, [bitSizeSymbol]: bs }
            break
        case NodeType.bytes:
            v = { [u8Symbol]: n.u8 }
            break
        case NodeType.byte_chunks:
            v = { [u8Symbol]: concatBuffers(n.children.map(x => x.u8)) }
            break
        case NodeType.u8Text:
            v = { [u8TextSymbol]: n.u8 }
            break
        case NodeType.u8Text_chunks:
            v = { [u8TextSymbol]: concatBuffers(n.children.map(x => x.u8)) }
            break
        case NodeType.parse_type_data:
            v = n.ob
            break
        case NodeType.type_map: {
            const c = [mapMarkerSymbol]
            for (let x of n.children) {
                assignPropNode(c, x, state)
            }
            v = createObject(c, state)
            break
        }
        default:
            throw 'not implemented assignPropNode ' + n.type
    }
    assignProp(ob, v, state)
}
export const isUnsignedInt = (v) => {
    if (typeof v == 'object') {
        const ks = Reflect.ownKeys(v)
        if (ks.some(x => x == bitSizeSymbol)) {
            return true
        }
    }
    return false
}
export const isUnsignedInt2 = (v) => {
    if (isUnsignedInt(v)) {
        return true
    }
    if (isUnrefinedMap(v)) {
        if (v.length == 5 && isUnsignedInt(getValueFromUnrefinedMap(v, sym_offset_add)) && isUnsignedInt(getValueFromUnrefinedMap(v, sym_value))) {
            return true
        }
    }
    return false
}
export const isText = (v) => v !== undefined && v[u8TextSymbol] !== undefined
export const getUnsignedIntVal = (v) => {
    const ks = Reflect.ownKeys(v)
    if (ks.some(x => x == bitSizeSymbol)) {
        return v[valSymbol]
    }
    return getUnsignedIntVal(getValueFromUnrefinedMap(v, sym_offset_add)) + getUnsignedIntVal(getValueFromUnrefinedMap(v, sym_value))
}
export const getValueFromUnrefinedMap = (a: any[], key) => {
    const l = Math.floor((a.length - 1) / 2)
    for (let i = 1; i <= l; i++) {
        if (a[i] === key) {
            return a[i + l]
        }
    }
}
export const isUnrefinedMap = (a) => Array.isArray(a) && a[0] === mapMarkerSymbol
export const copyLenDist = (state: UnpackState, dest: any[], len: number, dist: number) => {
    const mark = state.copyBuffer.length - dist
    for (let i = mark - 1; i < mark + len; i++) {
        if (i < 0) {
            dest.push(sym_nonexistent)
            state.copyBuffer.push(sym_nonexistent)
        }
        else {
            dest.push(state.copyBuffer[i])
            state.copyBuffer.push(state.copyBuffer[i])
        }
    }
}
export const assignProp = (ob, v, state: UnpackState) => {
    let push = true
    if (v[0] === mapMarkerSymbol) {
        switch (v.length) {
            case 3: {
                const kv = v[2]
                if (v[1] === sym_copy_length && isUnsignedInt2(kv) && state.unsafeExpand) {
                    copyLenDist(state, ob, getUnsignedIntVal(kv), 0)
                    push = false
                }
                else if (v[1] === sym_copy_distance && isUnsignedInt2(kv)) {
                    copyLenDist(state, ob, 0, getUnsignedIntVal(kv))
                    push = false
                }
                break
            }
            case 5: {
                const r_copyLength = getValueFromUnrefinedMap(v, sym_copy_length)
                const r_copyDistance = getValueFromUnrefinedMap(v, sym_copy_distance)
                if (isUnsignedInt2(r_copyLength) && isUnsignedInt2(r_copyDistance)) {
                    copyLenDist(state, ob, getUnsignedIntVal(r_copyLength), getUnsignedIntVal(r_copyDistance))
                    push = false
                }
                break
            }
        }
    }
    if (push) {
        ob.push(v)
    }
}
export const resolveOp = (x: Node) => {
    const op = resolveParseOp(x)
    if (op) {
        return op
    }
    if (x.type == NodeType.parse_type_data || (x.type == NodeType.type_map && x.children.every(c => resolveOp(c)?.type == ParseMode.none))) {
        return { type: ParseMode.none }
    }
}
export const assignParseNone = (ty: NodeIndex, ob, state: UnpackState) => {
    while (ty?.itemIndex !== undefined && ty.itemIndex < ty.node.children?.length && resolveOp(ty.node.children[ty.itemIndex])?.type == ParseMode.none) {
        assignPropNode(ob, ty.node.children[ty.itemIndex], state)
        ty.itemIndex++
    }
}
export const cycleTypeStack = (state: UnpackState) => {
    const top = state.nodeStack[state.nodeStack.length - 1]
    const mo = state.modeStack.length ? state.modeStack[state.modeStack.length - 1] : undefined
    const ob = mo?.objectStack.length ? mo.objectStack[mo.objectStack.length - 1] : undefined
    mo.typeStack.pop()
    const ty = mo?.typeStack[mo?.typeStack.length - 1]
    if (ty) {
        if (top.node.type == NodeType.array ||
            top.node.type == NodeType.array_bit ||
            top.node.type == NodeType.array_fixed ||
            top.node.type == NodeType.array_chunk ||
            top.node.type == NodeType.chunk
        ) {
            if (ob.length < top.node.children.length) {
                mo.typeStack.push({ node: ty.node.children[0] })
            }
        }
        else {
            ty.itemIndex++
            assignParseNone(ty, ob, state)
            if (ty.itemIndex < ty.node.children?.length) {
                mo.typeStack.push({ node: ty.node.children[ty.itemIndex] })
            }
        }
    }
}
export const createObject = (a, state: UnpackState) => {
    if (isUnrefinedMap(a)) {
        if (a.length == 3 && a[1] === sym_copyable) {
            state.copyBuffer.push(a[2])
            return a[2]
        }
    }
    else if (Array.isArray(a)) {
        if (a.some(x => isUnrefinedMap(x) && Array.isArray(getValueFromUnrefinedMap(x, sym_flatten_array)))) {
            const na = []
            for (let x of a) {
                const fa = getValueFromUnrefinedMap(x, sym_flatten_array)
                if (Array.isArray(fa)) {
                    na.push(...fa)
                }
                else {
                    na.push(x)
                }
            }
            return na
        }
    }
    return a
}
export const finishContainer = (state: UnpackState) => {
    const mo = state.modeStack[state.modeStack.length - 1]
    let a = mo.objectStack.pop()
    a = createObject(a, state)
    const ob = mo.objectStack[mo.objectStack.length - 1]
    assignProp(ob, a, state)
    cycleTypeStack(state)
}
export const selectChoiceShared = (state: UnpackState, index: number): Node => {
    let stackIndex = state.sharedChoiceStack.length - 1
    let selected: Node
    while (true) {
        if (stackIndex < 0) {
            return val(r.nonexistent, true)
        }
        const choice = state.sharedChoiceStack[stackIndex]
        index = choice.node.children.length <= index ? choice.node.children.length - 1 : index
        selected = choice.node.children[index]
        if (selected.type == NodeType.type_choice_select) {
            stackIndex--
            index = selected.children[0].val
        }
        else {
            return selected
        }
    }
}
export const unpack = (n: Node, unsafeExpand?: boolean) => {
    const state: UnpackState = { nodeStack: [{ node: n }], modeStack: [], sharedChoiceStack: [], copyBuffer: [], unsafeExpand }
    let lastNode: NodeIndex
    while (state.nodeStack.length) {
        const top = state.nodeStack[state.nodeStack.length - 1]
        const mo = state.modeStack[state.modeStack.length - 1]
        const ty = mo?.typeStack[mo?.typeStack.length - 1]
        const ob = mo?.objectStack[mo.objectStack.length - 1]
        if (top.itemIndex === undefined) {
            if (top.node.children?.length && top.node.type != NodeType.bits && top.node.type != NodeType.byte_chunks && top.node.type != NodeType.u8Text_chunks) {
                top.itemIndex = 0
                state.nodeStack.push({ node: top.node.children[0] })
            }
            else {
                state.nodeStack.pop()
            }
            switch (top.node.type) {
                case NodeType.parse_type_data:
                    state.modeStack.push({ mode: UnpackMode.type, typeStack: [], objectStack: [[mapMarkerSymbol]] })
                    if (top.node.children.length == 1) {
                        top.node.children.push(top.node.children[0])
                    }
                    break
                case NodeType.val:
                case NodeType.bit_val:
                    if (mo.mode == UnpackMode.data) {
                        assignPropNode(ob, top.node, state)
                        cycleTypeStack(state)
                    }
                    break
                case NodeType.type_optional:
                    top.node.type = NodeType.type_choice
                    top.node.children[1] = top.node.children[0]
                    top.node.children[0] = val(r.nonexistent, true)
                    break
                case NodeType.map: {
                    const o = [mapMarkerSymbol]
                    ty.itemIndex = 0
                    assignParseNone(ty, o, state)
                    mo.objectStack.push(o)
                    if (top.node.children?.length) {
                        if (ty.node.children === undefined) {
                            console.log(ty, top.node.children)
                        }
                        mo.typeStack.push({ node: ty.node.children[ty.itemIndex] })
                    }
                    else {
                        finishContainer(state)
                    }
                    break
                }
                case NodeType.array:
                case NodeType.array_bit:
                case NodeType.array_fixed:
                case NodeType.array_chunk:
                case NodeType.chunk: {
                    const o = []
                    mo.objectStack.push(o)
                    if (top.node.children?.length) {
                        if (top.node.type != NodeType.chunk) {
                            mo.typeStack.push({ node: ty.node.children[0] })
                        }
                    }
                    else {
                        if (top.node.arraySize && state.unsafeExpand) {
                            for (let i = 0; i < top.node.arraySize; i++) {
                                ty.itemIndex = 0
                                assignParseNone(ty, o, state)
                            }
                        }
                        finishContainer(state)
                    }
                    break
                }
                case NodeType.choice: {
                    state.nodeStack.pop()
                    const index = top.node.children[0].val
                    if (ty.node.choiceArray) {
                        const choiceArrayLength = ty.node.children[0].children[1].children.length
                        if (index < choiceArrayLength) {
                            state.nodeStack.push({ node: ty.node.children[0].children[1].children[index] })
                            mo.typeStack.push({ node: ty.node.children[0].children[0].children[0] })
                        }
                        else if (top.node.children?.length == 2) {
                            top.itemIndex = 1
                            state.nodeStack.push({ node: top.node.children[1] })
                            mo.typeStack.push({ node: ty.node.children[index - choiceArrayLength + 1] })
                        }
                        else {
                            assignPropNode(ob, ty.node.children[index - choiceArrayLength + 1], state)
                        }
                    }
                    else if (top.node.children?.length == 2) {
                        top.itemIndex = 1
                        state.nodeStack.push({ node: top.node.children[1] })
                        mo.typeStack.push({ node: ty.node.children[index] })
                    }
                    else {
                        assignPropNode(ob, ty.node.children[index], state)
                    }
                    if (top.node.choiceShared) {
                        state.sharedChoiceStack.push({ node: ty.node })
                    }
                    break
                }
                case NodeType.choice_select: {
                    const index = ty.node.children[0].val
                    if (top.node.children?.length == 1) {
                        mo.typeStack.push({ node: selectChoiceShared(state, index) })
                    }
                    else {
                        assignPropNode(ob, selectChoiceShared(state, index), state)
                        mo.typeStack.pop()
                    }
                    break
                }
                case NodeType.cycle:
                    assignProp(ob, cycleSymbol, state)
                    break
                case NodeType.bits:
                case NodeType.bytes:
                case NodeType.byte_chunks:
                case NodeType.u8Text:
                case NodeType.u8Text_chunks:
                    assignPropNode(ob, top.node, state)
                    cycleTypeStack(state)
                    break
                case NodeType.parse_align:
                case NodeType.align:
                case NodeType.parse_bit_size:
                case NodeType.type_map:
                case NodeType.type_array:
                case NodeType.type_array_bit:
                case NodeType.type_array_fixed:
                case NodeType.type_array_chunk:
                case NodeType.type_choice:
                case NodeType.type_choice_shared:
                case NodeType.type_choice_select:
                    break
                default:
                    throw 'not implemented unpack ' + top.node.type
            }
        }
        else {
            top.itemIndex++
            if (top.itemIndex < top.node.children.length) {
                state.nodeStack.push({ node: top.node.children[top.itemIndex] })
            }
            else {
                lastNode = state.nodeStack.pop()
                switch (top.node.type) {
                    case NodeType.map:
                    case NodeType.array:
                    case NodeType.array_bit:
                    case NodeType.array_fixed:
                    case NodeType.chunk:
                        finishContainer(state)
                        break
                    case NodeType.array_chunk:
                        mo.objectStack.push(mo.objectStack.pop().flat())
                        finishContainer(state)
                        break
                    case NodeType.choice:
                        cycleTypeStack(state)
                        if (top.node.choiceShared) {
                            state.sharedChoiceStack.pop()
                        }
                        break
                }
            }
            switch (top.node.type) {
                case NodeType.parse_type_data:
                    if (top.itemIndex == 1) {
                        mo.mode = UnpackMode.data
                        mo.typeStack.push({ node: top.node.children[0] })
                    }
                    else {
                        top.node.ob = mo.objectStack[0].pop()
                        state.modeStack.pop()
                        if (state.modeStack.length) {
                            const mo1 = state.modeStack[state.modeStack.length - 1]
                            const ob1 = mo1.objectStack[mo1.objectStack.length - 1]
                            assignProp(ob1, top.node.ob, state)
                            cycleTypeStack(state)
                        }
                    }
                    break
            }
        }
    }
    return lastNode.node.ob
}
export const refineVal = (v) => {
    if (isUnsignedInt(v)) {
        return v[valSymbol]
    }
    if (v === sym_nonexistent) {
        return undefined
    }
    if (v === sym_true) {
        return true
    }
    if (v === sym_false) {
        return false
    }
    if (v[u8TextSymbol]) {
        return new TextDecoder().decode(v[u8TextSymbol])
    }
    if (v[u8Symbol]) {
        return v[u8Symbol]
    }
    return v
}
export const getFloat16PolyFill = (dv: DataView, offset: number, littleEndian?: boolean): number => {
    const leadByte = dv.getUint8(offset + (littleEndian ? 1 : 0))
    const sign = leadByte & 0x80 ? -1 : 1
    const exp = (leadByte & 0x7C) >> 2
    const mant = ((leadByte & 0x03) << 8) | dv.getUint8(offset + (littleEndian ? 0 : 1))
    if (!exp) {
        return sign * 5.9604644775390625e-8 * mant
    } else if (exp === 0x1f) {
        return sign * (mant ? 0 / 0 : 2e308)
    }
    return sign * Math.pow(2, exp - 25) * (1024 + mant)
}
export const setNumberToDV = (d: DataView, n: number | bigint) => {
    d.setBigUint64(0, 0n)
    if (typeof n == 'number') {
        d.setUint32(0, n)
    }
    else {
        d.setBigUint64(0, n)
    }
}
export const alignNumber = (n: number | bigint, inSize: number, outSize: number) => {
    if (typeof n == 'number') {
        if (outSize > 32) {
            outSize = 32
        }
        return inSize < outSize ? n << (outSize - inSize) : n
    }
    else {
        const r = BigInt.asUintN(outSize, inSize < outSize ? n << BigInt(outSize - inSize) : n)
        return outSize <= 32 ? Number(r) : r
    }
}
export const isInt = (x) => typeof x == 'number' && Math.floor(x) === x && !isNaN(x) && isFinite(x)
export const isAddable = (x) => typeof refineValues(x) == 'number'
export const addValues = (a, b) => refineValues(a) + refineValues(b)
export const refineObject = (ob, tempDV: DataView, stack: RefineStack): any => {
    if (ob.length == 3) {
        const k = ob[1]
        const v = ob[2]
        if (k === sym_integer_signed && isUnsignedInt(v)) {
            const va = getUnsignedIntVal(v)
            if (typeof va == 'number') {
                const x1 = (1 << (v[bitSizeSymbol] - 1)) >>> 0
                return (va >> v[bitSizeSymbol] - 1) ? (-x1 + (x1 - 1 & va)) : va
            }
            else {
                const x1 = 1n << BigInt(v[bitSizeSymbol] - 1)
                return (va >> BigInt(v[bitSizeSymbol] - 1)) ? (-x1 + (x1 - 1n & va)) : va
            }
        }
        else if (k === sym_registry && isUnsignedInt(v)) {
            return getRegistrySymbol(getUnsignedIntVal(v))
        }
        else if (k === sym_IEEE_754_binary16 && isUnsignedInt(v)) {
            setNumberToDV(tempDV, alignNumber(getUnsignedIntVal(v), v[bitSizeSymbol], 16))
            return getFloat16PolyFill(tempDV, 2)
        }
        else if (k === sym_IEEE_754_binary32 && isUnsignedInt(v)) {
            setNumberToDV(tempDV, alignNumber(getUnsignedIntVal(v), v[bitSizeSymbol], 32))
            return tempDV.getFloat32(0)
        }
        else if (k === sym_IEEE_754_binary64 && isUnsignedInt(v)) {
            setNumberToDV(tempDV, alignNumber(getUnsignedIntVal(v), v[bitSizeSymbol], 64))
            return tempDV.getFloat64(0)
        }
        else if (k === sym_text && Array.isArray(v) && v.every(x => isUnsignedInt2(x) && getUnsignedIntVal(x) < 256)) {
            return new TextDecoder().decode(new Uint8Array([...v.map(x => getUnsignedIntVal(x))]))
        }
        else if (k === sym_text && isUnsignedInt2(v)) {
            return String.fromCodePoint(getUnsignedIntVal(v))
        }
        else if (k === sym_bytes && Array.isArray(v) && v.every(x => isUnsignedInt2(x) && getUnsignedIntVal(x) < 256)) {
            return new Uint8Array([...v.map(x => getUnsignedIntVal(x))])
        }
        else if (k === sym_delta && isAddable(v)) {
            const parent = stack[stack.length - 2]
            if (Array.isArray(parent.val)) {
                const last = parent.val[parent.index - 1]
                const num = typeof last == 'number' ? last : 0
                return num + refineValues(v)
            }
        }
        else if (k === sym_delta_double && isAddable(v)) {
            const parent = stack[stack.length - 2]
            if (Array.isArray(parent.val)) {
                const last = parent.val[parent.index - 1]
                if (typeof last == 'number') {
                    const last2 = parent.val[parent.index - 2]
                    const num2 = typeof last2 == 'number' ? last2 : 0
                    const delta = last - num2
                    return last + delta + refineValues(v)
                }
                else {
                    return refineValues(v)
                }
            }
        }
        else if (k === sym_epoch_seconds_continuous) {
            const val = typeof v == 'number' || typeof v == 'bigint' ? v : refineValues(v)
            if (typeof val == 'number') {
                const tai = val * 1000 + tai_dbuf_epochOffset
                return new Date(tai - getLeap_millis_tai(tai))
            }
        }
        else if (k === sym_instant && isUnrefinedMap(v)) {
            const r_year = getValueFromUnrefinedMap(v, sym_year)
            const r_month = getValueFromUnrefinedMap(v, sym_month)
            const r_day = getValueFromUnrefinedMap(v, sym_day)
            const r_hour = getValueFromUnrefinedMap(v, sym_hour)
            const r_minute = getValueFromUnrefinedMap(v, sym_minute)
            const r_second = getValueFromUnrefinedMap(v, sym_second)
            if (isUnsignedInt2(r_year)
                && (r_month === undefined || isUnsignedInt2(r_month))
                && (r_day === undefined || isUnsignedInt2(r_day))
                && (r_hour === undefined || isUnsignedInt2(r_hour))
                && (r_minute === undefined || isUnsignedInt2(r_minute))
                && (r_second === undefined || isUnsignedInt2(r_second))
            ) {
                const year = getUnsignedIntVal(r_year)
                const month = isUnsignedInt2(r_month) ? getUnsignedIntVal(r_month) : 0
                const day = isUnsignedInt2(r_day) ? getUnsignedIntVal(r_day) : 0
                const hour = isUnsignedInt2(r_hour) ? getUnsignedIntVal(r_hour) : 0
                const minute = isUnsignedInt2(r_minute) ? getUnsignedIntVal(r_minute) : 0
                const second = isUnsignedInt2(r_second) ? getUnsignedIntVal(r_second) : 0
                return new Date(year + 2018, month, day + 1, hour, minute, second)
            }
        }
    }
    else {
        const r_value = getValueFromUnrefinedMap(ob, sym_value)
        if (r_value !== undefined) {
            const r_sign = getValueFromUnrefinedMap(ob, sym_sign)
            const hasSign = r_sign !== undefined ? 2 : 0
            const signFlag = hasSign ? refineValues(r_sign) ? true : false : false
            if (hasSign && ob.length == 5) {
                if (isUnsignedInt(r_value)) {
                    return signFlag ? -r_value[valSymbol] : r_value[valSymbol]
                }
            }
            const r_exp2 = getValueFromUnrefinedMap(ob, sym_exponent_base2)
            if (r_exp2 !== undefined) {
                const ex = refineValues(r_exp2)
                if (isInt(ex) && ex < 1024 && ex > -1023 && isUnsignedInt(r_value) && r_value[bitSizeSymbol] < 53 && ob.length == 5 + hasSign) {
                    let n = (signFlag ? 1n : 0n) << 11n
                    n = (n | BigInt(ex + 1023)) << 52n
                    n = n | (BigInt(r_value[valSymbol]) << BigInt(52 - r_value[bitSizeSymbol]))
                    tempDV.setBigUint64(0, n)
                    return tempDV.getFloat64(0)
                }
                else {
                    return assembleMap(ob)
                }
            }
            const r_exp10 = getValueFromUnrefinedMap(ob, sym_exponent_base10)
            if (r_exp10 !== undefined) {
                const ex = refineValues(r_exp10)
                if (isInt(ex) && ex < 10 && ex > -10 && isUnsignedInt(r_value) && r_value[bitSizeSymbol] < 53 && ob.length == 5 + hasSign) {
                    return Number(r_value[valSymbol]) * (10 ** ex) * (signFlag ? -1 : 1)
                }
                else {
                    return assembleMap(ob)
                }
            }
            const r_offset_add = getValueFromUnrefinedMap(ob, sym_offset_add)
            if (r_offset_add !== undefined) {
                if (ob.length == 5 && isAddable(r_offset_add) && isAddable(r_value)) {
                    return addValues(r_offset_add, r_value)
                }
                else {
                    return assembleMap(ob)
                }
            }
            const r_prefixDelta = getValueFromUnrefinedMap(ob, getRegistrySymbol(r.prefix_delta))
            if (r_prefixDelta !== undefined && isText(r_value) && isUnsignedInt(r_prefixDelta) && ob.length == 5) {
                const parent = stack[stack.length - 2]
                if (Array.isArray(parent.val)) {
                    const last = parent.val[parent.index - 1]
                    const s = typeof last == 'string' ? last : ''
                    const sb = new TextEncoder().encode(s)
                    return new TextDecoder().decode(concatBuffers([sb.slice(0, sb.byteLength - refineVal(r_prefixDelta)), r_value[u8TextSymbol]]))
                }
                return assembleMap(ob)
            }
            const r_prefix = getValueFromUnrefinedMap(ob, getRegistrySymbol(r.prefix))
            const r_suffix = getValueFromUnrefinedMap(ob, getRegistrySymbol(r.suffix))
            if ((r_prefix !== undefined || r_suffix != undefined) && isText(r_value)) {
                if (ob.length == 5) {
                    if (isText(r_prefix)) {
                        return new TextDecoder().decode(concatBuffers([r_prefix[u8TextSymbol], r_value[u8TextSymbol]]))
                    }
                    if (isText(r_suffix)) {
                        return new TextDecoder().decode(concatBuffers([r_value[u8TextSymbol], r_suffix[u8TextSymbol]]))
                    }
                    return assembleMap(ob)
                }
                else if (ob.length == 7 && isText(r_prefix) && isText(r_suffix)) {
                    return new TextDecoder().decode(concatBuffers([r_prefix[u8TextSymbol], r_value[u8TextSymbol], r_suffix[u8TextSymbol]]))
                }
                else {
                    return assembleMap(ob)
                }
            }

        }
    }
}
export const assembleMap = (v: any[]) => {
    const o = {}
    const l = Math.floor((v.length - 1) / 2)
    for (let i = 1; i <= l; i++) {
        let pi = v[i]
        switch (typeof pi) {
            case 'string':
                if (!pi.startsWith(symbolPrefix)) {
                    pi = 's_' + pi
                }
                break
            case 'number':
            case 'bigint':
                pi = 'n_' + pi
                break
            case 'boolean':
                pi = 'b_' + pi
                break
            case 'object':
                pi = 'x_' + i
                break
            default:
                throw 'key type not implemented'
        }
        const pv = v[i + l]
        if (pi !== sym_nonexistent && pv !== sym_nonexistent) {
            if (o[pi] === undefined) {
                o[pi] = pv
            }
            else if (Array.isArray(o[pi])) {
                o[pi].push(pv)
            }
            else {
                o[pi] = [o[pi], pv]
            }
        }
    }
    return o
}
export type RefineStack = { val, index: number }[]
export const refineValues = (v) => {
    const stack: RefineStack = [{ val: v, index: 0 }]
    const tempDV = new DataView(new ArrayBuffer(8))
    let last
    while (stack.length) {
        const top = stack[stack.length - 1]
        if (isUnrefinedMap(top.val)) {
            const x = top.index == 0 ? refineObject(top.val, tempDV, stack) : undefined
            if (x === undefined) {
                if (last !== undefined) {
                    top.val[top.index] = last
                    top.index++
                    last = undefined
                }
                if (top.index == top.val.length) {
                    last = assembleMap(top.val)
                    stack.pop()
                }
                else {
                    if (top.val[top.index] === sym_nonexistent) {
                        top.index++
                    }
                    else {
                        stack.push({ val: top.val[top.index], index: 0 })
                    }
                }
            }
            else {
                stack.pop()
                last = x
            }
        }
        else if (Array.isArray(top.val)) {
            if (last !== undefined) {
                top.val[top.index] = last
                top.index++
                last = undefined
            }
            if (top.index == top.val.length) {
                last = stack.pop().val
            }
            else {
                if (top.val[top.index] === sym_nonexistent) {
                    delete top.val[top.index]
                    top.index++
                }
                else {
                    stack.push({ val: top.val[top.index], index: 0 })
                }
            }
        }
        else {
            last = refineVal(stack.pop().val)
        }
    }
    return last
}
export type PackStack = { val, index: number, tempTypes: Node[], tempData: Node[] }[]
export const pack = (v) => {
    const stack: PackStack = [{ val: v, index: 0, tempTypes: [], tempData: [] }]
    let lastType: Node
    let lastData: Node
    while (stack.length) {
        const top = stack[stack.length - 1]
        if (Array.isArray(top.val)) {
            if (lastType !== undefined) {
                top.tempTypes.push(lastType)
                top.tempData.push(lastData)
                top.index++
                lastType = lastData = undefined
            }
            if (top.index == top.val.length) {
                stack.pop()
                lastType = type_array(r.parse_type_data)
                lastData = array(...top.tempData.map((x, i) => parse_type_data(top.tempTypes[i], x)))
            }
            else {
                stack.push({ val: top.val[top.index], index: 0, tempTypes: [], tempData: [] })
            }
        }
        else if (top.val instanceof ArrayBuffer) {
            throw 'not imp'
        }
        else if (ArrayBuffer.isView(top.val)) {
            stack.pop()
            if (top.val instanceof Uint8Array) {
                lastType = val(r.parse_bytes, true)
                lastData = bytes(top.val)
            }
            else {
                throw 'not imp'
            }
        }
        else if (top.val === null) {
            stack.pop()
            lastType = val(r.describe_no_value, true)
        }
        else if (typeof top.val == 'object') {
            const ks = Object.keys(top.val)
            if (top.tempTypes.length == 0) {
                for (let k of ks) {
                    if (top.val[k] !== undefined) {
                        if (isRegistrySymbol(k)) {
                            top.tempTypes.push(val(getRegistryIndex(k), true))
                        }
                        else {
                            top.tempTypes.push(val(r.parse_text, true))
                            top.tempData.push(string(k))
                        }
                    }
                }
            }
            if (lastType !== undefined) {
                top.tempTypes.push(lastType)
                if (lastData) {
                    top.tempData.push(lastData)
                }
                top.index++
                lastType = lastData = undefined
            }
            if (top.index == ks.length) {
                stack.pop()
                lastType = type_map(...top.tempTypes)
                lastData = map(...top.tempData)
            }
            else {
                const k = ks[top.index]
                if (top.val[k] !== undefined) {
                    stack.push({ val: top.val[k], index: 0, tempTypes: [], tempData: [] })
                }
                else {
                    top.index++
                }
            }
        }
        else {
            stack.pop()
            if (typeof top.val == 'string') {
                if (isRegistrySymbol(top.val)) {
                    lastType = val(getRegistryIndex(top.val), true)
                }
                else {
                    lastType = val(r.parse_text, true)
                    lastData = string(top.val)
                }
            }
            else if (typeof top.val == 'number') {
                if (isNotNonNegativeInteger(top.val)) {
                    throw 'not implemented number'
                }
                else {
                    lastType = val(r.parse_varint, true)
                    lastData = val(top.val)
                }
            }
            else if (typeof top.val == 'boolean') {
                lastType = val(top.val ? r.true : r.false, true)
            }
            else {
                throw 'not implemented pack'
            }
        }
    }
    return root(lastType, lastData)
}
export const getField = (n: Node, key: r): Node => {
    if (n.type != NodeType.parse_type_data) {
        throw 'node is not parse type data'
    }
    if (n.children[0].type != NodeType.type_map) {
        throw 'node is not a type_map'
    }
    const numKeys = n.children[0].children.length / 2
    let mi = 0
    for (let i = 0; i < numKeys; i++) {
        if (n.children[0].children[i].registry == key) {
            return { type: NodeType.parse_type_data, children: [n.children[0].children[i + numKeys], n.children[1].children[mi]] }
        }
        else if (resolveParseOp(n.children[0].children[i]).type != ParseMode.none) {
            mi++
        }
    }
}