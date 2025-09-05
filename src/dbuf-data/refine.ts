import { getRegistrySymbol, r } from '@bintoca/dbuf-data/registry'
import { isUnsignedInt, valSymbol, u8Symbol, u8TextSymbol, getUnsignedIntVal, bitSizeSymbol, isUnsignedInt2, getValueFromUnrefinedMap, isUnrefinedMap, parseCoreLoop, unpack, initFullParser, UnpackType } from '@bintoca/dbuf-data/unpack'
import { concatBuffers } from '@bintoca/dbuf-codec/common'
import { tai_dbuf_epochOffsetSeconds, getLeapSecondsFromTAI } from '@bintoca/dbuf-data/time'

const sym_nonexistent = getRegistrySymbol(r.nonexistent)
const sym_false = getRegistrySymbol(r.false)
const sym_true = getRegistrySymbol(r.true)
const sym_value = getRegistrySymbol(r.value)
const sym_integer_signed = getRegistrySymbol(r.integer_signed)
const sym_IEEE_754_binary16 = getRegistrySymbol(r.IEEE_754_binary16)
const sym_IEEE_754_binary32 = getRegistrySymbol(r.IEEE_754_binary32)
const sym_IEEE_754_binary64 = getRegistrySymbol(r.IEEE_754_binary64)
const sym_exponent_base2 = getRegistrySymbol(r.exponent_base2)
const sym_exponent_base10 = getRegistrySymbol(r.exponent_base10)
const sym_text = getRegistrySymbol(r.text)
const sym_bytes = getRegistrySymbol(r.bytes)
const sym_epoch_seconds_continuous = getRegistrySymbol(r.epoch_seconds_continuous)
const sym_registry = getRegistrySymbol(r.registry)
const sym_delta = getRegistrySymbol(r.delta)
const sym_delta_double = getRegistrySymbol(r.delta_double)
const sym_offset_add = getRegistrySymbol(r.offset_add)
const sym_sign = getRegistrySymbol(r.sign)
const sym_instant = getRegistrySymbol(r.instant)
const sym_year = getRegistrySymbol(r.year)
const sym_month = getRegistrySymbol(r.month)
const sym_day = getRegistrySymbol(r.day)
const sym_hour = getRegistrySymbol(r.hour)
const sym_minute = getRegistrySymbol(r.minute)
const sym_second = getRegistrySymbol(r.second)

