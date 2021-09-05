self['metaServer'] = typeof EventTarget != 'undefined' ? new EventTarget() : document.createElement("div");
(function () {
    const ws = new WebSocket( "ws://" + window.location.host)
    ws.onmessage = (ev) => {
        const d = JSON.parse(ev.data);
        if (d.type == "update") {
            const ev = new Event(d.type);
            ev['data'] = d.data;
            self['metaServer'].dispatchEvent(ev)
        }
    }
})()
