import { encodeAdditionalInformation, additionalInformationSize, integerItem, binaryItem, textItem, numberItem, bigintItem, arrayItem, mapItem, tagItem, primitiveItem, decodeAdditionalInformation, encodeSyncLoop, writeItem, writeItemC, getFloat16 } from '@bintoca/cbor/core'
import * as lite from '@bintoca/cbor/lite'

test.each([[0, 0], [23, 23], [24, 24], [255, 24], [256, 25], [2 ** 16 - 1, 25], [2 ** 16, 26], [2 ** 32 - 1, 26], [2 ** 32, 27]])('encodeAdditionalInformation(%i,%i)', (a, e) => {
    expect(encodeAdditionalInformation(a)).toBe(e)
})
test.each([[1.5, 26], [1.1, 27]])('encodeAdditionalInformationFloat(%f,%i)', (a, e) => {
    expect(encodeAdditionalInformation(a, true)).toBe(e)
})
test.each([[0, 0], [23, 0], [24, 1], [25, 2], [26, 4], [27, 8]])('additionalInformationSize(%i,%i)', (a, e) => {
    expect(additionalInformationSize(a)).toBe(e)
})
test.each([[0, '0,0,0,0,0,0,0,0,0', 1], [23, '23,0,0,0,0,0,0,0,0', 1], [24, '24,24,0,0,0,0,0,0,0', 2], [256, '25,1,0,0,0,0,0,0,0', 3], [2 ** 16, '26,0,1,0,0,0,0,0,0', 5], [2 ** 32, '27,0,0,0,1,0,0,0,0', 9],
[-23, '54,0,0,0,0,0,0,0,0', 1], [-25, '56,24,0,0,0,0,0,0,0', 2], [-257, '57,1,0,0,0,0,0,0,0', 3], [-(2 ** 16 + 1), '58,0,1,0,0,0,0,0,0', 5], [-(2 ** 32 + 1), '59,0,0,0,1,0,0,0,0', 9]])('integerItem(%i)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0, stack: [] }
    integerItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[0, '0,0,0,0,0,0,0,0,0', 1], [23, '23,0,0,0,0,0,0,0,0', 1], [24, '24,24,0,0,0,0,0,0,0', 2], [256, '25,1,0,0,0,0,0,0,0', 3], [2 ** 16, '26,0,1,0,0,0,0,0,0', 5], [2 ** 32, '27,0,0,0,1,0,0,0,0', 9], [Number.MAX_SAFE_INTEGER + 1, '250,90,0,0,0,0,0,0,0', 5],
[-23, '54,0,0,0,0,0,0,0,0', 1], [-25, '56,24,0,0,0,0,0,0,0', 2], [-257, '57,1,0,0,0,0,0,0,0', 3], [-(2 ** 16 + 1), '58,0,1,0,0,0,0,0,0', 5], [-(2 ** 32 + 1), '59,0,0,0,1,0,0,0,0', 9], [Number.MIN_SAFE_INTEGER - 1, '250,218,0,0,0,0,0,0,0', 5],
[1.5, '249,62,0,0,0,0,0,0,0', 3], [2 ** 16 + 0.5, '250,71,128,0,64,0,0,0,0', 5], [2 ** 32 + 0.5, '251,65,240,0,0,0,8,0,0', 9], [-0, '249,128,0,0,0,0,0,0,0', 3], [NaN, '249,126,0,0,0,0,0,0,0', 3], [Infinity, '249,124,0,0,0,0,0,0,0', 3], [-Infinity, '249,252,0,0,0,0,0,0,0', 3]])('numberItem(%f)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0, stack: [] }
    numberItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([1, -1])('number16(%i)', (sign) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0, stack: [] }
    for (let i = 0; i < 1024; i++) {
        for (let j = 0; j < 16; j++) {
            out.length = 0
            const v = (1 + (i / 1024)) * (2 ** j) * sign
            numberItem(v, out)
            if (Math.floor(v) !== v) {
                expect(out.length).toBe(3)
                expect(out.view.getUint8(0)).toBe(0xf9)
                expect(out.view.getUint16(1)).toBe(i + ((j + 15) << 10) + (sign < 0 ? 1 << 15 : 0))
                expect(getFloat16(out.view, 1)).toBe(v)
            }
        }
        for (let j = 1; j < 15; j++) {
            out.length = 0
            const v = (1 + (i / 1024)) * (2 ** (j - 15)) * sign
            numberItem(v, out)
            if (Math.floor(v) !== v) {
                expect(out.length).toBe(3)
                expect(out.view.getUint8(0)).toBe(0xf9)
                expect(out.view.getUint16(1)).toBe(i + (j << 10) + (sign < 0 ? 1 << 15 : 0))
                expect(getFloat16(out.view, 1)).toBe(v)
            }
        }
        {
            out.length = 0
            const v = (i / 1024) * (2 ** (-14)) * sign
            numberItem(v, out)
            if (Math.floor(v) !== v) {
                expect(out.length).toBe(3)
                expect(out.view.getUint8(0)).toBe(0xf9)
                expect(out.view.getUint16(1)).toBe(i + (sign < 0 ? 1 << 15 : 0))
                expect(getFloat16(out.view, 1)).toBe(v)
            }
            if (Object.is(v, -0)) {
                expect(Object.is(getFloat16(out.view, 1), -0)).toBeTruthy()
            }
        }
        {
            out.length = 0
            out.view.setUint16(0, i + (31 << 10) + (sign < 0 ? 1 << 15 : 0))
            if (i == 0) {
                expect(getFloat16(out.view, 0)).toBe(sign * Infinity)
            }
            else {
                expect(getFloat16(out.view, 0)).toBeNaN()
            }
        }
    }
})
test.each([[new Uint8Array([1, 2, 3]), '67,1,2,3,0,0,0,0,0', 4]])('binaryItem(%s)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0, stack: [] }
    binaryItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([['hello', '101,104,101,108,108,111,0,0,0', 6]])('textItem(%s)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(9)), length: 0, stack: [] }
    textItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[BigInt(1234), '194,66,4,210,0,0,0,0,0,0', 4], [BigInt(-1234), '195,66,4,209,0,0,0,0,0,0', 4]])('bigintItem(%s)', (a, e, l) => {
    const out = { view: new DataView(new ArrayBuffer(10)), length: 0, stack: [] }
    bigintItem(a, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test('items', () => {
    const out = { view: new DataView(new ArrayBuffer(13)), length: 0, stack: [] }
    arrayItem(1, out)
    mapItem(1, out)
    integerItem(1, out)
    tagItem(10, out)
    primitiveItem(22, out)
    expect(new Uint8Array(out.view.buffer).toString()).toBe('129,161,1,202,246,0,0,0,0,0,0,0,0')
    expect(out.length).toBe(5)
})
test.each([[[0, 1], 0, 1], [[24, 50], 50, 2], [[25, 1, 0], 256, 3], [[26, 1, 0, 0, 0], 2 ** 24, 5], [[27, 0, 0, 0, 1, 0, 0, 0, 0], 2 ** 32, 9], [[27, 1, 0, 0, 0, 0, 0, 0, 0], 2n ** 56n, 9]])('decodeAdditionalInformation(%i,%s)', (a, e, p) => {
    const inp = { buffer: new Uint8Array(a), position: 1 }
    const dv = new DataView(inp.buffer.buffer)
    expect(decodeAdditionalInformation(0, a[0], dv, inp)).toBe(e)
    expect(inp.position).toBe(p)
})
test.each([[{}, [new Uint8Array([160])]],
[[new ArrayBuffer(4092), new ArrayBuffer(8)], [new Uint8Array([130, 89, 15, 252].concat(Array(4092))), new Uint8Array([72].concat(Array(8)))]], //resumeItem
[[new ArrayBuffer(4100)], [new Uint8Array([129, 89, 16, 4].concat(Array(4092))), new Uint8Array(Array(8))]], //resumeBuffer
[[new ArrayBuffer(4100), new ArrayBuffer(4100)], [new Uint8Array([130, 89, 16, 4].concat(Array(4092))), new Uint8Array(Array(8).concat([89, 16, 4].concat(Array(4085)))), new Uint8Array(Array(15))]], //resumeBuffer 2
[[new ArrayBuffer(9000)], [new Uint8Array([129, 89, 35, 40].concat(Array(4092))), new Uint8Array(4096), new Uint8Array(Array(812))]], //resumeBuffer large
])('encodeSyncLoop(%#)', (a, e) => {
    const en = new lite.Encoder()
    const r = en.encodeSyncLoop(a)
    //console.log(r)
    expect(r.length).toBe(e.length)
    expect(r).toEqual(e)
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

