export default typeof setInterval === 'undefined' ? undefined : function (h, t, ...a) {
    if (typeof h !== 'function') {
        throw new TypeError('first argument is not a function')
    }
    return setInterval(h, t, ...a)
}