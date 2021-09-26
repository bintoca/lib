import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import { EncoderState, bufferSourceToDataView, DecoderState, decodeCount, bufferSourceToUint8Array, decodeSkip, encodeSync, concat as bufConcat, setupDecoder, setupEncoder, decodeSync } from '@bintoca/cbor/core'
import { ESM_RESOLVE, defaultConditionsSync } from '@bintoca/package'
const TD = new TextDecoder()
const TE = new TextEncoder()

export const metaURL = import.meta.url
export const internalBase = '/x/a/'
export const configURL = '/x/config'
export const globalBase = '/x/g/'
export const reloadBase = '/x/h/'
export const importBase = '/x/i/'
export const packageBase = '/x/p/'
export type FileBundle = { [k: string]: { action: UpdateActions, buffer: BufferSource } }
export type UpdateActions = 'add' | 'change' | 'remove'
export type FileParseError = { type: FileType.error, error: ParseFilesError, message: string }
export type FileParseBuffer = { type: FileType.buffer, value: BufferSource }
export type FileParseJSON = { type: FileType.json, value: BufferSource, obj: any, main?: string }
export type FileParseWASM = { type: FileType.wasm, value: BufferSource }
export type FileParseJS = { type: FileType.js, value: Map<number, any> }
export type FileParse = FileParseError | FileParseBuffer | FileParseJSON | FileParseWASM | FileParseJS
export type Manifest = { files: { [k: string]: { integrity: string } }, main: string }
export const enum ParseFilesError {
    syntax = 1,
    importSubstitute = 2,
    packageJSON = 3,
    invalidSpecifier = 4
}
export const enum FileType {
    error = 0,
    buffer = 1,
    js = 2,
    json = 3,
    wasm = 4
}
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
export const isSpecifierInvalid = (file: string, specifier: string): boolean => {
    if (specifier.startsWith('./')) {
        return false
    }
    if (specifier.startsWith('../')) {
        return !new URL(specifier, 'http://x/x/' + file).href.startsWith('http://x/x/') || !new URL(specifier, 'http://y/y/' + file).href.startsWith('http://y/y/')
    }
    return true
}
export const parseFiles = async (files: FileBundle): Promise<{ [k: string]: FileParse }> => {
    const r = {}
    for (let k in files) {
        if (files[k].action != 'remove') {
            r[k] = await parseFile(k, files[k].buffer)
        }
    }
    return r
}
export const sourceMappingURLRegExp = /sourceMappingURL=(\S+).*/mg
export const fileError = (p: ParseFilesError, message: string): FileParseError => { return { type: FileType.error, error: p, message } }
export const parseFile = async (filename: string, b: BufferSource): Promise<FileParse> => {
    if (filename.endsWith('.js') || filename.endsWith('.mjs')) {
        let ast//: acorn.Node
        let text: string
        const sourceMappingURLs: string[] = []
        try {
            text = TD.decode(b)
            ast = acorn.parse(text, {
                ecmaVersion: 2022, sourceType: 'module', allowHashBang: true, onComment: (block, s, start, end) => {
                    let a;
                    while ((a = sourceMappingURLRegExp.exec(s)) !== null) {
                        //console.log(a[1])
                        sourceMappingURLs.push(a[1])
                    }
                }
            })
            //console.log(JSON.stringify(ast))
            //console.log(JSON.stringify(acorn.parse('const ev=2//@ sourceMappingURL=js.map', { ecmaVersion: 2022, sourceType: 'module', onComment: (block, text, start, end) => { console.log(block, text, start, end) } })))
        }
        catch (e) {
            return fileError(ParseFilesError.syntax, e.message)
        }
        const removeNodes = []
        const specifierNodes = []
        const importSuspectIds = {}
        function isSuspectId(s: string) {
            if (s.length == 6 && s.startsWith('$')) {
                importSuspectIds[s] = 1
            }
        }
        walk.ancestor(ast, {
            ImportExpression(n) {
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
                specifierNodes.push(n)
            },
            ImportDeclaration(n) {
                specifierNodes.push(n)
            },
            ExportAllDeclaration(n) {
                specifierNodes.push(n)
            },
            MetaProperty(n) {
                removeNodes.push(n)
            }
        })
        for (let n of specifierNodes) {
            if (n.source) {
                const specifier = n.source.value
                if (isSpecifierInvalid(filename, specifier)) {
                    return fileError(ParseFilesError.invalidSpecifier, specifier)
                }
            }
        }
        let position = 0
        let importSubstitute
        const importSubstituteOffsets = []
        removeNodes.sort((a, b) => a.start - b.start)
        let body = ''
        for (let n of removeNodes) {
            if (position != n.start) {
                body += text.substring(position, n.start)
            }
            position = n.end
            if (n.type == 'ImportExpression' || (n.type == 'MetaProperty' && n.meta.name == 'import')) {
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
        const m = new Map<number, any>([[2, body], [3, glob], [4, importSubstitute], [5, importSubstituteOffsets]])
        for (let x of m) {
            if (x[1] === undefined || (Array.isArray(x[1]) && x[1].length == 0)) {
                m.delete(x[0])
            }
        }
        return { type: FileType.js, value: m }
    }
    else if (filename.endsWith('.json')) {
        let obj
        try {
            obj = JSON.parse(TD.decode(b))
        }
        catch (e) {
            return fileError(ParseFilesError.syntax, e.message)
        }
        return { type: FileType.json, value: b, obj }
    }
    else if (filename.endsWith('.wasm')) {
        if (!WebAssembly.validate(b)) {
            return fileError(ParseFilesError.syntax, 'invalid wasm')
        }
        const m = await WebAssembly.compile(b)
        const im = WebAssembly.Module.imports(m)[0].module
        const sm = WebAssembly.Module.customSections(m, 'sourceMappingURL')
        return { type: FileType.wasm, value: b }
    }
    return { type: FileType.buffer, value: b }
}
export const validatePackageJSON = (parsed: { [k: string]: FileParse }) => {
    let fp = parsed['package.json']
    if (!fp) {
        fp = fileError(ParseFilesError.packageJSON, 'package.json not found')
    }
    else if (fp.type == FileType.json) {
        if (fp.obj.type != 'module') {
            fp = fileError(ParseFilesError.packageJSON, 'package type must be module')
        }
        else if (!fp.obj.name) {
            fp = fileError(ParseFilesError.packageJSON, 'package name required')
        }
        else {
            try {
                const u = new URL('file://')
                fp.main = ESM_RESOLVE(fp.obj.name, u, {
                    exists: (p: URL) => parsed[p.pathname.slice(1)] !== undefined,
                    read: (p: URL) => {
                        const pj = parsed[p.pathname.slice(1)]
                        if (pj.type == FileType.json) {
                            return pj.obj
                        }
                    }, jsonCache: {}, conditions: defaultConditionsSync
                }).pathname.slice(1)
            }
            catch (e) {
                fp = fileError(ParseFilesError.packageJSON, e.message)
            }
        }
    }
    else {
        throw new Error('incorrect FileType')
    }
    parsed['package.json'] = fp
    return fp
}
export const parsePackage = async (files: FileBundle, encoderState: EncoderState, integrityFunc: (u: Uint8Array) => Promise<string>) => {
    const parsed = await parseFiles(files)
    const pjson = validatePackageJSON(parsed)
    for (let x in parsed) {
        const m = parsed[x]
        if (m.type == FileType.error) {
            return { parsed }
        }
    }
    const encoded = encodePackage(parsed, encoderState)
    const manifest: Manifest = { files: {}, main: (pjson as FileParseJSON).main }
    for (let x in encoded) {
        manifest.files[x] = { integrity: await integrityFunc(encoded[x]) }
    }
    return { parsed, encoded, manifest }
}
export const encodePackage = (p: { [k: string]: FileParse }, state: EncoderState): { [k: string]: Uint8Array } => {
    const q: { [k: string]: Uint8Array } = {}
    for (let k in p) {
        q[k] = encodeFile(p[k], state)
    }
    return q
}
export const setupEncoderState = () => {
    const s = setupEncoder({ omitMapTag: true })
    s.typeMap.set(Uint8Array, s.typeMap.get(ArrayBuffer))
    return s
}
export const encodeFile = (p: FileParse, state: EncoderState): Uint8Array => {
    const m = new Map<number, any>([[-1, p.type]])
    switch (p.type) {
        case FileType.error:
            return new Uint8Array()
        case FileType.js: {
            for (let x of p.value) {
                m.set(x[0], x[1])
            }
            break
        }
        case FileType.buffer:
        case FileType.json:
        case FileType.wasm: {
            m.set(1, p.value)
            break
        }
        default:
            throw new Error('FileType not implemented')
    }
    return bufConcat(encodeSync(m, state))
}
export const decodeFileToOriginal = (b: BufferSource) => {
    const state = setupDecoder()
    const m = decodeSync(b, state) as Map<number, any>
    const ft = m.get(-1)
    switch (ft) {
        case FileType.js: {
            const body = m.get(2) as string
            const importSubOffsets = m.get(5) as number[]
            const chunks: { text: string, offset: number }[] = []
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
        default:
            return new Uint8Array(m.get(1))
    }
}
export const decodeFile = (b: BufferSource, controlledGlobals: DataView, parentURL: URL): { type: string, data: Uint8Array } => {
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
        case 5: {
            const mapCount = decodeCount(dv, state)
            state.position++
            const ft = decodeCount(dv, state)
            switch (ft) {
                case FileType.js: {
                    state.position++
                    const bodySize = decodeCount(dv, state)
                    const bodyPosition = state.position
                    state.position += bodySize
                    let globalCount = 0
                    if (dv.byteLength > state.position && dv.getUint8(state.position) == 3) {
                        globalCount = decodeCount(dv, state)
                    }
                    state.position = bodyPosition
                    const parentURLencoded = escapeDoubleQuote(encodeURIComponent(parentURL.href))
                    const sizeEstimate = bodySize + globalCount * 50 + parentURLencoded.length + 50
                    let u = new Uint8Array(sizeEstimate)
                    let len = 0
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
                    if (dv.byteLength > state.position && dv.getUint8(state.position) == 5) {
                        state.position++
                        decodeSkip(dv, state)
                    }
                    if (state.position != dv.byteLength) {
                        throw new Error('cbor not fully consumed')
                    }
                    return { type: 'text/javascript', data: new Uint8Array(u.buffer, 0, len) }
                }
                case FileType.wasm: {
                    state.position++
                    const len = decodeCount(dv, state)
                    return { type: 'application/wasm', data: bufferSourceToUint8Array(dv, state.position, len) }
                }
                case FileType.json: {
                    state.position++
                    const len = decodeCount(dv, state)
                    return { type: 'application/json', data: bufferSourceToUint8Array(dv, state.position, len) }
                }
                case FileType.buffer: {
                    state.position++
                    const len = decodeCount(dv, state)
                    return { type: 'application/octet-stream', data: bufferSourceToUint8Array(dv, state.position, len) }
                }
                default:
                    throw new Error('file type not implemented ' + ft)
            }
        }
        default:
            throw new Error('Major type not implemented ' + maj)
    }
}
export const getDynamicImportModule = (urlpath: string, hot: string): string => {
    const url = escapeDoubleQuote(decodeURIComponent(urlpath.slice(importBase.length)))
    const meta = 'imp.meta.url="' + url + '";' +
        (hot ? hot : '')
    return 'function imp(){};imp.meta=Object.create(null);' + meta + ';export default imp'
}
export const getGlobalModule = (p: string, initURL) => 'import gt from "' + initURL + '";export default gt.' + p.slice(0, -3)
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