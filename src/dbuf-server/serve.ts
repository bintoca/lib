import { ParseState, setParserBuffer, parseCore, resolveParseOp, initParser, readVarint, alignDecoder, getBytes, readBits32, validateSymbolsLite } from '@bintoca/dbuf-codec/decode'
import { NodeType, Node, ParseMode } from '@bintoca/dbuf-codec/common'
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
    bodyStream?: ReadableStream<Uint8Array<ArrayBuffer>>,
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
export const readPreamble = async (state: ServeState, maxBytes: number): Promise<void> => {
    if (serveCompleted(state)) { return }
    let read = await state.reader.read()
    if (read.done) {
        return setError(state, registryError(r.incomplete_stream))
    }
    state.parser = initParser(read.value, validateSymbolsLite)
    let stage = 0
    let baseType: Node
    let baseMap: Node
    let hasOperation = false
    let hasBytes = false
    let bytesIndex = 0
    let mapOpCount = 0
    while (true) {
        parseCore(state.parser)
        if (state.parser.decoder.totalBitsRead / 8 >= maxBytes) {
            return setError(state, registryError(r.preamble_max_size_exceeded))
        }
        if (state.parser.decoder.endOfBuffer) {
            const read = await state.reader.read()
            if (read.done) {
                return setError(state, registryError(r.incomplete_stream))
            }
            setParserBuffer(read.value, state.parser)
        }
        else if (state.parser.codecError) {
            return setError(state, codecError(state))
        }
        else if (stage == 0) {
            baseType = state.parser.nodeStack[2]
            if (!baseType || baseType.type != NodeType.type_map) {
                return setError(state, pathError(r.data_type_not_accepted, []))
            }
            stage++
        }
        else if (stage == 1) {
            if (baseType.children.length == baseType.needed) {
                const keys = new Set<number>()
                const n = baseType.needed / 2
                for (let i = 0; i < n; i++) {
                    const c = baseType.children[i]
                    if (!hasBytes) {
                        if (resolveParseOp(c).type != ParseMode.none) {
                            mapOpCount++
                        }
                        if (resolveParseOp(baseType.children[n + i]).type != ParseMode.none) {
                            mapOpCount++
                        }
                    }
                    if (c.type == NodeType.val && c.registry !== undefined) {
                        if (keys.has(c.registry)) {
                            return setError(state, pathError(r.data_type_not_accepted, []))
                        }
                        keys.add(c.registry)
                        if (c.registry == r.operation) {
                            hasOperation = true
                        }
                        else if (c.registry == r.bytes) {
                            hasBytes = true
                            bytesIndex = i
                        }
                    }
                    else {
                        return setError(state, pathError(r.data_type_not_accepted, []))
                    }
                }
                if (!hasOperation) {
                    return setError(state, pathError(r.required_field_missing, [getRegistrySymbol(r.operation)]))
                }
                if (mapOpCount) {
                    parseCore(state.parser)
                }
                baseMap = state.parser.nodeStack[2] || map()
                stage++
            }
        }
        else if (stage == 2) {
            if (baseMap.children.length === mapOpCount) {
                const n = baseType.needed / 2
                state.preambleNode = root(type_map(...(hasBytes ? baseType.children.slice(0, bytesIndex).concat(baseType.children.slice(n, n + bytesIndex)) : baseType.children)), baseMap)
                if (hasBytes) {
                    state.bodyType = baseType.children[n + bytesIndex]
                    state.postambleNode = type_map(...baseType.children.slice(bytesIndex + 1, n).concat(baseType.children.slice(n + bytesIndex + 1, n + n)))
                    state.postambleNode.op = { type: ParseMode.map, ops: state.postambleNode.children.map(x => resolveParseOp(x)).filter(x => x.type != ParseMode.none) }
                }
                break
            }
        }
    }
}
export const validateEd25519 = async (publicKey: Uint8Array<ArrayBuffer>, signature: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<boolean> => {
    const k1 = await crypto.subtle.importKey('raw', publicKey, { name: "Ed25519" }, true, ['verify'])
    return await crypto.subtle.verify({ name: "Ed25519" }, k1, signature, data)
}
export const validateCredentialSignature = async (c: RefineObjectType<ArrayBuffer>, basePath?: RefineType[]): Promise<Result<PreparedCredential, RefineObjectType<ArrayBuffer>>> => {
    const signature = c[getRegistrySymbol(r.signature)]
    if (!signature) {
        return { error: pathError(r.required_field_missing, [getRegistrySymbol(r.signature)], basePath) }
    }
    if (!(signature instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [getRegistrySymbol(r.signature)], basePath) }
    }
    const data = c[sym_value]
    if (!data) {
        return { error: pathError(r.required_field_missing, [sym_value], basePath) }
    }
    if (!(data instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [sym_value], basePath) }
    }
    const publicKey = c[getRegistrySymbol(r.public_key)]
    if (!publicKey) {
        return { error: pathError(r.required_field_missing, [getRegistrySymbol(r.public_key)], basePath) }
    }
    if (!(publicKey instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [getRegistrySymbol(r.public_key)], basePath) }
    }
    const algorithm = c[getRegistrySymbol(r.algorithm)]
    if (!algorithm) {
        return { error: pathError(r.required_field_missing, [getRegistrySymbol(r.algorithm)], basePath) }
    }
    if (algorithm == getRegistrySymbol(r.ed25519)) {
        if (! await validateEd25519(publicKey, signature, data)) {
            return { error: pathError(r.data_value_not_accepted, [getRegistrySymbol(r.signature)], basePath) }
        }
    }
    else {
        return { error: pathError(r.data_type_not_accepted, [getRegistrySymbol(r.algorithm)], basePath) }
    }
    const p = parseFull(data, validateSymbolsLite)
    if (p.error) {
        return { error: pathError(r.data_value_not_accepted, [sym_value], basePath) }
    }
    const refinedData = refineValues(unpack(p.root))
    const user = refinedData[getRegistrySymbol(r.user)]
    if (!user) {
        return { error: pathError(r.required_field_missing, [sym_value, getRegistrySymbol(r.user)], basePath) }
    }
    if (!(user instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [sym_value, getRegistrySymbol(r.user)], basePath) }
    }
    const nonce = refinedData[getRegistrySymbol(r.nonce)]
    if (!nonce) {
        return { error: pathError(r.required_field_missing, [sym_value, getRegistrySymbol(r.nonce)], basePath) }
    }
    if (!(nonce instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [sym_value, getRegistrySymbol(r.nonce)], basePath) }
    }
    return { value: { type: 'signature', user, nonce, algorithm, publicKey } }
}
export const validateCredentialToken = (data: Uint8Array<ArrayBuffer>, basePath?: RefineType[]): Result<PreparedCredential, RefineObjectType<ArrayBuffer>> => {
    const p = parseFull(data, validateSymbolsLite)
    if (p.error) {
        return { error: pathError(r.data_value_not_accepted, basePath) }
    }
    const refinedData = refineValues(unpack(p.root))
    const user = refinedData[getRegistrySymbol(r.user)]
    if (!user) {
        return { error: pathError(r.required_field_missing, [getRegistrySymbol(r.user)], basePath) }
    }
    if (!(user instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [getRegistrySymbol(r.user)], basePath) }
    }
    const value = refinedData[sym_value]
    if (!value) {
        return { error: pathError(r.required_field_missing, [sym_value], basePath) }
    }
    if (!(value instanceof Uint8Array)) {
        return { error: pathError(r.data_type_not_accepted, [sym_value], basePath) }
    }
    return { value: { type: 'token', user, value } }
}
export const isSignatureObject = <T extends ArrayBufferLike = ArrayBufferLike>(c: RefineType<T>): c is RefineObjectType<T> => typeof c == 'object' && c[getRegistrySymbol(r.signature)]
export const validateOperation = (state: ServeState) => {
    if (serveCompleted(state)) { return }
    for (let i = 0; i < state.preambleNode.children.length; i++) {
        const c = state.preambleNode.children[i]
        if (c.registry == r.operation) {
            const opType = state.preambleNode.children[i + state.preambleNode.children.length / 2]
            if (opType.registry === undefined) {
                return setError(state, pathError(r.data_type_not_accepted, [sym_operation]))
            }
            state.operation = getRegistrySymbol(opType.registry)
            return
        }
    }
}
export const executeOperation = async (state: ServeState) => {
    if (serveCompleted(state)) { return }
    if (state.config.operationMap.has(state.operation)) {
        const opConfig = state.config.operationMap.get(state.operation)
        await opConfig.func(state, opConfig.deps)
    }
    else {
        return setError(state, pathError(r.data_value_not_accepted, [sym_operation]))
    }
}
export const validateResponse = (state: ServeState) => {
    if (!state.responseBuffer && !state.responseStream) {
        internalError(state, 'no response returned ' + state.operation.toString())
    }
}
export const executeRequest = async (request: ReadableStream<Uint8Array<ArrayBuffer>>, config: ExecutionConfig, env): Promise<ServeState> => {
    const state: ServeState = { config, reader: request.getReader() }
    state.env = env
    try {
        await readPreamble(state, maxPreambleBytes)
        validateOperation(state)
        await executeOperation(state)
    }
    catch (e) {
        internalError(state, e)
    }
    validateResponse(state)
    return state
}
export const validateBody = (state: ServeState) => {
    if (serveCompleted(state) || !state.bodyType) { return }
    if (state.bodyType.registry == r.parse_bytes) {
        state.bodyStream = getBodyStream(state)
    }
    else if (state.bodyType.registry == r.type_array_chunk && state.bodyType.children[0].registry == r.parse_bytes) {
        state.bodyStream = getBodyStream(state, state.bodyType.bitSize)
    }
    else {
        return setError(state, pathError(r.data_type_not_accepted, [getRegistrySymbol(r.bytes)]))
    }
}
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
export const frameTypeData = 1
export const getFrameBodyStream = (state: ServeState) => {
    let frame = true
    let setLen = true
    let frameIndex = 1
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
                const isPlaceholder = frameType == 7
                if (frameType != frameTypeData && !isPlaceholder) {
                    controller.close()
                    return setError(state, pathError(r.data_value_not_accepted, [frameIndex, 'frame type']))
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