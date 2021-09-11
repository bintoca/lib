const internalNativeObj = Symbol('internalNativeObj')
const internalListeners = Symbol('internalListeners')
export const freeGlobals = ['Array', 'ArrayBuffer', 'atob', 'BigInt', 'Blob', 'btoa', 'clearInterval', 'clearTimeout', 'console', 'CryptoKey', 'crypto', 'DataView', 'Date',
    'decodeURIComponent', 'encodeURIComponent', 'Error', 'Infinity', 'isFinite', 'isNaN', 'JSON',
    'Map', 'Math', 'MessageChannel', 'Number', 'Object', 'parseFloat', 'parseInt', 'performance', 'Promise', 'Proxy', 'ReadableStream', 'ReadableStreamBYOBReader', 'Reflect', 'RegExp', 'Set', 'String', 'Symbol', 'SyntaxError',
    'TextDecoder', 'TextEncoder', 'TypeError', 'Uint16Array', 'Uint8Array', 'URL', 'WeakMap', 'WeakSet', 'WritableStream']
function buildSet(...a): Set<string | Symbol> {
    const d = new Set<string>()
    for (let p of a) {
        p.split(',').forEach(x => d.add(x))
    }
    return d
}
function setInterval(h, t, ...a) {
    if (typeof h !== 'function') {
        throw new TypeError('first argument is not a function')
    }
    return self.setInterval(h, t, ...a)
}
function setTimeout(h, t, ...a) {
    if (typeof h !== 'function') {
        throw new TypeError('first argument is not a function')
    }
    return self.setTimeout(h, t, ...a)
}
function eventProxy(ev, tar) {
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
const prohibitedStyle = buildSet('parentRule,setProperty')
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
const allowedNodeProps = buildSet('remove,textContent')
function nodeProxy(n) {
    n[internalListeners] = new WeakMap()
    return new Proxy(n, {
        get(target, property, receiver) {
            if (allowedNodeProps.has(property)) {
                return target[property]
            }
            switch (property) {
                case internalNativeObj:
                    return target
                case 'appendChild':
                    return c => { target.appendChild(c[internalNativeObj]); return c }
                case 'insertBefore':
                    return (n, r) => { target.insertBefore(n, r); return n }
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
const functionProxy = new Proxy(Function, {
    get(target, property, receiver) { return target[property] },
    set(target, property, value, receiver) { return false },
    apply() { throw new Error('not implemented') },
    construct() { throw new Error('not implemented') }
})
const prohibitedTags = buildSet('a,applet,base,body,embed,form,frame,head,html,iframe,link,meta,object,script,style,title')
const gt = (typeof self == 'undefined' ? {} : self) as Window & typeof globalThis
const documentProxy = gt.document ? new Proxy(gt.document, {
    get(target, property, receiver) {
        switch (property) {
            case 'body': {
                return nodeProxy(self.document.body)
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
}) : undefined
gt[internalListeners] = new WeakMap()
const allowedSelfProps = buildSet('innerHeight,innerWidth,outerHeight,outerWidth,WebAssembly', ...freeGlobals)
const selfProxy = new Proxy(gt, {
    get(target, property, receiver) {
        if (allowedSelfProps.has(property)) {
            return target[property]
        }
        switch (property) {
            case 'document': {
                return documentProxy
            }
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
            case 'setTimeout': {
                return setTimeout
            }
            case 'setInterval': {
                return setInterval
            }
            case 'Function': {
                return functionProxy
            }
            default:
                throw new Error('"' + property.toString() + '" property disabled in sandbox environment')
        }
    },
    set(target, property, value, receiver) {
        if (typeof property == 'string' && property.startsWith('on')) {
            target.addEventListener(property.slice(2), value)
            return true
        }
        return false
    }
})
export default selfProxy