export const refineVal = (v: UnpackType): RefineType => {
    if (isUnsignedInt(v)) {
        return v[valSymbol]
    }
    if (v === sym_nonexistent) {
        return undefined
    }
    if (v === sym_true) {
        return true
    }
    if (v === sym_false) {
        return false
    }
    if (v[u8TextSymbol]) {
        return new TextDecoder().decode(v[u8TextSymbol])
    }
    if (v[u8Symbol]) {
        return v[u8Symbol]
    }
    return v
}
export const setNumberToDV = (d: DataView, n: number | bigint) => {
    d.setBigUint64(0, 0n)
    if (typeof n == 'number') {
        d.setUint32(0, n)
    }
    else {
        d.setBigUint64(0, n)
    }
}
export const alignNumber = (n: number | bigint, inSize: number, outSize: number) => {
    if (typeof n == 'number') {
        if (outSize > 32) {
            outSize = 32
        }
        return inSize < outSize ? n << (outSize - inSize) : n
    }
    else {
        const r = BigInt.asUintN(outSize, inSize < outSize ? n << BigInt(outSize - inSize) : n)
        return outSize <= 32 ? Number(r) : r
    }
}
export const isText = (v) => v !== undefined && v[u8TextSymbol] !== undefined
export const isInt = (x): x is number => typeof x == 'number' && Math.floor(x) === x && !isNaN(x) && isFinite(x)
export const isAddable = (x) => typeof refineValues(x) == 'number'
export const refineObject = (ob: UnpackType[], tempDV: DataView, stack: RefineStack): RefineType => {
    if (ob.length == 3) {
        const k = ob[1]
        const v = ob[2]
        if (k === sym_integer_signed && isUnsignedInt(v)) {
            const va = getUnsignedIntVal(v)
            if (typeof va == 'number') {
                const x1 = (1 << (v[bitSizeSymbol] - 1)) >>> 0
                return (va >> v[bitSizeSymbol] - 1) ? (-x1 + (x1 - 1 & va)) : va
            }
            else {
                const x1 = 1n << BigInt(v[bitSizeSymbol] - 1)
                return (va >> BigInt(v[bitSizeSymbol] - 1)) ? (-x1 + (x1 - 1n & va)) : va
            }
        }
        else if (k === sym_registry && isUnsignedInt(v)) {
            return getRegistrySymbol(getUnsignedIntVal(v))
        }
        else if (k === sym_IEEE_754_binary16 && isUnsignedInt(v)) {
            setNumberToDV(tempDV, alignNumber(getUnsignedIntVal(v), v[bitSizeSymbol], 16))
            return tempDV.getFloat16(2)
        }
        else if (k === sym_IEEE_754_binary32 && isUnsignedInt(v)) {
            setNumberToDV(tempDV, alignNumber(getUnsignedIntVal(v), v[bitSizeSymbol], 32))
            return tempDV.getFloat32(0)
        }
        else if (k === sym_IEEE_754_binary64 && isUnsignedInt(v)) {
            setNumberToDV(tempDV, alignNumber(getUnsignedIntVal(v), v[bitSizeSymbol], 64))
            return tempDV.getFloat64(0)
        }
        else if (k === sym_text && Array.isArray(v) && v.every(x => isUnsignedInt2(x) && getUnsignedIntVal(x) < 256)) {
            return new TextDecoder().decode(new Uint8Array([...v.map(x => getUnsignedIntVal(x))]))
        }
        else if (k === sym_text && isUnsignedInt2(v)) {
            return String.fromCodePoint(getUnsignedIntVal(v))
        }
        else if (k === sym_bytes && Array.isArray(v) && v.every(x => isUnsignedInt2(x) && getUnsignedIntVal(x) < 256)) {
            return new Uint8Array([...v.map(x => getUnsignedIntVal(x))])
        }
        else if (k === sym_delta && isAddable(v)) {
            const parent = stack[stack.length - 2]
            if (Array.isArray(parent.val)) {
                const last = parent.val[parent.index - 1]
                const num = typeof last == 'number' ? last : 0
                return num + (refineValues(v) as number)
            }
        }
        else if (k === sym_delta_double && isAddable(v)) {
            const parent = stack[stack.length - 2]
            if (Array.isArray(parent.val)) {
                const last = parent.val[parent.index - 1]
                if (typeof last == 'number') {
                    const last2 = parent.val[parent.index - 2]
                    const num2 = typeof last2 == 'number' ? last2 : 0
                    const delta = last - num2
                    return last + delta + (refineValues(v) as number)
                }
                else {
                    return refineValues(v)
                }
            }
        }
        else if (k === sym_epoch_seconds_continuous) {
            const val = typeof v == 'number' || typeof v == 'bigint' ? v : refineValues(v)
            if (typeof val == 'number') {
                const tai = val + tai_dbuf_epochOffsetSeconds
                return new Date((tai - getLeapSecondsFromTAI(tai)) * 1000)
            }
        }
        else if (k === sym_instant && isUnrefinedMap(v)) {
            const r_year = getValueFromUnrefinedMap(v, sym_year)
            const r_month = getValueFromUnrefinedMap(v, sym_month)
            const r_day = getValueFromUnrefinedMap(v, sym_day)
            const r_hour = getValueFromUnrefinedMap(v, sym_hour)
            const r_minute = getValueFromUnrefinedMap(v, sym_minute)
            const r_second = getValueFromUnrefinedMap(v, sym_second)
            if (isUnsignedInt2(r_year)
                && (r_month === undefined || isUnsignedInt2(r_month))
                && (r_day === undefined || isUnsignedInt2(r_day))
                && (r_hour === undefined || isUnsignedInt2(r_hour))
                && (r_minute === undefined || isUnsignedInt2(r_minute))
                && (r_second === undefined || isUnsignedInt2(r_second))
            ) {
                const year = getUnsignedIntVal(r_year)
                const month = isUnsignedInt2(r_month) ? getUnsignedIntVal(r_month) : 0
                const day = isUnsignedInt2(r_day) ? getUnsignedIntVal(r_day) : 0
                const hour = isUnsignedInt2(r_hour) ? getUnsignedIntVal(r_hour) : 0
                const minute = isUnsignedInt2(r_minute) ? getUnsignedIntVal(r_minute) : 0
                const second = isUnsignedInt2(r_second) ? getUnsignedIntVal(r_second) : 0
                return new Date(year + 2018, month, day + 1, hour, minute, second)
            }
        }
    }
    else {
        const r_value = getValueFromUnrefinedMap(ob, sym_value)
        if (r_value !== undefined) {
            const r_sign = getValueFromUnrefinedMap(ob, sym_sign)
            const hasSign = r_sign !== undefined ? 2 : 0
            const signFlag = hasSign ? refineValues(r_sign) ? true : false : false
            if (hasSign && ob.length == 5) {
                if (isUnsignedInt(r_value)) {
                    return signFlag ? -r_value[valSymbol] : r_value[valSymbol]
                }
            }
            const r_exp2 = getValueFromUnrefinedMap(ob, sym_exponent_base2)
            if (r_exp2 !== undefined) {
                const ex = refineValues(r_exp2)
                if (isInt(ex) && ex < 1024 && ex > -1023 && isUnsignedInt(r_value) && r_value[bitSizeSymbol] < 53 && ob.length == 5 + hasSign) {
                    let n = (signFlag ? 1n : 0n) << 11n
                    n = (n | BigInt(ex + 1023)) << 52n
                    n = n | (BigInt(r_value[valSymbol]) << BigInt(52 - r_value[bitSizeSymbol]))
                    tempDV.setBigUint64(0, n)
                    return tempDV.getFloat64(0)
                }
                else {
                    return assembleMap(ob)
                }
            }
            const r_exp10 = getValueFromUnrefinedMap(ob, sym_exponent_base10)
            if (r_exp10 !== undefined) {
                const ex = refineValues(r_exp10)
                if (isInt(ex) && ex < 10 && ex > -10 && isUnsignedInt(r_value) && r_value[bitSizeSymbol] < 53 && ob.length == 5 + hasSign) {
                    return Number(r_value[valSymbol]) * (10 ** ex) * (signFlag ? -1 : 1)
                }
                else {
                    return assembleMap(ob)
                }
            }
            const r_offset_add = getValueFromUnrefinedMap(ob, sym_offset_add)
            if (r_offset_add !== undefined) {
                if (ob.length == 5 && isAddable(r_offset_add) && isAddable(r_value)) {
                    return (refineValues(r_offset_add) as number) + (refineValues(r_value) as number)
                }
                else {
                    return assembleMap(ob)
                }
            }
            const r_prefixDelta = getValueFromUnrefinedMap(ob, getRegistrySymbol(r.prefix_delta))
            if (r_prefixDelta !== undefined && isText(r_value) && isUnsignedInt(r_prefixDelta) && ob.length == 5) {
                const parent = stack[stack.length - 2]
                if (Array.isArray(parent.val)) {
                    const last = parent.val[parent.index - 1]
                    const s = typeof last == 'string' ? last : ''
                    const sb = new TextEncoder().encode(s)
                    return new TextDecoder().decode(concatBuffers([sb.slice(0, sb.byteLength - (refineVal(r_prefixDelta) as number)), r_value[u8TextSymbol]]))
                }
                return assembleMap(ob)
            }
            const r_prefix = getValueFromUnrefinedMap(ob, getRegistrySymbol(r.prefix))
            const r_suffix = getValueFromUnrefinedMap(ob, getRegistrySymbol(r.suffix))
            if ((r_prefix !== undefined || r_suffix != undefined) && isText(r_value)) {
                if (ob.length == 5) {
                    if (isText(r_prefix)) {
                        return new TextDecoder().decode(concatBuffers([r_prefix[u8TextSymbol], r_value[u8TextSymbol]]))
                    }
                    if (isText(r_suffix)) {
                        return new TextDecoder().decode(concatBuffers([r_value[u8TextSymbol], r_suffix[u8TextSymbol]]))
                    }
                    return assembleMap(ob)
                }
                else if (ob.length == 7 && isText(r_prefix) && isText(r_suffix)) {
                    return new TextDecoder().decode(concatBuffers([r_prefix[u8TextSymbol], r_value[u8TextSymbol], r_suffix[u8TextSymbol]]))
                }
                else {
                    return assembleMap(ob)
                }
            }

        }
    }
}
export const assembleMap = (v: RefineType[]) => {
    const o: { [key: string | symbol]: RefineType } = {}
    const l = Math.floor((v.length - 1) / 2)
    for (let i = 1; i <= l; i++) {
        let pi = v[i]
        let k: string | symbol
        switch (typeof pi) {
            case 'symbol':
            case 'string':
                k = pi
                break
            case 'number':
            case 'bigint':
                k = 'n_' + pi
                break
            case 'boolean':
                k = 'b_' + pi
                break
            case 'object':
                k = 'x_' + i
                break
            default:
                throw 'key type not implemented'
        }
        const pv = v[i + l]
        if (k !== sym_nonexistent && pv !== sym_nonexistent) {
            const ok = o[k]
            if (o[k] === undefined) {
                o[k] = pv
            }
            else if (Array.isArray(ok)) {
                ok.push(pv)
            }
            else {
                o[k] = [o[k], pv]
            }
        }
    }
    return o
}
export type RefineType<T extends ArrayBufferLike = ArrayBufferLike> = number | bigint | symbol | string | boolean | Date | Uint8Array<T> | RefineType<T>[] | RefineObjectType<T>
export type RefineObjectType<T extends ArrayBufferLike = ArrayBufferLike> = { [key: string | symbol]: RefineType<T> }
export type RefineStack = { val: UnpackType, index: number }[]
export const refineValues = <T extends ArrayBufferLike = ArrayBufferLike>(v: UnpackType<T>) => {
    const stack: RefineStack = [{ val: v, index: 0 }]
    const tempDV = new DataView(new ArrayBuffer(8))
    let last
    while (stack.length) {
        const top = stack[stack.length - 1]
        if (isUnrefinedMap(top.val)) {
            const x = top.index == 0 ? refineObject(top.val, tempDV, stack) : undefined
            if (x === undefined) {
                if (last !== undefined) {
                    top.val[top.index] = last
                    top.index++
                    last = undefined
                }
                if (top.index == top.val.length) {
                    last = assembleMap(top.val)
                    stack.pop()
                }
                else {
                    if (top.val[top.index] === sym_nonexistent) {
                        top.index++
                    }
                    else {
                        stack.push({ val: top.val[top.index], index: 0 })
                    }
                }
            }
            else {
                stack.pop()
                last = x
            }
        }
        else if (Array.isArray(top.val)) {
            if (last !== undefined) {
                top.val[top.index] = last
                top.index++
                last = undefined
            }
            if (top.index == top.val.length) {
                last = stack.pop().val
            }
            else {
                if (top.val[top.index] === sym_nonexistent) {
                    delete top.val[top.index]
                    top.index++
                }
                else {
                    stack.push({ val: top.val[top.index], index: 0 })
                }
            }
        }
        else {
            last = refineVal(stack.pop().val)
        }
    }
    return last as RefineType<T>
}