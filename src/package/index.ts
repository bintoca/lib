const gt = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : null
const { Set, JSONParse, TextDecoderDecode, URL, Error, StringEndsWith, StringStartsWith, StringReplace, StringSlice, RegExpTest, ArrayIsArray,
    ObjectGetOwnPropertyNames, ObjectHasOwnProperty, StringIndexOf, StringLastIndexOf, ArrayFilter, ArraySort, ReflectApply } = gt['primordials'] as Primordials

export type FileURLSystem = {
    exists: (path: URL) => Promise<boolean>, read: (path: URL, decoded: boolean) => Promise<Uint8Array>, jsonCache: { [k: string]: PackageJSON }, stateURL: string, conditions: Set<string>,
    fsSync: FileURLSystemSync, cjsParseCache: { [k: string]: { exportNames: Set<string> } }, initCJS: () => Promise<void>
}
export type FileURLSystemSync = { exists: (path: URL) => boolean, read: (path: URL) => CJS_MODULE, jsonCache: { [k: string]: PackageJSON }, conditions: Set<string> }
export type PackageJSON = { pjsonURL: URL, exists: boolean, main: string, name: string, type: string, exports, imports }
export const defaultConditions = new Set()
defaultConditions.add('node')
defaultConditions.add('import')
export const defaultConditionsSync = new Set()
defaultConditionsSync.add('node')
defaultConditionsSync.add('require')
//https://github.com/nodejs/node/blob/master/doc/api/esm.md
export const READ_PACKAGE_JSON = async (pjsonURL: URL, fs: FileURLSystem): Promise<PackageJSON> => {
    if (fs.jsonCache[pjsonURL.href]) {
        return fs.jsonCache[pjsonURL.href]
    }
    if (!await fs.exists(pjsonURL)) {
        const pj = {
            pjsonURL,
            exists: false,
            main: undefined,
            name: undefined,
            type: 'none',
            exports: undefined,
            imports: undefined,
        }
        fs.jsonCache[pjsonURL.href] = pj
        return pj
    }
    const p = await fs.read(pjsonURL, true)
    try {
        const obj = JSONParse(TextDecoderDecode(p))
        if (typeof obj.imports !== 'object' || obj.imports == null) {
            obj.imports = undefined
        }
        if (typeof obj.main !== 'string') {
            obj.main = undefined
        }
        if (typeof obj.name !== 'string') {
            obj.name = undefined
        }
        if (obj.type !== 'module' && obj.type !== 'commonjs') {
            obj.type = 'none'
        }
        const pj = {
            pjsonURL,
            exists: true,
            main: obj.main,
            name: obj.name,
            type: obj.type,
            exports: obj.exports,
            imports: obj.imports,
        }
        fs.jsonCache[pjsonURL.href] = pj
        return pj
    }
    catch (e) {
        throw new Error('Invalid Package Configuration ' + e + pjsonURL)
    }
}
export const READ_PACKAGE_JSON_Sync = (pjsonURL: URL, fs: FileURLSystemSync): PackageJSON => {
    if (fs.jsonCache[pjsonURL.href]) {
        return fs.jsonCache[pjsonURL.href]
    }
    if (!fs.exists(pjsonURL)) {
        const pj = {
            pjsonURL,
            exists: false,
            main: undefined,
            name: undefined,
            type: 'none',
            exports: undefined,
            imports: undefined,
        }
        fs.jsonCache[pjsonURL.href] = pj
        return pj
    }
    const p = fs.read(pjsonURL)
    const obj = p.exports
    if (typeof obj.imports !== 'object' || obj.imports == null) {
        obj.imports = undefined
    }
    if (typeof obj.main !== 'string') {
        obj.main = undefined
    }
    if (typeof obj.name !== 'string') {
        obj.name = undefined
    }
    if (obj.type !== 'module' && obj.type !== 'commonjs') {
        obj.type = 'none'
    }
    const pj = {
        pjsonURL,
        exists: true,
        main: obj.main,
        name: obj.name,
        type: obj.type,
        exports: obj.exports,
        imports: obj.imports,
    }
    fs.jsonCache[pjsonURL.href] = pj
    return pj
}
export const READ_PACKAGE_SCOPE = async (url: URL, fs: FileURLSystem): Promise<PackageJSON> => {
    let scopeURL = new URL('./package.json', url)
    while (true) {
        if (StringEndsWith(scopeURL.pathname, 'node_modules/package.json')) {
            break
        }
        const pjson = await READ_PACKAGE_JSON(scopeURL, fs)
        if (pjson.exists) {
            return pjson
        }
        const last = scopeURL;
        scopeURL = new URL('../package.json', scopeURL)
        if (scopeURL.pathname === last.pathname) {
            break
        }
    }
    return {
        pjsonURL: scopeURL,
        exists: false,
        main: undefined,
        name: undefined,
        type: 'none',
        exports: undefined,
        imports: undefined,
    }
}
export const READ_PACKAGE_SCOPE_Sync = (url: URL, fs: FileURLSystemSync): PackageJSON => {
    let scopeURL = new URL('./package.json', url)
    while (true) {
        if (StringEndsWith(scopeURL.pathname, 'node_modules/package.json')) {
            break
        }
        const pjson = READ_PACKAGE_JSON_Sync(scopeURL, fs)
        if (pjson.exists) {
            return pjson
        }
        const last = scopeURL;
        scopeURL = new URL('../package.json', scopeURL)
        if (scopeURL.pathname === last.pathname) {
            break
        }
    }
    return {
        pjsonURL: scopeURL,
        exists: false,
        main: undefined,
        name: undefined,
        type: 'none',
        exports: undefined,
        imports: undefined,
    }
}
export const invalidSegmentRegEx = /(^|\\|\/)(\.\.?|node_modules)(\\|\/|$)/;
export const patternRegEx = /\*/g;
export const isArrayIndex = (key) => {
    const keyNum = +key;
    if (`${keyNum}` !== key) return false;
    return keyNum >= 0 && keyNum < 0xFFFF_FFFF;
}
export const PACKAGE_TARGET_RESOLVE = async (pjsonURL: URL, target, subpath: string, pattern: boolean, internal: boolean, fs: FileURLSystem): Promise<URL> => {
    if (typeof target == 'string') {
        if (!pattern && subpath && !StringEndsWith(target, '/')) {
            throw new Error('Invalid Module Specifier')
        }
        if (!StringStartsWith(target, './')) {
            if (internal && !StringStartsWith(target, '../') && !StringStartsWith(target, '/')) {
                let validURL = false
                try {
                    new URL(target)
                    validURL = true
                } catch { }
                if (validURL) {
                    throw new Error('Invalid Package Target')
                }
                if (pattern) {
                    return await PACKAGE_RESOLVE(StringReplace(target, patternRegEx, subpath), pjsonURL, fs)
                }
                return await PACKAGE_RESOLVE(target + subpath, pjsonURL, fs)
            }
            else {
                throw new Error('Invalid Package Target')
            }
        }
        if (RegExpTest(invalidSegmentRegEx, StringSlice(target, 2))) {
            throw new Error('Invalid Package Target')
        }
        const resolvedTarget = new URL(target, pjsonURL)
        if (!StringStartsWith(resolvedTarget.pathname, new URL('.', pjsonURL).pathname)) {
            throw new Error('Invalid Package Target')
        }
        if (subpath === '') {
            return resolvedTarget
        }
        if (RegExpTest(invalidSegmentRegEx, subpath)) {
            throw new Error('Invalid Module Specifier')
        }
        if (pattern) {
            return new URL(StringReplace(resolvedTarget.href, patternRegEx, subpath))
        }
        return new URL(subpath, resolvedTarget)
    }
    else if (ArrayIsArray(target)) {
        if (target.length == 0) {
            return null
        }
        let lastException;
        for (let i = 0; i < target.length; i++) {
            const targetValue = target[i];
            let resolved;
            try {
                resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, targetValue, subpath, pattern, internal, fs);
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
        const keys = ObjectGetOwnPropertyNames(target)
        for (let i = 0; i < keys.length; i++) {
            if (isArrayIndex(keys[i])) {
                throw new Error('Invalid Package Configuration')
            }
        }
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key === 'default' || (fs.conditions || defaultConditions).has(key)) {
                const targetValue = target[key];
                const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, targetValue, subpath, pattern, internal, fs)
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
export const PACKAGE_TARGET_RESOLVE_Sync = (pjsonURL: URL, target, subpath: string, pattern: boolean, internal: boolean, fs: FileURLSystemSync): URL => {
    if (typeof target == 'string') {
        if (!pattern && subpath && !StringEndsWith(target, '/')) {
            throw new Error('Invalid Module Specifier')
        }
        if (!StringStartsWith(target, './')) {
            if (internal && !StringStartsWith(target, '../') && !StringStartsWith(target, '/')) {
                let validURL = false
                try {
                    new URL(target)
                    validURL = true
                } catch { }
                if (validURL) {
                    throw new Error('Invalid Package Target')
                }
                if (pattern) {
                    return PACKAGE_RESOLVE_Sync(StringReplace(target, patternRegEx, subpath), pjsonURL, fs)
                }
                return PACKAGE_RESOLVE_Sync(target + subpath, pjsonURL, fs)
            }
            else {
                throw new Error('Invalid Package Target')
            }
        }
        if (RegExpTest(invalidSegmentRegEx, StringSlice(target, 2))) {
            throw new Error('Invalid Package Target')
        }
        const resolvedTarget = new URL(target, pjsonURL)
        if (!StringStartsWith(resolvedTarget.pathname, new URL('.', pjsonURL).pathname)) {
            throw new Error('Invalid Package Target')
        }
        if (subpath === '') {
            return resolvedTarget
        }
        if (RegExpTest(invalidSegmentRegEx, subpath)) {
            throw new Error('Invalid Module Specifier')
        }
        if (pattern) {
            return new URL(StringReplace(resolvedTarget.href, patternRegEx, subpath))
        }
        return new URL(subpath, resolvedTarget)
    }
    else if (ArrayIsArray(target)) {
        if (target.length == 0) {
            return null
        }
        let lastException;
        for (let i = 0; i < target.length; i++) {
            const targetValue = target[i];
            let resolved;
            try {
                resolved = PACKAGE_TARGET_RESOLVE_Sync(pjsonURL, targetValue, subpath, pattern, internal, fs);
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
        const keys = ObjectGetOwnPropertyNames(target)
        for (let i = 0; i < keys.length; i++) {
            if (isArrayIndex(keys[i])) {
                throw new Error('Invalid Package Configuration')
            }
        }
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key === 'default' || (fs.conditions || defaultConditions).has(key)) {
                const targetValue = target[key];
                const resolved = PACKAGE_TARGET_RESOLVE_Sync(pjsonURL, targetValue, subpath, pattern, internal, fs)
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
function patternKeyCompare(a: string, b: string) {
    const aPatternIndex = StringIndexOf(a, '*')
    const bPatternIndex = StringIndexOf(b, '*')
    const baseLenA = aPatternIndex === -1 ? a.length : aPatternIndex + 1;
    const baseLenB = bPatternIndex === -1 ? b.length : bPatternIndex + 1;
    if (baseLenA > baseLenB) return -1;
    if (baseLenB > baseLenA) return 1;
    if (aPatternIndex === -1) return 1;
    if (bPatternIndex === -1) return -1;
    if (a.length > b.length) return -1;
    if (b.length > a.length) return 1;
    return 0;
}
export const PACKAGE_IMPORTS_EXPORTS_RESOLVE = async (matchKey: string, matchObj: Object, pjsonURL: URL, isImports, fs: FileURLSystem): Promise<{ resolved: URL, exact: boolean }> => {
    if (ObjectHasOwnProperty(matchObj, matchKey) && !StringEndsWith(matchKey, '/') && StringIndexOf(matchKey, '*') !== -1) {
        const target = matchObj[matchKey]
        const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, target, '', false, isImports, fs)
        return { resolved, exact: true }
    }
    const expansionKeys = ArraySort(ArrayFilter(ObjectGetOwnPropertyNames(matchObj), x => StringEndsWith(x, '/') || (StringIndexOf(x, '*') !== -1 && StringIndexOf(x, '*') === StringLastIndexOf(x, '*'))), patternKeyCompare)
    for (let i = 0; i < expansionKeys.length; i++) {
        const expansionKey = expansionKeys[i]
        let patternBase: string
        const patternIndex = StringIndexOf(expansionKey, '*')
        if (patternIndex >= 0) {
            patternBase = StringSlice(expansionKey, 0, patternIndex)
        }
        if (patternBase && StringStartsWith(matchKey, patternBase) && matchKey !== patternBase) {
            const patternTrailer = StringSlice(expansionKey, patternIndex + 1)
            if (!patternTrailer || (StringEndsWith(matchKey, patternTrailer) && matchKey.length >= expansionKey.length)) {
                const target = matchObj[expansionKey]
                const subpath = StringSlice(matchKey, patternBase.length, -patternTrailer.length)
                const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, target, subpath, true, isImports, fs)
                return { resolved, exact: true }
            }
        }
        if (!patternBase && StringStartsWith(matchKey, expansionKey)) {
            const target = matchObj[expansionKey]
            const subpath = StringSlice(matchKey, expansionKey.length)
            const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, target, subpath, false, isImports, fs)
            return { resolved, exact: false }
        }
    }
    return { resolved: null, exact: true }
}
export const PACKAGE_IMPORTS_EXPORTS_RESOLVE_Sync = (matchKey: string, matchObj: Object, pjsonURL: URL, isImports, fs: FileURLSystemSync): { resolved: URL, exact: boolean } => {
    if (ObjectHasOwnProperty(matchObj, matchKey) && !StringEndsWith(matchKey, '/') && StringIndexOf(matchKey, '*') !== -1) {
        const target = matchObj[matchKey]
        const resolved = PACKAGE_TARGET_RESOLVE_Sync(pjsonURL, target, '', false, isImports, fs)
        return { resolved, exact: true }
    }
    const expansionKeys = ArraySort(ArrayFilter(ObjectGetOwnPropertyNames(matchObj), x => StringEndsWith(x, '/') || (StringIndexOf(x, '*') !== -1 && StringIndexOf(x, '*') === StringLastIndexOf(x, '*'))), patternKeyCompare)
    for (let i = 0; i < expansionKeys.length; i++) {
        const expansionKey = expansionKeys[i]
        let patternBase: string
        const patternIndex = StringIndexOf(expansionKey, '*')
        if (patternIndex >= 0) {
            patternBase = StringSlice(expansionKey, 0, patternIndex)
        }
        if (patternBase && StringStartsWith(matchKey, patternBase) && matchKey !== patternBase) {
            const patternTrailer = StringSlice(expansionKey, patternIndex + 1)
            if (!patternTrailer || (StringEndsWith(matchKey, patternTrailer) && matchKey.length >= expansionKey.length)) {
                const target = matchObj[expansionKey]
                const subpath = StringSlice(matchKey, patternBase.length, -patternTrailer.length)
                const resolved = PACKAGE_TARGET_RESOLVE_Sync(pjsonURL, target, subpath, true, isImports, fs)
                return { resolved, exact: true }
            }
        }
        if (!patternBase && StringStartsWith(matchKey, expansionKey)) {
            const target = matchObj[expansionKey]
            const subpath = StringSlice(matchKey, expansionKey.length)
            const resolved = PACKAGE_TARGET_RESOLVE_Sync(pjsonURL, target, subpath, false, isImports, fs)
            return { resolved, exact: false }
        }
    }
    return { resolved: null, exact: true }
}
export const PACKAGE_IMPORTS_RESOLVE = async (specifier: string, parentURL: URL, fs: FileURLSystem) => {
    if (!StringStartsWith(specifier, '#')) {
        throw new Error('Assert starts with #')
    }
    if (specifier === '#' || StringStartsWith(specifier, '#/')) {
        throw new Error('Invalid Module Specifier')
    }
    const pjson = await READ_PACKAGE_SCOPE(parentURL, fs)
    if (pjson.exists) {
        if (pjson.imports) {
            const resolvedMatch = await PACKAGE_IMPORTS_EXPORTS_RESOLVE(specifier, pjson.imports, pjson.pjsonURL, true, fs)
            if (resolvedMatch.resolved) {
                return resolvedMatch
            }
        }
    }
    throw new Error('Package Import Not Defined')
}
export const PACKAGE_IMPORTS_RESOLVE_Sync = (specifier: string, parentURL: URL, fs: FileURLSystemSync) => {
    if (!StringStartsWith(specifier, '#')) {
        throw new Error('Assert starts with #')
    }
    if (specifier === '#' || StringStartsWith(specifier, '#/')) {
        throw new Error('Invalid Module Specifier')
    }
    const pjson = READ_PACKAGE_SCOPE_Sync(parentURL, fs)
    if (pjson.exists) {
        if (pjson.imports) {
            const resolvedMatch = PACKAGE_IMPORTS_EXPORTS_RESOLVE_Sync(specifier, pjson.imports, pjson.pjsonURL, true, fs)
            if (resolvedMatch.resolved) {
                return resolvedMatch
            }
        }
    }
    throw new Error('Package Import Not Defined')
}
function isConditionalSugar(exports) {
    if (typeof exports === 'string' || ArrayIsArray(exports)) return true;
    if (typeof exports !== 'object' || exports === null) return false;

    const keys = ObjectGetOwnPropertyNames(exports);
    let isConditionalSugar = false;
    let i = 0;
    for (let j = 0; j < keys.length; j++) {
        const key = keys[j];
        const curIsConditionalSugar = key === '' || key[0] !== '.';
        if (i++ === 0) {
            isConditionalSugar = curIsConditionalSugar;
        } else if (isConditionalSugar !== curIsConditionalSugar) {
            throw new Error('Invalid Package Configuration')
        }
    }
    return isConditionalSugar
}
export const PACKAGE_EXPORTS_RESOLVE = async (pjsonURL: URL, subpath: string, exports, fs: FileURLSystem): Promise<{ resolved: URL, exact: boolean }> => {
    if (isConditionalSugar(exports)) {
        exports = { '.': exports }
    }
    if (subpath === '.' && exports[subpath]) {
        const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, exports[subpath], '', false, false, fs)
        if (resolved) {
            return { resolved, exact: true }
        }
    }
    else {
        const matchKey = subpath
        const resolvedMatch = await PACKAGE_IMPORTS_EXPORTS_RESOLVE(matchKey, exports, pjsonURL, false, fs)
        if (resolvedMatch.resolved) {
            return resolvedMatch
        }
    }
    throw new Error('Package Path Not Exported ' + pjsonURL.href + ' ' + subpath)
}
export const PACKAGE_EXPORTS_RESOLVE_Sync = (pjsonURL: URL, subpath: string, exports, fs: FileURLSystemSync): { resolved: URL, exact: boolean } => {
    if (isConditionalSugar(exports)) {
        exports = { '.': exports }
    }
    if (subpath === '.' && exports[subpath]) {
        const resolved = PACKAGE_TARGET_RESOLVE_Sync(pjsonURL, exports[subpath], '', false, false, fs)
        if (resolved) {
            return { resolved, exact: true }
        }
    }
    else {
        const matchKey = subpath
        const resolvedMatch = PACKAGE_IMPORTS_EXPORTS_RESOLVE_Sync(matchKey, exports, pjsonURL, false, fs)
        if (resolvedMatch.resolved) {
            return resolvedMatch
        }
    }
    throw new Error('Package Path Not Exported ' + pjsonURL.href + ' ' + subpath)
}
export const PACKAGE_SELF_RESOLVE = async (packageName: string, packageSubpath: string, parentURL: URL, fs: FileURLSystem) => {
    const pjson = await READ_PACKAGE_SCOPE(parentURL, fs)
    if (!pjson.exists || !pjson.exports) {
        return undefined
    }
    if (pjson.name === packageName) {
        const { resolved } = await PACKAGE_EXPORTS_RESOLVE(pjson.pjsonURL, packageSubpath, pjson.exports, fs)
        return resolved
    }
    return undefined
}
export const PACKAGE_SELF_RESOLVE_Sync = (packageName: string, packageSubpath: string, parentURL: URL, fs: FileURLSystemSync) => {
    const pjson = READ_PACKAGE_SCOPE_Sync(parentURL, fs)
    if (!pjson.exists || !pjson.exports) {
        return undefined
    }
    if (pjson.name === packageName) {
        const match = PACKAGE_EXPORTS_RESOLVE_Sync(pjson.pjsonURL, packageSubpath, pjson.exports, fs)
        return RESOLVE_ESM_MATCH(match, fs)
    }
    return undefined
}
function parsePackageName(specifier: string) {
    let separatorIndex = StringIndexOf(specifier, '/')
    let validPackageName = true;
    let isScoped = false;
    if (specifier[0] === '@') {
        isScoped = true;
        if (separatorIndex === -1 || specifier.length === 0) {
            validPackageName = false;
        } else {
            separatorIndex = StringIndexOf(specifier, '/', separatorIndex + 1);
        }
    }
    const packageName = separatorIndex === -1 ?
        specifier : StringSlice(specifier, 0, separatorIndex);

    // Package name cannot have leading . and cannot have percent-encoding or
    // separators.
    for (let i = 0; i < packageName.length; i++) {
        if (packageName[i] === '%' || packageName[i] === '\\') {
            validPackageName = false;
            break;
        }
    }
    if (!validPackageName) {
        throw new Error('Invalid Module Specifier')
    }
    const packageSubpath = '.' + (separatorIndex === -1 ? '' : StringSlice(specifier, separatorIndex))
    return { packageName, packageSubpath, isScoped };
}
export const PACKAGE_RESOLVE = async (packageSpecifier: string, parentURL: URL, fs: FileURLSystem): Promise<URL> => {
    const { packageName, packageSubpath, isScoped } = parsePackageName(packageSpecifier)
    const selfURL = await PACKAGE_SELF_RESOLVE(packageName, packageSubpath, parentURL, fs)
    if (selfURL) {
        return selfURL
    }
    let pjsonURL = new URL('./node_modules/' + packageName + '/package.json', parentURL)
    let last
    let result
    do {
        const pjson = await READ_PACKAGE_JSON(pjsonURL, fs)
        if (pjson.exists) {
            if (pjson.exports) {
                const { resolved } = await PACKAGE_EXPORTS_RESOLVE(pjsonURL, packageSubpath, pjson.exports, fs)
                result = resolved
            }
            else if (packageSubpath === '.') {
                result = await LOAD_AS_DIRECTORY(pjson, fs)
            }
            else {
                result = new URL(packageSubpath, pjsonURL)
            }
            break
        }
        last = pjsonURL
        pjsonURL = new URL((isScoped ? '../../../../node_modules/' : '../../../node_modules/') + packageName + '/package.json', pjsonURL);
    }
    while (pjsonURL.pathname !== last.pathname)
    if (result) {
        return result
    }
    throw new Error('Module Not Found ' + packageSpecifier + ' ' + parentURL)
}
export const PACKAGE_RESOLVE_Sync = (packageSpecifier: string, parentURL: URL, fs: FileURLSystemSync): URL => {
    const { packageName, packageSubpath, isScoped } = parsePackageName(packageSpecifier)
    const selfURL = PACKAGE_SELF_RESOLVE_Sync(packageName, packageSubpath, parentURL, fs)
    if (selfURL) {
        return selfURL
    }
    let pjsonURL = new URL('./node_modules/' + packageName + '/package.json', parentURL)
    let last
    let result
    do {
        const pjson = READ_PACKAGE_JSON_Sync(pjsonURL, fs)
        if (pjson.exists) {
            if (pjson.exports) {
                const { resolved } = PACKAGE_EXPORTS_RESOLVE_Sync(pjsonURL, packageSubpath, pjson.exports, fs)
                result = resolved
            }
            else if (packageSubpath === '.') {
                result = LOAD_AS_DIRECTORY_Sync(pjson, fs)
            }
            else {
                result = new URL(packageSubpath, pjsonURL)
            }
            break
        }
        last = pjsonURL
        pjsonURL = new URL((isScoped ? '../../../../node_modules/' : '../../../node_modules/') + packageName + '/package.json', pjsonURL)
    }
    while (pjsonURL.pathname !== last.pathname)
    if (result) {
        return result
    }
    throw new Error('Module Not Found ' + packageSpecifier + ' ' + parentURL)
}
export const LOAD_AS_DIRECTORY = async (pjson: PackageJSON, fs: FileURLSystem): Promise<URL> => {
    if (pjson.exists) {
        if (pjson.main) {
            const m = new URL(`./${pjson.main}`, pjson.pjsonURL)
            const f = await LOAD_AS_FILE(m, fs)
            if (f) {
                return f
            }
            const i = await LOAD_INDEX(m, fs)
            if (i) {
                return i
            }
            const ix = await LOAD_INDEX(pjson.pjsonURL, fs)
            if (ix) {
                return ix
            }
            throw new Error('Module Not Found')
        }
    }
    const ix = await LOAD_INDEX(pjson.pjsonURL, fs)
    if (ix) {
        return ix
    }
}
export const LOAD_AS_DIRECTORY_Sync = (pjson: PackageJSON, fs: FileURLSystemSync): URL => {
    if (pjson.exists) {
        if (pjson.main) {
            const m = new URL(`./${pjson.main}`, pjson.pjsonURL)
            const f = LOAD_AS_FILE_Sync(m, fs)
            if (f) {
                return f
            }
            const i = LOAD_INDEX_Sync(m, fs)
            if (i) {
                return i
            }
            const ix = LOAD_INDEX_Sync(pjson.pjsonURL, fs)
            if (ix) {
                return ix
            }
            throw new Error('Module Not Found')
        }
    }
    const ix = LOAD_INDEX_Sync(pjson.pjsonURL, fs)
    if (ix) {
        return ix
    }
}
export const LOAD_AS_FILE = async (url: URL, fs: FileURLSystem): Promise<URL> => {
    if (await fs.exists(url)) {
        return url
    }
    let u = new URL(url.href + '.js')
    if (await fs.exists(u)) {
        return u
    }
    u = new URL(url.href + '.json')
    if (await fs.exists(u)) {
        return u
    }
    u = new URL(url.href + '.node')
    if (await fs.exists(u)) {
        return u
    }
}
export const LOAD_AS_FILE_Sync = (url: URL, fs: FileURLSystemSync): URL => {
    if (fs.exists(url)) {
        return url
    }
    let u = new URL(url.href + '.js')
    if (fs.exists(u)) {
        return u
    }
    u = new URL(url.href + '.json')
    if (fs.exists(u)) {
        return u
    }
    u = new URL(url.href + '.node')
    if (fs.exists(u)) {
        return u
    }
}
export const LOAD_INDEX = async (url: URL, fs: FileURLSystem): Promise<URL> => {
    let u = new URL('./index.js', url)
    if (await fs.exists(u)) {
        return u
    }
    u = new URL('./index.json', url)
    if (await fs.exists(u)) {
        return u
    }
    u = new URL('./index.node', url)
    if (await fs.exists(u)) {
        return u
    }
}
export const LOAD_INDEX_Sync = (url: URL, fs: FileURLSystemSync): URL => {
    let u = new URL('./index.js', url)
    if (fs.exists(u)) {
        return u
    }
    u = new URL('./index.json', url)
    if (fs.exists(u)) {
        return u
    }
    u = new URL('./index.node', url)
    if (fs.exists(u)) {
        return u
    }
}
function isRelativeSpecifier(specifier) {
    if (specifier[0] === '.') {
        if (specifier.length === 1 || specifier[1] === '/') return true;
        if (specifier[1] === '.') {
            if (specifier.length === 2 || specifier[2] === '/') return true;
        }
    }
    return false;
}
function shouldBeTreatedAsRelativeOrAbsolutePath(specifier) {
    if (specifier === '') return false;
    if (specifier[0] === '/') return true;
    return isRelativeSpecifier(specifier);
}
export const encodedSepRegEx = /%2F|%2C/i; //TODO should be %5C in node repo also
export const ESM_RESOLVE = async (specifier: string, parentURL: URL, fs: FileURLSystem): Promise<URL> => {
    let resolved;
    if (shouldBeTreatedAsRelativeOrAbsolutePath(specifier)) {
        resolved = new URL(specifier, parentURL);
    } else if (specifier[0] === '#') {
        ({ resolved } = await PACKAGE_IMPORTS_RESOLVE(specifier, parentURL, fs));
    } else {
        try {
            resolved = new URL(specifier);
        } catch {
            resolved = await PACKAGE_RESOLVE(specifier, parentURL, fs)
        }
    }
    if (RegExpTest(encodedSepRegEx, resolved.pathname)) {
        throw new Error('Invalid Module Specifier')
    }
    // if (!await fs.exists(resolved)) {
    //     throw new Error('Module Not Found')
    // }
    return resolved
}
export const cjsRegister = (f, k: string, state: State) => {
    const { cjsFunctions, cjsModules } = state
    if (typeof f == 'function') {
        cjsFunctions[k] = f
    }
    else {
        const module: CJS_MODULE = { exports: f }
        cjsModules[k] = module
        return module
    }
}
export type CJS_MODULE = { exports }
export type State = { cjsFunctions: { [k: string]: Function }, cjsModules: { [k: string]: CJS_MODULE }, fs: FileURLSystemSync }
export const cjsExec = (k: string, state: State) => {
    const { cjsFunctions, cjsModules, fs } = state
    if (!ObjectHasOwnProperty(cjsModules, k)) {
        if (cjsFunctions[k]) {
            const require = (specifier: string) => {
                const mURL = CJS_RESOLVE(specifier, new URL(k), fs)
                const m = cjsExec(mURL.href, state)
                return m.exports
            }
            const rp = new Proxy(require, {
                get(target, property, receiver) {
                    if (property in target) {
                        return target[property]
                    }
                    console.log('require unknown property get ' + property.toString(), k)
                },
                set(target, property, value, receiver) {
                    console.log('require unknown property set ' + property.toString(), k)
                    return false
                }
            })
            const module: CJS_MODULE = { exports: {} }
            cjsModules[k] = module
            ReflectApply(cjsFunctions[k], module.exports, [module, module.exports, rp, new URL('./', k).href, k])
        }
        else {
            throw new Error('cjs function not found ' + k)
        }
    }
    return cjsModules[k]
}
export const RESOLVE_ESM_MATCH = (match: { resolved: URL, exact: boolean }, fs: FileURLSystemSync) => {
    if (match.exact) {
        return match.resolved
    }
    const f = LOAD_AS_FILE_Sync(match.resolved, fs)
    if (f) {
        return f
    }
    const d = LOAD_AS_DIRECTORY_Sync(READ_PACKAGE_JSON_Sync(new URL('./package.json', match.resolved), fs), fs)
    if (d) {
        return d
    }
    throw new Error('Module Not Found')
}
export const LOAD_PACKAGE_EXPORTS = (packageSpecifier: string, parentURL: URL, fs: FileURLSystemSync) => {
    const { packageSubpath } = parsePackageName(packageSpecifier)
    const pjson = READ_PACKAGE_JSON_Sync(new URL('./package.json', parentURL), fs)
    if (pjson.exists && pjson.exports) {
        const match = PACKAGE_EXPORTS_RESOLVE_Sync(pjson.pjsonURL, packageSubpath, pjson.exports, fs)
        return RESOLVE_ESM_MATCH(match, fs)
    }
}
export const LOAD_PACKAGE_IMPORTS = (packageSpecifier: string, parentURL: URL, fs: FileURLSystemSync) => {
    const pjson = READ_PACKAGE_JSON_Sync(new URL('./package.json', parentURL), fs)
    if (pjson.exists && pjson.imports) {
        const match = PACKAGE_IMPORTS_RESOLVE_Sync(packageSpecifier, pjson.pjsonURL, fs)
        return RESOLVE_ESM_MATCH(match, fs)
    }
}
export const LOAD_NODE_MODULES = (packageSpecifier: string, dirURL: URL, fs: FileURLSystemSync): URL => {
    const { packageName, packageSubpath, isScoped } = parsePackageName(packageSpecifier)
    dirURL = new URL('./node_modules/' + packageName + '/package.json', dirURL)
    let last
    do {
        const r = LOAD_PACKAGE_EXPORTS(packageSpecifier, dirURL, fs)
        if (r) {
            return r
        }
        const rf = LOAD_AS_FILE_Sync(new URL(packageSubpath, dirURL), fs)
        if (rf) {
            return rf
        }
        const rd = LOAD_AS_DIRECTORY_Sync(READ_PACKAGE_JSON_Sync(new URL('./package.json', dirURL), fs), fs)
        if (rd) {
            return rd
        }
        last = dirURL
        dirURL = new URL((isScoped ? '../../../../node_modules/' : '../../../node_modules/') + packageName + '/package.json', dirURL)
    }
    while (dirURL.pathname !== last.pathname)
}
export const CJS_RESOLVE = (packageSpecifier: string, parentURL: URL, fs: FileURLSystemSync): URL => {
    //TODO core modules
    if (StringStartsWith(packageSpecifier, '/')) {
        throw new Error('specifier must not start with "/" ' + packageSpecifier)
    }
    if (StringStartsWith(packageSpecifier, './') || StringStartsWith(packageSpecifier, '../')) {
        const rf = LOAD_AS_FILE_Sync(new URL(packageSpecifier, parentURL), fs)
        if (rf) {
            return rf
        }
        const rd = LOAD_AS_DIRECTORY_Sync(READ_PACKAGE_JSON_Sync(new URL('./package.json', new URL(packageSpecifier, parentURL)), fs), fs)
        if (rd) {
            return rd
        }
        throw new Error('Module Not Found "' + packageSpecifier + '" in "' + parentURL + '"')
    }
    if (StringStartsWith(packageSpecifier, '#')) {
        const rf = LOAD_PACKAGE_IMPORTS(packageSpecifier, parentURL, fs)
        if (rf) {
            return rf
        }
    }
    const { packageName, packageSubpath, isScoped } = parsePackageName(packageSpecifier)
    const rs = PACKAGE_SELF_RESOLVE_Sync(packageName, packageSubpath, parentURL, fs)
    if (rs) {
        return rs
    }
    const rm = LOAD_NODE_MODULES(packageSpecifier, parentURL, fs)
    if (rm) {
        return rm
    }
    throw new Error('Module Not Found "' + packageSpecifier + '" in "' + parentURL + '"')
}