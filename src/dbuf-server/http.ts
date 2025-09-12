import { ServeState, ExecutionConfig, executeOperation, internalError, validateResponse, serveCompleted, validateCredentialSignature, validateCredentialToken, isSignatureObject, setError, pathError, validateOperation } from '@bintoca/dbuf-server/serve'
import { unpack, parseFull } from '@bintoca/dbuf-data/unpack'
import { RefineObjectType, RefineType, refineValues } from '@bintoca/dbuf-data/refine'
import { r } from '@bintoca/dbuf-server/registry'

export type HttpServeState = ServeState & { request?: Request, response?: Response }
export const contentTypeDBUF = 'application/dbuf'
export const contentTypeDBUF_Envelope = 'application/dbuf-envelope'
export const contentTypeDBUF_Body = 'application/dbuf-body'
export const contentTypeHeaderName = 'Content-Type'
export const httpStatus = (state: ServeState): number => {
    if (state.errorType) {
        switch (state.errorType) {
            case 'internal':
                return 500
            case 'not_authenticated':
                return 401
            case 'other':
                return 400
            default:
                throw 'not implemented'
        }
    }
    return 200
}
export const readHeaders = (state: HttpServeState) => {
    if (serveCompleted(state)) { return }
    for (const h of state.request.headers.keys()) {
        const p = h.split('dbuf-')
        if (p[1]) {
            let id: number
            try {
                id = parseInt(p[1])
            }
            catch { }
            if (id !== undefined) {

            }
        }
    }
}
export const validateAuthHeader = async (state: HttpServeState) => {
    if (serveCompleted(state)) { return }
    const a = state.request.headers.get('Authorization')
    if (a) {
        const parts = a.split(' ')
        if (parts[0] == 'Bearer' && parts[1]) {
            try {
                const p = parseFull(Uint8Array.fromBase64(parts[1]), true)
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
export const operationFromHeader = async (state: HttpServeState) => {
    if (serveCompleted(state)) { return }
    const a = state.request.headers.get('dbuf-operation')
    if (a) {
        try {
            const p = parseFull(Uint8Array.fromBase64(a), true)
            if (p.error) {
                return
            }
            state.operation = refineValues(unpack(p.root))
        }
        catch { }
    }
}
export const executeRequest = async (request: Request, config: ExecutionConfig, env): Promise<ServeState> => {
    const state: HttpServeState = { config, request, reader: request.body.getReader(), env }
    try {
        const ct = state.request.headers.get(contentTypeHeaderName)
        if (ct == contentTypeDBUF_Body) {
            readHeaders(state)
        }
        else if (ct == contentTypeDBUF_Envelope) {
            //await readPreamble(state, maxPreambleBytes)
        }
        else {
            setError(state, pathError(r.data_value_not_accepted, [contentTypeHeaderName]))
        }
        validateOperation(state)
        await executeOperation(state)
    }
    catch (e) {
        internalError(state, e)
    }
    validateResponse(state)
    return state
}
//export const createResponse = (state: ServeState): Response => new Response(state.responseBuffer, { status: httpStatus(state), headers: { [contentTypeHeaderName]: contentTypeDBUF } })