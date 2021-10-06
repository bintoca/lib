const { tes, expec } = (function () {
    const list = [];
    globalThis.bintocaTest = new Promise((resolve, reject) => {
        queueMicrotask(async () => {
            const bad = [];
            const good = [];
            for (let x of list) {
                for (let t of x.a) {
                    if (!Array.isArray(t)) {
                        t = [t];
                    }
                    try {
                        await x.f(...t);
                        good.push({ name: x.n });
                    }
                    catch (e) {
                        bad.push({ name: x.n, message: e.message, stack: e.stack });
                    }
                }
            }
            resolve({ good, bad });
        });
    });
    const test = (n, f, a) => {
        list.push({ n, f, a: a || [[]] });
    };
    const expect = (v) => {
        return {
            toBe: (a) => {
                if (v !== a) {
                    throw new Error(v + ' !== ' + a);
                }
            },
            toThrow: (a) => {
                let er;
                try {
                    v();
                }
                catch (e) {
                    er = true;
                    if (a && e.message !== a) {
                        throw new Error('Throw message ' + e.message + ' did not equal ' + a);
                    }
                }
                if (!er) {
                    throw new Error('function did not throw');
                }
            }
        };
    };
    return { tes: test, expec: expect };
})();
delete window.Proxy;
delete window.Reflect;
delete window.Set;
delete window.WeakMap;
delete window.Object.create;
tes('eval', () => {
    expec(() => setInterval('')).toThrow();
    expec(() => setTimeout('')).toThrow();
    expec(() => new Function('')).toThrow();
    expec(() => Function('')).toThrow();
    expec(typeof eval).toBe('undefined');
    expec(() => Proxy.prototype = 5).toThrow();
});
tes('location', () => {
    expec(() => location = 'a').toThrow('Assignment to constant variable.');
    expec(() => location.href = 'a').toThrow();
    expec(location.href).toBe(undefined);
});
tes('window', async () => {
    await new Promise((resolve, reject) => {
        window.addEventListener('foo', (ev) => {
            try {
                expec(ev.target).toBe(window);
                expec(ev.target['location'].href).toBe(undefined);
                resolve(null);
            }
            catch (e) {
                reject(e);
            }
        });
        window.dispatchEvent(new Event('foo'));
    });
    window['foo'] = 5;
    expec(typeof Object.getOwnPropertyNames(window)).toBe('object');
    expec(typeof Object.getOwnPropertyDescriptor(window, 'foo')).toBe('object');
    expec(window['foo']).toBe(5);
    expec(typeof top).toBe('undefined');
    expec(window.top).toBe(undefined);
    expec(self).toBe(window);
    expec(self.location.href).toBe(undefined);
    expec(globalThis).toBe(window);
    expec(globalThis.location.href).toBe(undefined);
});
tes('document', () => {
    expec(() => document.title).toThrow();
    expec(() => document.title = 'a').toThrow();
});
