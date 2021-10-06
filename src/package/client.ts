import primordials from '@bintoca/package/primordial'
const { JSONParse, _Event, _EventTarget, _WebSocket, setTimeout } = primordials
export const metaServer = typeof _EventTarget != 'undefined' ? new _EventTarget() : document.createElement("div");
function startWS() {
    const ws = new _WebSocket("ws://" + window.location.host)
    ws.onmessage = (ev) => {
        const d = JSONParse(ev.data);
        if (d.type == "update") {
            const ev = new _Event(d.type);
            ev['data'] = d.data;
            metaServer.dispatchEvent(ev)
            location.reload()
        }
    }
    ws.onclose = (ev) => {
        setTimeout(startWS, 1000)
    }
}
startWS()
