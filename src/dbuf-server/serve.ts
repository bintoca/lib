import { ParseState, setParserBuffer, parseCore, resolveParseOp, initParser, readVarint, alignDecoder, getBytes, readBits32, validateSymbolsLite } from '@bintoca/dbuf-codec/decode'
import { NodeType, Node, ParseMode, concatBuffers } from '@bintoca/dbuf-codec/common'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { r } from '@bintoca/dbuf-server/registry'
import { type_map, root, writeNodeFull, map } from '@bintoca/dbuf-codec/encode'
import { unpack, parseFull } from '@bintoca/dbuf-data/unpack'
import { pack } from '@bintoca/dbuf-data/pack'
import { RefineObjectType, RefineType, refineValues } from '@bintoca/dbuf-data/refine'

export type Result<T, E> = { value?: T, error?: E }

const sym_value = getRegistrySymbol(r.value)
const sym_operation = getRegistrySymbol(r.operation)
const sym_data_path = getRegistrySymbol(r.data_path)
export const registryError = (er: number) => { return { [getRegistrySymbol(r.error)]: getRegistrySymbol(er) } }

export type PreparedCredential = { type: 'token' | 'signature', user?: Uint8Array, nonce?: Uint8Array, value?: Uint8Array, publicKey?: Uint8Array, algorithm?: symbol }
export type ErrorType = 'internal' | 'not_authenticated' | 'other'
export type ServeState = {
    reader?: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>, operation?: RefineType,
    bodyStream?: ReadableStream<Uint8Array<ArrayBuffer>>, frameIndex: number
    responseBuffer?: Uint8Array<ArrayBuffer>, responseError?: RefineObjectType<ArrayBuffer>, responseStream?: ReadableStream,
    internalError?, preambleNode?: Node, postambleNode?: Node, parser?: ParseState<ArrayBuffer>, bodyType?: Node,
    env?, preparedCredential?: PreparedCredential, config: ExecutionConfig, serveCompleted?: boolean, errorType?: ErrorType
}
export const internalError = (state: ServeState, e) => {
    state.errorType = 'internal'
    state.responseBuffer = writeNodeFull(pack(registryError(r.error_internal)))
    state.internalError = e
}
export const setError = (state: ServeState, err: RefineObjectType<ArrayBuffer>) => {
    state.errorType = 'other'
    state.responseError = err
    state.responseBuffer = writeNodeFull(pack(err))
}
export const pathError = (er: number, path: RefineType[], basePath?: RefineType[]): RefineObjectType<ArrayBuffer> => Object.assign(registryError(er), { [sym_data_path]: basePath ? basePath.concat(path) : path })
export const serveCompleted = (state: ServeState) => state.errorType !== undefined || state.serveCompleted
export type OperationConfig = { func: (state: ServeState, deps) => Promise<void>, deps?}
export type OperationMap = Map<RefineType, OperationConfig>
export type ExecutionConfig = { operationMap: OperationMap }
export const maxPreambleBytes = 2 ** 14
export const codecError = (state: ServeState): RefineObjectType<ArrayBuffer> => Object.assign(registryError(state.parser.codecError), { [getRegistrySymbol(r.stream_position)]: state.parser.decoder.totalBitsRead })

