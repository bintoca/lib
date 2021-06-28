import { Duplex } from 'stream'
import { Output, Input, parseItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSync, concat, encodeObjectFuncLoop, resetOutput, defaultBufferSize, defaultMinViewSize, Options } from '@bintoca/cbor/core'

export class Encoder extends Duplex {
    constructor(options?: Options & { superOpts?}) {
        super({ readableObjectMode: false, writableObjectMode: true, ...options?.superOpts })
        let { backingView, newBufferSize, minViewSize, useWTF8, useRecursion } = options || {}
        backingView = backingView || new Uint8Array(defaultBufferSize)
        newBufferSize = newBufferSize || defaultBufferSize
        minViewSize = minViewSize || defaultMinViewSize
        this.output = { view: new DataView(backingView.buffer, backingView.byteOffset, backingView.byteLength), length: 0, stack: [], buffers: [], backingView, offset: 0, newBufferSize, minViewSize, useWTF8, useRecursion }
    }
    private output: Output
    private chunks: any[]
    private cb: (error?: Error | null) => void
    private doRead: boolean
    private hasChunks: boolean
    _writev(chunks: { chunk }[], callback: (error?: Error | null) => void) {
        this.chunks = chunks.map(x => x.chunk)
        this.cb = callback
        this.hasChunks = true
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
            if (this.hasChunks) {
                const out = this.output
                resetOutput(out)
                while (true) {
                    if (out.stack.length == 0 && this.chunks.length > 0) {
                        out.stack.push(this.chunks.shift())
                    }
                    encodeLoop(out, encodeObjectFuncLoop)
                    if (out.resumeItem || out.resumeBuffer || this.chunks.length == 0) {
                        this.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
                        if (!out.resumeItem && !out.resumeBuffer && this.chunks.length == 0) {
                            this.hasChunks = false
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
            if (this.hasChunks) {
                this.cb(e)
            }
            this.destroy(e)
        }
    }
    encode = (value): Uint8Array => concat(encodeSync(value, this.output))
}