import { s } from './lib/m1.js'
import * as w from './lib/m1.js'

import.meta.server.addEventListener('update', (ev) => {
    //console.log(ev.data)
    for (let k in ev.data.updates) {
        if (ev.data.updates[k].error) {
            console.log('update error', k, ev.data.updates[k].error)
            return
        }
        //window.fetch(ev.data.baseReload + '233/' + k.slice(ev.data.base.length))
    }
    //console.log(window.location.reload)
    location.reload()
})

console.log('configurable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.configurable))
console.log('not configurable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => !x.d.configurable))
console.log('enum', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.enumerable))
console.log('not enum', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => !x.d.enumerable))
console.log('writeable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.writable || x.d.set))
console.log('not writeable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => !x.d.writable && !x.d.set))
console.log('\uD800', JSON.parse('{"a":"\uD800"}'))
//Object.defineProperty(window, 'crypto', {configurable:true,writable:true, enumerable:true})
//self = {}
//console.log('configurable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.configurable), top)
for (let k of []) {
    try {
        if (k == 'eval') {
            console.warn(k)
        }
        if (k == 'location') {

        }
        else {
            window[k] = 1
            console.log('suc', k)
        }
    }
    catch (e) {
        console.error('er', k, e)
    }
}
//indexedDB
URL.prototype.constructor = () => { }
console.log(Object.getOwnPropertyDescriptors(URL.prototype))
Object.defineProperty(URL.prototype, 'href', {
    value: 42,
    writable: false
})

console.log(new URL('http://s.com'), Set.prototype.constructor, Set, Set.prototype)
//const fr = Function('console.log("qasw")')
//fr()
//console.log('sy', Object.getOwnPropertySymbols(document.body), document.body[Object.getOwnPropertySymbols(document.body)[0]])
document.body.textContent = 'hey123456' + w.t.st + import.meta.url
