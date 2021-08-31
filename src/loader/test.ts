import { ChunkType, FileType, encode, decodePackage, decodeFile, createLookup, exists, FileURLSystem, defaultConditions, getPackageBreakIndex } from '@bintoca/loader'

const freeGlobals = createLookup(['Free'])
const controlledGlobals = createLookup(['Math'])
const parentURL = new URL('file://')
const fs = { exists: null, read: null }
test('buffer', async () => {
    const cb = encode({ files: { 'p.json': new Map<number, any>([[1, FileType.buffer], [2, new TextEncoder().encode('{"a":2}')]]) } })
    const d = decodePackage(cb)
    expect(new TextDecoder().decode((await decodeFile(d.get(1)['p.json'], freeGlobals, controlledGlobals, parentURL, defaultConditions, fs)).data)).toBe('{"a":2}')
})
test.each([['const w = 4;          const r=5;', new Map<number, any>([[1, FileType.js], [2, 500], [3, 'const w = 4;          const r=5;']])],
['const w = 4;          ImporTTHISconst r=5;\nimport Math from"/x/g/Math"\nimport Number from"/x/u"\nimport $bbbbb from "bxx"\nimport ImporT from"/x/i"\nimport THIS from"/x/t"\nexport {b0} from "bxx"\nexport {r}\nexport{r}\nexport default $AA',
    new Map<number, any>([[1, FileType.js], [2, 500],
    [3, 'const w = 4;          ImporTTHISconst r=5;'],
    [4, ['Math', 'Number', 'Free']],
    [5, [new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])]], [6, 'ImporT'], [7, 'THIS'],
    [8, [new Map<number, any>([[2, "export {b0} from "], [3, 'b1']]), new Map<number, any>([[2, "export {r}"]]), new Map<number, any>([[1, "r"]]), new Map<number, any>([[4, "$AA"]])]]
    ])]])('js', async (a, b) => {
        const cb = encode({ files: { 'p.js': b } })
        const d = decodePackage(cb)
        expect(new TextDecoder().decode((await decodeFile(d.get(1)['p.js'], freeGlobals, controlledGlobals, parentURL, defaultConditions, fs)).data)).toBe(a)
    })
test('createLookup', () => {
    expect(new Uint8Array(createLookup(['hey', 'dude']).buffer)).toEqual(new Uint8Array([0, 0, 0, 2, 100, 0, 0, 12, 104, 0, 0, 17, 4, 100, 117, 100, 101, 3, 104, 101, 121]))
})
const look = createLookup(['hey', 'dude'])
test.each([[new DataView(new Uint8Array([104, 101, 121]).buffer), true], [new DataView(new Uint8Array([100, 117, 100, 101]).buffer), true],
[new DataView(new Uint8Array([104, 101, 122]).buffer), false], [new DataView(new Uint8Array([104, 101, 121, 120]).buffer), false], [new DataView(new Uint8Array([100, 117, 100, 102]).buffer), false]])('createLookup', (a, e) => {
    expect(exists(look, a, 0, a.byteLength)).toBe(e)
})
const shortString = new TextDecoder().decode(new Uint8Array(30))
const longString = new TextDecoder().decode(new Uint8Array(3000))
const repeat = (d, n) => {
    const a = []
    for (let i = 0; i < n; i++) {
        a.push(d)
    }
    return a
}
const sizeEstimate = (chunks, imports, glob) => chunks.map(x => typeof x == 'string' ? new TextEncoder().encode(x).length : x.get(1) == ChunkType.Placeholder ? x.get(2) : x.get(1) == ChunkType.Import ? 6 : x.get(1) == ChunkType.This ? 4 : 0)
    .concat(imports.map(x => new TextEncoder().encode(x.get(1)).length + new TextEncoder().encode(x.get(2)).length + 50)).concat(glob.map(x => new TextEncoder().encode(x).length * 2 + 50)).reduce((a, b) => a + b, 0)
const testFile = (chunks, imports, glob) => decodePackage(encode({ files: { 'p.js': new Map<number, any>([[1, FileType.js], [2, sizeEstimate(chunks, imports, glob)], [3, chunks], [4, glob], [5, imports]]) } })).get(1)['p.js']
const bench = (n, f, d) => {
    const c = Date.now()
    for (let i = 0; i < 100000; i++) {
        f(d)
    }
    console.log(n, Date.now() - c)
}
const f = (d) => decodeFile(d, freeGlobals, controlledGlobals, parentURL, defaultConditions, fs)
const doBench = () => {
    bench('a', f, testFile([shortString], [], []))
    bench('b', f, testFile([shortString, longString], [], []))
    bench('c', f, testFile([shortString], [], ['Math', 'Number']))
    bench('d', f, testFile([shortString, longString], [], ['Math', 'Number']))
    bench('e', f, testFile(repeat(shortString, 100), [], ['Math', 'Number']))
    bench('f', f, testFile([shortString, longString], [new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']]), new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])], ['Math', 'Number']))
}
//doBench()
test.each([['', -1], ['a', -1], ['/x/x/node_modules/', -1], ['/x/x/node_modules/a', -1], ['/x/x/node_modules/@', -1], ['/x/x/node_modules/@/', -1],
['/x/x/node_modules/a/', '/'], ['/x/x/node_modules/@a/a/', '/'], ['/x/x/node_modules/a/wes', '/wes'], ['/x/x/node_modules/@a/a/wes', '/wes'], ['/x/x/node_modules/cv/node_modules/@a/a/wes', '/wes']])('getPackageBreakIndex(%s)', (a, e) => {
    const index = getPackageBreakIndex(a)
    expect(index === -1 ? index : a.slice(index)).toBe(e)
})