import { encodeAdditionalInformation, integerItem, binaryItem, textItem, numberItem, bigintItem, arrayItem, mapItem, tagItem, primitiveItem, decodeAdditionalInformation } from '@bintoca/cbor-core'

test.each([[0, 0], [23, 23], [24, 24], [255, 24], [256, 25], [2 ** 16 - 1, 25], [2 ** 16, 26], [2 ** 32 - 1, 26], [2 ** 32, 27]])('encodeAdditionalInformation(%i,%i)', (a, e) => {
    expect(encodeAdditionalInformation(a)).toBe(e)
})
test.each([[0, '0,0,0,0,0,0,0,0,0', 1], [23, '23,0,0,0,0,0,0,0,0', 1], [24, '24,24,0,0,0,0,0,0,0', 2], [256, '25,1,0,0,0,0,0,0,0', 3], [2 ** 16, '26,0,1,0,0,0,0,0,0', 5], [2 ** 32, '27,0,0,0,1,0,0,0,0', 9],
[-23, '54,0,0,0,0,0,0,0,0', 1], [-25, '56,24,0,0,0,0,0,0,0', 2], [-257, '57,1,0,0,0,0,0,0,0', 3], [-(2 ** 16 + 1), '58,0,1,0,0,0,0,0,0', 5], [-(2 ** 32 + 1), '59,0,0,0,1,0,0,0,0', 9]])('integerItem(%i)', (a, e, l) => {
    const out = { buffer: new ArrayBuffer(9), length: 0 }
    integerItem(a, out)
    expect(new Uint8Array(out.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[0, '0,0,0,0,0,0,0,0,0', 1], [23, '23,0,0,0,0,0,0,0,0', 1], [24, '24,24,0,0,0,0,0,0,0', 2], [256, '25,1,0,0,0,0,0,0,0', 3], [2 ** 16, '26,0,1,0,0,0,0,0,0', 5], [2 ** 32, '250,79,128,0,0,0,0,0,0', 5],
[-23, '54,0,0,0,0,0,0,0,0', 1], [-25, '56,24,0,0,0,0,0,0,0', 2], [-257, '57,1,0,0,0,0,0,0,0', 3], [-(2 ** 16 + 1), '58,0,1,0,0,0,0,0,0', 5], [-(2 ** 32 + 1), '251,193,240,0,0,0,16,0,0', 9],
[1.5, '250,63,192,0,0,0,0,0,0', 5], [2 ** 32 + 0.5, '251,65,240,0,0,0,8,0,0', 9]])('numberItem(%f)', (a, e, l) => {
    const out = { buffer: new ArrayBuffer(9), length: 0 }
    numberItem(a, out)
    expect(new Uint8Array(out.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[new Uint8Array([1, 2, 3]), '67,1,2,3,0,0,0,0,0', 4]])('binaryItem(%s)', (a, e, l) => {
    const out = { buffer: new ArrayBuffer(9), length: 0 }
    binaryItem(a, out)
    expect(new Uint8Array(out.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([['hello', '101,104,101,108,108,111,0,0,0', 6]])('textItem(%s)', (a, e, l) => {
    const out = { buffer: new ArrayBuffer(9), length: 0 }
    textItem(a, out)
    expect(new Uint8Array(out.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test.each([[BigInt(1234), '194,66,4,210,0,0,0,0,0,0', 4], [BigInt(-1234), '195,66,4,209,0,0,0,0,0,0', 4]])('bigintItem(%s)', (a, e, l) => {
    const out = { buffer: new ArrayBuffer(10), length: 0 }
    bigintItem(a, out)
    expect(new Uint8Array(out.buffer).toString()).toBe(e)
    expect(out.length).toBe(l)
})
test('items', () => {
    const out = { buffer: new ArrayBuffer(13), length: 0 }
    arrayItem(1, out)
    mapItem(1, out)
    integerItem(1, out)
    tagItem(10, out)
    primitiveItem(22, out)
    expect(new Uint8Array(out.buffer).toString()).toBe('129,161,1,202,246,0,0,0,0,0,0,0,0')
    expect(out.length).toBe(5)
})
test.each([[[0, 1], 0, 1], [[24, 50], 50, 2], [[25, 1, 0], 256, 3], [[26, 1, 0, 0, 0], 2 ** 24, 5], [[27, 0, 0, 0, 1, 0, 0, 0, 0], 2 ** 32, 9], [[27, 1, 0, 0, 0, 0, 0, 0, 0], 2n ** 56n, 9]])('decodeAdditionalInformation(%i,%s)', (a, e, p) => {
    const inp = { buffer: new Uint8Array(a), position: 1 }
    const dv = new DataView(inp.buffer.buffer)
    expect(decodeAdditionalInformation(a[0], dv, inp)).toBe(e)
    expect(inp.position).toBe(p)
})