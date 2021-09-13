import { internalListeners, internalNativeObj, eventTargetProps } from './Event.js'

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
const init = () => {
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
export default typeof document === 'undefined' ? undefined : init()