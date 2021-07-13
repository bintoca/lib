
export function bufEqual(a: BufferSource, b: BufferSource): boolean {
    if (a.byteLength != b.byteLength) {
        return false
    }
    const da = a instanceof ArrayBuffer ? new DataView(a) : new DataView(a.buffer, a.byteOffset, a.byteLength)
    const db = b instanceof ArrayBuffer ? new DataView(b) : new DataView(b.buffer, b.byteOffset, b.byteLength)
    for (let i = 0; i < a.byteLength; i++) {
        if (da.getUint8(i) != db.getUint8(i)) {
            return false
        }
    }
    return true
}
export type primitive = number | string | boolean | null | unknown
const good: string[] = []
const bad: any[] = []
const scope = []
const normalizeScope = t => scope.join('/') + '/' + t
export function pushScope(s: string) { scope.push(s) }
export function popScope() { scope.pop() }
export function checkArray(test: string, actual: string[], expected: (string | number)[]) {
    test = normalizeScope(test)
    if (!actual) {
        actual = []
    }
    if (!expected) {
        expected = []
    }
    if (actual.sort().join() == expected.sort().join()) {
        good.push(test)
    }
    else {
        const missing = expected.filter(x => !actual.some(g => g == x))
        const extra = actual.filter(x => !expected.some(g => g == x))
        bad.push({ test, missing, extra, actual: actual.sort(), expected: expected.sort() })
    }
}
export function eq(test: string, actual: primitive, expected: primitive) {
    test = normalizeScope(test)
    if (actual === expected) {
        good.push(test)
    }
    else {
        bad.push({ test, actual, expected })
    }
}
export function memberEq(test: string, actual: any, expected: any) {
    test = normalizeScope(test)
    let ok
    if (typeof actual == typeof expected) {
        if (typeof actual == 'object' && actual) {
            if (actual.constructor == expected.constructor) {
                if (Array.isArray(actual)) {
                    if (actual.length == expected.length) {
                        ok = actual.every((v,i) => v === expected[i])
                    }
                }
                else {
                    if (Object.keys(actual).join() == Object.keys(expected).join()) {
                        ok = Object.keys(actual).every(x => actual[x] === expected[x])
                    }
                }
            }
        }
        else {
            ok = actual === expected
        }
    }
    if (ok) {
        good.push(test)
    }
    else {
        bad.push({ test, actual, expected })
    }
}
export function bufEq(test: string, actual: ArrayBuffer, expected: ArrayBuffer) {
    test = normalizeScope(test)
    if (bufEqual(actual, expected)) {
        good.push(test)
    }
    else {
        bad.push({ test, actual, expected })
    }
}
export function allTrue(test: string, ...actual: (boolean[])) {
    test = normalizeScope(test)
    const v = actual.every(x => x)
    if (v) {
        good.push(test)
    }
    else {
        bad.push({ test, actual })
    }
}
export function print(goodExpected) {
    if (bad.length == 0) {
        if (goodExpected.sort().join() == good.sort().join()) {
            console.log('good - all tests')
        }
        else {
            const missing = goodExpected.filter(x => !good.some(g => g == x))
            const extra = good.filter(x => !goodExpected.some(g => g == x))
            console.error('bad - good did not match expected', missing, extra)

        }
    }
    else {
        for (let b of bad) {
            console.error('bad', b)
        }

    }
}