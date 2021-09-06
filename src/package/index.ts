import * as acorn from 'acorn'
import glo from 'acorn-globals'
import * as walk from 'acorn-walk'
import { Encoder, Decoder } from '@bintoca/cbor'
import { defaultTypeMap, EncoderState, binaryItem, tagItem, tags, bufferSourceToDataView, DecoderState, decodeInfo, bufferSourceToUint8Array } from '@bintoca/cbor/core'
const TD = new TextDecoder()
const TE = new TextEncoder()

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
    invalidSpecifier = 5
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
export const parseFile = (k: string, b: Buffer): Map<number, any> => {
    if (k.endsWith('.js') || k.endsWith('.cjs') || k.endsWith('.mjs')) {
        let ast//: acorn.Node
        let text: string
        try {
            text = TD.decode(b)
            ast = acorn.parse(text, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true })
            //console.log(JSON.stringify(ast))
        }
        catch (e) {
            return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.syntax], [3, e.message]])
        }
        const removeNodes = []
        const importSuspectIds = {}
        const thisSuspectIds = {}
        const exportDefaultSuspectIds = {}
        function isSuspectId(s: string) {
            if (s.length == 6 && s.startsWith('$')) {
                importSuspectIds[s] = 1
            }
            else if (s.length == 4 && s.startsWith('$')) {
                thisSuspectIds[s] = 1
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
            ThisExpression(n, a: any[]) {
                if (!a.some(x => thisScopes.some(t => t == x.type))) {
                    removeNodes.push(n)
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
        let thisSubstitute
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
            else if (n.type == 'ThisExpression') {
                if (!thisSubstitute) {
                    thisSubstitute = getSubstituteId(thisSuspectIds, 3, '$')
                }
                if (!thisSubstitute) {
                    return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.thisSubstitute], [3, k]])
                }
                body += thisSubstitute
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
            else if (n.type == 'MetaProperty' && n.meta.name == 'import') {

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
        glob = glob.filter(x => x.name != 'this').map(x => x.name)
        const sizeEstimate = imports.map(x => TE.encode(x.get(1)).length + TE.encode(x.get(2)).length + 100)
            .concat(exports.map(x => TE.encode(x.get(1) || '').length + TE.encode(x.get(2) || '').length + TE.encode(x.get(3) || '').length + TE.encode(x.get(4) || '').length + 100))
            .concat(glob.map(x => TE.encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0)
            + (importSubstitute ? 50 : 0) + (thisSubstitute ? 50 : 0) + body.length
        const m = new Map<number, any>([[1, FileType.js], [2, sizeEstimate], [3, body], [4, glob], [5, imports], [6, importSubstitute], [7, thisSubstitute], [8, exports]])

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
export const getShrinkwrapURLs = (shrinkwrap: any): ShrinkwrapPackageDescription[] => {
    const u = []
    for (let k in shrinkwrap.packages) {
        const v = shrinkwrap.packages[k]
        if (k && !v.dev) {
            u.push(v)
        }
    }
    return u
}
export const enum FileType {
    buffer = 1,
    js = 2,
    error = 3,
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
export const decodeFile = async (b: BufferSource, freeGlobals: DataView, controlledGlobals: DataView, parentURL: URL, conditions: Set<string>, fs: FileURLSystem): Promise<{ type: string, data: Uint8Array }> => {
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
        return { type: 'application/octet-stream', data: new Uint8Array(dv.buffer, dv.byteOffset + state.position, len) }
    }
    else if (type == FileType.js) {
        state.position = 3
        if (dv.getUint8(state.position) != 2) {
            throw new Error('invalid cbor at index ' + state.position)
        }
        state.position++
        let sizeEstimate = decodeCount(dv, state)
        const loopStart = state.position
        let loop = true
        let u
        let len
        const parentURLencoded = encodeURIComponent(parentURL.href)
        while (loop) {
            loop = false
            state.position = loopStart
            u = new Uint8Array(sizeEstimate + parentURLencoded.length)
            len = 0
            if (dv.getUint8(state.position) != 3) {
                throw new Error('invalid cbor at index ' + state.position)
            }
            state.position++
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
            if (dv.byteLength > state.position && dv.getUint8(state.position) == 4) {
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
                    const rCount = await importResolve(u, len, dv, state, specifierSize, parentURL, conditions, fs)
                    if (rCount == -1) {
                        loop = true
                        sizeEstimate = sizeEstimate * 2
                        continue
                    }
                    len += rCount
                    u[len++] = 34
                    state.position += specifierSize
                }
            }
            if (dv.byteLength > state.position && dv.getUint8(state.position) == 6) {
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
                u[len++] = 116
                u[len++] = 34
            }
            if (dv.byteLength > state.position && dv.getUint8(state.position) == 8) {
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
                            const rCount = await importResolve(u, len, dv, state, specifierSize, parentURL, conditions, fs)
                            if (rCount == -1) {
                                loop = true
                                sizeEstimate = sizeEstimate * 2
                                continue
                            }
                            len += rCount
                            u[len++] = 34
                            state.position += specifierSize
                        }
                    }
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
export const getManifest = (p: { [k: string]: Uint8Array }) => {
    const m = {}
    for (let k in p) {
        m[k] = 1
        if (k.endsWith('package.json')) {
            try {
                const pj = JSON.parse(new TextDecoder().decode(p[k]))
                m[k] = pj
            }
            catch { }
        }
    }
}
export const dynamicImportBase = '/x/i/'
export const reloadBase = '/x/h/'
export const getDynamicImportModule = (urlpath: string, hot: boolean): string => {
    const url = decodeURIComponent(urlpath.slice(dynamicImportBase.length)).replace(/"/g, '\\"')
    const meta = 'imp.meta.url="' + url + '";' +
        (hot ? 'imp.meta.server=self.metaServer;' : '')
    return 'function imp(){};imp.meta=Object.create(null);' + meta + ';export default imp'
}
export type Update = { [k: string]: { action: UpdateActions, buffer: Buffer } }
export type UpdateActions = 'add' | 'change' | 'remove'
const importResolve = async (u: Uint8Array, len: number, dv: DataView, state: DecoderState, size: number, parentURL: URL, conditions: Set<string>, fs: FileURLSystem): Promise<number> => {
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
            sp = (await ESM_RESOLVE(s, parentURL, conditions, fs)).pathname
        }
    }
    const spb = new TextEncoder().encode(sp)
    if (u.byteLength - len - spb.byteLength < 100) {
        return -1
    }
    u.set(spb, len)
    return spb.byteLength
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
        return pack.resolved + urlpath.slice(index)
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
export type FileURLSystem = { exists: (path: URL) => Promise<boolean>, read: (path: URL, decoded: boolean) => Promise<Uint8Array>, jsonCache: { [k: string]: PackageJSON } }
export type PackageJSON = { pjsonURL: URL, exists: boolean, main: string, name: string, type: string, exports, imports }
export const defaultConditions = new Set(['import', 'default'])
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
        const obj = JSON.parse(new TextDecoder().decode(p))
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
        if (scopeURL.pathname.endsWith('node_modules/package.json')) {
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
export const invalidSegmentRegEx = /(^|\\|\/)(\.\.?|node_modules)(\\|\/|$)/;
export const patternRegEx = /\*/g;
export const isArrayIndex = (key) => {
    const keyNum = +key;
    if (`${keyNum}` !== key) return false;
    return keyNum >= 0 && keyNum < 0xFFFF_FFFF;
}
export const PACKAGE_TARGET_RESOLVE = async (pjsonURL: URL, target, subpath: string, pattern: boolean, internal: boolean, conditions: Set<string>, fs: FileURLSystem): Promise<URL> => {
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
                    return await PACKAGE_RESOLVE(target.replace(patternRegEx, subpath), pjsonURL, conditions, fs)
                }
                return await PACKAGE_RESOLVE(target + subpath, pjsonURL, conditions, fs)
            }
            else {
                throw new Error('Invalid Package Target')
            }
        }
        if (invalidSegmentRegEx.test(target.slice(2))) {
            throw new Error('Invalid Package Target')
        }
        const resolvedTarget = new URL(target, pjsonURL)
        if (!resolvedTarget.pathname.startsWith(new URL('.', pjsonURL).pathname)) {
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
                resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, targetValue, subpath, pattern, internal, conditions, fs);
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
                const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, targetValue, subpath, pattern, internal, conditions, fs)
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
    const aPatternIndex = a.indexOf('*')
    const bPatternIndex = b.indexOf('*')
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
export const PACKAGE_IMPORTS_EXPORTS_RESOLVE = async (matchKey: string, matchObj: Object, pjsonURL: URL, isImports, conditions: Set<string>, fs: FileURLSystem): Promise<{ resolved: URL, exact: boolean }> => {
    if (matchObj.hasOwnProperty(matchKey) && !matchKey.endsWith('/') && !matchKey.includes('*')) {
        const target = matchObj[matchKey]
        const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, target, '', false, isImports, conditions, fs)
        return { resolved, exact: true }
    }
    const expansionKeys = Object.keys(matchObj).filter(x => x.endsWith('/') || (x.indexOf('*') !== -1 && x.indexOf('*') === x.lastIndexOf('*'))).sort(patternKeyCompare)
    for (let expansionKey of expansionKeys) {
        let patternBase: string
        const patternIndex = expansionKey.indexOf('*')
        if (patternIndex >= 0) {
            patternBase = expansionKey.slice(0, patternIndex)
        }
        if (patternBase && matchKey.startsWith(patternBase) && matchKey !== patternBase) {
            const patternTrailer = expansionKey.slice(patternIndex + 1)
            if (!patternTrailer || (matchKey.endsWith(patternTrailer) && matchKey.length >= expansionKey.length)) {
                const target = matchObj[expansionKey]
                const subpath = matchKey.slice(patternBase.length, -patternTrailer.length)
                const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, target, subpath, true, isImports, conditions, fs)
                return { resolved, exact: true }
            }
        }
        if (!patternBase && matchKey.startsWith(expansionKey)) {
            const target = matchObj[expansionKey]
            const subpath = matchKey.slice(expansionKey.length)
            const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, target, subpath, false, isImports, conditions, fs)
            return { resolved, exact: false }
        }
    }
    return { resolved: null, exact: true }
}
export const PACKAGE_IMPORTS_RESOLVE = async (specifier: string, parentURL: URL, conditions: Set<string>, fs: FileURLSystem) => {
    if (!specifier.startsWith('#')) {
        throw new Error('Assert starts with #')
    }
    if (specifier === '#' || specifier.startsWith('#/')) {
        throw new Error('Invalid Module Specifier')
    }
    const pjson = await READ_PACKAGE_SCOPE(parentURL, fs)
    if (pjson.exists) {
        if (pjson.imports) {
            const resolvedMatch = await PACKAGE_IMPORTS_EXPORTS_RESOLVE(specifier, pjson.imports, pjson.pjsonURL, true, conditions, fs)
            if (resolvedMatch.resolved) {
                return resolvedMatch
            }
        }
    }
    throw new Error('Package Import Not Defined')
}
function isConditionalSugar(exports) {
    if (typeof exports === 'string' || Array.isArray(exports)) return true;
    if (typeof exports !== 'object' || exports === null) return false;

    const keys = Object.getOwnPropertyNames(exports);
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
export const PACKAGE_EXPORTS_RESOLVE = async (pjsonURL: URL, subpath: string, exports, conditions: Set<string>, fs: FileURLSystem) => {
    if (isConditionalSugar(exports)) {
        exports = { '.': exports }
    }
    if (subpath === '.' && exports[subpath]) {
        const resolved = await PACKAGE_TARGET_RESOLVE(pjsonURL, exports[subpath], '', false, false, conditions, fs)
        if (resolved) {
            return { resolved, exact: true }
        }
    }
    else {
        const matchKey = './' + subpath
        const resolvedMatch = await PACKAGE_IMPORTS_EXPORTS_RESOLVE(matchKey, exports, pjsonURL, false, conditions, fs)
        if (resolvedMatch.resolved) {
            return resolvedMatch
        }
    }
    throw new Error('Package Path Not Exported')
}
export const PACKAGE_SELF_RESOLVE = async (packageName: string, packageSubpath: string, parentURL: URL, conditions: Set<string>, fs: FileURLSystem) => {
    const pjson = await READ_PACKAGE_SCOPE(parentURL, fs)
    if (!pjson.exists || !pjson.exports) {
        return undefined
    }
    if (pjson.name === packageName) {
        const { resolved } = await PACKAGE_EXPORTS_RESOLVE(pjson.pjsonURL, packageSubpath, pjson.exports, conditions, fs)
        return resolved
    }
    return undefined
}
function parsePackageName(specifier: string) {
    let separatorIndex = specifier.indexOf('/')
    let validPackageName = true;
    let isScoped = false;
    if (specifier[0] === '@') {
        isScoped = true;
        if (separatorIndex === -1 || specifier.length === 0) {
            validPackageName = false;
        } else {
            separatorIndex = specifier.indexOf('/', separatorIndex + 1);
        }
    }
    const packageName = separatorIndex === -1 ?
        specifier : specifier.slice(0, separatorIndex);

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
    const packageSubpath = '.' + (separatorIndex === -1 ? '' : specifier.slice(separatorIndex))
    return { packageName, packageSubpath, isScoped };
}
export const PACKAGE_RESOLVE = async (packageSpecifier: string, parentURL: URL, conditions: Set<string>, fs: FileURLSystem): Promise<URL> => {
    const { packageName, packageSubpath, isScoped } = parsePackageName(packageSpecifier)
    const selfURL = await PACKAGE_SELF_RESOLVE(packageName, packageSubpath, parentURL, conditions, fs)
    if (selfURL) {
        return selfURL
    }
    let pjsonURL = new URL('./node_modules/' + packageName + '/package.json', parentURL)
    let last
    do {
        const pjson = await READ_PACKAGE_JSON(pjsonURL, fs)
        if (pjson.exists) {
            if (pjson.exports) {
                const { resolved } = await PACKAGE_EXPORTS_RESOLVE(pjsonURL, packageSubpath, pjson.exports, conditions, fs)
                return resolved
            }
            else if (packageSubpath === '.') {
                return await LOAD_AS_DIRECTORY(pjson, fs)
            }
            return new URL(packageSubpath, pjsonURL)
        }
        last = pjsonURL
        pjsonURL = new URL((isScoped ? '../../../../node_modules/' : '../../../node_modules/') + packageName + '/package.json', pjsonURL);
    }
    while (pjsonURL.pathname !== last.pathname)
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
    throw new Error('Module Not Found')
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
export const ESM_RESOLVE = async (specifier: string, parentURL: URL, conditions: Set<string>, fs: FileURLSystem): Promise<URL> => {
    let resolved;
    if (shouldBeTreatedAsRelativeOrAbsolutePath(specifier)) {
        resolved = new URL(specifier, parentURL);
    } else if (specifier[0] === '#') {
        ({ resolved } = await PACKAGE_IMPORTS_RESOLVE(specifier, parentURL, conditions, fs));
    } else {
        try {
            resolved = new URL(specifier);
        } catch {
            resolved = await PACKAGE_RESOLVE(specifier, parentURL, conditions, fs)
        }
    }
    if (encodedSepRegEx.test(resolved.pathname)) {
        throw new Error('Invalid Module Specifier')
    }
    // if (!await fs.exists(resolved)) {
    //     throw new Error('Module Not Found')
    // }
    return resolved
}