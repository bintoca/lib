import { r } from '../dbuf-codec/registryEnum'
export const symbolPrefix = 'dbuf_' 
export const getRegistrySymbol = (r: r): string => symbolPrefix + r
export const isRegistrySymbol = (s: string) => s.startsWith(symbolPrefix)
export const getRegistryIndex = (s: string) => parseInt(s.split('_')[1])
export type ErrorObject = { dbuf_32: any }
export const registryError = (er: r) => { return { dbuf_32: getRegistrySymbol(er) } }
export const stringError = (message: string) => { return { dbuf_32: message } }