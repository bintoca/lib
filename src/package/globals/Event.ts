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
const onSet = (target, property, receiver, value) => { //not sure this works if listener can be removed
    if (typeof property === 'string' && property.startsWith('on')) {
        receiver.addEventListener(property.slice(2), value)
    }
}