import { cjsRegister as reg, cjsExec as exec, State } from '@bintoca/package'

export const url = import.meta.url
export const state: State = { cjsFunctions: {}, cjsModules: {}, fs: null }
state.fs = { exists: (path: URL) => state.cjsFunctions[path.href] != undefined || state.cjsModules[path.href] != undefined, read: (path: URL) => state.cjsModules[path.href], jsonCache: {} }
export const cjsRegister = (f, k: string) => reg(f, k, state)
export const cjsExec = (k: string) => exec(k, state)