import primordials from '@bintoca/package/primordial'
const { JSONParse, Event } = primordials
export const metaServer = typeof EventTarget != 'undefined' ? new EventTarget() : document.createElement("div");
(function () {
    const ws = new WebSocket("ws://" + window.location.host)
    ws.onmessage = (ev) => {
        const d = JSONParse(ev.data);
        if (d.type == "update") {
            const ev = new Event(d.type);
            ev['data'] = d.data;
            metaServer.dispatchEvent(ev)
        }
    }
})()
