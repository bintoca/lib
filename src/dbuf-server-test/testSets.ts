import { concatBuffers } from "@bintoca/dbuf-codec/common"
import { createParser, readBits32, setParserBuffer } from "@bintoca/dbuf-codec/decode"
import { pathError, ServeState, registryError } from "@bintoca/dbuf-server/serve"
import { r } from '@bintoca/dbuf-server/registry'

export const testGetBodyStream = (test, expect, getBodyStream: (state: ServeState, chunkBits?: number) => ReadableStream) => {
    const f = async (fullBuffers: Uint8Array<ArrayBuffer>[], len: number, chunkBits?: number) => {
        const fullStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull(controller) {
                controller.enqueue(fullBuffers.shift())
                if (!fullBuffers.length) { controller.close() }
            },
        })
        const state: ServeState = { config: null, reader: fullStream.getReader(), frameIndex: 0 }
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
export const testGetFrameBodyStream = (test, expect, getFrameBodyStream: (state: ServeState) => ReadableStream) => {
    const f = async (fullBuffers: Uint8Array<ArrayBuffer>[], len: number) => {
        const fullStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull(controller) {
                controller.enqueue(fullBuffers.shift())
                if (!fullBuffers.length) { controller.close() }
            },
        })
        const state: ServeState = { config: null, reader: fullStream.getReader(), frameIndex: 0 }
        state.parser = createParser()
        setParserBuffer((await state.reader.read()).value, state.parser)
        const body = getFrameBodyStream(state).getReader()
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
    const er = async (fullBuffers: Uint8Array<ArrayBuffer>[], err) => {
        const fullStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull(controller) {
                controller.enqueue(fullBuffers.shift())
                if (!fullBuffers.length) { controller.close() }
            },
        })
        const state: ServeState = { config: null, reader: fullStream.getReader(), frameIndex: 0 }
        state.parser = createParser()
        setParserBuffer((await state.reader.read()).value, state.parser)
        const body = getFrameBodyStream(state).getReader()
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
        expect(state.responseError).toStrictEqual(err)
    }
    test.each([
        [['15', 5], 5],
        [['10'], 0],
        [['72', 2, '9730', 3, 'C10730', 3, 'E1000730', 3, 'F100000073', 3], 0],
        [['14', 4, '16', 6, '7900', 16, '17', 3, 4], 17],
    ])('getFrameBodyStream(%#)', async (i, len) => {
        await f(i.map(x => typeof x == 'string' ? Uint8Array.fromHex(x) : new Uint8Array(x)), len)
    })
    test.each([
        [['15'], registryError(r.incomplete_stream)],
        [['19'], registryError(r.incomplete_stream)],
        [['25'], pathError(r.data_value_not_accepted, [0, 'frame type'])],
    ])('getFrameBodyStream_error(%#)', async (i, err) => {
        await er(i.map(x => typeof x == 'string' ? Uint8Array.fromHex(x) : new Uint8Array(x)), err)
    })
}
export const testGetStructuredFrame = (test, expect, getStructuredFrame: (state: ServeState) => Promise<Uint8Array<ArrayBuffer>>) => {
    const f = async (fullBuffers: Uint8Array<ArrayBuffer>[], len: number) => {
        const fullStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull(controller) {
                controller.enqueue(fullBuffers.shift())
                if (!fullBuffers.length) { controller.close() }
            },
        })
        const state: ServeState = { config: null, reader: fullStream.getReader(), frameIndex: 0 }
        state.parser = createParser()
        setParserBuffer((await state.reader.read()).value, state.parser)
        const out = await getStructuredFrame(state)
        expect(out.byteLength).toBe(len)
    }
    const er = async (fullBuffers: Uint8Array<ArrayBuffer>[], err) => {
        const fullStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull(controller) {
                controller.enqueue(fullBuffers.shift())
                if (!fullBuffers.length) { controller.close() }
            },
        })
        const state: ServeState = { config: null, reader: fullStream.getReader(), frameIndex: 0 }
        state.parser = createParser()
        setParserBuffer((await state.reader.read()).value, state.parser)
        const out = await getStructuredFrame(state)
        expect(out).toBeUndefined()
        expect(state.responseError).toStrictEqual(err)
    }
    test.each([
        [['05', 5], 5],
        [['00'], 0],
        [['72', 2, '9730', 3, 'C10730', 3, 'E1000730', 3, 'F100000073', 3, '04', 4], 4],
        [['07', 3, 4], 7],
    ])('getStructuredFrame(%#)', async (i, len) => {
        await f(i.map(x => typeof x == 'string' ? Uint8Array.fromHex(x) : new Uint8Array(x)), len)
    })
    test.each([
        [['05'], registryError(r.incomplete_stream)],
        [['09'], registryError(r.incomplete_stream)],
        [['C1'], registryError(r.incomplete_stream)],
        [['25'], pathError(r.data_value_not_accepted, [0, 'frame type'])],
    ])('getStructuredFrame_error(%#)', async (i, err) => {
        await er(i.map(x => typeof x == 'string' ? Uint8Array.fromHex(x) : new Uint8Array(x)), err)
    })
}