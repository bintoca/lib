declare global {
    type Primordials = {
        ObjectCreate: (o: object) => {},
        ObjectGetOwnPropertyNames: (o: object) => string[],
        ObjectHasOwnProperty: (o: object, k: PropertyKey) => boolean,
        JSONParse: (s: string) => any,
        TD: { decode: (b: BufferSource) => string }
        Set: SetConstructor,
        URL: typeof URL
        Error: typeof Error,
        Event: typeof Event,
        EventTarget: typeof EventTarget,
        DataView: typeof DataView,
        WebAssembly: typeof WebAssembly,
        WebSocket: typeof WebSocket,
        StringEndsWith: (s: string, search: string) => boolean,
        StringStartsWith: (s: string, search: string) => boolean,
        StringReplace: (s: string, search: string | RegExp, replace: string) => string,
        StringSlice: (s: string, start?: number, end?: number) => string,
        StringIndexOf: (s: string, search: string, position?: number) => number
        StringLastIndexOf: (s: string, search: string, position?: number) => number
        RegExpTest: (r: RegExp, s: string) => boolean,
        ArrayIsArray: (o) => boolean,
        ArrayFilter: <T>(a: T[], f: Function) => T[],
        ArraySort: <T>(a: T[], f: Function) => T[],
        ArrayPush: <T>(a: T[], ...items: T[]) => number,
        setTimeout: typeof setTimeout
    }
}
const copyProps = (src, dest) => {
    for (let k of Reflect.ownKeys(src)) {
        if (!Reflect.getOwnPropertyDescriptor(dest, k)) {
            Reflect.defineProperty(dest, k, Reflect.getOwnPropertyDescriptor(src, k))
        }
    }
    return dest
}
const copyConstructor = <T extends Function, U extends T>(src: T, dest: U) => {
    copyProps(src.prototype, dest.prototype)
    copyProps(src, dest)
    return dest
}
const callBind = Function.prototype.bind.bind(Function.prototype.call)
const wa = copyProps(WebAssembly, Object.create(null)) as unknown as typeof WebAssembly
wa.Module = copyProps(WebAssembly.Module, Object.create(null)) as unknown as typeof WebAssembly.Module
const TDe = copyConstructor(TextDecoder, class extends TextDecoder { constructor(i?, o?) { super(i, o); } })
export const primordials: Primordials = {
    ObjectCreate: Object.create,
    ObjectGetOwnPropertyNames: Object.getOwnPropertyNames,
    ObjectHasOwnProperty: callBind(Object.prototype.hasOwnProperty),
    JSONParse: JSON.parse,
    TD: new TDe(),
    Set: copyConstructor(Set, class extends Set { constructor(i) { super(i); } }),
    URL: copyConstructor(URL, class extends URL { constructor(i, base) { super(i, base); } }),
    Error: copyConstructor(Error, class extends Error { constructor(message?: string) { super(message); } } as ErrorConstructor),
    Event: typeof Event === 'undefined' ? undefined : copyConstructor(Event, class extends Event { constructor(i, d) { super(i, d); } }),
    EventTarget: typeof EventTarget === 'undefined' ? undefined : copyConstructor(EventTarget, class extends EventTarget { constructor() { super(); } }),
    DataView: copyConstructor(DataView, class extends DataView { constructor(i, o, l) { super(i, o, l); } }),
    WebAssembly: wa,
    WebSocket: typeof WebSocket === 'undefined' ? undefined : copyConstructor(WebSocket, class extends WebSocket { constructor(i, d) { super(i, d); } }),
    StringEndsWith: callBind(String.prototype.endsWith),
    StringStartsWith: callBind(String.prototype.startsWith),
    StringReplace: callBind(String.prototype.replace),
    StringSlice: callBind(String.prototype.slice),
    StringIndexOf: callBind(String.prototype.indexOf),
    StringLastIndexOf: callBind(String.prototype.lastIndexOf),
    RegExpTest: callBind(RegExp.prototype.test),
    ArrayIsArray: Array.isArray,
    ArrayFilter: callBind(Array.prototype.filter),
    ArraySort: callBind(Array.prototype.sort),
    ArrayPush: callBind(Array.prototype.push),
    setTimeout: setTimeout
}
export default primordials
const { ArrayPush, TD } = primordials
export const decodeLEB128_U32 = (dv: DataView, state: { position: number }) => {
    let bytes = 0
    let r = 0
    while (dv.byteLength > state.position && bytes < 5) {
        const b = dv.getUint8(state.position)
        state.position++
        r += (b & 127) * (2 ** (7 * bytes))
        if (b < 128) {
            return r
        }
        bytes++
    }
    return -1
}
export const bufferSourceToDataView = (b: BufferSource, offset: number = 0, length?: number): DataView => {
    if ((b as DataView).buffer) {
        return new primordials.DataView((b as DataView).buffer, (b as DataView).byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
    }
    return new primordials.DataView(b as ArrayBuffer, offset, length !== undefined ? length : b.byteLength - offset)
}
export const parseWasm = (b: BufferSource) => {
    const state = { position: 8 }
    const dv = bufferSourceToDataView(b)
    const importSpecifiers: string[] = []
    const customNames: string[] = []
    const mapURLs: string[] = []
    while (dv.byteLength > state.position) {
        const secId = decodeLEB128_U32(dv, state)
        const secLen = decodeLEB128_U32(dv, state)
        const secStart = state.position
        if (secId == 2) {
            const numImports = decodeLEB128_U32(dv, state)
            for (let i = 0; i < numImports; i++) {
                let modLen = decodeLEB128_U32(dv, state)
                let modStart = state.position
                state.position += modLen
                const fieldLen = decodeLEB128_U32(dv, state)
                const fieldStart = state.position
                state.position += fieldLen
                const kind = decodeLEB128_U32(dv, state)
                const module = TD.decode(bufferSourceToDataView(dv, modStart, modLen))
                ArrayPush(importSpecifiers, module)
                switch (kind) {
                    case 0: {
                        const index = decodeLEB128_U32(dv, state)
                        break;
                    }
                    case 1: {
                        const t = decodeLEB128_U32(dv, state)
                        const flags = decodeLEB128_U32(dv, state)
                        const initial = decodeLEB128_U32(dv, state)
                        const fv = flags ? decodeLEB128_U32(dv, state) : 0
                        break;
                    }
                    case 2: {
                        const flags = decodeLEB128_U32(dv, state)
                        const initial = decodeLEB128_U32(dv, state)
                        const fv = flags ? decodeLEB128_U32(dv, state) : 0
                        break;
                    }
                    case 3: {
                        const t = decodeLEB128_U32(dv, state)
                        const mut = decodeLEB128_U32(dv, state)
                        break;
                    }
                    default:
                        throw new Error('wasm import type not implemented ' + kind)
                }
            }
        }
        else if (secId == 0) {
            const nameLen = decodeLEB128_U32(dv, state)
            const cname = TD.decode(bufferSourceToDataView(dv, state.position, nameLen))
            ArrayPush(customNames, cname)
            state.position += nameLen
            if (cname == 'sourceMappingURL' || cname == 'external_debug_info') {
                const urlLen = decodeLEB128_U32(dv, state)
                const url = TD.decode(bufferSourceToDataView(dv, state.position, urlLen))
                ArrayPush(mapURLs, url)
            }
        }
        state.position = secStart + secLen
    }
    return { importSpecifiers, customNames, mapURLs }
}