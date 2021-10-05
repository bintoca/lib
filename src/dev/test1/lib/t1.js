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
tes('document', () => {
    expec(() => document.title).toThrow();
    expec(() => document.title = 'a').toThrow();
});
