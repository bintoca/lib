import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import { Encoder, Decoder } from '@bintoca/cbor'
import { defaultTypeMap, EncoderState, binaryItem, tagItem, tags, bufferSourceToDataView, DecoderState, decodeCount, bufferSourceToUint8Array, decodeSkip } from '@bintoca/cbor/core'
import { FileURLSystem, FileURLSystemSync, ESM_RESOLVE, READ_PACKAGE_SCOPE_Sync, CJS_MODULE, READ_PACKAGE_SCOPE, CJS_RESOLVE } from '@bintoca/package'
import * as cjsLexer from 'cjs-module-lexer'
const TD = new TextDecoder()
const TE = new TextEncoder()

export const metaURL = import.meta.url
export const internalBase = '/x/a/'
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
export const thisScopes = ['FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression']
export const isSpecifierInvalid = (file: string, specifier: string): boolean => (specifier.startsWith('.') && !specifier.startsWith('./') && !specifier.startsWith('../')) || !new URL(specifier, 'http://x/x/' + file).href.startsWith('http://x/x/') || !new URL(specifier, 'http://y/y/' + file).href.startsWith('http://y/y/')
export const parseFiles = (files: Update): { files: { [k: string]: Map<number, any> } } => {
    const r = { files: {} }
    for (let k in files) {
        if (files[k].action != 'remove') {
            r.files[k] = parseFile(k, files[k].buffer)
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
export const parseFile = (k: string, b: BufferSource): Map<number, any> => {
    if (k.endsWith('.js') || k.endsWith('.cjs') || k.endsWith('.mjs')) {
        let ast//: acorn.Node
        let text: string
        try {
            text = TD.decode(b)
            ast = acorn.parse(text, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true })
            //console.log(JSON.stringify(ast))
            //console.log(JSON.stringify(acorn.parse('const ev=2', { ecmaVersion: 2022, sourceType: 'module' })))
        }
        catch (e) {
            return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.syntax], [3, e.message]])
        }
        const removeNodes = []
        const importSuspectIds = {}
        const evalSuspectIds = {}
        const exportDefaultSuspectIds = {}
        function isSuspectId(s: string) {
            if (s.length == 6 && s.startsWith('$')) {
                importSuspectIds[s] = 1
            }
            else if (s.length == 4 && s.startsWith('$')) {
                evalSuspectIds[s] = 1
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
                if (n['name'] == 'eval') {
                    removeNodes.push(n)
                }
                isSuspectId(n['name'])
            },
            VariablePattern(n) {
                if (n['name'] == 'eval') {
                    removeNodes.push(n)
                }
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
        const imports: Map<number, any>[] = []
        const exports: Map<number, any>[] = []
        let importSubstitute
        let evalSubstitute
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
                if (isSpecifierInvalid(k, specifier)) {
                    return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, specifier]])
                }
                imports.push(new Map([[1, text.substring(n.start, n.source.start)], [2, specifier]]))
            }
            else if (n.type == 'ImportExpression' || (n.type == 'MetaProperty' && n.meta.name == 'import')) {
                position = n.start + 6
                if (!importSubstitute) {
                    importSubstitute = getSubstituteId(importSuspectIds, 5, '$')
                }
                if (!importSubstitute) {
                    return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.importSubstitute], [3, k]])
                }
                body += importSubstitute
            }
            else if (n.type == 'Identifier' || n.type == 'VariablePattern') {
                if (n.name == 'eval') {
                    if (!evalSubstitute) {
                        evalSubstitute = getSubstituteId(evalSuspectIds, 3, '$')
                        isSuspectId(evalSubstitute)
                    }
                    if (!evalSubstitute) {
                        return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.evalSubstitute], [3, k]])
                    }
                    body += evalSubstitute
                }
            }
            else if (n.type == 'ExportNamedDeclaration') {
                if (n.declaration) {
                    position = n.start + 6
                    body += placeholderString(6)
                    if (n.declaration.type == 'FunctionDeclaration' || n.declaration.type == 'ClassDeclaration') {
                        exports.push(new Map([[1, n.declaration.id.name]]))
                    }
                    else if (n.declaration.type == 'VariableDeclaration') {
                        for (let x of n.declaration.declarations) {
                            exports.push(new Map([[1, x.id.name]]))
                        }
                    }
                }
                else {
                    body += placeholderString(n.end - n.start)
                    if (n.source) {
                        const specifier = n.source.value
                        if (isSpecifierInvalid(k, specifier)) {
                            return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, specifier]])
                        }
                        exports.push(new Map([[2, text.substring(n.start, n.source.start)], [3, specifier]]))
                    }
                    else {
                        exports.push(new Map([[2, text.substring(n.start, n.end)]]))
                    }
                }
            }
            else if (n.type == 'ExportDefaultDeclaration') {
                position = n.start + 14
                const sub = getSubstituteId(exportDefaultSuspectIds, 8, '$')
                body += 'var ' + sub + '='
                exports.push(new Map([[4, sub]]))
            }
            else if (n.type == 'ExportAllDeclaration') {
                body += placeholderString(n.end - n.start)
                const specifier = n.source.value
                if (isSpecifierInvalid(k, specifier)) {
                    return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, specifier]])
                }
                exports.push(new Map([[2, text.substring(n.start, n.source.start)], [3, specifier]]))
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
        glob = glob.filter(x => x.name != 'this' && x.name != 'eval').map(x => x.name)
        const sizeEstimate = imports.map(x => TE.encode(x.get(1)).length + TE.encode(x.get(2)).length + 100)
            .concat(exports.map(x => TE.encode(x.get(1) || '').length + TE.encode(x.get(2) || '').length + TE.encode(x.get(3) || '').length + TE.encode(x.get(4) || '').length + 100))
            .concat(glob.map(x => TE.encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0)
            + (importSubstitute ? 50 : 0) + (evalSubstitute ? 50 : 0) + body.length
        const m = new Map<number, any>([[1, FileType.js], [2, sizeEstimate], [3, body], [4, glob], [5, imports], [6, exports], [7, importSubstitute], [8, evalSubstitute]])
        for (let x of m) {
            if (x[1] === undefined || (Array.isArray(x[1]) && x[1].length == 0)) {
                m.delete(x[0])
            }
        }
        return m
    }
    else {
        return new Map<number, any>([[1, FileType.buffer], [2, b]])
    }
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
export const enum FileType {
    error = 0,
    buffer = 1,
    js = 2,
}
export const encodePackage = (p: { files: {} }): Uint8Array => {
    const q = { files: {} }
    const en = new Encoder({ omitMapTag: true })
    for (let k in p.files) {
        q.files[k] = en.encode(p.files[k])
    }
    const tm = new Map(defaultTypeMap)
    tm.set(Uint8Array, (a: Uint8Array, state: EncoderState) => {
        tagItem(tags.encodedCBORItem, state)
        binaryItem(a, state)
    })
    const enc = new Encoder({ omitMapTag: true, typeMap: tm })
    return enc.encode(new Map([[1, q.files]]))
}
export const encodeFile = (p: Map<number, any>): Uint8Array => {
    const en = new Encoder({ omitMapTag: true })
    return en.encode(p)
}
export const decodePackage = (b: BufferSource): Map<number, any> => {
    const dec = new Decoder({ byteStringNoCopy: true })
    return dec.decode(b)
}
export const cjsHiddenVariable = 's3jY8Nt5dO3xokuh194BF'
export const cjsModuleGlobals = ['module', 'exports', 'require', '__dirname', '__filename', cjsHiddenVariable]
export const decodeFile = async (b: BufferSource, controlledGlobals: DataView, parentURL: URL, fs: FileURLSystem): Promise<{ type: string, data: Uint8Array }> => {
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
        if (parentURL.pathname.startsWith(packageCJSPath) && parentURL.pathname.endsWith('.json')) {
            const s = 'import{cjsRegister}from"' + internalBase + escapeDoubleQuote(fs.stateURL) + '";cjsRegister('
                + TD.decode(new Uint8Array(dv.buffer, dv.byteOffset + state.position, len)) + ',"' + escapeDoubleQuote(parentURL.href) + '");'
            return { type: 'text/javascript', data: TE.encode(s) }
        }
        return { type: 'application/octet-stream', data: new Uint8Array(dv.buffer, dv.byteOffset + state.position, len) }
    }
    else if (type == FileType.js) {
        const parentURLencoded = escapeDoubleQuote(encodeURIComponent(parentURL.href))
        const cjs = await isCommonJS(parentURL, fs)
        state.position = 3
        if (dv.getUint8(state.position) != 2) {
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
            if (dv.getUint8(state.position) != 3) {
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
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 4) {
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
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 5) {
                    state.position++
                    decodeSkip(dv, state)
                }
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 6) {
                    state.position++
                    decodeSkip(dv, state)
                }
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 7) {
                    state.position++
                    const size = decodeCount(dv, state)
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
                    state.position += size
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
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 8) {
                    state.position++
                    const size = decodeCount(dv, state)
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
                    state.position += size
                    u[len++] = 32
                    u[len++] = 102
                    u[len++] = 114
                    u[len++] = 111
                    u[len++] = 109
                    u[len++] = 34
                    u[len++] = 47
                    u[len++] = 120
                    u[len++] = 47
                    u[len++] = 117
                    u[len++] = 34
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
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 4) {
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
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 5) {
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
                        const rCount = await importResolve(u, len, dv, state, specifierSize, parentURL, fs)
                        if (rCount == -1) {
                            loop = true
                            sizeEstimate = sizeEstimate * 2
                            continue loop1
                        }
                        len += rCount
                        u[len++] = 34
                        state.position += specifierSize
                    }
                }
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 6) {
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
                                const rCount = await importResolve(u, len, dv, state, specifierSize, parentURL, fs)
                                if (rCount == -1) {
                                    loop = true
                                    sizeEstimate = sizeEstimate * 2
                                    continue loop1
                                }
                                len += rCount
                                u[len++] = 34
                                state.position += specifierSize
                            }
                        }
                    }
                }
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 7) {
                    state.position++
                    const size = decodeCount(dv, state)
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
                    state.position += size
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
                if (dv.byteLength > state.position && dv.getUint8(state.position) == 8) {
                    state.position++
                    const size = decodeCount(dv, state)
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
                    state.position += size
                    u[len++] = 32
                    u[len++] = 102
                    u[len++] = 114
                    u[len++] = 111
                    u[len++] = 109
                    u[len++] = 34
                    u[len++] = 47
                    u[len++] = 120
                    u[len++] = 47
                    u[len++] = 117
                    u[len++] = 34
                }
            }
        }
        if (state.position != dv.byteLength) {
            throw new Error('cbor not fully consumed')
        }
        return { type: 'text/javascript', data: new Uint8Array(u.buffer, 0, len) }
    }
    else if (type == FileType.error) {
        const m = new Decoder().decode(b)
        const s = 'Error type: ' + m.get(2) + ' Message: ' + m.get(3)
        return { type: 'text/plain', data: new TextEncoder().encode(s) }
    }
    else {
        throw new Error('FileType not implemented ' + type)
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
export type Update = { [k: string]: { action: UpdateActions, buffer: Buffer } }
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