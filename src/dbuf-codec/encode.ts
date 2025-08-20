import { Node, NodeType, magicNumberPrefix, littleEndianPrefix, val, concatBuffers } from '@bintoca/dbuf-codec/common'
import { r } from '@bintoca/dbuf-codec/registry'

export type EncoderState<T extends ArrayBufferLike = ArrayBufferLike> = { buffers: Uint8Array<T>[], dv: DataView<T>, offset: number, bitsRemaining: number, bits: number, nodeStack: { node: Node, itemIndex?: number }[], littleEndian?: boolean, bitsWritten: number, rootInitialized: boolean, alignVarint8?: boolean, newBufferSize: number }
export const createEncoder = (bufferSize?: number): EncoderState<ArrayBuffer> => {
    const newBufferSize = bufferSize || 4096
    return { buffers: [], dv: new DataView(new ArrayBuffer(newBufferSize)), offset: 0, bitsRemaining: 32, bits: 0, nodeStack: [], bitsWritten: 0, rootInitialized: false, newBufferSize }
}
export const createEncoderSharedArrayBuffer = (bufferSize?: number): EncoderState<SharedArrayBuffer> => {
    const newBufferSize = bufferSize || 4096
    return { buffers: [], dv: new DataView(new SharedArrayBuffer(newBufferSize)), offset: 0, bitsRemaining: 32, bits: 0, nodeStack: [], bitsWritten: 0, rootInitialized: false, newBufferSize }
}
export const newBuffer = (s: EncoderState) => {
    if (s.dv.buffer instanceof ArrayBuffer) {
        s.dv = new DataView(new ArrayBuffer(s.newBufferSize))
    }
    else if (s.dv.buffer instanceof SharedArrayBuffer) {
        s.dv = new DataView(new SharedArrayBuffer(s.newBufferSize))
    }
    else {
        throw 'unknown buffer type'
    }
}
export const writeVarint = (s: EncoderState, x: number) => {
    if (x < 8 && !s.alignVarint8) {
        writeBits(s, 0, 1)
        writeBits(s, x, 3)
    }
    else if (x < 64) {
        writeBits(s, s.littleEndian ? 1 : 2, 2)
        writeBits(s, x, 6)
    }
    else if (x < 2 ** 13) {
        writeBits(s, s.littleEndian ? 3 : 6, 3)
        writeBits(s, x, 13)
    }
    else if (x < 2 ** 20) {
        writeBits(s, s.littleEndian ? 7 : 14, 4)
        writeBits(s, x, 20)
    }
    else if (x < 2 ** 32) {
        writeBits(s, 15, 4)
        writeBits(s, x, 32)
    }
}
export const alignEncoder = (s: EncoderState, n: number) => {
    const current = (s.offset * 8 + 32 - s.bitsRemaining) % n
    if (current) {
        writeBits(s, 0, n - current)
    }
}
export const writeBits = (s: EncoderState, x: number, size: number) => {
    if (s.dv.byteLength == s.offset) {
        s.buffers.push(new Uint8Array(s.dv.buffer))
        newBuffer(s)
        s.offset = 0
    }
    if (s.littleEndian) {
        const shift = 32 - s.bitsRemaining
        s.bits = s.bits | (x << shift)
        if (s.bitsRemaining > size) {
            s.bitsRemaining -= size
        }
        else {
            s.dv.setUint32(s.offset, s.bits, true)
            s.offset += 4
            if (s.bitsRemaining == 32) {
                s.bits = 0
            }
            else {
                s.bits = x >>> s.bitsRemaining
                s.bitsRemaining = 32 - (size - s.bitsRemaining)
            }
        }
    }
    else {
        if (s.bitsRemaining > size) {
            const shift = s.bitsRemaining - size
            s.bits = s.bits | (x << shift)
            s.bitsRemaining -= size
        }
        else {
            const shift = size - s.bitsRemaining
            s.bits = s.bits | (x >>> shift)
            s.dv.setUint32(s.offset, s.bits)
            s.offset += 4
            if (shift == 0) {
                s.bits = 0
                s.bitsRemaining = 32
            }
            else {
                const shift1 = 32 - shift
                s.bits = x << shift1
                s.bitsRemaining = shift1
            }
        }
    }
    s.bitsWritten += size
}
export const writeBytes = (s: EncoderState, u8: Uint8Array) => {
    let pad = 0
    if (s.bitsRemaining != 32) {
        pad = s.bitsRemaining
        s.bitsWritten -= s.bitsRemaining
        writeBits(s, 0, s.bitsRemaining)
        const align = s.bitsWritten % 8
        if (align) {
            s.bitsWritten += 8 - align
        }
    }
    s.offset -= pad >>> 3
    let u8i = 0
    while (u8i < u8.byteLength) {
        const dvRemaining = s.dv.byteLength - s.offset
        const bytesRemaining = u8.byteLength - u8i
        if (dvRemaining < bytesRemaining) {
            for (let i = 0; i < dvRemaining; i++) {
                s.dv.setUint8(s.offset, u8[u8i])
                s.offset++
                u8i++
            }
            s.buffers.push(new Uint8Array(s.dv.buffer))
            newBuffer(s)
            s.offset = 0
        }
        else {
            for (let i = 0; i < bytesRemaining; i++) {
                s.dv.setUint8(s.offset, u8[u8i])
                s.offset++
                u8i++
            }
        }
    }
    s.bitsWritten += u8.byteLength * 8
    const b = s.offset % 4
    s.offset -= b
    s.bitsWritten -= b * 8
    for (let i = 0; i < b; i++) {
        writeBits(s, s.dv.getUint8(s.offset + i), 8)
    }
}
export const finishWrite = (s: EncoderState) => {
    if (s.bitsRemaining != 32) {
        s.bitsWritten -= s.bitsRemaining
        writeBits(s, 0, s.bitsRemaining)
    }
    s.buffers.push(new Uint8Array(s.dv.buffer, 0, Math.ceil(s.bitsWritten / 8) - s.buffers.reduce((a, b) => a + b.length, 0)))
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
export const writeTokens = (x: WriterToken) => {
    const es = createEncoder()
    writeTokensCore(x, es)
    return es
}
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
export const writeTokensCore = (x: WriterToken, es: EncoderState) => {
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
export const writeNodeStream = async (s: EncoderState, sc: Node, stream: WritableStreamDefaultWriter<ArrayBufferView>) => {
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
export const writeNodeFull = (node: Node) => {
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
export const choice = (a: Node, b?: NodeOrNum): Node => { return { type: NodeType.choice, children: b === undefined ? [nodeOrNum(a)] : [nodeOrNum(a), nodeOrNum(b)] } }
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