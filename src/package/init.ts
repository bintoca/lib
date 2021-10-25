import { primordials, isRelativeInvalid, parseWasm } from '@bintoca/package/primordial'
const { _Set, ObjectCreate, _Error, _Proxy, _Reflect, _WeakMap, StringEndsWith, _WebAssembly } = primordials
const _fetch = fetch
const freeGlobals = ['Array', 'ArrayBuffer', 'addEventListener', 'atob', 'BigInt', 'Blob', 'btoa', 'CryptoKey', 'clearInterval', 'clearTimeout', 'console', 'constructor', 'crypto', 'DataView', 'Date',
    'decodeURIComponent', 'dispatchEvent', 'encodeURIComponent', 'Error', 'Event', 'Function', 'fetch', 'globalThis', 'Infinity', 'isFinite', 'isNaN', 'JSON',
    'Map', 'Math', 'MessageChannel', 'NaN', 'Number', 'Object', 'parseFloat', 'parseInt', 'performance', 'Promise', 'Proxy', 'queueMicrotask', 'ReadableStream', 'ReadableStreamBYOBReader', 'Reflect', 'RegExp', 'Response', 'removeEventListener',
    'Set', 'String', 'Symbol', 'SyntaxError', 'self', 'setInterval', 'setTimeout',
    'TextDecoder', 'TextEncoder', 'TypeError', 'Uint16Array', 'Uint8Array', 'URL', 'undefined', 'WeakMap', 'WeakSet', 'WebAssembly', 'WritableStream', Symbol.toStringTag]