export const getBodyStream = (state: ServeState, chunkBits?: number) => {
    if (chunkBits) {
        let setupChunkLength = true
        let setupChunkCount = true
        let chunkCount = 0
        let len = 0
        return new ReadableStream<Uint8Array<ArrayBuffer>>({
            async pull(controller) {
                if (setupChunkCount) {
                    while (true) {
                        chunkCount = readBits32(state.parser.decoder, chunkBits)
                        if (state.parser.decoder.endOfBuffer) {
                            const read = await state.reader.read()
                            if (read.done) {
                                return setError(state, registryError(r.incomplete_stream))
                            }
                            setParserBuffer(read.value, state.parser)
                        }
                        else {
                            if (chunkCount == 0) {
                                controller.enqueue(new Uint8Array())
                                controller.close()
                                return
                            }
                            break
                        }
                    }
                    setupChunkCount = false
                }
                if (setupChunkLength) {
                    while (true) {
                        len = readVarint(state.parser.decoder)
                        if (state.parser.decoder.endOfBuffer) {
                            const read = await state.reader.read()
                            if (read.done) {
                                return setError(state, registryError(r.incomplete_stream))
                            }
                            setParserBuffer(read.value, state.parser)
                        }
                        else {
                            break
                        }
                    }
                    alignDecoder(state.parser.decoder, 8)
                    setupChunkLength = false
                }
                if (len == 0) {
                    controller.enqueue(new Uint8Array())
                }
                else {
                    if (state.parser.decoder.dv.byteLength == state.parser.decoder.dvOffset) {
                        const read = await state.reader.read()
                        if (read.done) {
                            return setError(state, registryError(r.incomplete_stream))
                        }
                        setParserBuffer(read.value, state.parser)
                    }
                    const avail = state.parser.decoder.dv.byteLength - state.parser.decoder.dvOffset
                    if (len <= avail) {
                        controller.enqueue(getBytes(state.parser, len, true))
                        setupChunkLength = true
                        chunkCount--
                        if (!chunkCount) {
                            setupChunkCount = true
                        }
                    }
                    else {
                        controller.enqueue(getBytes(state.parser, avail, true))
                        len -= avail
                    }
                }
            },
            cancel() {
                state.reader.cancel()
            },
        })
    }
    else {
        let setup = true
        let len = 0
        return new ReadableStream<Uint8Array<ArrayBuffer>>({
            async pull(controller) {
                if (setup) {
                    while (true) {
                        len = readVarint(state.parser.decoder)
                        if (state.parser.decoder.endOfBuffer) {
                            const read = await state.reader.read()
                            if (read.done) {
                                return setError(state, registryError(r.incomplete_stream))
                            }
                            setParserBuffer(read.value, state.parser)
                        }
                        else {
                            break
                        }
                    }
                    alignDecoder(state.parser.decoder, 8)
                    setup = false
                }
                if (len == 0) {
                    controller.enqueue(new Uint8Array())
                    controller.close()
                    return
                }
                if (state.parser.decoder.dv.byteLength == state.parser.decoder.dvOffset) {
                    const read = await state.reader.read()
                    if (read.done) {
                        return setError(state, registryError(r.incomplete_stream))
                    }
                    setParserBuffer(read.value, state.parser)
                }
                const avail = state.parser.decoder.dv.byteLength - state.parser.decoder.dvOffset
                if (len <= avail) {
                    controller.enqueue(getBytes(state.parser, len, true))
                    controller.close()
                }
                else {
                    controller.enqueue(getBytes(state.parser, avail, true))
                    len -= avail
                }
            },
            cancel() {
                state.reader.cancel()
            },
        })
    }
}
export const frameTypeStructured = 0
export const frameTypeData = 1
export const isPlaceholderFrameType = (type: number) => (type & 7) == 7
export const getFrameBodyStream = (state: ServeState) => {
    let frame = true
    let setLen = true
    let len = 0
    let frameType = 0
    return new ReadableStream<Uint8Array<ArrayBuffer>>({
        async pull(controller) {
            if (frame) {
                while (true) {
                    frameType = readVarint(state.parser.decoder)
                    if (state.parser.decoder.endOfBuffer) {
                        const read = await state.reader.read()
                        if (read.done) {
                            controller.close()
                            return
                        }
                        setParserBuffer(read.value, state.parser)
                    }
                    else {
                        break
                    }
                }
                if (frameType != frameTypeData && !isPlaceholderFrameType(frameType)) {
                    controller.close()
                    return setError(state, pathError(r.data_value_not_accepted, [state.frameIndex, 'frame type']))
                }
                frame = false
            }
            if (setLen) {
                while (true) {
                    len = readVarint(state.parser.decoder)
                    if (state.parser.decoder.endOfBuffer) {
                        const read = await state.reader.read()
                        if (read.done) {
                            controller.close()
                            return setError(state, registryError(r.incomplete_stream))
                        }
                        setParserBuffer(read.value, state.parser)
                    }
                    else {
                        break
                    }
                }
                alignDecoder(state.parser.decoder, 8)
                setLen = false
            }
            if (len == 0) {
                controller.enqueue(new Uint8Array())
                frame = true
                setLen = true
                state.frameIndex++
            }
            else {
                if (state.parser.decoder.dv.byteLength == state.parser.decoder.dvOffset) {
                    const read = await state.reader.read()
                    if (read.done) {
                        controller.close()
                        return setError(state, registryError(r.incomplete_stream))
                    }
                    setParserBuffer(read.value, state.parser)
                }
                const avail = state.parser.decoder.dv.byteLength - state.parser.decoder.dvOffset
                if (len <= avail) {
                    const bytes = getBytes(state.parser, len, true)
                    controller.enqueue(frameType == frameTypeData ? bytes : new Uint8Array())
                    frame = true
                    setLen = true
                    state.frameIndex++
                }
                else {
                    const bytes = getBytes(state.parser, avail, true)
                    controller.enqueue(frameType == frameTypeData ? bytes : new Uint8Array())
                    len -= avail
                }
            }
        },
        cancel() {
            state.reader.cancel()
        },
    })
}
export const getStructuredFrame = async (state: ServeState): Promise<Uint8Array<ArrayBuffer>> => {
    while (true) {
        let frameType
        let len
        while (true) {
            frameType = readVarint(state.parser.decoder)
            if (state.parser.decoder.endOfBuffer) {
                const read = await state.reader.read()
                if (read.done) {
                    setError(state, registryError(r.incomplete_stream))
                    return
                }
                setParserBuffer(read.value, state.parser)
            }
            else {
                break
            }
        }
        if (frameType != frameTypeStructured && !isPlaceholderFrameType(frameType)) {
            setError(state, pathError(r.data_value_not_accepted, [state.frameIndex, 'frame type']))
            return
        }
        while (true) {
            len = readVarint(state.parser.decoder)
            if (state.parser.decoder.endOfBuffer) {
                const read = await state.reader.read()
                if (read.done) {
                    setError(state, registryError(r.incomplete_stream))
                    return
                }
                setParserBuffer(read.value, state.parser)
            }
            else {
                break
            }
        }
        alignDecoder(state.parser.decoder, 8)
        if (len == 0) {
            if (frameType == frameTypeStructured) {
                return new Uint8Array()
            }
            state.frameIndex++
        }
        else {
            const buffers: Uint8Array<ArrayBuffer>[] = []
            while (true) {
                if (state.parser.decoder.dv.byteLength == state.parser.decoder.dvOffset) {
                    const read = await state.reader.read()
                    if (read.done) {
                        setError(state, registryError(r.incomplete_stream))
                        return
                    }
                    setParserBuffer(read.value, state.parser)
                }
                const avail = state.parser.decoder.dv.byteLength - state.parser.decoder.dvOffset
                if (len <= avail) {
                    const bytes = getBytes(state.parser, len, true)
                    if (frameType == frameTypeStructured) {
                        buffers.push(bytes)
                    }
                    state.frameIndex++
                    break
                }
                else {
                    const bytes = getBytes(state.parser, avail, true)
                    if (frameType == frameTypeStructured) {
                        buffers.push(bytes)
                    }
                    len -= avail
                }
            }
            if (buffers.length) {
                return concatBuffers(buffers)
            }
        }
    }
}