const fr = typeof Function === 'undefined' ? undefined : new Proxy(Function, {
    apply() { throw new Error('not implemented') },
    construct() { throw new Error('not implemented') },
})
export default fr