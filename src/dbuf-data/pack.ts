import { getRegistryIndex, r } from '@bintoca/dbuf-data/registry'
import { type_array, array, parse_type_data, bytes, string, type_map, map, root, isNotNonNegativeInteger } from '@bintoca/dbuf-codec/encode'
import { Node, val } from '@bintoca/dbuf-codec/common'
import { RefineType } from './refine'

export type PackStack = { val, index: number, tempTypes: Node[], tempData: Node[] }[]
export const pack = (v:RefineType) => {
    const stack: PackStack = [{ val: v, index: 0, tempTypes: [], tempData: [] }]
    let lastType: Node
    let lastData: Node
    while (stack.length) {
        const top = stack[stack.length - 1]
        if (Array.isArray(top.val)) {
            if (lastType !== undefined) {
                top.tempTypes.push(lastType)
                top.tempData.push(lastData)
                top.index++
                lastType = lastData = undefined
            }
            if (top.index == top.val.length) {
                stack.pop()
                lastType = type_array(r.parse_type_data)
                lastData = array(...top.tempData.map((x, i) => parse_type_data(top.tempTypes[i], x)))
            }
            else {
                stack.push({ val: top.val[top.index], index: 0, tempTypes: [], tempData: [] })
            }
        }
        else if (top.val instanceof ArrayBuffer) {
            throw 'not imp'
        }
        else if (ArrayBuffer.isView(top.val)) {
            stack.pop()
            if (top.val instanceof Uint8Array) {
                lastType = val(r.parse_bytes, true)
                lastData = bytes(top.val)
            }
            else {
                throw 'not imp'
            }
        }
        else if (top.val === null) {
            stack.pop()
            lastType = val(r.describe_no_value, true)
        }
        else if (typeof top.val == 'object') {
            const ks = Reflect.ownKeys(top.val)
            if (top.tempTypes.length == 0) {
                for (let k of ks) {
                    if (top.val[k] !== undefined) {
                        if (typeof k == 'symbol') {
                            top.tempTypes.push(val(getRegistryIndex(k), true))
                        }
                        else {
                            top.tempTypes.push(val(r.parse_text, true))
                            top.tempData.push(string(k))
                        }
                    }
                }
            }
            if (lastType !== undefined) {
                top.tempTypes.push(lastType)
                if (lastData) {
                    top.tempData.push(lastData)
                }
                top.index++
                lastType = lastData = undefined
            }
            if (top.index == ks.length) {
                stack.pop()
                lastType = type_map(...top.tempTypes)
                lastData = map(...top.tempData)
            }
            else {
                const k = ks[top.index]
                if (top.val[k] !== undefined) {
                    stack.push({ val: top.val[k], index: 0, tempTypes: [], tempData: [] })
                }
                else {
                    top.index++
                }
            }
        }
        else {
            stack.pop()
            switch (typeof top.val) {
                case 'symbol':
                    lastType = val(getRegistryIndex(top.val), true)
                    break
                case 'string':
                    lastType = val(r.parse_text, true)
                    lastData = string(top.val)
                    break
                case 'number':
                    if (isNotNonNegativeInteger(top.val)) {
                        throw 'not implemented number'
                    }
                    else {
                        lastType = val(r.parse_varint, true)
                        lastData = val(top.val)
                    }
                    break
                case 'boolean':
                    lastType = val(top.val ? r.true : r.false, true)
                    break
                default:
                    throw 'not implemented pack'
            }
        }
    }
    return root(lastType, lastData)
}