const freeSet = new _Set(freeGlobals)
const gt = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : null
gt.Function = new _Proxy(Function, {
    apply() { throw new _Error('not implemented') },
    construct() { throw new _Error('not implemented') },
})
const _setInterval = setInterval
gt.setInterval = function (h, t, ...a) {
    if (typeof h !== 'function') {
        throw new _Error('first argument is not a function')
    }
    return _setInterval(h, t, ...a)
} as any
const _setTimeout = setTimeout
gt.setTimeout = function (h, t, ...a) {
    if (typeof h !== 'function') {
        throw new _Error('first argument is not a function')
    }
    return _setTimeout(h, t, ...a)
} as any
gt.fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    if (isRelativeInvalid('root', typeof input == 'string' ? input : input.url)) {
        throw new _Error('invalid url ' + input)
    }
    return _fetch(input, init)
}
gt.WebAssembly.Module = function (b: BufferSource): WebAssembly.Module {
    const p = parseWasm('root', b)
    return new _WebAssembly.Module(b)
} as any
gt.WebAssembly.Module.customSections = _WebAssembly.Module.customSections
gt.WebAssembly.Module.exports = _WebAssembly.Module.exports
gt.WebAssembly.Module.imports = _WebAssembly.Module.imports
gt.WebAssembly.compile = (b: BufferSource): Promise<WebAssembly.Module> => {
    const p = parseWasm('root', b)
    return _WebAssembly.compile(b)
}
gt.WebAssembly.instantiate = function (b: BufferSource | WebAssembly.Module, imports): Promise<WebAssembly.WebAssemblyInstantiatedSource | WebAssembly.Instance> {
    if ('byteLength' in b) {
        parseWasm('root', b)
    }
    return _WebAssembly.instantiate(b, imports)
} as any
gt.WebAssembly.compileStreaming = async (b: Response | Promise<Response>): Promise<WebAssembly.Module> => {
    const a = await ('then' in b ? (await b).arrayBuffer() : b.arrayBuffer())
    const p = parseWasm('root', a)
    return _WebAssembly.compile(a)
}
gt.WebAssembly.instantiateStreaming = async (b: Response | Promise<Response>, imports): Promise<WebAssembly.WebAssemblyInstantiatedSource> => {
    const a = await ('then' in b ? (await b).arrayBuffer() : b.arrayBuffer())
    const p = parseWasm('root', a)
    return _WebAssembly.instantiate(a, imports)
}
const listenerMap = new _WeakMap()
const targetMap = new _WeakMap()
const eventProxy = (ev, tar) => {
    const p = new _Proxy(ev, {
        get(target, property, receiver) {
            switch (property) {
                case 'target':
                    return tar
            }
        },
        set(target, property, value, receiver) { return false }
    })
    return p
}
const eventTargetProps = (target, property, receiver) => {
    switch (property) {
        case 'addEventListener':
            return (t, l, op) => {
                const l1 = ev => l(eventProxy(ev, receiver))
                if (!listenerMap.has(target)) {
                    listenerMap.set(target, new _WeakMap())
                }
                listenerMap.get(target).set(l, l1)
                target.addEventListener(t, l1, op)
            }
        case 'removeEventListener':
            if (!listenerMap.has(target)) {
                listenerMap.set(target, new _WeakMap())
            }
            return (t, l, op) => target.removeEventListener(t, listenerMap.get(target).get(l), op)
        case 'dispatchEvent':
            return ev => target.dispatchEvent(ev)
    }
    return undefined
}
const locationProxy = new _Proxy(ObjectCreate(null), {
    get(target, property, receiver) {
        if (property == 'reload') {
            return () => { location.reload() }
        }
    },
    set(target, property, value, receiver) { return false },
})
function styleProxy(sty) {
    return new _Proxy(sty, {
        get(target, property, receiver) {
            switch (property) {
                case 'setProperty': {
                    return (prop, value, priority) => {
                        if (value.includes('@') || value.includes('(')) {
                            throw new _Error('invalid css value')
                        }
                        target.setProperty(prop, value, priority)
                    }
                }
            }
            return target[property]
        },
        set(target, property, value, receiver) {
            if (value.includes('@') || value.includes('(')) {
                return false
            }
            target[property] = value
            return true
        }
    })
}
const allowedNodeProps = new _Set<string | Symbol>(['remove', 'textContent', 'id', 'name', 'click', 'className', 'value', 'type', 'files', 'checked', 'width', 'height'])
function nodeProxy(n) {
    const p = new _Proxy(n, {
        get(target, property, receiver) {
            if (property == 'getContext') {
                return (...x) => {
                    const ct = target.getContext(...x)
                    return new _Proxy(ct, {
                        get(target, prop, rec) {
                            if (prop == 'canvas') {
                                throw new _Error('illegal property')
                            }
                            if (typeof target[prop] == 'function') {
                                return (...x) => target[prop](...x)
                            }
                            return target[prop]
                        },
                        set(target, prop, val, rec) {
                            target[prop] = val
                            return true
                        }
                    })
                }
            }
            if (allowedNodeProps.has(property)) {
                if (typeof target[property] == 'function') {
                    return (...x) => target[property](...x)
                }
                return target[property]
            }
            const et = eventTargetProps(target, property, receiver)
            if (et) {
                return et
            }
            switch (property) {
                case 'appendChild':
                    return c => { target.appendChild(targetMap.get(c)); return c }
                case 'insertBefore':
                    return (n, r) => { target.insertBefore(targetMap.get(n), r ? targetMap.get(r) : r); return n }
                case 'style':
                    return styleProxy(target.style)
                default:
                    throw new _Error('"' + property.toString() + '" property disabled in sandbox environment')
            }
        },
        set(target, property, value, receiver) {
            if (property == 'style') {
                if (value.includes('@') || value.includes('(')) {
                    return false
                }
                target[property] = value
                return true
            }
            if (allowedNodeProps.has(property)) {
                target[property] = value
                return true
            }
            return false
        }
    })
    targetMap.set(p, n)
    return p
}
const allowedTags = new _Set<string | Symbol>(['div', 'span', 'link', 'input', 'textarea', 'select', 'option', 'canvas'])
const documentProxy = typeof gt.document === 'undefined' ? undefined : new _Proxy(gt.document, {
    get(target, property, receiver) {
        const et = eventTargetProps(target, property, receiver)
        if (et) {
            return et
        }
        switch (property) {
            case 'body': {
                return nodeProxy(gt.document.body)
            }
            case 'createElement':
                return tag => {
                    if (!allowedTags.has(tag)) {
                        throw new _Error('Unsupported tag "' + tag + '"')
                    }
                    if (tag == 'link') {
                        const n = target.createElement(tag)
                        const p = new _Proxy(n, {
                            get() { return undefined },
                            set(target, prop, val, rec) {
                                if ((prop == 'rel' && val == 'stylesheet') ||
                                    (prop == 'href' && StringEndsWith(val, '.css') && !isRelativeInvalid('root', val))) {
                                    target[prop] = val
                                    return true
                                }
                                return false
                            }
                        })
                        targetMap.set(p, n)
                        return p
                    }
                    return nodeProxy(target.createElement(tag))
                }
            // case 'createElementNS':
            //     return (ns, tag) => {
            //         if (prohibitedTags.has(tag)) {
            //             throw new _Error('Unsupported tag "' + tag + '"')
            //         }
            //         return nodeProxy(target.createElementNS(ns, tag))
            //     }//TODO svg
            default:
                throw new _Error('"' + property.toString() + '" property disabled in sandbox environment')
        }
    },
    set(target, property, value, receiver) { return false }
})
const selfProxy = new _Proxy(gt, {
    get(target, property, receiver) {
        const et = eventTargetProps(gt, property, receiver)
        if (et) {
            return et
        }
        switch (property) {
            case 'document':
                return documentProxy
            case 'window':
                return selfProxy
            case 'location':
                return locationProxy
            default:
                if (nonConfigurable.has(property)) {
                    return undefined
                }
                return gt[property]
        }
    },
    set(target, property, value, receiver) {
        if (nonConfigurable.has(property)) {
            return false
        }
        gt[property] = value
        return true
    },
    ownKeys(target) {
        return _Reflect.ownKeys(gt)
    },
    getOwnPropertyDescriptor(target, p) {
        return _Reflect.getOwnPropertyDescriptor(gt, p)
    }
})
gt.self = selfProxy as Window & typeof globalThis
gt['global' + 'This'] = selfProxy
const configURL = gt['configURL']
let ob = gt
const nonConfigurable = new _Set<string | symbol>()
while (ob && ob !== Object.prototype) {
    const ds = Object.getOwnPropertyDescriptors(ob)
    for (let k of (Object.getOwnPropertyNames(ds) as any[]).concat(Object.getOwnPropertySymbols(ds))) {
        if (!freeSet.has(k)) {
            if (ds[k].configurable) {
                //console.log('delete', isJSDOM, k)
                delete ob[k]
            }
            else {
                nonConfigurable.add(k)
            }
        }
    }
    ob = Object.getPrototypeOf(ob)
}
const fetchPromise = _fetch(configURL, { method: 'POST', body: JSON.stringify({ nonConfigurable: Array.from(nonConfigurable) }) }).then(x => x.json()).then(x => {
    if (typeof gt.document !== 'undefined') {
        const s = gt.document.createElement('script')
        s.type = 'module'
        s.src = x.src
        gt.document.head.appendChild(s)
    }
})
export default selfProxy
export { freeGlobals, eventProxy, eventTargetProps, documentProxy }