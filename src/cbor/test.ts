import { integerItem, binaryItem, stringItem, numberItem, bigintItem, arrayItem, nullItem, mapItem, tagItem, decodeAdditionalInformation, encodeSync, hasBadSurrogates, undefinedItem, booleanItem, EncoderState, defaultTypeMap, objectItem, setupEncoder } from '@bintoca/cbor/core'
import * as node from '@bintoca/cbor/node'
import wtf8 from 'wtf-8'

class TestAsync { }
defaultTypeMap.set(TestAsync, (a, out: EncoderState) => {
    out.resume = {
        promise: new Promise((resolve, reject) => {
            out.stack.push('asy')
            resolve()
        })
    }
})

test.each([[0, '0,0,0,0,0,0,0,0,0', 1], [23, '23,0,0,0,0,0,0,0,0', 1], [24, '24,24,0,0,0,0,0,0,0', 2], [256, '25,1,0,0,0,0,0,0,0', 3], [2 ** 16, '26,0,1,0,0,0,0,0,0', 5], [2 ** 32, '27,0,0,0,1,0,0,0,0', 9],
[-23, '54,0,0,0,0,0,0,0,0', 1], [-25, '56,24,0,0,0,0,0,0,0', 2], [-257, '57,1,0,0,0,0,0,0,0', 3], [-(2 ** 16 + 1), '58,0,1,0,0,0,0,0,0', 5], [-(2 ** 32 + 1), '59,0,0,0,1,0,0,0,0', 9]])('integerItem(%i)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0 } as EncoderState
    integerItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[0, '0,0,0,0,0,0,0,0,0', 1], [23, '23,0,0,0,0,0,0,0,0', 1], [24, '24,24,0,0,0,0,0,0,0', 2], [256, '25,1,0,0,0,0,0,0,0', 3], [2 ** 16, '26,0,1,0,0,0,0,0,0', 5], [2 ** 32, '27,0,0,0,1,0,0,0,0', 9], [Number.MAX_SAFE_INTEGER + 1, '250,90,0,0,0,0,0,0,0', 5],
[-23, '54,0,0,0,0,0,0,0,0', 1], [-25, '56,24,0,0,0,0,0,0,0', 2], [-257, '57,1,0,0,0,0,0,0,0', 3], [-(2 ** 16 + 1), '58,0,1,0,0,0,0,0,0', 5], [-(2 ** 32 + 1), '59,0,0,0,1,0,0,0,0', 9], [Number.MIN_SAFE_INTEGER - 1, '250,218,0,0,0,0,0,0,0', 5],
[1.5, '249,62,0,0,0,0,0,0,0', 3], [2 ** 16 + 0.5, '250,71,128,0,64,0,0,0,0', 5], [2 ** 32 + 0.5, '251,65,240,0,0,0,8,0,0', 9], [-0, '249,128,0,0,0,0,0,0,0', 3], [NaN, '249,126,0,0,0,0,0,0,0', 3], [Infinity, '249,124,0,0,0,0,0,0,0', 3], [-Infinity, '249,252,0,0,0,0,0,0,0', 3]])('numberItem(%f)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0 } as EncoderState
    numberItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[new Uint8Array([1, 2, 3]), '67,1,2,3,0,0,0,0,0', 4]])('binaryItem(%s)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0 } as EncoderState
    binaryItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([['hello', '101,104,101,108,108,111', ''], ['😊', '100,240,159,152,138', ''], ['😊😊😊', '108,240,159,152,138,240,159,152,138,240', '159,152,138'], ['a\uD800\uD800', '103,97,239,191,189,239,191,189', '']])('stringItem(%s)', (a, e, e2) => {
    const out = { view: new DataView(new ArrayBuffer(10)), length: 0 } as EncoderState
    stringItem(a, out)
    expect(new Uint8Array(out.view.buffer, 0, out.length).toString()).toBe(e)
    if (e2) {
        expect(out.resume.buffer.toString()).toBe(e2)
    } else {
        expect(out.resume).toBeUndefined()
    }
})
test.each([['hello', '101,104,101,108,108,111', ''], ['😊', '100,240,159,152,138', ''], ['😊😊😊', '108,240,159,152,138,240,159,152,138,240', '159,152,138'], ['a\uD800\uD800', '217,1,17', '97,195,173,194,160,194,128,195,173,194,160,194,128']])('stringItemWTF8(%s)', (a, e, e2) => {
    const out = { view: new DataView(new ArrayBuffer(10)), length: 0, useWTF8: wtf8 } as EncoderState
    stringItem(a, out)
    expect(new Uint8Array(out.view.buffer, 0, out.length).toString()).toBe(e)
    if (e2) {
        expect(out.resume.buffer.toString()).toBe(e2)
    } else {
        expect(out.resume).toBeUndefined()
    }
})
test.each([['a\uD800\uD800', '217,1,17', '97,195,173,194,160,194,128,195,173,194,160,194,128']])('multipleResumeItem(%s)', (a, e, e2) => {
    const out = { view: new DataView(new ArrayBuffer(10), 8, 2), length: 0, useWTF8: wtf8 } as EncoderState
    stringItem(a, out)
    expect(out.length).toBe(0)
    expect(out.resume.items).toEqual([{ major: 6, adInfo: 273 }, { major: 2, adInfo: 13 }])
    expect(out.resume.buffer.toString()).toBe(e2)
})
test.each(['\uD800', '\uDC00', '\uD800\uD800', '\uDBFF', '\uDFFF', '\uDFFF\uDFFF', 'a\uD800', 'a\uD800\uD800', 'a\uDC00', '\uD800a', '\uD800\uD800a', '\uDC00a', '\uD800a\uDC00', '\uDC00\uD800'])('hasBadSurrogates(%s)', (a) => {
    expect(hasBadSurrogates(a)).toBeTruthy()
})
test.each(['\uD800\uDC00', '\uDBFF\uDFFF'])('hasBadSurrogatesFalse(%s)', (a) => {
    expect(hasBadSurrogates(a)).toBeFalsy()
})
test.each([[BigInt(1234), '194,66,4,210,0,0,0,0,0,0', 4], [BigInt(-1234), '195,66,4,209,0,0,0,0,0,0', 4]])('bigintItem(%s)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(10)), length: 0 } as EncoderState
    bigintItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test('items', () => {
    const out = { view: new DataView(new ArrayBuffer(18)), length: 0, typeMap: new Map(defaultTypeMap) } as EncoderState
    arrayItem(1, out)
    mapItem(1, out)
    integerItem(1, out)
    tagItem(10, out)
    nullItem(out)
    undefinedItem(out)
    booleanItem(true, out)
    booleanItem(false, out)
    objectItem({}, out)
    objectItem(Object.create(null), out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe('129,161,1,202,246,247,245,244,160,160,0,0,0,0,0,0,0,0')
    expect(out.length).toBe(10)
})
test.each([[[0, 1], 0, 1], [[24, 50], 50, 2], [[25, 1, 0], 256, 3], [[26, 1, 0, 0, 0], 2 ** 24, 5], [[27, 0, 0, 0, 1, 0, 0, 0, 0], 2 ** 32, 9], [[27, 1, 0, 0, 0, 0, 0, 0, 0], BigInt(2) ** BigInt(56), 9]])('decodeAdditionalInformation(%i,%s)', (a, e, p) => {
    const inp = { buffer: new Uint8Array(a), position: 1 }
    const dv = new DataView(inp.buffer.buffer)
    expect(decodeAdditionalInformation(0, a[0], dv, inp)).toBe(e)
    expect(inp.position).toBe(p)
})

const cycle1 = {}
const cycle2 = {}
cycle1['a'] = cycle1
cycle1['b'] = [cycle2, cycle2]

test.each([[{ a: 1, b: [2, 3] }, [new Uint8Array([162, 97, 97, 1, 97, 98, 130, 2, 3])]], [cycle1, [new Uint8Array([216, 28, 162, 97, 97, 216, 29, 0, 97, 98, 130, 216, 28, 160, 216, 29, 1])]],
[[new ArrayBuffer(4092), new ArrayBuffer(8)], [new Uint8Array([130, 89, 15, 252].concat(Array(4092))), new Uint8Array([72].concat(Array(8)))]], //resumeItem
[[new ArrayBuffer(4100)], [new Uint8Array([129, 89, 16, 4].concat(Array(4092))), new Uint8Array(Array(8))]], //resumeBuffer
[[new ArrayBuffer(4100), new ArrayBuffer(4100)], [new Uint8Array([130, 89, 16, 4].concat(Array(4092))), new Uint8Array(Array(8).concat([89, 16, 4].concat(Array(4085)))), new Uint8Array(Array(15))]], //resumeBuffer 2
[[new ArrayBuffer(9000)], [new Uint8Array([129, 89, 35, 40].concat(Array(4092))), new Uint8Array(4096), new Uint8Array(Array(812))]], //resumeBuffer large
])('encodeSync(%#)', (a, e) => {
    const r = encodeSync(a, setupEncoder({ encodeCycles: true }))
    expect(r.length).toBe(e.length)
    expect(r).toEqual(e)
})
test.each([['hello', new TestAsync(), '101,104,101,108,108,111', '99,97,115,121'], ['hello', cycle1, '101,104,101,108,108,111', '216,28,162,97,97,216,29,0,97,98,130,216,28,160,216,29,1']])('nodeStream(%s,%s)', async (a, b, a1, b1) => {
    const r: Uint8Array[] = await new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder({ encodeCycles: true })
        enc.on('data', buf => { bufs.push(buf) })
        enc.on('error', reject)
        enc.on('end', () => resolve(bufs))
        enc.write(a)
        enc.write(b)
        enc.end()
    })
    expect(r.length).toBe(2)
    expect(new Uint8Array(r[0]).toString()).toBe(a1)
    expect(new Uint8Array(r[1]).toString()).toBe(b1)
})
test.each([['hello', new TestAsync(), '101,104,101,108,108,111,99,97,115,121']])('nodeStreamCombine(%s,%s)', async (a, b, e) => {
    const r: Uint8Array[] = await new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder()
        enc.on('data', buf => { bufs.push(buf) })
        enc.on('error', reject)
        enc.on('end', () => resolve(bufs))
        enc.cork()
        enc.write(a)
        enc.write(b)
        enc.uncork()
        enc.end()
    })
    expect(r.length).toBe(1)
    expect(new Uint8Array(r[0]).toString()).toBe(e)
})
test.each([['hello', new TestAsync(), '101,104,101,108,108,111', '99,97,115,121']])('nodeStreamNextTick(%s,%s)', async (a, b, a1, b1) => {
    const r: Uint8Array[] = await new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder()
        enc.on('data', buf => { bufs.push(buf) })
        enc.on('error', reject)
        enc.on('end', () => resolve(bufs))
        process.nextTick(() => {
            enc.write(a)
            enc.write(b)
            enc.end()
        })
    })
    expect(r.length).toBe(2)
    expect(new Uint8Array(r[0]).toString()).toBe(a1)
    expect(new Uint8Array(r[1]).toString()).toBe(b1)
})
test.each([['hello', new TestAsync(), '101,104,101,108,108,111', '99,97,115,121']])('nodeStreamNextTick2(%s,%s)', async (a, b, a1, b1) => {
    const r: Uint8Array[] = await new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder()
        enc.write(a)
        enc.write(b)
        enc.end()
        process.nextTick(() => {
            enc.on('data', buf => { bufs.push(buf) })
            enc.on('error', reject)
            enc.on('end', () => resolve(bufs))
        })
    })
    expect(r.length).toBe(2)
    expect(new Uint8Array(r[0]).toString()).toBe(a1)
    expect(new Uint8Array(r[1]).toString()).toBe(b1)
})
test.each([[{ f: () => { } }, 'function']])('nodeStreamError(%s)', async (a, b) => {
    const p = new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder()
        enc.on('data', buf => { bufs.push(buf) })
        enc.on('error', reject)
        enc.on('end', () => resolve(bufs))
        enc.write(a)
        enc.end()
    })
    return expect(p).rejects.toMatchObject(new Error('unsupported type ' + b))
})
test.each([[new ArrayBuffer(4100), new Uint8Array([89, 16, 4].concat(Array(4093))), new Uint8Array(7)]])('nodeSplitChunk()', async (a, a1, b1) => {
    const r: Uint8Array[] = await new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder()
        enc.on('data', buf => { bufs.push(buf) })
        enc.on('error', reject)
        enc.on('end', () => resolve(bufs))
        enc.write(a)
        enc.end()
    })
    expect(r.length).toBe(2)
    expect(new Uint8Array(r[0])).toEqual(a1)
    expect(new Uint8Array(r[1])).toEqual(b1)
})
// test.each([[1, -2, 123456n, -123456n, null, undefined, true, false, 'q', 1.4, new Date(1234), new Date(2000), new ArrayBuffer(8)], { a: 1, b: [2.5], c: { a: 3 }, d: 'hey', e: null, f: undefined, g: true, h: false }])('lite(%#)', (a) => {
//     expect(lite.decode(lite.encode(a))).toEqual(a)
//     expect(lite.decode(lite.encode(a))).not.toBe(a)
// })
// test.each([new Uint8Array([1, 2, 3, 4])])('liteView', (a) => {
//     expect(Buffer.from([1, 2]).equals(Buffer.from(lite.decode(lite.encode(a.slice(0, 2)))))).toBe(true)
// })
// test.each([new Map([[1, 2]])])('liteMap', (a) => {
//     expect(lite.decode(lite.encode(a)).get(1)).toBe(2)
// })
// test.each([1, -1, 123456n, -123456n, 1.5, null, undefined, true, false, 'hey'])('litePrimitive(%s)', (a) => {
//     expect(lite.decode(lite.encode(a))).toBe(a)
// })
// test.each([[new Uint8Array([1, 0]), new Error('length mismatch 1 2')], [new Uint8Array([130, 0]), new Error('unfinished depth: 1')]])('liteError(%#)', (a, e) => {
//     expect(() => lite.decode(a)).toThrow(e)
// })

