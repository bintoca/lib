import {
    integerItem, binaryItem, stringItem, numberItem, bigintItem, arrayItem, mapItem, tagItem, decodeInfo, encodeSync, hasBadSurrogates, encodeItem, EncoderState,
    defaultTypeMap, setupEncoder, setupDecoder, indefiniteBinaryBegin, indefiniteStringBegin, indefiniteArrayBegin, indefiniteMapBegin, indefiniteEnd, decodeLoop, decodeSync
} from '@bintoca/cbor/core'
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
test.each([['hello', '101,104,101,108,108,111', ''], ['😊', '100,240,159,152,138', ''], ['😊😊😊', '108,240,159,152,138,240,159,152,138,240', '159,152,138'], ['a\uD800\uD800', '217,1,17,77,97,195,173,194,160,194', '128,195,173,194,160,194,128']])('stringItemWTF8(%s)', (a, e, e2) => {
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
    const out = { view: new DataView(new ArrayBuffer(40)), length: 0, typeMap: new WeakMap(defaultTypeMap), disableSharedReferences: true } as EncoderState
    arrayItem(1, out)
    mapItem(1, out)
    integerItem(1, out)
    tagItem(10, out)
    encodeItem(null, out)
    encodeItem(undefined, out)
    encodeItem(true, out)
    encodeItem(false, out)
    encodeItem({}, out)
    encodeItem(Object.create(null), out)
    indefiniteBinaryBegin(out)
    indefiniteStringBegin(out)
    indefiniteArrayBegin(out)
    indefiniteMapBegin(out)
    indefiniteEnd(out)
    encodeItem(new Map(), out)
    out.omitMapTag = true
    encodeItem(new Map(), out)
    encodeItem(new Set(), out)
    encodeItem([], out)
    encodeItem(new Date(1234), out)
    encodeItem(new Date(2000), out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe('129,161,1,202,246,247,245,244,160,160,95,127,159,191,255,217,1,3,160,160,217,1,2,128,128,217,3,233,162,1,1,34,24,234,193,2,0,0,0,0')
    expect(out.length).toBe(36)
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
    const r = encodeSync(a, setupEncoder())
    expect(r.length).toBe(e.length)
    expect(r).toEqual(e)
})
test.each([[{ a: 1, b: [2, 3] }, [new Uint8Array([162, 97, 97, 1, 97, 98, 130, 2, 3])]], [cycle1, [new Uint8Array([216, 28, 162, 97, 97, 216, 29, 0, 97, 98, 130, 216, 28, 160, 216, 29, 1])]],
[[new ArrayBuffer(4092), new ArrayBuffer(8)], [new Uint8Array([89, 15, 252].concat(Array(4092)).concat([72])), new Uint8Array(8)]],
[[new ArrayBuffer(4100)], [new Uint8Array([89, 16, 4].concat(Array(4093))), new Uint8Array(7)]],
[[new ArrayBuffer(4100), new ArrayBuffer(4100)], [new Uint8Array([89, 16, 4].concat(Array(4093))), new Uint8Array(Array(7).concat([89, 16, 4].concat(Array(4086)))), new Uint8Array(14)]],
[[new ArrayBuffer(9000)], [new Uint8Array([89, 35, 40].concat(Array(4093))), new Uint8Array(4096), new Uint8Array(Array(811))]],
])('encodeSync_Sequence(%#)', (a, e) => {
    const r = encodeSync(a, setupEncoder({ minViewSize: 1 }), { sequence: true })
    expect(r.length).toBe(e.length)
    expect(r).toEqual(e)
})
test.each([['hello', new TestAsync(), '101,104,101,108,108,111', '99,97,115,121'], ['hello', cycle1, '101,104,101,108,108,111', '216,28,162,97,97,216,29,0,97,98,130,216,28,160,216,29,1']])('nodeStream(%s,%s)', async (a, b, a1, b1) => {
    const r: Uint8Array[] = await new Promise((resolve, reject) => {
        const bufs = []
        const enc = new node.Encoder({ superOpts: { readableHighWaterMark: 6 } })
        enc.on('data', buf => { bufs.push(buf) })
        enc.on('error', reject)
        enc.on('end', () => resolve(bufs))
        enc.write(a)
        enc.write(b)
        enc.end()
        expect(enc.readableHighWaterMark).toBe(6)
    })
    expect(r.length).toBe(2)
    expect(new Uint8Array(r[0]).toString()).toBe(a1)
    expect(new Uint8Array(r[1]).toString()).toBe(b1)
})
test.each([[node.nullSymbol, new TestAsync(), '246,99,97,115,121']])('nodeStreamCombine(%s,%s)', async (a, b, e) => {
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
    return expect(p).rejects.toMatchObject(new Error('unsupported type: ' + b))
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

test.each([[[0], 0, 1], [[24, 50], 50, 2], [[25, 1, 0], 256, 3], [[26, 1, 0, 0, 0], 2 ** 24, 5], [[27, 0, 0, 0, 1, 0, 0, 0, 0], 2 ** 32, 9], [[27, 1, 0, 0, 0, 0, 0, 0, 0], BigInt(2) ** BigInt(56), 9], [[250, 90, 0, 0, 0], Number.MAX_SAFE_INTEGER + 1, 5],
[[54], -23, 1], [[56, 24], -25, 2], [[57, 1, 0], -257, 3], [[58, 0, 1, 0, 0], -(2 ** 16 + 1), 5], [[59, 0, 0, 0, 1, 0, 0, 0, 0], -(2 ** 32 + 1), 9], [[250, 218, 0, 0, 0], Number.MIN_SAFE_INTEGER - 1, 5],
[[249, 62, 0], 1.5, 3], [[250, 71, 128, 0, 64], 2 ** 16 + 0.5, 5], [[251, 65, 240, 0, 0, 0, 8, 0, 0], 2 ** 32 + 0.5, 9], [[249, 128, 0], -0, 3], [[249, 126, 0], NaN, 3], [[249, 124, 0], Infinity, 3], [[249, 252, 0], -Infinity, 3],
[[216, 64, 67, 1, 2, 3], new Uint8Array([1, 2, 3]), 6], [[101, 104, 101, 108, 108, 111], 'hello', 6], [[130, 1, 2], [1, 2], 3], [[161, 97, 104, 1], { h: 1 }, 4], [[246], null, 1], [[247], undefined, 1], [[244], false, 1], [[245], true, 1],
[[194, 66, 4, 210], BigInt(1234), 4], [[195, 66, 4, 209], BigInt(-1234), 4], [[217, 1, 3, 160], new Map(), 4], [[217, 1, 2, 128], new Set(), 4], [[217, 3, 233, 162, 1, 1, 34, 24, 234], new Date(1234), 9], [[193, 2], new Date(2000), 2],
[[192, 100, 50, 48, 48, 48], new Date('2000'), 6], [[216, 28, 162, 97, 97, 216, 29, 0, 97, 98, 130, 216, 28, 160, 216, 29, 1], cycle1, 17]])('decodeLoop(%i,%s)', (a, e, p) => {
    const state = setupDecoder({ queue: [new Uint8Array(a)] })
    expect(decodeLoop(state)).toEqual(e)
    expect(state.position).toBe(p)
})
test('decodeLoop_Chunked', () => {
    const state = setupDecoder()
    state.queue.push(new Uint8Array([148].concat(Array(18))))
    expect(decodeLoop(state)).toEqual(0)
    expect(state.position).toBe(19)
    expect(state.stopPosition).toBe(undefined)
    expect(state.queue).toEqual([])
    expect(state.stack).toEqual([{ major: 4, length: 20, temp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }])
    state.queue.push(new Uint8Array([0, 0, 25]))
    expect(decodeLoop(state)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(state.position).toBe(2)
    expect(state.stopPosition).toBe(undefined)
    expect(state.queue).toEqual([new Uint8Array([25])])
    expect(state.stack).toEqual([])
    expect(decodeLoop(state)).toEqual(undefined)
    expect(state.position).toBe(1)
    expect(state.stopPosition).toBe(0)
    expect(state.queue).toEqual([new Uint8Array([25])])
    expect(state.stack).toEqual([])
    expect(state.buffer).toBe(undefined)
    state.queue.push(new Uint8Array([1]))
    expect(decodeLoop(state)).toEqual(undefined)
    expect(state.position).toBe(2)
    expect(state.stopPosition).toBe(0)
    expect(state.queue).toEqual([new Uint8Array([25]), new Uint8Array([1])])
    expect(state.stack).toEqual([])
    state.queue.push(new Uint8Array([0, 148].concat(Array(20))))
    expect(decodeLoop(state)).toEqual(256)
    expect(state.position).toBe(3)
    expect(state.stopPosition).toBe(undefined)
    expect(state.queue).toEqual([new Uint8Array([148].concat(Array(20)))])
    expect(state.stack).toEqual([])
    expect(state.buffer).toBe(undefined)
    expect(decodeLoop(state)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(state.position).toBe(21)
    expect(state.stopPosition).toBe(undefined)
    expect(state.queue).toEqual([])
    expect(state.stack).toEqual([])
    expect(state.buffer).toBe(undefined)
    state.queue.push(new Uint8Array([129, 24]))
    expect(decodeLoop(state)).toEqual(undefined)
    expect(state.position).toBe(2)
    expect(state.stopPosition).toBe(1)
    expect(state.queue).toEqual([new Uint8Array([24])])
    expect(state.stack).toEqual([{ major: 4, length: 1, temp: [] }])
    expect(state.buffer).toBe(undefined)
})
test('nonStringKeysToObject', () => {
    const state = setupDecoder()
    state.queue.push(new Uint8Array([161, 1, 2]))
    expect(decodeLoop(state)).toEqual(new Map([[1, 2]]))
    state.queue.push(new Uint8Array([161, 1, 2]))
    state.nonStringKeysToObject = true
    expect(decodeLoop(state)).toEqual({ "1": 2 })
})
test('maxBytesPerItem', () => {
    const state = setupDecoder({ maxBytesPerItem: 10 })
    state.queue.push(new Uint8Array([27, 0, 0, 0, 1, 0, 0, 0, 0]))
    expect(decodeLoop(state)).toEqual(2 ** 32)
    state.queue.push(new Uint8Array([27, 0, 0, 0, 1, 0, 0, 0, 0]))
    expect(decodeLoop(state)).toEqual(2 ** 32)
    state.queue.push(new Uint8Array([138].concat(Array(10))))
    expect(() => decodeLoop(state)).toThrowError('current item consumed 11 bytes')
})
test.each([[new Uint8Array(), undefined], [new Uint8Array([0]), 0], [[new Uint8Array([24]), new Uint8Array([50, 0])], 50], [[new Uint8Array([66, 0, 0])], new ArrayBuffer(2)], [[new Uint8Array([66]), new Uint8Array([0, 0])], new ArrayBuffer(2)],
[[new Uint8Array([68, 0, 0]), new Uint8Array([0, 0])], new ArrayBuffer(4)], [[new Uint8Array([88, 40, 0]), new Uint8Array(37), new Uint8Array([0, 0, 1, 3])], new ArrayBuffer(40)],
[[new Uint8Array([101]), new Uint8Array([104, 101, 108, 108, 111])], 'hello'], [[new Uint8Array([99, 104]), new Uint8Array([101, 121])], 'hey'],
[[new Uint8Array([120, 40, 104]), new Uint8Array([65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65]), new Uint8Array([101, 0, 1, 3])], 'hAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAe\0'],
[[new Uint8Array([216, 64, 95]), new Uint8Array([66, 101, 104, 255])], new Uint8Array([101, 104])], [[new Uint8Array([127]), new Uint8Array([101, 104, 101, 108, 108, 111, 255])], 'hello'],
[[new Uint8Array([159]), new Uint8Array([1, 2, 3, 255])], [1, 2, 3]], [[new Uint8Array([191]), new Uint8Array([1, 2, 3, 4, 255])], new Map([[1, 2], [3, 4]])]])('decodeSync(%i,%s)', (a, e) => {
    const state = setupDecoder()
    const r = decodeSync(a, state, { allowExcessBytes: true })
    expect(e instanceof ArrayBuffer ? new Uint8Array(r) : r).toEqual(e instanceof ArrayBuffer ? new Uint8Array(e) : e)
})
test.each([[new Uint8Array([0, 0, 0]), 'excess bytes: 2'], [new Uint8Array([216, 64, 66, 0, 0, 1]), 'excess bytes: 1'], [new Uint8Array([101, 104, 101, 108, 108, 111, 5]), 'excess bytes: 1'],
[new Uint8Array([216, 64, 66, 0]), 'unfinished stack depth: 2'], [new Uint8Array([101, 104, 101, 108, 108]), 'unfinished stack depth: 1'], [[new Uint8Array([129])], 'unfinished stack depth: 1'],
[[new Uint8Array([25])], 'unexpected end of buffer: 0'], [[new Uint8Array([216, 64, 95]), new Uint8Array([101, 104, 255])], 'invalid nested string'], [new Uint8Array([255]), 'invalid break of indefinite length item']])('decodeSync_Error(%i,%s)', (a, e) => {
    const state = setupDecoder()
    expect(() => decodeSync(a, state)).toThrowError(e)
})
test.each([[new Uint8Array(), [undefined]], [new Uint8Array([0, 0, 0]), [0, 0, 0]], [[new Uint8Array([216, 64, 88, 40, 0]), new Uint8Array(37), new Uint8Array([0, 0, 1, 3])], [new Uint8Array(40), 1, 3]],
[[new Uint8Array([120, 40, 104]), new Uint8Array([65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65]), new Uint8Array([101, 0, 1, 3])], ['hAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAe\0', 1, 3]],
[[new Uint8Array([216, 64, 95]), new Uint8Array([66, 101, 104, 255, 5])], [new Uint8Array([101, 104]), 5]], [[new Uint8Array([127]), new Uint8Array([101, 104, 101, 108, 108, 111, 255, 5])], ['hello', 5]],
[[new Uint8Array([159]), new Uint8Array([1, 2, 3, 255, 5])], [[1, 2, 3], 5]], [[new Uint8Array([191]), new Uint8Array([1, 2, 3, 4, 255, 5])], [new Map([[1, 2], [3, 4]]), 5]]])('decodeSync_Sequence(%i,%i)', (a, e) => {
    const state = setupDecoder()
    expect(decodeSync(a, state, { sequence: true })).toEqual(e)
})
test.each([[[new Uint8Array([0, 0, 129])], 'unfinished stack depth: 1'], [new Uint8Array([216, 64, 66, 0]), 'unfinished stack depth: 2'], [new Uint8Array([101, 104, 101, 108, 108]), 'unfinished stack depth: 1'],
[[new Uint8Array([25])], 'unexpected end of buffer: 0'], [[new Uint8Array([216, 64, 95]), new Uint8Array([101, 104, 255])], 'invalid nested string'], [new Uint8Array([255]), 'invalid break of indefinite length item']])('decodeSync_Sequence_Error(%i,%s)', (a, e) => {
    const state = setupDecoder()
    expect(() => decodeSync(a, state, { sequence: true })).toThrowError(e)
})
test('sharedRef', () => {
    const o = { o: {}, a: [], m: new Map(), s: new Set() }
    o.o = o
    const a = []
    a.push(a)
    o.a = a
    const m = new Map()
    m.set(1, m)
    m.set(m, m)
    o.m = m
    const s = new Set()
    s.add(s)
    o.s = s
    const data = encodeSync(o, setupEncoder())
    const r = decodeSync(data, setupDecoder())
    expect(r == r.o).toBe(true)
    expect(r.a == r.a[0]).toBe(true)
    expect(r.m == r.m.get(1)).toBe(true)
    expect(r.m == r.m.get(r.m)).toBe(true)
    expect(r.s.has(r.s)).toBe(true)
})