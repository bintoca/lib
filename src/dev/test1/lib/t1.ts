const { tes, expec } = (function () {
    const list: { n: string, f: Function, a?: any[] }[] = []
    globalThis.bintocaTest = new Promise((resolve, reject) => {
        queueMicrotask(async () => {
            const bad = []
            const good = []
            for (let x of list) {
                let count = 1
                for (let t of x.a) {
                    if (!Array.isArray(t)) {
                        t = [t]
                    }
                    const n = x.n + ((x.a.length > 1) ? (t[0].toString() || count) : '')
                    try {
                        await x.f(...t)
                        good.push({ name: n })
                    }
                    catch (e) {
                        bad.push({ name: n, message: e.message, stack: e.stack })
                    }
                    count++
                }
            }
            resolve({ good, bad })
        })
    })
    const test = (n: string, f: Function, a?: any[]) => {
        list.push({ n, f, a: a || [[]] })
    }
    const expect = (v) => {
        return {
            toBe: (a) => {
                if (v !== a) {
                    throw new Error(v + ' !== ' + a)
                }
            },
            toThrow: async (a?: string) => {
                let er
                try {
                    await v()
                }
                catch (e) {
                    er = true
                    if (a && e.message !== a) {
                        throw new Error('Throw message ' + e.message + ' did not equal ' + a)
                    }
                }
                if (!er) {
                    throw new Error('function did not throw')
                }
            }
        }
    }
    return { tes: test, expec: expect }
})()
delete window.Proxy
delete window.Reflect
delete window.Set
delete window.WeakMap
delete window.Object.create
tes('eval', () => {
    expec(() => setInterval('')).toThrow()
    expec(() => setTimeout('')).toThrow()
    expec(() => new Function('')).toThrow()
    expec(() => Function('')).toThrow()
    expec(typeof eval).toBe('undefined')
    expec(() => Proxy.prototype = 5).toThrow()
})
tes('location', () => {
    expec(() => (location as any) = 'a').toThrow('Assignment to constant variable.')
    expec(() => location.href = 'a').toThrow()
    expec(location.href).toBe(undefined)
})
tes('window', async () => {
    await new Promise((resolve, reject) => {
        window.addEventListener('foo', (ev: Event) => {
            try {
                expec(ev.target).toBe(window)
                expec(ev.target['location'].href).toBe(undefined)
                resolve(null)
            }
            catch (e) {
                reject(e)
            }
        })
        window.dispatchEvent(new Event('foo'))
    })
    window['foo'] = 5
    expec(typeof Object.getOwnPropertyNames(window)).toBe('object')
    expec(typeof Object.getOwnPropertyDescriptor(window, 'foo')).toBe('object')
    expec(window['foo']).toBe(5)
    expec(window.top).toBe(undefined)
    expec(self).toBe(window)
    expec(self.location.href).toBe(undefined)
    expec(globalThis).toBe(window)
    expec(globalThis.location.href).toBe(undefined)
})
tes('document', async () => {
    expec(() => document.cookie).toThrow()
    expec(() => document.cookie = 'a').toThrow()
    expec(() => document.title).toThrow()
    expec(() => document.title = 'a').toThrow()
    expec(() => document.defaultView).toThrow()
    expec(() => document.domain).toThrow()
    expec(() => document.domain = 'a').toThrow()
    expec(() => document.location).toThrow()
    expec(() => document.location = 'a').toThrow()
    expec(() => document.referrer).toThrow()
    expec(() => document.URL).toThrow()
    await new Promise((resolve, reject) => {
        document.addEventListener('foo', (ev: Event) => {
            try {
                expec(ev.target).toBe(document)
                expec(() => ev.target['location']).toThrow()
                resolve(null)
            }
            catch (e) {
                reject(e)
            }
        })
        document.dispatchEvent(new Event('foo'))
    })
    await new Promise((resolve, reject) => {
        const div = document.createElement('div')
        div.textContent = 'te'
        document.body.appendChild(div)
        const div2 = document.createElement('div')
        div2.textContent = 't2'
        div2['style' + ''] = 'border:solid 1px black'
        div2.style.backgroundColor = 'green'
        div2.className = 'c1'
        div2.textContent = div2.textContent + div2.className
        document.body.insertBefore(div2, div)
        const lis = (ev) => {
            expec(ev.view).toBe(undefined)
            expec(ev.target['textContent']).toBe('te')
            expec(div2.textContent).toBe('t2c1')
            div.removeEventListener('click', lis)
            div.remove()
            resolve(null)
        }
        div.addEventListener('click', lis)
        div.click()
    })
    const div = document.createElement('div')
    expec(() => div['style' + ''] = 'url()').toThrow()
    expec(() => div.style.backgroundImage = 'url()').toThrow()
    expec(() => div.style.setProperty('border', 'url()')).toThrow()
    const link = document.createElement('link')
    link.href = 'lib/m.css'
    link.rel = 'stylesheet'
    document.body.appendChild(link)
    expec(() => link.href = './m.cs').toThrow()
    expec(() => link.href = '../m.css').toThrow()
    expec(() => link.href = 'http://localhost/x.css').toThrow()
    expec(() => link.rel = 'a').toThrow()
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.id = 'chid'
    checkbox.name = 'chname'
    document.body.appendChild(checkbox)
    const fil = document.createElement('input')
    fil.type = 'file'
    fil.files
    document.body.appendChild(fil)
    const intext = document.createElement('input')
    intext.type = 'text'
    intext.value = 'v'
    document.body.appendChild(intext)
    const tarea = document.createElement('textarea')
    tarea.value = 'v'
    document.body.appendChild(tarea)
    const select = document.createElement('select')
    const option = document.createElement('option')
    option.value = 'vf'
    option.textContent = 'foo'
    select.appendChild(option)
    document.body.appendChild(select)
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    ctx.fillRect(20, 30, 40, 50)
    ctx.textAlign = 'center'
    document.body.appendChild(canvas)
    expec(() => ctx.canvas).toThrow()
})
tes('createElement_error_', (tag) => {
    expec(() => document.createElement(tag)).toThrow()
}, ['a', 'applet', 'base', 'body', 'embed', 'form', 'frame', 'head', 'html', 'iframe', 'meta', 'object', 'script', 'style', 'title'])
tes('fetch', async () => {
    expec(() => fetch('../')).toThrow()
})
tes('wasm', async () => {
    const r = await fetch('lib/leb128.wasm')
    const b = await r.arrayBuffer()
    const m = await WebAssembly.compile(b)
    const mm = new WebAssembly.Module(b)
    WebAssembly.Module.imports(m)
    WebAssembly.Module.exports(m)
    WebAssembly.Module.customSections(m, '')
    const mem = new WebAssembly.Memory({ initial: 1 })
    const i = await WebAssembly.instantiate(b, { memory: { "": mem }, console: { logi32: () => { } } })
    const im = await WebAssembly.instantiate(m, { memory: { "": mem }, console: { logi32: () => { } } })
    const ms = await WebAssembly.compileStreaming(await fetch('lib/leb128.wasm'))
    const is = await WebAssembly.instantiateStreaming(await fetch('lib/leb128.wasm'), { memory: { "": mem }, console: { logi32: () => { } } })

    const buf = new Uint8Array('00,61,73,6d,01,00,00,00,00,15,10,73,6f,75,72,63,65,4d,61,70,70,69,6e,67,55,52,4c,04,61,3a,2f,2f'.split(',').map(x => parseInt(x, 16)))
    expec(() => WebAssembly.compile(buf)).toThrow('invalid sourceMappingURL "a://"')
    expec(() => WebAssembly.instantiate(buf)).toThrow('invalid sourceMappingURL "a://"')
    expec(async () => await WebAssembly.compileStreaming(new Response(buf))).toThrow('invalid sourceMappingURL "a://"')
    expec(async () => await WebAssembly.instantiateStreaming(new Response(buf), { memory: { "": mem }, console: { logi32: () => { } } })).toThrow('invalid sourceMappingURL "a://"')
})
