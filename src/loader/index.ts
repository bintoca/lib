import { Encoder, Decoder } from '@bintoca/cbor'
import { defaultTypeMap, EncoderState, binaryItem, tagItem, tags, bufferSourceToDataView, DecoderState, decodeInfo, bufferSourceToUint8Array } from '@bintoca/cbor/core'

export const enum FileType {
    buffer = 1,
    js = 2,
    error = 3,
}
export const enum ChunkType {
    Placeholder = 1,
    Import = 2,
    This = 3
}
export const encode = (p: { files: {} }): Uint8Array => {
    const en = new Encoder({ omitMapTag: true })
    for (let k in p.files) {
        p.files[k] = en.encode(p.files[k])
    }
    const tm = new Map(defaultTypeMap)
    tm.set(Uint8Array, (a: Uint8Array, state: EncoderState) => {
        tagItem(tags.encodedCBORItem, state)
        binaryItem(a, state)
    })
    const enc = new Encoder({ omitMapTag: true, typeMap: tm })
    return enc.encode(new Map([[1, p.files]]))
}
export const decodePackage = (b: BufferSource): Map<number, any> => {
    const dec = new Decoder({ byteStringNoCopy: true })
    return dec.decode(b)
}
export const decodeCount = (dv: DataView, state: DecoderState): number => {
    const c = dv.getUint8(state.position)
    state.position++
    const major = c >> 5
    const ai = c & 31
    return decodeInfo(major, ai, dv, state) as number
}
export const decodeFile = (b: BufferSource, freeGlobals: DataView, controlledGlobals: DataView, importResolve: (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number) => number): Uint8Array => {
    const state = { position: 0 } as DecoderState
    const dv = bufferSourceToDataView(b)
    if (dv.getUint8(0) >> 5 != 5) {
        throw new Error('invalid cbor at index 0')
    }
    if (dv.getUint8(1) != 1) {
        throw new Error('invalid cbor at index 1')
    }
    const type = dv.getUint8(2) & 31
    if (type == FileType.buffer) {
        state.position = 4
        if (dv.getUint8(state.position) == 192 + 24) {
            state.position += 2
        }
        const len = decodeCount(dv, state)
        return new Uint8Array(dv.buffer, dv.byteOffset + state.position, len)
    }
    else if (type == FileType.js) {
        state.position = 3
        if (dv.getUint8(state.position) != 2) {
            throw new Error('invalid cbor at index ' + state.position)
        }
        state.position++
        const sizeEstimate = decodeCount(dv, state)
        const u = new Uint8Array(sizeEstimate)
        let len = 0
        let importSubIndex = 0
        let thisSubIndex = 0
        if (dv.getUint8(state.position) == 6) {
            importSubIndex = state.position + 2
            state.position += 8
        }
        if (dv.getUint8(state.position) == 7) {
            thisSubIndex = state.position + 2
            state.position += 6
        }
        if (dv.getUint8(state.position) != 3) {
            throw new Error('invalid cbor at index ' + state.position)
        }
        state.position++
        const chunkCount = decodeCount(dv, state)
        for (let i = 0; i < chunkCount; i++) {
            const maj = dv.getUint8(state.position) >> 5
            if (maj == 3) {
                const size = decodeCount(dv, state)
                if (size > 100) {
                    u.set(new Uint8Array(dv.buffer, dv.byteOffset + state.position, size), len)
                }
                else {
                    for (let j = 0; j < size; j++) {
                        u[len + j] = dv.getUint8(state.position + j)
                    }
                }
                state.position += size
                len += size
            }
            else {
                state.position += 2
                const chunkType = dv.getUint8(state.position)
                state.position++
                if (chunkType == ChunkType.Placeholder) {
                    state.position++
                    const size = decodeCount(dv, state)
                    for (let j = 0; j < size; j++) {
                        u[len + j] = 32
                    }
                    len += size
                }
                else if (chunkType == ChunkType.Import) {
                    if (!importSubIndex) {
                        throw new Error('import substitute not found')
                    }
                    for (let j = 0; j < 6; j++) {
                        u[len + j] = dv.getUint8(importSubIndex + j)
                    }
                    len += 6
                }
                else if (chunkType == ChunkType.This) {
                    if (!thisSubIndex) {
                        throw new Error('this substitute not found')
                    }
                    for (let j = 0; j < 4; j++) {
                        u[len + j] = dv.getUint8(thisSubIndex + j)
                    }
                    len += 4
                }
                else {
                    throw new Error('ChunkType not implemented ' + chunkType)
                }
            }
        }
        if (dv.byteLength > state.position) {
            if (dv.getUint8(state.position) != 4) {
                throw new Error('invalid cbor at index ' + state.position)
            }
            state.position++
            const globalCount = decodeCount(dv, state)
            for (let i = 0; i < globalCount; i++) {
                const size = decodeCount(dv, state)
                if (!exists(freeGlobals, dv, state.position, size)) {
                    u[len++] = 10
                    u[len++] = 105
                    u[len++] = 109
                    u[len++] = 112
                    u[len++] = 111
                    u[len++] = 114
                    u[len++] = 116
                    u[len++] = 32
                    for (let j = 0; j < size; j++) {
                        u[len + j] = dv.getUint8(state.position + j)
                    }
                    len += size
                    u[len++] = 32
                    u[len++] = 102
                    u[len++] = 114
                    u[len++] = 111
                    u[len++] = 109
                    u[len++] = 34
                    u[len++] = 47
                    u[len++] = 120
                    u[len++] = 47
                    if (exists(controlledGlobals, dv, state.position, size)) {
                        u[len++] = 103
                        u[len++] = 47
                        for (let j = 0; j < size; j++) {
                            u[len + j] = dv.getUint8(state.position + j)
                        }
                        len += size
                    }
                    else {
                        u[len++] = 117
                    }
                    u[len++] = 34
                }
                state.position += size
            }
        }
        if (dv.byteLength > state.position) {
            if (dv.getUint8(state.position) != 5) {
                throw new Error('invalid cbor at index ' + state.position)
            }
            state.position++
            const importCount = decodeCount(dv, state)
            for (let i = 0; i < importCount; i++) {
                state.position += 2
                const size = decodeCount(dv, state)
                u[len++] = 10
                for (let j = 0; j < size; j++) {
                    u[len + j] = dv.getUint8(state.position + j)
                }
                len += size
                state.position += size + 1
                u[len++] = 34
                const specifierSize = decodeCount(dv, state)
                len += importResolve(u, len, dv, state, specifierSize)
                u[len++] = 34
                state.position += specifierSize
            }
        }
        if (importSubIndex) {
            u[len++] = 10
            u[len++] = 105
            u[len++] = 109
            u[len++] = 112
            u[len++] = 111
            u[len++] = 114
            u[len++] = 116
            u[len++] = 32
            for (let j = 0; j < 6; j++) {
                u[len + j] = dv.getUint8(importSubIndex + j)
            }
            len += 6
            u[len++] = 32
            u[len++] = 102
            u[len++] = 114
            u[len++] = 111
            u[len++] = 109
            u[len++] = 34
            u[len++] = 47
            u[len++] = 120
            u[len++] = 47
            u[len++] = 105
            u[len++] = 34
        }
        if (thisSubIndex) {
            u[len++] = 10
            u[len++] = 105
            u[len++] = 109
            u[len++] = 112
            u[len++] = 111
            u[len++] = 114
            u[len++] = 116
            u[len++] = 32
            for (let j = 0; j < 4; j++) {
                u[len + j] = dv.getUint8(thisSubIndex + j)
            }
            len += 4
            u[len++] = 32
            u[len++] = 102
            u[len++] = 114
            u[len++] = 111
            u[len++] = 109
            u[len++] = 34
            u[len++] = 47
            u[len++] = 120
            u[len++] = 47
            u[len++] = 116
            u[len++] = 34
        }
        if (dv.byteLength > state.position) {
            if (dv.getUint8(state.position) != 8) {
                throw new Error('invalid cbor at index ' + state.position)
            }
            state.position++
            const exportCount = decodeCount(dv, state)
            for (let i = 0; i < exportCount; i++) {
                const mapCount = dv.getUint8(state.position) & 31
                state.position++
                const type = dv.getUint8(state.position)
                state.position++
                if (type == 1) {
                    const size = decodeCount(dv, state)
                    u[len++] = 10
                    u[len++] = 101
                    u[len++] = 120
                    u[len++] = 112
                    u[len++] = 111
                    u[len++] = 114
                    u[len++] = 116
                    u[len++] = 123
                    for (let j = 0; j < size; j++) {
                        u[len + j] = dv.getUint8(state.position + j)
                    }
                    len += size
                    state.position += size
                    u[len++] = 125
                }
                else if (type == 4) {
                    const size = decodeCount(dv, state)
                    u[len++] = 10
                    u[len++] = 101
                    u[len++] = 120
                    u[len++] = 112
                    u[len++] = 111
                    u[len++] = 114
                    u[len++] = 116
                    u[len++] = 32
                    u[len++] = 100
                    u[len++] = 101
                    u[len++] = 102
                    u[len++] = 97
                    u[len++] = 117
                    u[len++] = 108
                    u[len++] = 116
                    u[len++] = 32
                    for (let j = 0; j < size; j++) {
                        u[len + j] = dv.getUint8(state.position + j)
                    }
                    len += size
                    state.position += size
                }
                else {
                    const size = decodeCount(dv, state)
                    u[len++] = 10
                    for (let j = 0; j < size; j++) {
                        u[len + j] = dv.getUint8(state.position + j)
                    }
                    len += size
                    state.position += size
                    if (mapCount == 2) {
                        state.position++
                        u[len++] = 34
                        const specifierSize = decodeCount(dv, state)
                        len += importResolve(u, len, dv, state, specifierSize)
                        u[len++] = 34
                        state.position += specifierSize
                    }
                }
            }
        }
        return new Uint8Array(u.buffer, 0, len)
    }
    else if (type == FileType.error) {
        const m = new Decoder().decode(b)
        const s = 'Error type: ' + m.get(2) + ' Message: ' + m.get(3)
        return new TextEncoder().encode(s)
    }
    else {
        throw new Error('FileType not implemented ' + type)
    }
}
export const createLookup = (s: string[]): DataView => {
    const TE = new TextEncoder()
    const b = s.sort().map(x => TE.encode(x))
    const m = new Map()
    for (let x of b) {
        if (!m.get(x[0])) {
            m.set(x[0], [])
        }
        m.get(x[0]).push(x)
    }
    const headeSize = 4 + m.size * 4
    const u = new Uint8Array(headeSize + b.map(x => x.byteLength + 1).reduce((a, b) => a + b, 0))
    let pos = 0, pos2 = headeSize
    const dv = new DataView(u.buffer)
    dv.setUint32(pos, m.size)
    pos += 4
    for (let x of m) {
        dv.setUint8(pos, x[0])
        dv.setUint16(pos + 2, pos2)
        pos += 4
        for (let y of x[1]) {
            u[pos2] = y.byteLength
            pos2++
            for (let i = 0; i < y.byteLength; i++) {
                u[pos2 + i] = y[i]
            }
            pos2 += y.byteLength
        }
    }
    return dv
}
export const exists = (lookup: DataView, dv: DataView, position: number, length: number): boolean => {
    const headerSize = lookup.getUint32(0)
    for (let i = 0; i < headerSize; i++) {
        const key = lookup.getUint8(i * 4 + 4)
        const f1 = dv.getUint8(position)
        if (key == f1) {
            let pos = lookup.getUint16(i * 4 + 6)
            while (true) {
                const len = lookup.getUint8(pos)
                pos++
                const first = lookup.getUint8(pos)
                if (first != f1) {
                    return false
                }
                if (len == length) {
                    let match = true
                    for (let i = 0; i < len; i++) {
                        if (lookup.getUint8(pos + i) != dv.getUint8(position + i)) {
                            match = false
                        }
                    }
                    if (match) {
                        return true
                    }
                }
                pos += len
                if (pos == lookup.byteLength) {
                    return false
                }
            }
        }
    }
    return false
}
export const enum ValidateExportKeyResult {
    relative = 1,
    condition = 2,
    mix = 3
}
export const validateExportKeys = (keys: string[]): ValidateExportKeyResult => {
    const relative = keys.some(x => x.startsWith('.'))
    const condition = keys.some(x => !x.startsWith('.'))
    return relative && condition ? ValidateExportKeyResult.mix : relative ? ValidateExportKeyResult.relative : ValidateExportKeyResult.condition
}
export const isExportPathValid = (s: string) => s.startsWith('./')
export const getExportsEntryPoint = (exports: any, specifier: string, conditions: string[]): string => {
    specifier = specifier || '.'
    let path = ''
    if (typeof exports == 'string') {
        return isExportPathValid(exports) ? exports : ''
    }
    else if (typeof exports == 'object') {
        const keys = Object.keys(exports)
        if (keys.length == 0) {
            return ''
        }
        if (Array.isArray(exports)) {

        }
        else {
            const kind = validateExportKeys(keys)
            if (kind == ValidateExportKeyResult.mix) {
                return ''
            }
            if (kind == ValidateExportKeyResult.relative) {

            }
            else {
                for (let k in exports) {
                    if (conditions.some(x => x == k)) {

                    }
                }
            }
        }
    }
    return ''
}
export const pathJoin = (...v: string[]) => {
    let r = ''
    for (let s of v) {
        r += s
        if (!r.endsWith('/')) {
            r += '/'
        }
    }
    v.join('/')
}
export type FileSystem = { exists: (path: string) => Promise<boolean>, read: (path: string) => Promise<Uint8Array> }
//https://github.com/nodejs/node/blob/master/doc/api/esm.md
export const READ_PACKAGE_JSON = async (packageURL: string, fs: FileSystem) => {
    const pjsonURL = packageURL + (packageURL.endsWith('/') ? '' : '/') + 'package.json'
    if (!await fs.exists(pjsonURL)) {
        return null
    }
    const p = await fs.read(pjsonURL)
    try {
        return JSON.parse(new TextDecoder().decode(p))
    }
    catch (e) {
        throw new Error('Invalid Package Configuration')
    }
}
export const READ_PACKAGE_SCOPE = async (url: string, fs: FileSystem) => {
    let scopeURL = url
    while (scopeURL != 'file:///') {
        scopeURL = scopeURL.substring(0, scopeURL.lastIndexOf('/'))
        if (scopeURL.endsWith('node_modules')) {
            return null
        }
        const pjson = await READ_PACKAGE_JSON(scopeURL, fs)
        if (pjson) {
            return pjson
        }
    }
    return null
}
export const invalidSegmentRegEx = /(^|\\|\/)(\.\.?|node_modules)(\\|\/|$)/;
export const patternRegEx = /\*/g;
export const isArrayIndex = (key) => {
    const keyNum = +key;
    if (`${keyNum}` !== key) return false;
    return keyNum >= 0 && keyNum < 0xFFFF_FFFF;
}
export const PACKAGE_TARGET_RESOLVE = async (packageURL: string, target, subpath: string, pattern: boolean, internal: boolean, conditions, fs: FileSystem) => {
    if (typeof target == 'string') {
        if (!pattern && subpath && !target.endsWith('/')) {
            throw new Error('Invalid Module Specifier')
        }
        if (!target.startsWith('./')) {
            if (internal && !target.startsWith('../') && !target.startsWith('/')) {
                let validURL = false
                try {
                    new URL(target)
                    validURL = true
                } catch { }
                if (validURL) {
                    throw new Error('Invalid Package Target')
                }
                if (pattern) {
                    return PACKAGE_RESOLVE(target.replace(patternRegEx, subpath), packageURL + '/', fs)
                }
                return PACKAGE_RESOLVE(target + subpath, packageURL + '/', fs)
            }
            else {
                throw new Error('Invalid Package Target')
            }
        }
        if (invalidSegmentRegEx.test(target.slice(2))) {
            throw new Error('Invalid Package Target')
        }
        const resolvedTarget = new URL(target, packageURL)
        if (!resolvedTarget.pathname.startsWith(new URL('.', packageURL).pathname)) {
            throw new Error('Invalid Package Target')
        }
        if (subpath === '') {
            return resolvedTarget
        }
        if (invalidSegmentRegEx.test(subpath)) {
            throw new Error('Invalid Module Specifier')
        }
        if (pattern) {
            return new URL(resolvedTarget.href.replace(patternRegEx, subpath))
        }
        return new URL(subpath, resolvedTarget)
    }
    else if (Array.isArray(target)) {
        if (target.length == 0) {
            return null
        }
        let lastException;
        for (let i = 0; i < target.length; i++) {
            const targetValue = target[i];
            let resolved;
            try {
                resolved = PACKAGE_TARGET_RESOLVE(packageURL, targetValue, subpath, pattern, internal, conditions, fs);
            } catch (e) {
                lastException = e;
                if (e.message === 'Invalid Package Target')
                    continue;
                throw e;
            }
            if (resolved === undefined)
                continue;
            if (resolved === null) {
                lastException = null;
                continue;
            }
            return resolved;
        }
        if (lastException === undefined || lastException === null)
            return lastException;
        throw lastException;
    }
    else if (typeof target === 'object' && target !== null) {
        const keys = Object.getOwnPropertyNames(target)
        if (keys.some(x => isArrayIndex(x))) {
            throw new Error('Invalid Package Configuration')
        }
        for (let key of keys) {
            if (key === 'default' || conditions.has(key)) {
                const targetValue = target[key];
                const resolved = PACKAGE_TARGET_RESOLVE(packageURL, targetValue, subpath, pattern, internal, conditions, fs)
                if (resolved === undefined)
                    continue;
                return resolved;
            }
        }
        return undefined
    }
    else if (target === null) {
        return null;
    }
    throw new Error('Invalid Package Target')
}
export const PACKAGE_RESOLVE = async (packageSpecifier, parentURL, fs: FileSystem) => {

}