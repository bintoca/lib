export default typeof location === 'undefined' ? undefined : new Proxy({} as Location, {
    get(target, property, receiver) {
        if (property == 'reload') {
            return () => { location.reload() }
        }
    },
    set(target, property, value, receiver) { return false },
})