import { ParseState, setParserBuffer, parseCore, resolveParseOp, initParser } from '@bintoca/dbuf-codec/decode'
import { NodeType, Node, ParseMode } from '@bintoca/dbuf-codec/common'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { r } from '@bintoca/dbuf-server/registry'
import { type_map, root, writeNodeFull, map } from '@bintoca/dbuf-codec/encode'
import { unpack, parseFull } from '@bintoca/dbuf-data/unpack'
import { pack } from '@bintoca/dbuf-data/pack'
import { RefineObjectType, RefineType, refineValues } from '@bintoca/dbuf-data/refine'

export type Result<T, E> = { value?: T, error?: E }

const sym_value = getRegistrySymbol(r.value)
const sym_error_internal = getRegistrySymbol(r.error_internal)
const sym_operation = getRegistrySymbol(r.operation)
const sym_data_path = getRegistrySymbol(r.data_path)
const sym_stream_position = getRegistrySymbol(r.stream_position)
export const registryError = (er: number) => { return { [getRegistrySymbol(r.error)]: getRegistrySymbol(er) } }

export type PreparedCredential = { type: 'token' | 'signature', user?: Uint8Array, nonce?: Uint8Array, value?: Uint8Array, publicKey?: Uint8Array, algorithm?: symbol }
export type ServeState = {
    parser?: ParseState, reader?: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
    refinedPreamble?: RefineObjectType<ArrayBuffer>, bodyType?: Node, responseError?: RefineObjectType<ArrayBuffer>, internalError?, preambleNode?: Node, bodyNode?: Node, refinedBody?: RefineObjectType<ArrayBuffer>, request?: Request,
    env?, preparedCredential?: PreparedCredential, response?: Response, refinedResponse?: RefineObjectType<ArrayBuffer>, opConfig?: OperationConfig, config: ExecutionConfig, serveCompleted?: boolean
}
export const internalError = (state: ServeState, e) => {
    state.responseError = registryError(r.error_internal)
    state.internalError = e
    return state.responseError
}
export const pathError = (er: number, path: RefineType[], basePath?: RefineType[]): RefineObjectType<ArrayBuffer> => Object.assign(registryError(er), { [sym_data_path]: basePath ? basePath.concat(path) : path })
export const serveCompleted = (state: ServeState) => state.responseError !== undefined || state.serveCompleted
export const createServeState = (req: Request, config: ExecutionConfig): ServeState => {
    return { request: req, config, reader: req.body.getReader() }
}
export const codecError = (state: ServeState): RefineObjectType<ArrayBuffer> => Object.assign(registryError(state.parser.codecError), { [sym_stream_position]: state.parser.decoder.totalBitsRead })
export const readPreamble = async (state: ServeState, maxBytes: number): Promise<any> => {
    try {
        let read = await state.reader.read()
        if (read.done) {
            return state.responseError = registryError(r.incomplete_stream)
        }
        state.parser = initParser(read.value, true)
        let stage = 0
        let baseType: Node
        let baseMap: Node
        let hasOperation = false
        let operationIndex = 0
        let mapOpCount = 0
        while (true) {
            parseCore(state.parser)
            if (state.parser.decoder.totalBitsRead / 8 >= maxBytes) {
                return state.responseError = registryError(r.preamble_max_size_exceeded)
            }
            if (state.parser.decoder.endOfBuffer) {
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
                if (baseMap.children.length === mapOpCount) {
                    const n = baseType.needed / 2
                    state.preambleNode = root(type_map(...(hasOperation ? baseType.children.slice(0, operationIndex).concat(baseType.children.slice(n, n + operationIndex)) : baseType.children)), baseMap)
                    state.bodyType = (hasOperation ? type_map(...baseType.children.slice(operationIndex, n).concat(baseType.children.slice(n + operationIndex, n + n))) : type_map())
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
export const validatePreamble = (state: ServeState): any => {
    if (serveCompleted(state)) { return }
    try {
        const rp = refineValues(unpack(state.preambleNode)) as RefineObjectType<ArrayBuffer>
        for (let x of Reflect.ownKeys(rp)) {
            if (!state.config.preambleFields.some(f => f.key == x)) {
                return state.responseError = pathError(r.field_not_accepted, [x])
            }
        }
        for (let x of state.config.preambleFields.filter(x => x.required)) {
            if (rp[x.key] === undefined) {
                return state.responseError = pathError(r.required_field_missing, [x.key])
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
export const httpStatusFromError = (ob: RefineObjectType<ArrayBuffer>): number => {
    const er = ob[getRegistrySymbol(r.error)]
    if (er === sym_error_internal) {
        return 500
    }
    if (er == getRegistrySymbol(r.not_authenticated)) {
        return 401
    }
    return 400
}
export const responseFromError = (state: ServeState, ob?: RefineObjectType<ArrayBuffer>): Response => {
    if (ob) {
        state.responseError = ob
    }
    return new Response(writeNodeFull(pack(state.responseError)), { status: httpStatusFromError(state.responseError), headers: { [contentTypeHeaderName]: contentTypeDBUF } })
}
export const packResponse = (state: ServeState): Response => new Response(writeNodeFull(pack(state.refinedResponse)), { status: 200, headers: { [contentTypeHeaderName]: contentTypeDBUF } })
export type FieldConfig = { key: number, required?: boolean, advancedProfile?: boolean }
export type FieldSymbolConfig = { key: symbol, required?: boolean, advancedProfile?: boolean }
export type OperationConfig = { func: (state: ServeState, deps) => Promise<void>, fields: FieldConfig[], streamBody?: boolean, checkCredentialToken?: boolean, deps?}
export type OperationMap = Map<RefineType, OperationConfig>
export type ExecutionConfig = { preambleFields: FieldSymbolConfig[], operationMap: OperationMap }
export const validateBodyType = (state: ServeState) => {
    if (serveCompleted(state)) { return }
    const n = state.bodyType.children.length / 2
    for (let i = 0; i < n; i++) {
        const c = state.bodyType.children[i]
        if (c.type == NodeType.val) {
            const f = state.opConfig.fields.filter(x => x.key == c.registry)[0]
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
    for (let f of state.opConfig.fields.filter(x => x.required)) {
        if (!state.bodyType.children.slice(0, n).some(x => x.registry == f.key)) {
            return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(f.key)])
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
    const p = parseFull(data, true)
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
    const p = parseFull(data, true)
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
export const validateAuthHeader = async (state: ServeState) => {
    if (serveCompleted(state)) { return }
    const a = state.request.headers.get('Authorization')
    if (typeof a == 'string') {
        const parts = a.split(' ')
        if (parts[0] == 'Bearer' && parts[1]) {
            try {
                const data = Uint8Array.fromBase64(parts[1])
                const p = parseFull(data, true)
                if (p.error) {
                    return
                }
                const c = refineValues(unpack(p.root))
                if (c instanceof Uint8Array) {
                    const result = validateCredentialToken(c)
                    if (result.error) {
                        return
                    }
                    state.preparedCredential = result.value
                }
                else if (isSignatureObject(c)) {
                    const result = await validateCredentialSignature(c)
                    if (result.error) {
                        return
                    }
                    state.preparedCredential = result.value
                }
            }
            catch { }
        }
    }
}
export const small_body_max_bytes = 2 ** 16
export const validateOperation = (state: ServeState) => {
    if (serveCompleted(state)) { return }
    const op = state.refinedPreamble[sym_operation]
    if (state.config.operationMap.has(op)) {
        state.opConfig = state.config.operationMap.get(op)
    }
    else {
        state.responseError = pathError(r.data_value_not_accepted, [sym_operation])
    }
}
export const executeOperation = async (state: ServeState) => {
    if (serveCompleted(state)) { return }
    await state.opConfig.func(state, state.opConfig.deps)
}
export const validateResponse = (state: ServeState) => {
    if (!state.response) {
        if (state.responseError) {
            state.response = responseFromError(state)
        }
        else if (state.refinedResponse) {
            state.response = packResponse(state)
        }
        else {
            internalError(state, 'no response returned ' + state.refinedPreamble[sym_operation].toString())
        }
    }
}
export const createConfig = (): ExecutionConfig => { return { preambleFields: [{ key: sym_operation, required: true }], operationMap: new Map() } }
export const readBody = async (state: ServeState, maxBytes: number) => {
    if (serveCompleted(state) || state.opConfig.streamBody) { return }
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
        if (serveCompleted(state) || state.opConfig.streamBody) { return }
        state.refinedBody = refineValues(unpack(state.bodyNode)) as RefineObjectType<ArrayBuffer>
        return state.refinedBody
    }
    catch (e) {
        internalError(state, e)
    }
}
export const executeRequest = async (request: Request, config: ExecutionConfig, env): Promise<ServeState> => {
    const state: ServeState = createServeState(request, config)
    state.env = env
    try {
        await validateAuthHeader(state)
        await readPreamble(state, maxPreambleBytes)
        validatePreamble(state)
        validateOperation(state)
        validateBodyType(state)
        await readBody(state, small_body_max_bytes)
        refineBody(state)
        await executeOperation(state)
    }
    catch (e) {
        internalError(state, e)
    }
    validateResponse(state)
    return state
}