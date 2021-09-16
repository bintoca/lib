import { cjsRegister as reg, cjsExec as exec, State } from '@bintoca/package'
const gt = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : null
const { ObjectCreate } = gt['primordials'] as Primordials

export const url = import.meta.url
export const state: State = { cjsFunctions: ObjectCreate(null), cjsModules: ObjectCreate(null), fs: null }
state.fs = { exists: (path: URL) => state.cjsFunctions[path.href] != undefined || state.cjsModules[path.href] != undefined, read: (path: URL) => state.cjsModules[path.href], jsonCache: ObjectCreate(null), conditions: undefined }
export const cjsRegister = (f, k: string) => reg(f, k, state)
export const cjsExec = (k: string) => exec(k, state)