import primordials from '@bintoca/package/primordial'
const { Set, ObjectCreate } = primordials
const fetchFunc = fetch

export const freeGlobals = ['Array', 'ArrayBuffer', 'addEventListener', 'atob', 'BigInt', 'Blob', 'btoa', 'CryptoKey', 'clearInterval', 'clearTimeout', 'console', 'constructor', 'crypto', 'DataView', 'Date',
    'decodeURIComponent', 'dispatchEvent', 'encodeURIComponent', 'Error', 'Function', 'Infinity', 'isFinite', 'isNaN', 'JSON',
    'Map', 'Math', 'MessageChannel', 'NaN', 'Number', 'Object', 'parseFloat', 'parseInt', 'performance', 'Promise', 'Proxy', 'ReadableStream', 'ReadableStreamBYOBReader', 'Reflect', 'RegExp', 'removeEventListener',
    'Set', 'String', 'Symbol', 'SyntaxError', 'setInterval', 'setTimeout',
    'TextDecoder', 'TextEncoder', 'TypeError', 'Uint16Array', 'Uint8Array', 'URL', 'undefined', 'WebAssembly', 'WeakMap', 'WeakSet', 'WritableStream', Symbol.toStringTag]
const freeSet = new Set(freeGlobals)
const gt = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : null
gt.Function = new Proxy(Function, {
    apply() { throw new Error('not implemented') },
    construct() { throw new Error('not implemented') },
})
gt.setInterval = function (h, t, ...a) {
    if (typeof h !== 'function') {
        throw new TypeError('first argument is not a function')
    }
    return setInterval(h, t, ...a)
} as any
gt.setTimeout = function (h, t, ...a) {
    if (typeof h !== 'function') {
        throw new TypeError('first argument is not a function')
    }
    return setTimeout(h, t, ...a)
} as any

export const internalNativeObj = Symbol('internalNativeObj')
export const internalListeners = Symbol('internalListeners')

export const eventProxy = (ev, tar) => {
    return new Proxy(ev, {
        get(target, property, receiver) {
            switch (property) {
                case internalNativeObj:
                    return target
                case 'target':
                    return tar
            }
        },
        set(target, property, value, receiver) { return false }
    })
}
export const eventTargetProps = (target, property, receiver) => {
    switch (property) {
        case 'addEventListener':
            return (t, l, op) => {
                const l1 = ev => l(eventProxy(ev, receiver))
                target[internalListeners].set(l, l1)
                target.addEventListener(t, l1, op)
            }
        case 'removeEventListener':
            return (t, l, op) => target.removeEventListener(t, target[internalListeners].get(l), op)
        case 'dispatchEvent':
            return ev => target.dispatchEvent(ev)
    }
    return undefined
}
export const locationProxy = new Proxy(ObjectCreate(null), {
    get(target, property, receiver) {
        if (property == 'reload') {
            return () => { location.reload() }
        }
    },
    set(target, property, value, receiver) { return false },
})
const prohibitedStyle = new Set<string | Symbol>(['parentRule', 'setProperty'])
function styleProxy(sty) {
    return new Proxy(sty, {
        get(target, property, receiver) {
            if (prohibitedStyle.has(property)) {
                throw new Error('"' + property.toString() + '" property disabled in sandbox environment')
            }
            return target[property]
        },
        set(target, property, value, receiver) {
            if (value.indexOf('(') >= 0) {
                value = value.toLowerCase()
                if (value.indexOf('url(') >= 0 || value.indexOf('image(') >= 0 || value.indexOf('image-set(') >= 0) {
                    return false
                }
            }
            target[property] = value
            return true
        }
    })
}
const allowedNodeProps = new Set<string | Symbol>(['remove', 'textContent'])
function nodeProxy(n) {
    n[internalListeners] = new WeakMap()
    return new Proxy(n, {
        get(target, property, receiver) {
            if (allowedNodeProps.has(property)) {
                return target[property]
            }
            const et = eventTargetProps(target, property, receiver)
            if (et) {
                return et
            }
            switch (property) {
                case internalNativeObj:
                    return target
                case 'appendChild':
                    return c => { target.appendChild(c[internalNativeObj]); return c }
                case 'insertBefore':
                    return (n, r) => { target.insertBefore(n, r); return n }
                case 'style':
                    return styleProxy(target.style)
                default:
                    throw new Error('"' + property.toString() + '" property disabled in sandbox environment')
            }
        },
        set(target, property, value, receiver) {
            if (property == 'textContent') {
                target[property] = value
                return true
            }
            return false
        }
    })
}
const prohibitedTags = new Set<string | Symbol>('a,applet,base,body,embed,form,frame,head,html,iframe,link,meta,object,script,style,title'.split(','))
const initDocument = () => {
    document[internalListeners] = new WeakMap()
    return new Proxy(document, {
        get(target, property, receiver) {
            const et = eventTargetProps(target, property, receiver)
            if (et) {
                return et
            }
            switch (property) {
                case 'body': {
                    return nodeProxy(document.body)
                }
                case 'createElement':
                    return tag => {
                        if (prohibitedTags.has(tag)) {
                            throw new Error('Unsupported tag "' + tag + '"')
                        }
                        return nodeProxy(target.createElement(tag))
                    }
                case 'createElementNS':
                    return (ns, tag) => {
                        if (prohibitedTags.has(tag)) {
                            throw new Error('Unsupported tag "' + tag + '"')
                        }
                        return nodeProxy(target.createElementNS(ns, tag))
                    }
                default:
                    throw new Error('"' + property.toString() + '" property disabled in sandbox environment')
            }
        },
        set(target, property, value, receiver) { return false }
    })
}
const documentProxy = typeof document === 'undefined' ? undefined : initDocument()
gt[internalListeners] = new WeakMap()
const selfProxy = new Proxy(gt, {
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
                console.log('get', property)
                return gt[property]
        }
    },
    set(target, property, value, receiver) {
        if (nonConfigurable.has(property)) {
            return false
        }
        console.log('set', property)
        gt[property] = value
        return true
    },
    ownKeys(target) {
        return Reflect.ownKeys(gt)
    },
    getOwnPropertyDescriptor(target, p) {
        return Reflect.getOwnPropertyDescriptor(gt, p)
    }
})
gt.self = selfProxy as Window & typeof globalThis
gt['global' + 'This'] = selfProxy
const configURL = gt['configURL']
let ob = gt
const nonConfigurable = new Set<string | symbol>()
while (ob && ob !== Object.prototype) {
    const ds = Object.getOwnPropertyDescriptors(ob)
    for (let k of (Object.getOwnPropertyNames(ds) as any[]).concat(Object.getOwnPropertySymbols(ds))) {
        if (!freeSet.has(k)) {
            if (ds[k].configurable) {
                //console.log('delete', k)
                delete ob[k]
            }
            else {
                nonConfigurable.add(k)
            }
        }
    }
    ob = Object.getPrototypeOf(ob)
}
fetchFunc(configURL, { method: 'POST', body: JSON.stringify({ nonConfigurable: Array.from(nonConfigurable) }) }).then(x => x.json()).then(x => {
    if (typeof document !== 'undefined') {
        const s = document.createElement('script')
        s.type = 'module'
        s.src = x.src
        document.head.appendChild(s)
    }
})
export default selfProxy