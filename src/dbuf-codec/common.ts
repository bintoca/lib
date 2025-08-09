import { r } from './registry'

export const enum NodeType { parse_type_data, type_map, map, type_array, array, type_array_chunk, array_chunk, chunk, type_choice, type_optional, type_choice_shared, choice, type_choice_select, choice_select, bits, parse_bit_size, val, bit_val, parse_align, align, type_array_bit, type_array_fixed, array_bit, array_fixed, parse_span, span, cycle, u8Text, u8Text_chunks, bytes, byte_chunks }
export type Node = { type: number, registry?: number, needed?: number, children?: Node[], val?: number, op?: ParseOp, ops?: ParseOp[], bitSize?: number, arraySize?: number, rootMagic?: boolean, rootLittleEndian?: boolean, choiceShared?: boolean, choiceArray?: boolean, arrayOffset?: number, u8?: Uint8Array }
export const enum ParseMode { varint, any, parse_type_data, bit_size, array, array_chunk, chunk, choice, choice_select, map, none, read_assign, align, array_bit, array_fixed, array_none, bytes, byte_chunk, u8Text, u8Text_chunk }
export type ParseOp = { type: number, bitSize?: number, ops?: ParseOp[], op?: ParseOp, shared?: boolean, spanUnit?: number, spanBitFlag?: number, index?: number, lastTotalBitsRead?: number, arrayOffset?: number }
export const littleEndianPrefix = 128 + r.little_endian_marker
export const magicNumberPrefix = 0xDFDFDFDF
export const val = (v: number, isRegistry?: boolean): Node => { return { type: NodeType.val, val: v, registry: isRegistry ? v : undefined } }
export const val_size = (v: number, numBits: number, isRegistry?: boolean): Node => { return { type: NodeType.val, val: v, bitSize: numBits, op: { type: ParseMode.none }, registry: isRegistry ? v : undefined } }
export const bit_val = (v: number, numBits: number): Node => { return { type: NodeType.bit_val, val: v, bitSize: numBits, op: { type: ParseMode.none } } }
export const concatBuffers = (buffers: Uint8Array[]): Uint8Array => {
    if (buffers.length == 1) {
        return buffers[0]
    }
    const u = new Uint8Array(buffers.reduce((a, b) => a + b.byteLength, 0))
    let offset = 0
    for (let b of buffers) {
        u.set(b, offset)
        offset += b.byteLength
    }
    return u
}