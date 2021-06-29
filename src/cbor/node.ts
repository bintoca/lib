import { Duplex } from 'stream'
import { Output, Input, parseItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSync, concat, resetOutput, defaultBufferSize, defaultMinViewSize, EncoderOptions, detectCycles } from '@bintoca/cbor/core'

export class Encoder extends Duplex {
    constructor(options?: EncoderOptions & { superOpts?}) {
        super({ readableObjectMode: false, writableObjectMode: true, ...options?.superOpts })
        let { backingView, newBufferSize, minViewSize, useWTF8, useRecursion, encodeCycles } = options || {}
        backingView = backingView || new Uint8Array(newBufferSize || defaultBufferSize)
        newBufferSize = newBufferSize || defaultBufferSize
        minViewSize = minViewSize || defaultMinViewSize
        this.output = { view: new DataView(backingView.buffer, backingView.byteOffset, backingView.byteLength), length: 0, stack: [], buffers: [], backingView, offset: 0, newBufferSize, minViewSize, useWTF8, useRecursion, encodeCycles }
    }
    private output: Output
    private chunks: any[]
    private cb: (error?: Error | null) => void
    private doRead: boolean
    private chunkIndex: number
    _writev(chunks: { chunk }[], callback: (error?: Error | null) => void) {
        this.chunks = chunks.map(x => x.chunk)
        this.cb = callback
        this.chunkIndex = 0
        if (this.doRead) {
            this._read(0)
        }
    }
    _final(callback: (error?: Error | null) => void) {
        this.push(null)
        callback()
    }
    _read(size) {
        try {
            if (this.chunks) {
                const out = this.output
                resetOutput(out)
                while (true) {
                    if (out.stack.length == 0 && this.chunkIndex < this.chunks.length) {
                        out.stack.push(this.chunks[this.chunkIndex])
                        this.chunkIndex++
                        detectCycles(out.stack[0], out)
                    }
                    encodeLoop(out)
                    if (out.resumeItem || out.resumeBuffer || this.chunkIndex == this.chunks.length) {
                        this.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
                        if (!out.resumeItem && !out.resumeBuffer && this.chunkIndex == this.chunks.length) {
                            this.chunks = undefined
                            this.cb()
                        }
                        break
                    }
                }
            }
            else {
                this.doRead = true
            }
        }
        catch (e) {
            if (this.chunks) {
                this.chunks = undefined
                this.cb(e)
            }
            this.destroy(e)
        }
    }
    encode = (value): Uint8Array => concat(encodeSync(value, this.output))
}