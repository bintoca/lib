import { finishWrite, writeBits, alignEncoder, writeBytes, writeTokens, writeVarintChecked, writeNodeFull } from '@bintoca/dbuf-codec/encode'
import { readVarint, setParserBuffer, readBits32, alignDecoder, validateSymbolsLite } from '@bintoca/dbuf-codec/decode'
import { Node, } from '@bintoca/dbuf-codec/common'
import { parseCoreLoop, initFullParser } from '@bintoca/dbuf-data/unpack'
import { r } from '@bintoca/dbuf-codec/registry'
import { testAlignDecoder, testAlignEncoder, testParse, testParseChunks, testParseError, testReadBits32, testReadVarint, testWriteBits, testWriteBytes, testWriteNodeFull, testWriteVarint } from '@bintoca/dbuf-codec-test/testSets'

test('magicNumber', () => {
    const dv = new DataView(new ArrayBuffer(4))
    dv.setUint8(0, 0xDF)
    dv.setUint8(1, 0xDF)
    dv.setUint8(2, 0xDF)
    dv.setUint8(3, 0xDF)
    expect(new Uint8Array(dv.buffer)).toEqual(writeTokens([r.magic_number, r.magic_number]).buffers[0].slice(0, 4))
})
testAlignDecoder(test, expect, alignDecoder)
testAlignEncoder(test, expect, alignEncoder)
export const parseError = (u8: Uint8Array): object => {
    const st = initFullParser(u8, validateSymbolsLite)
    parseCoreLoop(st)
    return st.error
}
testParseError(test, expect, parseError)
export const parse = (u8: Uint8Array): Node => {
    const st = initFullParser(u8)
    parseCoreLoop(st)
    return st.root
}
testParse(test, expect, parse)
export const parseChunks = (u8: Uint8Array): Node => {
    const st = initFullParser(u8.slice(0, 1))
    st.root.needed = 1
    parseCoreLoop(st)
    const dvs = new DataView(u8.buffer)
    for (let i = 1; i < u8.byteLength; i++) {
        const dvd = new DataView(new ArrayBuffer(1))
        dvd.setUint8(0, dvs.getUint8(i))
        setParserBuffer(dvd, st)
        st.error = undefined
        parseCoreLoop(st)
    }
    return st.root
}
testParseChunks(test, expect, parseChunks)
testWriteNodeFull(test, expect, parse, writeNodeFull)
testWriteBits(test, expect, writeBits, finishWrite)
testWriteBytes(test, expect, writeBytes, writeBits, finishWrite)
testReadBits32(test, expect, readBits32)
testWriteVarint(test, expect, writeVarintChecked, finishWrite)
testReadVarint(test, expect, readVarint)