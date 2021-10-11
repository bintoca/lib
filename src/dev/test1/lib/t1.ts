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
            toThrow: (a?: string) => {
                let er
                try {
                    v()
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
    expec(typeof top).toBe('undefined')
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
        const lis = (ev) => {
            expec(ev.view).toBe(undefined)
            expec(ev.target['textContent']).toBe('te')
            div.removeEventListener('click', lis)
            div.remove()
            resolve(null)
        }
        div.addEventListener('click', lis)
        div.click()
    })
})
tes('createElement_error_', (tag) => {
    expec(() => document.createElement(tag)).toThrow()
}, ['a', 'applet', 'base', 'body', 'embed', 'form', 'frame', 'head', 'html', 'iframe', 'link', 'meta', 'object', 'script', 'style', 'title'])
