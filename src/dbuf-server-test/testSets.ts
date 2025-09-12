import { concatBuffers } from "@bintoca/dbuf-codec/common";
import { createParser, readBits32, setParserBuffer } from "@bintoca/dbuf-codec/decode";
import { ServeState } from "@bintoca/dbuf-server/serve";

export const testGetBodyStream = (test, expect, getBodyStream: (state: ServeState, chunkBits?: number) => ReadableStream) => {
    const f = async (fullBuffers: Uint8Array<ArrayBuffer>[], len: number, chunkBits?: number) => {
        const fullStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull(controller) {
                controller.enqueue(fullBuffers.shift())
                if (!fullBuffers.length) { controller.close() }
            },
        })
        const state: ServeState = { config: null, reader: fullStream.getReader() }
        state.parser = createParser()
        setParserBuffer((await state.reader.read()).value, state.parser)
        while (true) {
            const n = readBits32(state.parser.decoder, 1)
            if (n) {
                break
            }
        }
        const body = getBodyStream(state, chunkBits).getReader()
        const out = []
        while (true) {
            const r = await body.read()
            if (r.done) {
                break
            }
            else {
                out.push(r.value)
            }
        }
        expect(out.length).toBeTruthy()
        expect(concatBuffers(out).byteLength).toBe(len)
    }
    test.each([
        ['13', 3],
        ['4c', 3],
        ['0190', 16],
        ['0193', 19],
        ['10', 0]
    ])('getBodyStream(%#)', async (i, len) => {
        await f([Uint8Array.fromHex(i), new Uint8Array(16), new Uint8Array(16)], len)
    })
    test.each([
        [['1130', 3, '00'], 3],
        [['10'], 0],
        [['1130', 3, '2900', 9, 7, '40', 4, '00'], 23],
    ])('getBodyStream_chunk(%#)', async (i, len) => {
        await f(i.map(x => typeof x == 'string' ? Uint8Array.fromHex(x) : new Uint8Array(x)), len, 4)
    })
}