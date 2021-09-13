export default typeof setTimeout === 'undefined' ? undefined : function (h, t, ...a) {
    if (typeof h !== 'function') {
        throw new TypeError('first argument is not a function')
    }
    return setTimeout(h, t, ...a)
}