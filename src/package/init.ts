declare global {
    type Primordials = {
        ObjectCreate: (o: object) => {},
        ObjectGetOwnPropertyNames: (o: object) => string[],
        ObjectHasOwnProperty: (o: object, k: PropertyKey) => boolean,
        JSONParse: (s: string) => any,
        TextDecoderDecode: (b: BufferSource) => string
        Set: SetConstructor,
        URL: typeof URL
        Error: ErrorConstructor,
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
        ReflectApply: (target: Function, thisArgument: any, argumentsList: ArrayLike<any>) => any
    }
}
const copyProps = (src, dest) => {
    for (let k of Reflect.ownKeys(src)) {
        if (!Reflect.getOwnPropertyDescriptor(dest, k)) {
            Reflect.defineProperty(dest, k, Reflect.getOwnPropertyDescriptor(src, k))
        }
    }
}
const copyConstructor = <T extends Function, U extends T>(src: T, dest: U) => {
    copyProps(src.prototype, dest.prototype)
    copyProps(src, dest)
    return dest
}
const callBind = Function.prototype.bind.bind(Function.prototype.call)
const pr: Primordials = {
    ObjectCreate: Object.create,
    ObjectGetOwnPropertyNames: Object.getOwnPropertyNames,
    ObjectHasOwnProperty: callBind(Object.prototype.hasOwnProperty),
    JSONParse: JSON.parse,
    TextDecoderDecode: (b) => new TextDecoder().decode(b),
    Set: copyConstructor(Set, class SetCon extends Set { constructor(i) { super(i); } }),
    URL: copyConstructor(URL, class URLCon extends URL { constructor(i, base) { super(i, base); } }),
    Error,
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
    ReflectApply: Reflect.apply
}
//globalThis.Error = null
//console.log('edf', Reflect.getOwnPropertyDescriptor(Array.prototype, 'filter'), Object.getPrototypeOf(JSON.parse('{}')), Object.getPrototypeOf(Object.create(null)))


const gt = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : null
gt['primordials'] = pr
export const url = import.meta.url