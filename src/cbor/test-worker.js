self.onmessage = (ev) =>{
    console.log('worker', ev.data)//, typeof ev.data.zj, ev.data.zj)
    //self.postMessage(ev.data, self.origin)
}
self.onmessageerror = ev => {
    console.log('merr', ev, ev.data)
}