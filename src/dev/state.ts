import { cjsRegister as reg, cjsExec as exec, CJS_MODULE } from '@bintoca/package'

export const url = import.meta.url
const cjsFunctions: { [k: string]: Function } = {}
const cjsModules: { [k: string]: CJS_MODULE } = {}
export const cjsRegister = (f, k: string) => reg(f,k, cjsFunctions, cjsModules)
export const cjsExec = (k: string) => exec(k, cjsFunctions, cjsModules)