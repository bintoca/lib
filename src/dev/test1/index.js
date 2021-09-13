import { s } from './lib/m1.js'
import * as w from './lib/m1.js'

window.addEventListener('load', () => {
    //console.log(w)
    document.body.textContent = 'hey12345' + w.t.st + import.meta.url

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