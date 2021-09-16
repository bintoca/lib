import { s } from './lib/m1.js'
import * as w from './lib/m1.js'

window.addEventListener('load', () => {
    // for (let k in window) {
    //     try {
    //         if (k == 'setTimeout') {
    //             console.warn(k)
    //         }
    //         if (k == 'location') {

    //         }
    //         else {
    //             window[k] = 1
    //             console.log('suc', k)
    //         }
    //     }
    //     catch (e) {
    //         console.error('er', k, e)
    //     }
    // }
    //console.log(w)
    const f = () => { console.log('ff') }
    console.log(Function, Function, Function.call, f instanceof Function, Object.getPrototypeOf(Function), Object.prototype.isPrototypeOf(f), Function.prototype.call('aa', 'as'), Function.prototype.call('aa', 'at'))
    //Function.prototype.call = ()=>{console.log('aa')}
    f.call()
    Array.prototype.map = () => { console.log('mm') }
    [].map()
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

})
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