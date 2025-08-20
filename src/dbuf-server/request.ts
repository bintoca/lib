import { ParseState, setParserBuffer, parseCore, resolveParseOp, initParser } from '@bintoca/dbuf-codec/decode'
import { NodeType, Node, ParseMode } from '@bintoca/dbuf-codec/common'
import { getRegistrySymbol } from '@bintoca/dbuf-data/registry'
import { r } from '@bintoca/dbuf-server/registry'
import { type_map, root, writeNodeFull, map } from '@bintoca/dbuf-codec/encode'
import { unpack, parseFull } from '@bintoca/dbuf-data/unpack'
import { pack } from '@bintoca/dbuf-data/pack'
import { RefineObjectType, RefineType, refineValues } from '@bintoca/dbuf-data/refine'

const sym_value = getRegistrySymbol(r.value)
const sym_error_internal = getRegistrySymbol(r.error_internal)
const sym_operation = getRegistrySymbol(r.operation)
const sym_data_path = getRegistrySymbol(r.data_path)
const sym_stream_position = getRegistrySymbol(r.stream_position)
export const registryError = (er: number) => { return { [getRegistrySymbol(r.error)]: getRegistrySymbol(er) } }

export type ServeState = {
    parser?: ParseState, reader?: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
    refinedPreamble?: RefineObjectType<ArrayBuffer>, bodyType?: Node, responseError?: object, internalError?, preambleNode?: Node, bodyNode?: Node, refinedBody?: RefineObjectType<ArrayBuffer>, request?: Request,
    env?, refinedCredential?: any, response?: Response, opConfig?: OperationConfig, config: ExecutionConfig
}
export const internalError = (state: ServeState, e) => {
    state.responseError = registryError(r.error_internal)
    state.internalError = e
    return state.responseError
}
export const pathError = (er: number, path: RefineType[]): RefineObjectType => Object.assign(registryError(er), { [sym_data_path]: path })
export const hasError = (state: ServeState) => state.responseError !== undefined
export const createServeState = (req: Request, config: ExecutionConfig): ServeState => {
    return { request: req, config }
}
export const codecError = (state: ServeState): RefineObjectType => Object.assign(registryError(state.parser.codecError), { [sym_stream_position]: state.parser.decoder.totalBitsRead })
export const readPreamble = async (state: ServeState, maxBytes: number): Promise<any> => {
    try {
        state.reader = state.request.body.getReader()
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
    if (hasError(state)) { return }
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
export const httpStatusFromError = (ob: object): number => {
    const er = ob[getRegistrySymbol(r.error)]
    if (er === sym_error_internal) {
        return 500
    }
    const path = ob[sym_data_path]
    if (path && path.length == 1 && path[0] == getRegistrySymbol(r.credential)) {
        return 401
    }
    return 400
}
export const responseFromError = (state: ServeState, ob?: object): Response => {
    if (ob) {
        state.responseError = ob
    }
    return new Response(writeNodeFull(pack(state.responseError)), { status: httpStatusFromError(state.responseError), headers: { [contentTypeHeaderName]: contentTypeDBUF } })
}
export const packResponse = (value): Response => new Response(writeNodeFull(pack({ [sym_value]: value })), { status: 200, headers: { [contentTypeHeaderName]: contentTypeDBUF } })
export type FieldConfig = { key: number, required?: boolean, advancedProfile?: boolean }
export type FieldSymbolConfig = { key: symbol, required?: boolean, advancedProfile?: boolean }
export type OperationConfig = { func: (state: ServeState, deps) => Promise<Response>, fields: FieldConfig[], streamBody?: boolean, checkCredentialToken?: boolean, deps?}
export type OperationMap = Map<RefineType, OperationConfig>
export type ExecutionConfig = { preambleFields: FieldSymbolConfig[], operationMap: OperationMap }
export const validateBodyType = (state: ServeState) => {
    if (hasError(state)) { return }
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
export const validateCredentialToken = (state: ServeState, u8: Uint8Array) => {
    try {
        const p = parseFull(u8, true)
        if (p.error) {
            return state.responseError = pathError(r.data_value_not_accepted, [getRegistrySymbol(r.credential)])
        }
        state.refinedCredential = refineValues(unpack(p.root))
        const accountIRI = state.refinedCredential[getRegistrySymbol(r.reference)]
        if (!accountIRI) {
            return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential), getRegistrySymbol(r.reference)])
        }
        if (typeof accountIRI != 'string') {
            return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), getRegistrySymbol(r.reference)])
        }
        const tokenValue = state.refinedCredential[sym_value]
        if (!tokenValue) {
            return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential), sym_value])
        }
        if (!(tokenValue instanceof Uint8Array)) {
            return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), sym_value])
        }
    }
    catch (e) {
        internalError(state, e)
    }
}
export const ttsig = async () => {
    const u = new Uint8Array([1, 2, 3, 4])
    const k = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, k.privateKey, u)
    const pk = await crypto.subtle.exportKey("raw", k.publicKey);
    const k1 = await crypto.subtle.importKey('raw', pk, { name: "Ed25519" }, true, ['verify'])
    expect(await crypto.subtle.verify({ name: "Ed25519" }, k1, sig, u)).toBe(true)
}
export const validateCredentialSignature = async (state: ServeState, c: RefineObjectType<ArrayBuffer>) => {
    const sig = c[getRegistrySymbol(r.signature)]
    if (!(sig instanceof Uint8Array)) {
        return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), getRegistrySymbol(r.signature)])
    }
    const data = c[sym_value]
    if (!data) {
        return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential), sym_value])
    }
    if (!(data instanceof Uint8Array)) {
        return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), sym_value])
    }
    const accountIRI = c[getRegistrySymbol(r.reference)]
    if (!accountIRI) {
        return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential), getRegistrySymbol(r.reference)])
    }
    if (typeof accountIRI != 'string') {
        return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), getRegistrySymbol(r.reference)])
    }
    const publicKey = c[getRegistrySymbol(r.public_key)]
    if (!publicKey) {
        return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential), getRegistrySymbol(r.public_key)])
    }
    if (!(publicKey instanceof Uint8Array)) {
        return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), getRegistrySymbol(r.public_key)])
    }
    const alg = c[getRegistrySymbol(r.algorithm)]
    if (!alg) {
        return state.responseError = pathError(r.required_field_missing, [getRegistrySymbol(r.credential), getRegistrySymbol(r.algorithm)])
    }
    if (alg == getRegistrySymbol(r.ed25519)) {
        const k1 = await crypto.subtle.importKey('raw', publicKey, { name: "Ed25519" }, true, ['verify'])
        if (!await crypto.subtle.verify({ name: "Ed25519" }, k1, sig, data)) {
            return state.responseError = pathError(r.data_value_not_accepted, [getRegistrySymbol(r.credential), getRegistrySymbol(r.signature)])
        }
    }
    else {
        return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential), getRegistrySymbol(r.algorithm)])
    }
}
export const isSignatureObject = <T extends ArrayBufferLike = ArrayBufferLike>(c: RefineType<T>): c is RefineObjectType<T> => typeof c == 'object' && c[getRegistrySymbol(r.signature)]
export const validateCredential = async (state: ServeState) => {
    if (hasError(state)) { return }
    const c = state.refinedPreamble[getRegistrySymbol(r.credential)]
    if (c !== undefined) {
        if (c instanceof Uint8Array) {
            validateCredentialToken(state, c)
        }
        else if (isSignatureObject(c)) {
            await validateCredentialSignature(state, c)
        }
        else {
            return state.responseError = pathError(r.data_type_not_accepted, [getRegistrySymbol(r.credential)])
        }
    }
}
export const small_body_max_bytes = 2 ** 16
export const validateOperation = (state: ServeState) => {
    if (hasError(state)) { return }
    const op = state.refinedPreamble[sym_operation]
    if (state.config.operationMap.has(op)) {
        state.opConfig = state.config.operationMap.get(op)
    }
    else {
        state.responseError = pathError(r.data_value_not_accepted, [sym_operation])
    }
}
export const executeOperation = async (state: ServeState) => {
    if (hasError(state)) { return }
    await state.opConfig.func(state, state.opConfig.deps)
}
export const validateResponse = (state: ServeState) => {
    if (!state.response) {
        if (!state.responseError) {
            internalError(state, 'no response returned ' + state.refinedPreamble[sym_operation].toString())
        }
        state.response = responseFromError(state)
    }
}
export const createConfig = (): ExecutionConfig => { return { preambleFields: [{ key: sym_operation, required: true }, { key: getRegistrySymbol(r.credential) }], operationMap: new Map() } }
export const readBody = async (state: ServeState, maxBytes: number) => {
    if (hasError(state) || state.opConfig.streamBody) { return }
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
        if (hasError(state) || state.opConfig.streamBody) { return }
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
        await readPreamble(state, maxPreambleBytes)
        await validatePreamble(state)
        await validateOperation(state)
        await validateCredential(state)
        await validateBodyType(state)
        await readBody(state, small_body_max_bytes)
        await refineBody(state)
        await executeOperation(state)
    }
    catch (e) {
        internalError(state, e)
    }
    validateResponse(state)
    return state
}