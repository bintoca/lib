import tar from 'tar'
import cachedir from 'cachedir'
import * as acorn from 'acorn'
import glo from 'acorn-globals'
import * as walk from 'acorn-walk'
import { ChunkType, FileType, ShrinkwrapPackageDescription } from '@bintoca/loader'
import path from 'path'
const TD = new TextDecoder()
const TE = new TextEncoder()

export const cacacheDir = path.join(cachedir('bintoca'), '_cacache')
export async function parseTar(t: NodeJS.ReadableStream): Promise<{ [k: string]: Buffer }> {
    return new Promise((resolve, reject) => {
        const files = {}
        const p: tar.ParseStream = new (tar.Parse as any)()
        const ent = (e: tar.ReadEntry) => {
            const fn = e.path.substring(e.path.indexOf('/') + 1)
            let chunks = []
            e.on('data', d => {
                chunks.push(d)
            })
            e.on('end', () => {
                if (fn && !fn.endsWith('/')) {
                    files[fn] = Buffer.concat(chunks)
                }
            })
        }
        p.on('entry', ent)
        p.on('end', () => {
            resolve(files)
        })
        t.on('error', er => {
            reject(er)
        })
        t.pipe(p)
    })
}
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
export const parseFiles = (files: { [k: string]: Buffer }): { files: { [k: string]: Map<number, any> } } => {
    const r = { files: {} }
    for (let k in files) {
        r.files[k] = parseFile(k, files[k])
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