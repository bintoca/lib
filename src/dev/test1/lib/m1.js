export const s = 'dse'
let d = 4
export default d = 5
export * as t from './t1.js'
import * as acorn from 'acorn'
//import react from 'react'
console.log(acorn.parse('const a = import.meta.url', {sourceType:'module'}))