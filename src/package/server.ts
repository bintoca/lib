import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import { EncoderState, tags, bufferSourceToDataView, DecoderState, decodeCount, bufferSourceToUint8Array, decodeSkip, tagSymbol, encodeSync, concat as bufConcat, writeItemCore, setupDecoder, decodeSync } from '@bintoca/cbor/core'
import { FileURLSystem, FileURLSystemSync, PackageJSON, READ_PACKAGE_SCOPE_Sync, CJS_MODULE, CJS_RESOLVE, patternRegEx, invalidSegmentRegEx, isArrayIndex, parsePackageName, patternKeyCompare, isConditionalSugar } from '@bintoca/package'
import * as cjsLexer from 'cjs-module-lexer'
const TD = new TextDecoder()
const TE = new TextEncoder()
import primordials from '@bintoca/package/primordial'
const { Set, JSONParse, TextDecoderDecode, URL, Error, StringEndsWith, StringStartsWith, StringReplace, StringSlice, RegExpTest, ArrayIsArray,
    ObjectGetOwnPropertyNames, ObjectHasOwnProperty, StringIndexOf, StringLastIndexOf, ArrayFilter, ArraySort } = primordials

export const metaURL = import.meta.url
export const internalBase = '/x/a/'
export const configURL = '/x/config'
export const globalBase = '/x/g/'
export const reloadBase = '/x/h/'
export const importBase = '/x/i/'
export const packageBase = '/x/p/'
export const packageCJSPath = '/x/pc'
export const undefinedPath = '/x/u'
export const escapeDoubleQuote = (s: string) => s.replace(/"/g, '\\"')
export function getSubstituteIdCore(count: number, length: number, prefix: string) {
    const b64alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_$"
    let id = prefix
    for (let i = 0; i < length; i++) {
        id += b64alpha[(count >> 6 * i) & 63]
    }
    return id
}
export function getSubstituteId(suspects, length: number, prefix: string) {
    let count = 0
    while (count < length * 64) {
        const sub = getSubstituteIdCore(count, length, prefix)
        if (!suspects[sub]) {
            return sub
        }
        count++
    }
}
export const enum ParseFilesError {
    syntax = 1,
    importSubstitute = 2,
    thisSubstitute = 3,
    packageJSON = 4,
    invalidSpecifier = 5,
    evalSubstitute = 6
}
export const enum ImportExportType {
    regular = 1,
    exportName = 2,
    exportDefault = 3
}
export const enum FileType {
    error = 0,
    buffer = 1,
    js = 2,
    json = 3,
    wasm = 4,
    cbor = 5
}
export const thisScopes = ['FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression']
export const isSpecifierInvalid = (file: string, specifier: string): boolean => (specifier.startsWith('.') && !specifier.startsWith('./') && !specifier.startsWith('../')) || !new URL(specifier, 'http://x/x/' + file).href.startsWith('http://x/x/') || !new URL(specifier, 'http://y/y/' + file).href.startsWith('http://y/y/')
export const parseFiles = (files: Update): { [k: string]: FileParse } => {
    const r = {}
    for (let k in files) {
        if (files[k].action != 'remove') {
            r[k] = parseFile(k, files[k].buffer)
        }
    }
    return r
}
export const placeholderString = (size: number) => {
    let s = ''
    for (let i = 0; i < size; i++) {
        s += ' '
    }
    return s
}
export type FileParse = { type: FileType, value }
export const fileError = (p: ParseFilesError, message: string) => { return { type: FileType.error, value: { type: p, message } } }
export const parseFile = (filename: string, b: BufferSource): FileParse => {
    if (filename.endsWith('.js') || filename.endsWith('.cjs') || filename.endsWith('.mjs')) {
        let ast//: acorn.Node
        let text: string
        try {
            text = TD.decode(b)
            ast = acorn.parse(text, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true })
            //console.log(JSON.stringify(ast))
            //console.log(JSON.stringify(acorn.parse('const ev=2', { ecmaVersion: 2022, sourceType: 'module' })))
        }
        catch (e) {
            return fileError(ParseFilesError.syntax, e.message)
        }
        const removeNodes = []
        const importSuspectIds = {}
        const exportDefaultSuspectIds = {}
        function isSuspectId(s: string) {
            if (s.length == 6 && s.startsWith('$')) {
                importSuspectIds[s] = 1
            }
            else if (s.length == 9 && s.startsWith('$')) {
                exportDefaultSuspectIds[s] = 1
            }
        }
        walk.ancestor(ast, {
            ImportExpression(n) {
                removeNodes.push(n)
            },
            ImportDeclaration(n) {
                removeNodes.push(n)
            },
            Identifier(n) {
                isSuspectId(n['name'])
            },
            VariablePattern(n) {
                isSuspectId(n['name'])
            },
            ImportSpecifier(n) {
                isSuspectId(n['local']['name'])
            },
            ImportDefaultSpecifier(n) {
                isSuspectId(n['local']['name'])
            },
            ImportNamespaceSpecifier(n) {
                isSuspectId(n['local']['name'])
            },
            PrivateIdentifier(n) {
                isSuspectId(n['name'])
            },
            PropertyDefinition(n) {
                if (n['key']?.type == 'PrivateIdentifier') {
                    isSuspectId(n['key']['name'])
                }
            },
            ExportNamedDeclaration(n) {
                removeNodes.push(n)
            },
            ExportDefaultDeclaration(n) {
                removeNodes.push(n)
            },
            ExportAllDeclaration(n) {
                removeNodes.push(n)
            },
            MetaProperty(n) {
                removeNodes.push(n)
            }
        })
        let position = 0
        const importExports: Map<number, any>[] = []
        let importSubstitute
        const importSubstituteOffsets = []
        removeNodes.sort((a, b) => a.start - b.start)
        let body = ''
        for (let n of removeNodes) {
            if (position != n.start) {
                body += text.substring(position, n.start)
            }
            position = n.end
            if (n.type == 'ImportDeclaration') {
                body += placeholderString(n.end - n.start)
                const specifier = n.source.value
                if (isSpecifierInvalid(filename, specifier)) {
                    return fileError(ParseFilesError.invalidSpecifier, specifier)
                }
                importExports.push(new Map([[1, ImportExportType.regular], [2, n.start], [3, text.substring(n.start, n.source.start + 1)], [4, specifier]]))
            }
            else if (n.type == 'ImportExpression' || (n.type == 'MetaProperty' && n.meta.name == 'import')) {
                position = n.start + 6
                if (!importSubstitute) {
                    importSubstitute = getSubstituteId(importSuspectIds, 5, '$')
                }
                if (!importSubstitute) {
                    return fileError(ParseFilesError.importSubstitute, filename)
                }
                importSubstituteOffsets.push(n.start)
                body += importSubstitute
            }
            else if (n.type == 'ExportNamedDeclaration') {
                if (n.declaration) {
                    position = n.start + 6
                    body += placeholderString(6)
                    if (n.declaration.type == 'FunctionDeclaration' || n.declaration.type == 'ClassDeclaration') {
                        importExports.push(new Map([[1, ImportExportType.exportName], [2, n.start], [3, n.declaration.id.name]]))
                    }
                    else if (n.declaration.type == 'VariableDeclaration') {
                        for (let x of n.declaration.declarations) {
                            importExports.push(new Map([[1, ImportExportType.exportName], [2, n.start], [3, x.id.name]]))
                        }
                    }
                }
                else {
                    body += placeholderString(n.end - n.start)
                    if (n.source) {
                        const specifier = n.source.value
                        if (isSpecifierInvalid(filename, specifier)) {
                            return fileError(ParseFilesError.invalidSpecifier, specifier)
                        }
                        importExports.push(new Map([[1, ImportExportType.regular], [2, n.start], [3, text.substring(n.start, n.source.start + 1)], [4, specifier]]))
                    }
                    else {
                        importExports.push(new Map<number, any>([[1, ImportExportType.regular], [2, n.start], [3, text.substring(n.start, n.end)]]))
                    }
                }
            }
            else if (n.type == 'ExportDefaultDeclaration') {
                position = n.start + 14
                const sub = getSubstituteId(exportDefaultSuspectIds, 8, '$')
                body += 'var ' + sub + '='
                importExports.push(new Map<number, any>([[1, ImportExportType.exportDefault], [2, n.start], [3, sub]]))
            }
            else if (n.type == 'ExportAllDeclaration') {
                body += placeholderString(n.end - n.start)
                const specifier = n.source.value
                if (isSpecifierInvalid(filename, specifier)) {
                    return fileError(ParseFilesError.invalidSpecifier, specifier)
                }
                importExports.push(new Map([[1, ImportExportType.regular], [2, n.start], [3, text.substring(n.start, n.source.start + 1)], [4, specifier]]))
            }
        }
        body += text.substring(position)
        let glob
        //const g = glo(ast)
        {//fork of acorn-globals with PRs #52 #58 #60 and fix for ExportAllDeclaration es2020
            var globals = [];
            function isScope(node) {
                return node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression' || node.type === 'Program';
            }
            function isBlockScope(node) {
                return node.type === 'BlockStatement' || isScope(node);
            }

            function declaresArguments(node) {
                return node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration';
            }

            function declaresThis(node) {
                return node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration';
            }
            var declareFunction = function (node) {
                var fn = node;
                fn.locals = fn.locals || Object.create(null);
                node.params.forEach(function (node) {
                    declarePattern(node, fn);
                });
                if (node.id) {
                    fn.locals[node.id.name] = true;
                }
            };
            var declareClass = function (node) {
                node.locals = node.locals || Object.create(null);
                if (node.id) {
                    node.locals[node.id.name] = true;
                }
            };
            var declarePattern = function (node, parent) {
                switch (node.type) {
                    case 'Identifier':
                        parent.locals[node.name] = true;
                        break;
                    case 'ObjectPattern':
                        node.properties.forEach(function (node) {
                            declarePattern(node.value || node.argument, parent);
                        });
                        break;
                    case 'ArrayPattern':
                        node.elements.forEach(function (node) {
                            if (node) declarePattern(node, parent);
                        });
                        break;
                    case 'RestElement':
                        declarePattern(node.argument, parent);
                        break;
                    case 'AssignmentPattern':
                        declarePattern(node.left, parent);
                        break;
                    // istanbul ignore next
                    default:
                        throw new Error('Unrecognized pattern type: ' + node.type);
                }
            };
            var declareModuleSpecifier = function (node, parents) {
                ast.locals = ast.locals || Object.create(null);
                ast.locals[node.local.name] = true;
            };
            walk.ancestor(ast, {
                'VariableDeclaration': function (node: any, parents) {
                    var parent = null;
                    for (var i = parents.length - 1; i >= 0 && parent === null; i--) {
                        if (node.kind === 'var' ? isScope(parents[i]) : isBlockScope(parents[i])) {
                            parent = parents[i];
                        }
                    }
                    parent.locals = parent.locals || Object.create(null);
                    node.declarations.forEach(function (declaration) {
                        declarePattern(declaration.id, parent);
                    });
                },
                'FunctionDeclaration': function (node: any, parents) {
                    var parent = null;
                    for (var i = parents.length - 2; i >= 0 && parent === null; i--) {
                        if (isScope(parents[i])) {
                            parent = parents[i];
                        }
                    }
                    parent.locals = parent.locals || Object.create(null);
                    if (node.id) {
                        parent.locals[node.id.name] = true;
                    }
                    declareFunction(node);
                },
                'Function': declareFunction,
                'ClassDeclaration': function (node: any, parents) {
                    var parent = null;
                    for (var i = parents.length - 2; i >= 0 && parent === null; i--) {
                        if (isBlockScope(parents[i])) {
                            parent = parents[i];
                        }
                    }
                    parent.locals = parent.locals || Object.create(null);
                    if (node.id) {
                        parent.locals[node.id.name] = true;
                    }
                    declareClass(node);
                },
                'Class': declareClass,
                'TryStatement': function (node: any) {
                    if (node.handler === null || node.handler.param === null) return;
                    node.handler.locals = node.handler.locals || Object.create(null);
                    declarePattern(node.handler.param, node.handler);
                },
                'ImportDefaultSpecifier': declareModuleSpecifier,
                'ImportSpecifier': declareModuleSpecifier,
                'ImportNamespaceSpecifier': declareModuleSpecifier,
                'ExportAllDeclaration': function (node: any) {//TODO make pull request or formal fork
                    ast.ignore = ast.ignore || new WeakSet();
                    if (node.exported) {
                        ast.ignore.add(node.exported)
                    }
                }
            });
            function identifier(node, parents) {
                var name = node.name;
                if (name === 'undefined') return;
                if (ast.ignore && ast.ignore.has(node)) {
                    return
                }
                for (var i = 0; i < parents.length; i++) {
                    if (name === 'arguments' && declaresArguments(parents[i])) {
                        return;
                    }
                    if (parents[i].locals && name in parents[i].locals) {
                        return;
                    }
                }
                node.parents = parents.slice();
                globals.push(node);
            }
            walk.ancestor(ast, {
                'VariablePattern': identifier,
                'Identifier': identifier,
                'ThisExpression': function (node: any, parents) {
                    for (var i = 0; i < parents.length; i++) {
                        var parent = parents[i];
                        if (parent.type === 'FunctionExpression' || parent.type === 'FunctionDeclaration') { return; }
                        if (parent.type === 'PropertyDefinition' && parents[i + 1] === parent.value) { return; }
                    }
                    node.parents = parents.slice();
                    globals.push(node);
                }
            });
            var groupedGlobals = Object.create(null);
            globals.forEach(function (node) {
                var name = node.type === 'ThisExpression' ? 'this' : node.name;
                groupedGlobals[name] = (groupedGlobals[name] || []);
                groupedGlobals[name].push(node);
            });
            glob = Object.keys(groupedGlobals).sort().map(function (name) {
                return { name: name, nodes: groupedGlobals[name] };
            });
        }
        glob = glob.map(x => x.name)
        const sizeEstimate = importExports.map(x => TE.encode(x.get(3) || '').length + TE.encode(x.get(4) || '').length + 100)
            .concat(glob.map(x => TE.encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0)
            + (importSubstitute ? 50 : 0) + TE.encode(body).length
        const m = new Map<number, any>([[1, sizeEstimate], [2, body], [3, glob], [4, importExports], [5, importSubstitute], [6, importSubstituteOffsets]])
        for (let x of m) {
            if (x[1] === undefined || (Array.isArray(x[1]) && x[1].length == 0)) {
                m.delete(x[0])
            }
        }
        return { type: FileType.js, value: m }
    }
    else if (filename.endsWith('.json')) {
        return { type: FileType.json, value: b }
    }
    else if (filename.endsWith('.wasm')) {
        return { type: FileType.wasm, value: b }
    }
    else if (filename.endsWith('.cbor')) {
        return { type: FileType.cbor, value: b }
    }
    return { type: FileType.buffer, value: b }
}
export const getShrinkwrapURLs = (shrinkwrap: any): { [k: string]: ShrinkwrapPackageDescription } => {
    const u = {}
    for (let k in shrinkwrap.packages) {
        const v = shrinkwrap.packages[k]
        if (k && !v.dev) {
            u[k] = v
        }
    }
    return u
}
export const encodePackage = (p: { [k: string]: FileParse }, state: EncoderState): { [k: string]: Uint8Array } => {
    const q: { [k: string]: Uint8Array } = {}
    for (let k in p) {
        q[k] = encodeFile(p[k], state)
    }
    return q
}
export const createTagPrefix = (t: tags): Uint8Array => {
    const dv = new DataView(new ArrayBuffer(5))
    const count = writeItemCore(6, t, dv, 0)
    return bufferSourceToUint8Array(dv, 0, count)
}
export const jsonTagPrefix = createTagPrefix(tags.json)
export const wasmTagPrefix = createTagPrefix(tags.wasm)
export const cborTagPrefix = new Uint8Array([0xd9, 0xd9, 0xf8, 0x43, 0x42, 0x4f, 0x52])
export const encodeFile = (p: FileParse, state: EncoderState): Uint8Array => {
    switch (p.type) {
        case FileType.error:
            return new Uint8Array()
        case FileType.js: {
            p.value[tagSymbol] = tags.ecmaScript
            return bufConcat(encodeSync(p.value, state))
        }
        case FileType.buffer: {
            const dv = new DataView(new ArrayBuffer(9))
            const count = writeItemCore(2, (p.value as BufferSource).byteLength, dv, 0)
            return bufConcat([bufferSourceToUint8Array(dv, 0, count), p.value])
        }
        case FileType.json: {
            const dv = new DataView(new ArrayBuffer(9))
            const count = writeItemCore(2, (p.value as BufferSource).byteLength, dv, 0)
            return bufConcat([jsonTagPrefix, bufferSourceToUint8Array(dv, 0, count), p.value])
        }
        case FileType.wasm: {
            const dv = new DataView(new ArrayBuffer(9))
            const count = writeItemCore(2, (p.value as BufferSource).byteLength, dv, 0)
            return bufConcat([wasmTagPrefix, bufferSourceToUint8Array(dv, 0, count), p.value])
        }
        case FileType.cbor:
            return bufConcat([cborTagPrefix, p.value])
        default:
            throw new Error('FileType not implemented ' + p.type)
    }
}
export const cjsHiddenVariable = 's3jY8Nt5dO3xokuh194BF'
export const cjsModuleGlobals = ['module', 'exports', 'require', '__dirname', '__filename', cjsHiddenVariable]
export const decodeFileToOriginal = (b: BufferSource) => {
    const state = setupDecoder()
    const dv = bufferSourceToDataView(b)
    const maj = dv.getUint8(0) >> 5
    switch (maj) {
        case 2: {
            const len = decodeCount(dv, state)
            return bufferSourceToUint8Array(dv, state.position, len)
        }
        case 3: {
            const len = decodeCount(dv, state)
            return TD.decode(bufferSourceToUint8Array(dv, state.position, len))
        }
        case 6: {
            const t = decodeCount(dv, state)
            if (t == tags.ecmaScript) {
                const m = decodeSync(bufferSourceToUint8Array(dv, state.position), state) as Map<number, any>
                const body = m.get(2) as string
                const importExports = m.get(4) as Map<number, any>[]
                const importSubOffsets = m.get(6) as number[]
                const chunks: { text: string, offset: number }[] = []
                for (let x of importExports) {
                    switch (x.get(1)) {
                        case ImportExportType.regular: {
                            let text = x.get(3) as string
                            if (x.get(4)) {
                                text += x.get(4) + text.slice(-1)
                            }
                            chunks.push({ offset: x.get(2), text })
                            break
                        }
                        case ImportExportType.exportName: {
                            chunks.push({ offset: x.get(2), text: 'export' })
                            break
                        }
                        case ImportExportType.exportDefault: {
                            chunks.push({ offset: x.get(2), text: 'export default' })
                            break
                        }
                        default:
                            throw new Error('ImportExportType not implemented ' + x.get(1))
                    }
                }
                for (let x of importSubOffsets) {
                    chunks.push({ offset: x, text: 'import' })
                }
                chunks.sort((a, b) => a.offset - b.offset)
                let s = ''
                let offset = 0
                for (let x of chunks) {
                    s += body.slice(offset, x.offset)
                    s += x.text
                    offset = x.offset + x.text.length
                }
                s += body.slice(offset)
                return s
            }
            else if (t == tags.json) {
                const len = decodeCount(dv, state)
                return bufferSourceToUint8Array(dv, state.position, len)
            }
            else if (t == tags.wasm) {
                const len = decodeCount(dv, state)
                return bufferSourceToUint8Array(dv, state.position, len)
            }
            else if (t == tags.selfDescribedCBOR) {
                const len = decodeCount(dv, state)
                return bufferSourceToUint8Array(dv, state.position, len)
            }
            else if (t == tags.selfDescribedCBORSequence) {
                decodeSkip(dv, state)
                return bufferSourceToUint8Array(dv, state.position)
            }
        }
        default:
            throw new Error('Major type not implemented ' + maj)
    }
}
export const decodeFile = async (b: BufferSource, controlledGlobals: DataView, parentURL: URL, fs: FileURLSystem): Promise<{ type: string, data: Uint8Array }> => {
    const state = { position: 0 } as DecoderState
    const dv = bufferSourceToDataView(b)
    const maj = dv.getUint8(0) >> 5
    switch (maj) {
        case 2: {
            const len = decodeCount(dv, state)
            return { type: 'application/octet-stream', data: bufferSourceToUint8Array(dv, state.position, len) }
        }
        case 3: {
            const len = decodeCount(dv, state)
            return { type: 'text/plain', data: bufferSourceToUint8Array(dv, state.position, len) }
        }
        case 6: {
            const t = decodeCount(dv, state)
            if (t == tags.ecmaScript) {
                state.position++
                const parentURLencoded = escapeDoubleQuote(encodeURIComponent(parentURL.href))
                const cjs = await isCommonJS(parentURL, fs)
                if (dv.getUint8(state.position) != 1) {
                    throw new Error('invalid cbor at index ' + state.position)
                }
                state.position++
                let sizeEstimate = decodeCount(dv, state)
                const loopStart = state.position
                let loop = true
                let u: Uint8Array
                let len
                loop1:
                while (loop) {
                    loop = false
                    state.position = loopStart
                    u = new Uint8Array(sizeEstimate + parentURLencoded.length + (cjs ? parentURLencoded.length + 250 : 0))
                    len = 0
                    if (dv.getUint8(state.position) != 2) {
                        throw new Error('invalid cbor at index ' + state.position)
                    }
                    state.position++
                    const bodySize = decodeCount(dv, state)
                    if (cjs) {
                        if (parentURL.pathname.startsWith(packageBase)) {
                            await fs.initCJS()
                            await cjsLexer.init()
                            const lex = cjsLexer.parse(TD.decode(new Uint8Array(dv.buffer, dv.byteOffset + state.position, bodySize)))
                            const exportNames = new Set(lex.exports)
                            fs.cjsParseCache[parentURL.href] = { exportNames }
                            for (const x of lex.reexports) {
                                const r = CJS_RESOLVE(x, parentURL, fs.fsSync)
                                if (r.href.endsWith('.js') || r.href.endsWith('.cjs')) {
                                    if (!fs.cjsParseCache[r.href]) {
                                        await decodeFile(await fs.read(r, false), controlledGlobals, r, fs)
                                    }
                                    if (!fs.cjsParseCache[r.href]) {
                                        throw new Error('cjs parse cache not found: ' + r.href)
                                    }
                                    for (const n of fs.cjsParseCache[r.href].exportNames) {
                                        exportNames.add(n)
                                    }
                                }
                            }
                            const s = 'import "' + packageCJSPath + '";import{cjsExec}from"' + internalBase + escapeDoubleQuote(fs.stateURL) +
                                '";const m=cjsExec("' + escapeDoubleQuote(parentURL.href) + '");export default m.exports;export const {' + Array.from(exportNames).join() + '}=m.exports;'
                            return { type: 'text/javascript', data: TE.encode(s) }
                        }
                        const cjsHeader = TE.encode('import{cjsRegister as ' + cjsHiddenVariable + '}from"' + internalBase + escapeDoubleQuote(fs.stateURL) + '";' + cjsHiddenVariable + '((function (' + cjsModuleGlobals.join() + '){')
                        u.set(cjsHeader, len)
                        len += cjsHeader.byteLength
                        if (dv.getUint8(state.position) == 35 && dv.getUint8(state.position + 1) == 33) {//#!
                            u[len++] = 47
                            u[len++] = 47
                        }
                        if (bodySize > 100) {
                            u.set(new Uint8Array(dv.buffer, dv.byteOffset + state.position, bodySize), len)
                        }
                        else {
                            for (let j = 0; j < bodySize; j++) {
                                u[len + j] = dv.getUint8(state.position + j)
                            }
                        }
                        state.position += bodySize
                        len += bodySize
                        const cjsFooter = TE.encode('}),"' + escapeDoubleQuote(parentURL.href.replace(packageCJSPath + '/', packageBase)) + '");')
                        u.set(cjsFooter, len)
                        len += cjsFooter.byteLength
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 3) {
                            state.position++
                            const globalCount = decodeCount(dv, state)
                            for (let i = 0; i < globalCount; i++) {
                                const size = decodeCount(dv, state)
                                const s = TD.decode(bufferSourceToUint8Array(dv, state.position, size))
                                if (controlledGlobals && !cjsModuleGlobals.includes(s) && lookupExists(controlledGlobals, dv, state.position, size)) {
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
                                    u[len++] = 103
                                    u[len++] = 47
                                    for (let j = 0; j < size; j++) {
                                        u[len + j] = dv.getUint8(state.position + j)
                                    }
                                    len += size
                                    u[len++] = 46
                                    u[len++] = 106
                                    u[len++] = 115
                                    u[len++] = 34
                                }
                                state.position += size
                            }
                        }
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 4) {
                            state.position++
                            decodeSkip(dv, state)
                        }
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 5) {
                            state.position++
                            const importSubSize = decodeCount(dv, state)
                            u[len++] = 10
                            u[len++] = 105
                            u[len++] = 109
                            u[len++] = 112
                            u[len++] = 111
                            u[len++] = 114
                            u[len++] = 116
                            u[len++] = 32
                            for (let j = 0; j < importSubSize; j++) {
                                u[len + j] = dv.getUint8(state.position + j)
                            }
                            len += importSubSize
                            state.position += importSubSize
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
                            u[len++] = 47
                            for (let j = 0; j < parentURLencoded.length; j++) {
                                u[len + j] = parentURLencoded.charCodeAt(j)
                            }
                            len += parentURLencoded.length
                            u[len++] = 34
                        }
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 6) {
                            state.position++
                            decodeSkip(dv, state)
                        }
                        if (len >= u.byteLength) {
                            loop = true
                            sizeEstimate = sizeEstimate * 2
                            continue loop1
                        }
                    }
                    else {
                        if (bodySize > 100) {
                            u.set(new Uint8Array(dv.buffer, dv.byteOffset + state.position, bodySize), len)
                        }
                        else {
                            for (let j = 0; j < bodySize; j++) {
                                u[len + j] = dv.getUint8(state.position + j)
                            }
                        }
                        state.position += bodySize
                        len += bodySize
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 3) {
                            state.position++
                            const globalCount = decodeCount(dv, state)
                            for (let i = 0; i < globalCount; i++) {
                                const size = decodeCount(dv, state)
                                if (controlledGlobals && lookupExists(controlledGlobals, dv, state.position, size)) {
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
                                    u[len++] = 103
                                    u[len++] = 47
                                    for (let j = 0; j < size; j++) {
                                        u[len + j] = dv.getUint8(state.position + j)
                                    }
                                    len += size
                                    u[len++] = 46
                                    u[len++] = 106
                                    u[len++] = 115
                                    u[len++] = 34
                                }
                                state.position += size
                            }
                        }
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 4) {
                            state.position++
                            const exportCount = decodeCount(dv, state)
                            for (let i = 0; i < exportCount; i++) {
                                const mapCount = dv.getUint8(state.position) & 31
                                state.position += 2
                                const type = dv.getUint8(state.position)
                                state.position += 2
                                const originalPosition = decodeCount(dv, state)
                                state.position++
                                const size = decodeCount(dv, state)
                                if (type == ImportExportType.exportName) {
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
                                else if (type == ImportExportType.exportDefault) {
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
                                else if (type == ImportExportType.regular) {
                                    u[len++] = 10
                                    for (let j = 0; j < size; j++) {
                                        u[len + j] = dv.getUint8(state.position + j)
                                    }
                                    len += size
                                    state.position += size
                                    if (mapCount == 4) {
                                        const quote = u[len - 1]
                                        state.position++
                                        const specifierSize = decodeCount(dv, state)
                                        const rCount = await importResolve(u, len, dv, state, specifierSize, parentURL, fs)
                                        if (rCount == -1) {
                                            loop = true
                                            sizeEstimate = sizeEstimate * 2
                                            continue loop1
                                        }
                                        len += rCount
                                        u[len++] = quote
                                        state.position += specifierSize
                                    }
                                }
                            }
                        }
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 5) {
                            state.position++
                            const importSubSize = decodeCount(dv, state)
                            u[len++] = 10
                            u[len++] = 105
                            u[len++] = 109
                            u[len++] = 112
                            u[len++] = 111
                            u[len++] = 114
                            u[len++] = 116
                            u[len++] = 32
                            for (let j = 0; j < importSubSize; j++) {
                                u[len + j] = dv.getUint8(state.position + j)
                            }
                            len += importSubSize
                            state.position += importSubSize
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
                            u[len++] = 47
                            for (let j = 0; j < parentURLencoded.length; j++) {
                                u[len + j] = parentURLencoded.charCodeAt(j)
                            }
                            len += parentURLencoded.length
                            u[len++] = 34
                        }
                        if (dv.byteLength > state.position && dv.getUint8(state.position) == 6) {
                            state.position++
                            decodeSkip(dv, state)
                        }
                    }
                }
                if (state.position != dv.byteLength) {
                    throw new Error('cbor not fully consumed')
                }
                return { type: 'text/javascript', data: new Uint8Array(u.buffer, 0, len) }
            }
            else if (t == tags.json) {
                const len = decodeCount(dv, state)
                if (parentURL.pathname.startsWith(packageCJSPath) && parentURL.pathname.endsWith('.json')) {
                    const s = 'import{cjsRegister}from"' + internalBase + escapeDoubleQuote(fs.stateURL) + '";cjsRegister('
                        + TD.decode(new Uint8Array(dv.buffer, dv.byteOffset + state.position, len)) + ',"' + escapeDoubleQuote(parentURL.href) + '");'
                    return { type: 'text/javascript', data: TE.encode(s) }
                }
                return { type: 'application/json', data: bufferSourceToUint8Array(dv, state.position, len) }
            }
            else if (t == tags.wasm) {
                const len = decodeCount(dv, state)
                return { type: 'application/wasm', data: bufferSourceToUint8Array(dv, state.position, len) }
            }
            else if (t == tags.selfDescribedCBOR) {
                const len = decodeCount(dv, state)
                return { type: 'application/cbor', data: bufferSourceToUint8Array(dv, state.position, len) }
            }
            else if (t == tags.selfDescribedCBORSequence) {
                decodeSkip(dv, state)
                return { type: 'application/cbor', data: bufferSourceToUint8Array(dv, state.position) }
            }
        }
        default:
            throw new Error('Major type not implemented ' + maj)
    }
}
export const isCommonJS = async (u: URL, fs: FileURLSystem) => {
    if (u.href.endsWith('.mjs')) {
        return false
    }
    if (u.href.endsWith('.cjs')) {
        return true
    }
    if (u.href.endsWith('.js')) {
        if (u.pathname.startsWith(internalBase)) {
            return false
        }
        const pjson = await READ_PACKAGE_SCOPE(u, fs)
        if (pjson.type == 'module') {
            return false
        }
        return true
    }
    throw new Error('Unsupported File Extension ' + u.href)
}
export const getManifest = (p: Update): { [k: string]: 1 | { type: string } } => {
    const m = {}
    for (let k in p) {
        m[k] = 1
        if (k.endsWith((k.indexOf('/') == -1 ? '' : '/') + 'package.json')) {
            try {
                const pj = JSON.parse(TD.decode(p[k].buffer))
                m[k] = { type: pj.type || 'none' }
            }
            catch (e) { }
        }
    }
    return m
}
export const getCJSFiles = (manifest: { [k: string]: 1 | { type: string } }): string[] => {
    const a = []
    const fs: FileURLSystemSync = { exists: (p: URL) => manifest[p.pathname.slice(1)] !== undefined, read: (p: URL): CJS_MODULE => { return { exports: manifest[p.pathname.slice(1)] } }, jsonCache: {}, conditions: undefined }
    for (const k in manifest) {
        if (k.endsWith('.cjs') || k.endsWith('.json')) {
            a.push(k)
        }
        else if (k.endsWith('.js')) {
            const pj = READ_PACKAGE_SCOPE_Sync(new URL(k, 'file:///'), fs)
            if (pj.type == 'none' || pj.type == 'commonjs') {
                a.push(k)
            }
        }
    }
    return a
}
export const getDynamicImportModule = (urlpath: string, hot: string): string => {
    const url = escapeDoubleQuote(decodeURIComponent(urlpath.slice(importBase.length)))
    const meta = 'imp.meta.url="' + url + '";' +
        (hot ? hot : '')
    return 'function imp(){};imp.meta=Object.create(null);' + meta + ';export default imp'
}
export const getAllCJSModule = (u: { [k: string]: 1 }) => Object.keys(u).map(x => 'import "' + x.replace(packageBase, packageCJSPath + '/') + '"').join(';')
export const getGlobalModule = (p: string, initURL) => 'import gt from "' + initURL + '";export default gt.' + p.slice(0, -3)
export type Update = { [k: string]: { action: UpdateActions, buffer: BufferSource } }
export type UpdateActions = 'add' | 'change' | 'remove'
const importResolve = async (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number, parentURL: URL, fs: FileURLSystem): Promise<number> => {
    const s = TD.decode(bufferSourceToUint8Array(dv, state.position, size))
    let sp
    if (s[0] == '.') {
        sp = s
    }
    else {
        if (s == 'b1') {
            sp = 'bxx'
        }
        else {
            sp = (await ESM_RESOLVE(s, parentURL, fs)).pathname
        }
    }
    const spb = TE.encode(sp)
    if (u.byteLength - len - spb.byteLength < 100) {
        return -1
    }
    u.set(spb, len)
    return spb.byteLength
}
export const createLookup = (s: Set<string>): DataView => {
    const TE = new TextEncoder()
    const b = Array.from(s).sort().map(x => TE.encode(x))
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
export const lookupExists = (lookup: DataView, dv: DataView, position: number, length: number): boolean => {
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
export const getPackageBreakIndex = (urlpath: string): number => {
    let index = urlpath.lastIndexOf('/node_modules/')
    if (index < 0 || index + 14 >= urlpath.length) {
        return -1
    }
    index += 14
    if (urlpath[index] == '@') {
        const ni = urlpath.indexOf('/', index)
        if (ni >= 0) {
            index = ni + 1
        }
        else {
            return -1
        }
    }
    const ni = urlpath.indexOf('/', index)
    if (ni >= 0) {
        index = ni
    }
    else {
        return -1
    }
    return index
}
export const getCacheKey = (urlpath: string, base: string, shrinkwrap): string => {
    const index = getPackageBreakIndex(urlpath)
    if (index == -1) {
        return undefined
    }
    const pack = getShrinkwrapResolved(urlpath, base, shrinkwrap)
    if (pack) {
        return pack.resolved + '/files' + urlpath.slice(index)
    }
    return undefined
}
export type ShrinkwrapPackageDescription = { resolved: string, integrity: string }
export const getShrinkwrapResolved = (urlpath: string, base: string, shrinkwrap): ShrinkwrapPackageDescription => {
    const index = getPackageBreakIndex(urlpath)
    if (index == -1) {
        return undefined
    }
    const shrinkwrapPath = urlpath.slice(base.length, index)
    return shrinkwrap.packages[shrinkwrapPath]
}

export const defaultConditions = new Set()
defaultConditions.add('node')
defaultConditions.add('import')
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
export const PACKAGE_IMPORTS_EXPORTS_RESOLVE = async (matchKey: string, matchObj: Object, pjsonURL: URL, isImports, fs: FileURLSystem): Promise<{ resolved: URL, exact: boolean }> => {
    if (ObjectHasOwnProperty(matchObj, matchKey) && !StringEndsWith(matchKey, '/') && StringIndexOf(matchKey, '*') === -1) {
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