import { ParseState, createParser, setParserBuffer, parseCore, resolveParseOp } from '@bintoca/dbuf-codec/decode'
import { NodeType, Node, ParseMode } from '@bintoca/dbuf-codec/common'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { r } from './registry'
import { type_map, root, writeNodeFull, map } from '@bintoca/dbuf-codec/encode'
import { unpack, parseFull, createFullParser } from '@bintoca/dbuf-data/unpack'
import { pack } from '@bintoca/dbuf-data/pack'
import { refineValues } from '@bintoca/dbuf-data/refine'

const sym_value = getRegistrySymbol(r.value)
const sym_error_internal = getRegistrySymbol(r.error_internal)
const sym_operation = getRegistrySymbol(r.operation)
const sym_data_path = getRegistrySymbol(r.data_path)
const sym_stream_position = getRegistrySymbol(r.stream_position)
export const registryError = (er: number) => { return { [getRegistrySymbol(r.error)]: getRegistrySymbol(er) } }

export type ServeState = {
    parser: ParseState, inputStream?: ReadableStream<ArrayBufferView>, reader?: ReadableStreamDefaultReader<ArrayBufferView>,
    refinedPreamble?: any, bodyType?: Node, responseError?: object, internalError?, preambleNode?: Node, bodyNode?: Node, refinedBody?: any, request?: Request,
    refinedToken?: any, env?
}
export const internalError = (state: ServeState, e) => {
    state.responseError = registryError(r.error_internal)
    state.internalError = e
    return state.responseError
}
export const pathError = (er: number, path: any[]): object => Object.assign(registryError(er), { [sym_data_path]: path })
export const hasError = (state: ServeState) => state.responseError !== undefined
export const createServeState = (): ServeState => {
    return { parser: createParser(true) }
}
export const codecError = (state: ServeState): object => Object.assign(registryError(state.parser.codecError), { [sym_stream_position]: state.parser.decoder.totalBitsRead })
export const readPreamble = async (state: ServeState, maxBytes: number): Promise<any> => {
    try {
        state.reader = state.inputStream.getReader()
        let read = await state.reader.read()
        if (read.done) {
            return state.responseError = registryError(r.incomplete_stream)
        }
        setParserBuffer(read.value, state.parser)
        let stage = 0
        let baseType: Node
        let baseMap: Node
        let hasOperation = false
        let operationIndex = 0
        let mapOpCount = 0
        while (true) {
            parseCore(state.parser)
            if (state.parser.decoder.endOfBuffer) {
                if (state.parser.decoder.totalBitsRead / 8 >= maxBytes) {
                    return state.responseError = registryError(r.preamble_max_size_exceeded)
                }
                let read = await state.reader.read()
                if (read.done) {
                    return state.responseError = registryError(r.incomplete_stream)
                }
                setParserBuffer(read.value, state.parser)
            }
            else if (state.parser.codecError) {
                return state.responseError = codecError(state)
            }
            else if (stage == 0) {
                baseType = state.parser.nodeStack[2]
                if (!baseType || baseType.type != NodeType.type_map) {
                    return state.responseError = pathError(r.data_type_not_accepted, [])
                }
                stage++
            }
            else if (stage == 1) {
                if (baseType.children.length == baseType.needed) {
                    const n = baseType.needed / 2
                    for (let i = 0; i < n; i++) {
                        const c = baseType.children[i]
                        if (!hasOperation) {
                            if (resolveParseOp(c).type != ParseMode.none) {
                                mapOpCount++
                            }
                            if (resolveParseOp(baseType.children[n + i]).type != ParseMode.none) {
                                mapOpCount++
                            }
                        }
                        if (c.type == NodeType.val && c.registry == r.operation) {
                            hasOperation = true
                            operationIndex = i + 1
                        }
                    }
                    if (mapOpCount) {
                        parseCore(state.parser)
                    }
                    baseMap = state.parser.nodeStack[2] || map()
                    stage++
                }
            }
            else if (stage == 2) {
                if (baseMap.children.length == mapOpCount) {
                    const n = baseType.needed / 2
                    state.preambleNode = root(type_map(...(hasOperation ? baseType.children.slice(0, operationIndex).concat(baseType.children.slice(n, n + operationIndex)) : baseType.children)), baseMap)
                    state.bodyType = hasOperation ? type_map(...baseType.children.slice(operationIndex, n).concat(baseType.children.slice(n + operationIndex, n + n))) : type_map()
                    state.bodyType.op = { type: ParseMode.map, ops: state.bodyType.children.map(x => resolveParseOp(x)).filter(x => x.type != ParseMode.none) }
                    break
                }
            }
        }
    }
    catch (e) {
        internalError(state, e)
    }
}
export const maxPreambleBytes = 2 ** 14
export const initRequest = async <T>(request: Request): Promise<ServeState> => {
    const state: ServeState = createServeState()
    state.request = request
    state.inputStream = request.body
    await readPreamble(state, maxPreambleBytes)
    return state
}
export const validatePreamble = (state: ServeState, preambleFields: FieldSymbolConfig[]): any => {
    if (hasError(state)) { return }
    try {
        const rp = refineValues(unpack(state.preambleNode))
        for (let x of Reflect.ownKeys(rp)) {
            if (!preambleFields.some(f => f.key == x)) {
                return state.responseError = Object.assign(registryError(r.field_not_accepted), { [sym_data_path]: [x] })
            }
        }
        for (let x of preambleFields.filter(x => x.required)) {
            if (rp[x.key] === undefined) {
                return state.responseError = Object.assign(registryError(r.required_field_missing), { [sym_data_path]: [x.key] })
            }
        }
        state.refinedPreamble = rp
    }
    catch (e) {
        internalError(state, e)
    }
}
export const contentTypeDBUF = 'application/dbuf'
export const contentTypeHeaderName = 'Content-Type'
export const httpStatusFromError = (ob: object): number => ob[getRegistrySymbol(r.error)] === sym_error_internal ? 500 : 400
export const responseFromError = (state: ServeState, ob?: object): Response => {
    if (ob) {
        state.responseError = ob
    }
    return new Response(writeNodeFull(pack(state.responseError)), { status: httpStatusFromError(state.responseError), headers: { [contentTypeHeaderName]: contentTypeDBUF } })
}
export const packResponse = (value): Response => new Response(writeNodeFull(pack({ [sym_value]: value })), { status: 200, headers: { [contentTypeHeaderName]: contentTypeDBUF } })
export type FieldConfig = { key: number, required?: boolean, advancedProfile?: boolean }
export type FieldSymbolConfig = { key: symbol, required?: boolean, advancedProfile?: boolean }
export type OperationConfig = { func: (state: ServeState, deps: object, env) => Promise<Response>, fields: FieldConfig[], streamBody?: boolean, checkCredentialToken?: boolean, deps?}
export type OperationMap = Map<(string | number | symbol), OperationConfig>
export type ExecutionConfig = { preambleFields: FieldSymbolConfig[], operationMap: OperationMap, extraTokenValidationFunc?: (state: ServeState) => void }
export type ResponseState = { response: Response, state: ServeState }
export const validateBodyType = (state: ServeState, fields: FieldConfig[]) => {
    const n = state.bodyType.children.length / 2
    for (let i = 0; i < n; i++) {
        const c = state.bodyType.children[i]
        if (c.type == NodeType.val) {
            const f = fields.filter(x => x.key == c.registry)[0]
            if (f) {
                const t = state.bodyType.children[n + i]
                if (t.type == NodeType.val && t.registry == r.parse_type_data && !f.advancedProfile) {
                    return state.responseError = pathError(r.registry_symbol_not_accepted, [getRegistrySymbol(c.registry)])
                }
            }
            else {
                return state.responseError = pathError(r.field_not_accepted, [getRegistrySymbol(c.registry)])
            }
        }
        else {
            return state.responseError = pathError(r.field_not_accepted, ['body_' + i])
        }
    }
    for (let f of fields.filter(x => x.required)) {
        if (!state.bodyType.children.slice(0, n).some(x => x.registry == f.key)) {
            return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(f.key)])
        }
    }
}
export const validateCredentialToken = <T>(state: ServeState, config: ExecutionConfig) => {
    const ct = state.refinedPreamble[getRegistrySymbol(r.credential_token)]
    if (!ct) { return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential_token)]) }
    if (!(ct instanceof Uint8Array)) { return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential_token)]) }
    try {
        const p = createFullParser(true)
        setParserBuffer(ct, p)
        parseFull(p)
        if (p.error) {
            return state.responseError = pathError(r.data_value_not_accepted, [getRegistrySymbol(r.credential_token)])
        }
        state.refinedToken = refineValues(unpack(p.root))
        if (config.extraTokenValidationFunc) {
            config.extraTokenValidationFunc(state)
        }
    }
    catch (e) {
        internalError(state, e)
    }
}
export const small_body_max_bytes = 2 ** 16
export const dispatchOperation = async <T>(state: ServeState, config: ExecutionConfig, env: T) => {
    try {
        if (!hasError(state)) {
            const op = state.refinedPreamble[sym_operation]
            if (config.operationMap.has(op)) {
                const opConfig = config.operationMap.get(op)
                if (opConfig.checkCredentialToken) {
                    validateCredentialToken(state, config)
                }
                if (!hasError(state)) {
                    validateBodyType(state, opConfig.fields)
                }
                if (!hasError(state) && !opConfig.streamBody) {
                    await readBody(state, small_body_max_bytes)
                    refineBody(state)
                }
                if (!hasError(state)) {
                    const resp = await opConfig.func(state, opConfig.deps, env)
                    if (resp) {
                        return resp
                    }
                    if (state.responseError) {
                        return responseFromError(state)
                    }
                    internalError(state, 'no response returned ' + op.toString())
                }
            }
            else {
                state.responseError = pathError(r.data_value_not_accepted, [sym_operation])
            }
        }
    }
    catch (e) {
        internalError(state, e)
    }
    return responseFromError(state)
}
export const executeRequest = async (request: Request, config: ExecutionConfig, env): Promise<ResponseState> => {
    const state = await initRequest(request)
    state.env = env
    validatePreamble(state, config.preambleFields)
    return { response: await dispatchOperation(state, config, env), state }
}
export const createConfig = (): ExecutionConfig => { return { preambleFields: [{ key: sym_operation, required: true }, { key: getRegistrySymbol(r.credential_token) }], operationMap: new Map() } }
export const readBody = async (state: ServeState, maxBytes: number) => {
    try {
        if (state.bodyType.children.length) {
            state.parser.nodeStack.pop()
            state.parser.root.children[0] = state.bodyType
            state.parser.root.op = resolveParseOp(state.bodyType)
            while (true) {
                parseCore(state.parser)
                if (state.parser.decoder.endOfBuffer) {
                    if (state.parser.decoder.totalBitsRead / 8 >= maxBytes) {
                        return state.responseError = registryError(r.body_max_size_exceeded)
                    }
                    let read = await state.reader.read()
                    if (read.done) {
                        return state.responseError = registryError(r.incomplete_stream)
                    }
                    setParserBuffer(read.value, state.parser)
                }
                else if (state.parser.codecError) {
                    return state.responseError = codecError(state)
                }
                else if (state.parser.root.children.length == 2) {
                    state.bodyNode = state.parser.root
                    return
                }
            }
        }
        else {
            state.bodyNode = root(state.bodyType, map())
        }
    }
    catch (e) {
        internalError(state, e)
    }
}
export const refineBody = (state: ServeState) => {
    try {
        if (hasError(state)) { return }
        state.refinedBody = refineValues(unpack(state.bodyNode))
        return state.refinedBody
    }
    catch (e) {
        internalError(state, e)
    }
}