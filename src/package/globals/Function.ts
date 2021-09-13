export default typeof Function === 'undefined' ? undefined : new Proxy(Function, {
    get(target, property, receiver) { return target[property] },
    set(target, property, value, receiver) { return false },
    apply() { throw new Error('not implemented') },
    construct() { throw new Error('not implemented') }
})