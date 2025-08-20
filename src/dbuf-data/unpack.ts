import { getRegistrySymbol, r } from '@bintoca/dbuf-data/registry'
import { parseCore, ParseState, resolveParseOp, initParser } from '@bintoca/dbuf-codec/decode'
import { Node, NodeType, ParseMode, val, concatBuffers } from '@bintoca/dbuf-codec/common'

const sym_nonexistent = getRegistrySymbol(r.nonexistent)
const sym_value = getRegistrySymbol(r.value)
const sym_copyable = getRegistrySymbol(r.copyable)
const sym_copy_length = getRegistrySymbol(r.copy_length)
const sym_copy_distance = getRegistrySymbol(r.copy_distance)
const sym_flatten_array = getRegistrySymbol(r.flatten_array)
const sym_offset_add = getRegistrySymbol(r.offset_add)

export type ParseFullState<T extends ArrayBufferLike = ArrayBufferLike> = ParseState<T> & { error?: object, internalError?: any }
export const initFullParser = <T extends ArrayBufferLike = ArrayBufferLike>(b: ArrayBufferView<T>, liteProfile?: boolean): ParseFullState<T> => initParser(b, liteProfile)
export const parseCoreLoop = (st: ParseFullState) => {
    try {
        while (true) {
            parseCore(st)
            if (st.decoder.endOfBuffer) {
                st.error = { [getRegistrySymbol(r.error)]: getRegistrySymbol(r.incomplete_stream) }
                break
            }
            if (st.codecError) {
                st.error = { [getRegistrySymbol(r.error)]: getRegistrySymbol(st.codecError) }
                break
            }
            if (st.container.children.length) {
                break
            }
        }
    }
    catch (e) {
        st.error = { [getRegistrySymbol(r.error)]: getRegistrySymbol(r.error_internal) }
        st.internalError = e
    }
    if (st.decoder.dv.byteLength == st.decoder.dvOffset) {
        st.decoder.dv = undefined
    }
}
export const parseFull = <T extends ArrayBufferLike = ArrayBufferLike>(b: ArrayBufferView<T>, liteProfile?: boolean): ParseFullState<T> => {
    const st = initFullParser(b, liteProfile)
    parseCoreLoop(st)
    return st
}
export const enum UnpackMode { type, data }
export type UnpackNode = Node & { ob?: UnpackType }
export type NodeIndex = { node: UnpackNode, itemIndex?: number }
export type ModeIndex = { mode: UnpackMode, typeStack: NodeIndex[], objectStack: UnpackType[][] }
export type UnpackState = { nodeStack: NodeIndex[], modeStack: ModeIndex[], sharedChoiceStack: NodeIndex[], copyBuffer: any[], unsafeExpand?: boolean }
export type UnpackType = { [valSymbol]?: number | bigint, [bitSizeSymbol]?: number, [u8Symbol]?: Uint8Array, [u8TextSymbol]?: Uint8Array } | symbol | UnpackType[]
export const bitSizeSymbol = Symbol.for('bitSizeSymbol')
export const valSymbol = Symbol.for('valSymbol')
export const u8Symbol = Symbol.for('u8Symbol')
export const u8TextSymbol = Symbol.for('u8TextSymbol')
export const cycleSymbol = Symbol.for('dbuf_cycle')
export const mapMarkerSymbol = Symbol.for('mapMarkerSymbol')
export const assignPropNode = (ob: UnpackType[], n: UnpackNode, state: UnpackState) => {
    let v: UnpackType
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
            const c: UnpackType[] = [mapMarkerSymbol]
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
export const getUnsignedIntVal = (v) => {
    const ks = Reflect.ownKeys(v)
    if (ks.some(x => x == bitSizeSymbol)) {
        return v[valSymbol]
    }
    return getUnsignedIntVal(getValueFromUnrefinedMap(v, sym_offset_add)) + getUnsignedIntVal(getValueFromUnrefinedMap(v, sym_value))
}
export const getValueFromUnrefinedMap = (a: UnpackType[], key) => {
    const l = Math.floor((a.length - 1) / 2)
    for (let i = 1; i <= l; i++) {
        if (a[i] === key) {
            return a[i + l]
        }
    }
}
export const isUnrefinedMap = (a: UnpackType): a is UnpackType[] => Array.isArray(a) && a[0] === mapMarkerSymbol
export const copyLenDist = (state: UnpackState, dest: UnpackType[], len: number, dist: number) => {
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
export const assignProp = (ob: UnpackType[], v: UnpackType, state: UnpackState) => {
    let push = true
    if (isUnrefinedMap(v)) {
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
export const assignParseNone = (ty: NodeIndex, ob: UnpackType[], state: UnpackState) => {
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
export const createObject = (a: UnpackType, state: UnpackState) => {
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
    let a = createObject(mo.objectStack.pop(), state)
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