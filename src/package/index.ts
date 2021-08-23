import tar from 'tar'
import * as acorn from 'acorn'
import glo from 'acorn-globals'
import * as walk from 'acorn-walk'
import { ChunkType, FileType } from '@bintoca/loader'
const TD = new TextDecoder()

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
export const parseFiles = (files: { [k: string]: Buffer }): { files: {} } => {
    const r = { files: {} }
    for (let k in files) {
        r.files[k] = parseFile(k, files[k])
    }
    return r
}
export const parseFile = (k: string, b: Buffer): Map<number, any> => {
    if (k.endsWith('.js') || k.endsWith('.cjs') || k.endsWith('.mjs')) {
        let ast//: acorn.Node
        let text: string
        try {
            text = TD.decode(b)
            ast = acorn.parse(text, { ecmaVersion: "latest", sourceType: 'module' })
            //console.log(JSON.stringify(ast))
        }
        catch (e) {
            return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.syntax], [3, e.message]])
        }
        const removeNodes = []
        const importSuspectIds = {}
        const thisSuspectIds = {}
        function isSuspectId(s: string) {
            if (s.length == 6 && s.startsWith('$')) {
                importSuspectIds[s] = 1
            }
            else if (s.length == 4 && s.startsWith('$')) {
                thisSuspectIds[s] = 1
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
            }
        })
        let position = 0
        const chunks: (Map<number, any> | string)[] = []
        const imports: Map<number, any>[] = []
        let hasDynamicImport = false
        let hasGlobalThis = false
        for (let n of removeNodes) {
            if (n.type == 'ImportDeclaration') {
                if (position != n.start) {
                    chunks.push(text.substring(position, n.start))
                }
                position = n.end
                chunks.push(new Map([[1, ChunkType.Placeholder], [2, n.end - n.start]]))
                const specifier = text.substring(n.source.start + 1, n.source.end - 1)
                if ((specifier.startsWith('.') && !specifier.startsWith('./') && !specifier.startsWith('../')) || !new URL(specifier, 'http://x/x/' + k).href.startsWith('http://x/x/') || !new URL(specifier, 'http://y/y/' + k).href.startsWith('http://y/y/')) {
                    return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, specifier]])
                }
                imports.push(new Map([[1, text.substring(n.start, n.source.start)], [2, specifier]]))
            }
            else if (n.type == 'ImportExpression') {
                if (position != n.start) {
                    chunks.push(text.substring(position, n.start))
                }
                position = n.start + 6
                chunks.push(new Map([[1, ChunkType.Import]]))
                hasDynamicImport = true
            }
            else if (n.type == 'ThisExpression') {
                if (position != n.start) {
                    chunks.push(text.substring(position, n.start))
                }
                position = n.end
                chunks.push(new Map([[1, ChunkType.This]]))
                hasGlobalThis = true
            }
        }
        chunks.push(text.substring(position))
        let glob
        //const g = glo(ast)
        {//fork of acorn-globals with PRs #52 #58 #60
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
                'ImportNamespaceSpecifier': declareModuleSpecifier
            });
            function identifier(node, parents) {
                var name = node.name;
                if (name === 'undefined') return;
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
        const importSubstitute = hasDynamicImport ? getSubstituteId(importSuspectIds, 5, '$') : undefined
        const thisSubstitute = hasGlobalThis ? getSubstituteId(thisSuspectIds, 3, '$') : undefined
        const sizeEstimate = chunks.map(x => typeof x == 'string' ? new TextEncoder().encode(x).length : x.get(1) == ChunkType.Placeholder ? x.get(2) : x.get(1) == ChunkType.Import ? 6 : x.get(1) == ChunkType.This ? 4 : 0)
            .concat(imports.map(x => new TextEncoder().encode(x.get(1)).length + new TextEncoder().encode(x.get(2)).length + 50)).concat(glob.map(x => new TextEncoder().encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0)
            + (importSubstitute ? 50 : 0) + (thisSubstitute ? 50 : 0)
        if (hasDynamicImport && !importSubstitute) {
            return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.importSubstitute], [3, k]])
        }
        if (hasGlobalThis && !thisSubstitute) {
            return new Map<number, any>([[1, FileType.error], [2, ParseFilesError.thisSubstitute], [3, k]])
        }
        const m = new Map<number, any>([[1, FileType.js], [2, sizeEstimate], [6, importSubstitute], [7, thisSubstitute], [3, chunks], [4, glob], [5, imports]])
        if (!importSubstitute) {
            m.delete(6)
        }
        if (!thisSubstitute) {
            m.delete(7)
        }
        return m
    }
    else {
        return new Map<number, any>([[1, FileType.buffer], [2, b]])
    }
}