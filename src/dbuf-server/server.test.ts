import { writeNodeFull } from '@bintoca/dbuf-codec/encode'
import { ServeState, hasError, executeRequest, responseFromError, createConfig, pathError, ttsig } from '@bintoca/dbuf-server/request'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { r } from '@bintoca/dbuf-server/registry'
import { type_map, root, map, parse_type_data, type_array, parse_bit_size, array, parse_align, type_choice, choice, writeTokens, writerPrefix, type_array_bit } from '@bintoca/dbuf-codec/encode'
import { bit_val, Node } from '@bintoca/dbuf-codec/common'
import { parseFull, unpack } from '@bintoca/dbuf-data/unpack'
import { RefineType, refineValues } from '@bintoca/dbuf-data/refine'

const sym_stream_position = getRegistrySymbol(r.stream_position)
const sym_error = getRegistrySymbol(r.error)
const sym_error_incomplete_stream = getRegistrySymbol(r.incomplete_stream)
const sym_data_path = getRegistrySymbol(r.data_path)
const sym_registry_symbol_not_accepted = getRegistrySymbol(r.registry_symbol_not_accepted)
const sym_registry_symbol_not_accepted_as_array_type = getRegistrySymbol(r.registry_symbol_not_accepted_as_array_type)
const sym_data_type_not_accepted = getRegistrySymbol(r.data_type_not_accepted)
const sym_preamble_max_size_exceeded = getRegistrySymbol(r.preamble_max_size_exceeded)
const testConfig = createConfig()
testConfig.operationMap.set(getRegistrySymbol(r.value), {
    fields: [{ key: r.reference, required: true }], func: async (state: ServeState): Promise<Response> => {
        if (hasError(state)) {
            return responseFromError(state)
        }
        if (typeof state.refinedBody[getRegistrySymbol(r.reference)] != 'string') {
            state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.reference)])
            return responseFromError(state)
        }
    }
})
test('sig', async () => { await ttsig() })
export type RefinedResponse = { status: number, ob: RefineType }
const fetchRefine = async (req: Request): Promise<RefinedResponse> => {
    const r = await executeRequest(req, testConfig, null)
    if (r.internalError !== undefined) {
        console.log(r.internalError)
    }
    const st = parseFull(new Uint8Array(await r.response.arrayBuffer()))
    return { status: r.response.status, ob: refineValues(unpack(st.root)) }
}
const createRequest = (n: Uint8Array | ReadableStream): Request => new Request('http://example.com', { body: n, method: 'post', duplex: 'half' } as any)
const nodeFetchRefine = async (n: Node): Promise<RefinedResponse> => await fetchRefine(createRequest(writeNodeFull(n)))
test.each([
    [root(type_map(r.operation, parse_type_data(type_array(parse_bit_size(32)), array(...Array(6000).fill(0).map(x => bit_val(1, 32))))), map()), sym_preamble_max_size_exceeded],
    [root(type_map(r.operation, type_array(parse_bit_size(32))), map(array(...Array(6000).fill(0).map(x => bit_val(1, 32))))), sym_preamble_max_size_exceeded],
    [root(type_map(r.operation, r.value, type_array(parse_bit_size(32)), r.parse_varint), map(array(...Array(6000).fill(0).map(x => bit_val(1, 32))), 5)), sym_preamble_max_size_exceeded],
])('errorPreambleSize(%#)', async (i, o) => {
    const r = await nodeFetchRefine(i)
    expect(r.status).toBe(400)
    expect(r.ob).toStrictEqual({ [sym_error]: o })
})
test.each([
    [root(r.type_choice), sym_registry_symbol_not_accepted, 4],
    [root(r.type_optional), sym_registry_symbol_not_accepted, 4],
    [root(r.parse_type_data_immediate), sym_registry_symbol_not_accepted, 4],
    [root(r.type_array_bit), sym_registry_symbol_not_accepted, 8],
    [root(r.type_array_fixed), sym_registry_symbol_not_accepted, 8],
    [root(r.type_array_chunk), sym_registry_symbol_not_accepted, 8],
    [root(r.type_choice_shared), sym_registry_symbol_not_accepted, 8],
    [root(r.type_choice_select), sym_registry_symbol_not_accepted, 8],
    [root(type_map(r.operation, type_array(r.value))), sym_registry_symbol_not_accepted_as_array_type, 28],
    [root(type_map(r.operation, type_array(parse_align(4, r.value)))), sym_registry_symbol_not_accepted_as_array_type, 28],
    [root(type_map(r.operation, type_array(type_map(r.value, r.parse_varint)))), sym_registry_symbol_not_accepted_as_array_type, 24],
    [root(type_map(r.value, r.operation, r.parse_varint, r.nonexistent), map(1)), sym_registry_symbol_not_accepted, 36],
    [root(type_map(r.value, r.operation, r.parse_varint, r.parse_type_data), map(1, parse_type_data(type_choice(r.parse_varint), choice(bit_val(1, 1), 2)))), sym_registry_symbol_not_accepted, 44],
])('errorPosition(%#)', async (i, o, pos) => {
    const r = await nodeFetchRefine(i)
    expect(r.status).toBe(400)
    expect(r.ob).toStrictEqual({ [sym_error]: o, [sym_stream_position]: pos })
})
test.each([
    [root(r.true), sym_data_type_not_accepted, []],
    [root(r.type_array), sym_data_type_not_accepted, []],
    [root(type_map(), map()), getRegistrySymbol(r.required_field_missing), [getRegistrySymbol(r.operation)]],
    [root(type_map(type_map(r.operation, r.parse_varint), r.value)), getRegistrySymbol(r.field_not_accepted), ['x_1']],
    [root(type_map(r.denominator, r.parse_varint)), getRegistrySymbol(r.field_not_accepted), [getRegistrySymbol(r.denominator)]],
    [root(type_map(r.operation, r.parse_varint), map(2)), getRegistrySymbol(r.data_value_not_accepted), [getRegistrySymbol(r.operation)]],
    [root(type_map(r.operation, r.value), map()), getRegistrySymbol(r.required_field_missing), [getRegistrySymbol(r.reference)]],
    [root(type_map(r.operation, r.reference, r.value, r.parse_type_data), map()), getRegistrySymbol(r.registry_symbol_not_accepted), [getRegistrySymbol(r.reference)]],
    [root(type_map(r.operation, r.reference, r.denominator, r.value, r.parse_varint, r.parse_varint), map()), getRegistrySymbol(r.field_not_accepted), [getRegistrySymbol(r.denominator)]],
    [root(type_map(r.operation, r.reference, type_map(r.operation, r.parse_varint), r.value, r.parse_varint, r.parse_varint), map()), getRegistrySymbol(r.field_not_accepted), ['body_1']],
    [root(type_map(r.operation, r.reference, r.value, r.parse_varint), map(2)), getRegistrySymbol(r.data_type_not_accepted), [getRegistrySymbol(r.reference)]],
])('errorPath(%#)', async (i, o, path) => {
    const r = await nodeFetchRefine(i)
    expect(r.status).toBe(400)
    expect(r.ob).toStrictEqual({ [sym_error]: o, [sym_data_path]: path })
})
test.each([
    [[]],
    [[r.type_map, 1]],
])('error_incomplete(%#)', async (i) => {
    const r = await fetchRefine(createRequest(writeTokens(writerPrefix(i, true)).buffers[0]))
    expect(r.status).toBe(400)
    expect(r.ob).toStrictEqual({ [sym_error]: sym_error_incomplete_stream })
})
test.each([
    [root(type_map(r.denominator, r.reference, r.value, r.true, type_array_bit(2, r.parse_varint), r.true)), sym_registry_symbol_not_accepted, 56],
])('error_chunk(%#)', async (i, o, path) => {
    const b = writeNodeFull(i)
    const bufs = []
    for (let x = 0; x < b.byteLength; x++) {
        bufs.push(new Uint8Array([b[x]]))
    }
    const input = new ReadableStream<BufferSource>({
        pull(controller) {
            if (bufs.length) {
                controller.enqueue(bufs.shift())
            }
            else {
                controller.close()
            }
        },
        cancel(reason) {
            //reject(reason)
        }
    })
    const r = await fetchRefine(createRequest(input))
    expect(r.status).toBe(400)
    expect(r.ob).toStrictEqual({ [sym_error]: o, [sym_stream_position]: path })
})