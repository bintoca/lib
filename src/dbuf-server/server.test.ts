import { createParser, setParserBuffer } from '@bintoca/dbuf-codec/decode'
import { createEncoder, finishWrite } from '@bintoca/dbuf-codec/encode'
import { ServeState, hasError, executeRequest, responseFromError, ResponseState, ExecutionConfig, createConfig, pathError } from './request'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { r } from './registry'
import { type_map, root, map, parse_type_data, type_array, parse_bit_size, array, writeNode, parse_align, type_choice, choice, writer, writerPrefix, type_array_bit } from '@bintoca/dbuf-codec/encode'
import { unpack, parseFull } from '@bintoca/dbuf-data/unpack'
import { refineValues } from '@bintoca/dbuf-data/refine'
import { concatBuffers, bit_val } from '@bintoca/dbuf-codec/common'

const sym_stream_position = getRegistrySymbol(r.stream_position)
const sym_error = getRegistrySymbol(r.error)
const sym_error_incomplete_stream = getRegistrySymbol(r.incomplete_stream)
const sym_data_path = getRegistrySymbol(r.data_path)
const sym_registry_symbol_not_accepted = getRegistrySymbol(r.registry_symbol_not_accepted)
const sym_registry_symbol_not_accepted_as_array_type = getRegistrySymbol(r.registry_symbol_not_accepted_as_array_type)
const sym_data_type_not_accepted = getRegistrySymbol(r.data_type_not_accepted)
const sym_preamble_max_size_exceeded = getRegistrySymbol(r.preamble_max_size_exceeded)
const call_response = async <T>(i: Uint8Array | Uint8Array[], config?: ExecutionConfig<T>): Promise<ResponseState> => {
    const bufs = Array.isArray(i) ? i : [i]
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
    if (!config) {
        config = createConfig()
    }
    return await executeRequest(new Request('http://example.com', { body: input, method: 'post', duplex: 'half' } as any), config, null)
}
test.each([
    [root(type_map(r.operation, parse_type_data(type_array(parse_bit_size(32)), array(...Array(6000).fill(0).map(x => bit_val(1, 32))))), map()), sym_preamble_max_size_exceeded],
    [root(type_map(r.operation, type_array(parse_bit_size(32))), map(array(...Array(6000).fill(0).map(x => bit_val(1, 32))))), sym_preamble_max_size_exceeded],
    [root(type_map(r.operation, r.value, type_array(parse_bit_size(32)), r.parse_varint), map(array(...Array(6000).fill(0).map(x => bit_val(1, 32))), 5)), sym_preamble_max_size_exceeded],
])('errorPreambleSize(%#)', async (i, o) => {
    const st = createParser()
    const en = createEncoder()
    writeNode(en, i)
    finishWrite(en)
    const r = await call_response(en.buffers)
    if (r.state.internalError !== undefined) {
        console.log(r.state.internalError)
    }
    expect(r.state.internalError).toBe(undefined)
    expect(r.response.status).toBe(400)
    setParserBuffer(new Uint8Array(await r.response.arrayBuffer()), st)
    parseFull(st)
    const u = refineValues(unpack(st.root))
    expect(Reflect.ownKeys(u)[0]).toBe(sym_error)
    expect(u).toStrictEqual({ [sym_error]: o })
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
    const st = createParser()
    const en = createEncoder()
    writeNode(en, i)
    finishWrite(en)
    const r = await call_response(concatBuffers(en.buffers))
    if (r.state.internalError !== undefined) {
        console.log(r.state.internalError)
    }
    expect(r.state.internalError).toBe(undefined)
    expect(r.response.status).toBe(400)
    setParserBuffer(new Uint8Array(await r.response.arrayBuffer()), st)
    parseFull(st)
    const u = refineValues(unpack(st.root))
    expect(Reflect.ownKeys(u)[0]).toBe(sym_error)
    expect(u).toStrictEqual({ [sym_error]: o, [sym_stream_position]: pos })
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
    const st = createParser()
    const en = createEncoder()
    writeNode(en, i)
    finishWrite(en)
    const config = createConfig()
    config.operationMap.set(getRegistrySymbol(r.value), {
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
    const es = await call_response(concatBuffers(en.buffers), config)
    if (es.state.internalError !== undefined) {
        console.log(es.state.internalError)
    }
    expect(es.state.internalError).toBe(undefined)
    expect(es.response.status).toBe(400)
    setParserBuffer(new Uint8Array(await es.response.arrayBuffer()), st)
    parseFull(st)
    const u = refineValues(unpack(st.root))
    expect(Reflect.ownKeys(u)[0]).toBe(sym_error)
    expect(u).toStrictEqual({ [sym_error]: o, [sym_data_path]: path })
})
test.each([
    [[]],
    [[r.type_map, 1]],
])('error_incomplete(%#)', async (i) => {
    const st = createParser()
    const r = await call_response(writer(writerPrefix(i, true)))
    if (r.state.internalError !== undefined) {
        console.log(r.state.internalError)
    }
    expect(r.state.internalError).toBe(undefined)
    expect(r.response.status).toBe(400)
    setParserBuffer(new Uint8Array(await r.response.arrayBuffer()), st)
    parseFull(st)
    const u = refineValues(unpack(st.root))
    expect(u).toStrictEqual({ [sym_error]: sym_error_incomplete_stream })
})
test.each([
    [root(type_map(r.denominator, r.reference, r.value, r.true, type_array_bit(2, r.parse_varint), r.true)), sym_registry_symbol_not_accepted, 56],
])('error_chunk(%#)', async (i, o, path) => {
    const st = createParser()
    const en = createEncoder()
    writeNode(en, i)
    finishWrite(en)
    const a = []
    for (let x = 0; x < en.buffers[0].byteLength; x++) {
        a.push(new Uint8Array([en.buffers[0][x]]))
    }
    const r = await call_response(a)
    if (r.state.internalError !== undefined) {
        console.log(r.state.internalError)
    }
    expect(r.state.internalError).toBe(undefined)
    expect(r.response.status).toBe(400)
    setParserBuffer(new Uint8Array(await r.response.arrayBuffer()), st)
    parseFull(st)
    const u = refineValues(unpack(st.root))
    expect(u).toStrictEqual({ [sym_error]: o, [sym_stream_position]: path })
})