import { s } from './lib/m1.js'
import * as w from './lib/m1.js'

import.meta.server.addEventListener('update', (ev) => {
    //console.log(ev.data)
    // for (let k in ev.data.updates) {
    //     if (ev.data.updates[k].error) {
    //         console.log('update error', k, ev.data.updates[k].error)
    //         return
    //     }
    //     //window.fetch(ev.data.baseReload + '233/' + k.slice(ev.data.base.length))
    // }
    // //console.log(window.location.reload)
    // location.reload()
})

console.log('configurable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.configurable))
console.log('not configurable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => !x.d.configurable))
console.log('enum', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.enumerable))
console.log('not enum', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => !x.d.enumerable))
console.log('writeable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => x.d.writable || x.d.set))
console.log('not writeable', Object.getOwnPropertyNames(window).map(x => { return { x, d: Object.getOwnPropertyDescriptor(window, x) } }).filter(x => !x.d.writable && !x.d.set))

document.body.textContent = 'hey123' + w.s + import.meta.url
