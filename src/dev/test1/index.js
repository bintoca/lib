import { s } from './lib/m1.js'
import * as w from './lib/m1.js'

window.onload = () => {
    //console.log(w)
    document.body.textContent = 'hey12345' + w.t.st + import.meta.url
}
import.meta.server.addEventListener('update', (ev) => {
    //console.log(ev.data)
    for (let k in ev.data.updates) {
        //window.fetch(ev.data.baseReload + '233/' + k.slice(ev.data.base.length))
    }
    window.location.reload()
})