import { internalListeners, eventTargetProps } from './Event.js'

self[internalListeners] = new WeakMap()
const allowedSelfProps = new Set<string | Symbol>('innerHeight,innerWidth,outerHeight,outerWidth'.split(','))
const selfProxy = new Proxy(self, {
    get(target, property, receiver) {
        if (allowedSelfProps.has(property)) {
            return target[property]
        }
        const et = eventTargetProps(target, property, receiver)
        if (et) {
            return et
        }
    },
    set(target, property, value, receiver) {
        return false
    }
})
export default selfProxy