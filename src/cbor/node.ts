import { Duplex } from 'stream'
import { EncoderState, Input, parseItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSync, concat, resetOutput, EncoderOptions, detectCycles, setupEncoder } from '@bintoca/cbor/core'

export class Encoder extends Duplex {
    constructor(options?: EncoderOptions & { superOpts?}) {
        super({ readableObjectMode: false, writableObjectMode: true, ...options?.superOpts })
        this.state = setupEncoder(options)
    }
    protected state: EncoderState
    protected chunks: any[]
    protected cb: (error?: Error | null) => void
    protected doRead: boolean
    protected chunkIndex: number
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
                const out = this.state
                if (out.resume?.promise) {
                    out.resume = undefined
                }
                else {
                    resetOutput(out)
                }
                while (true) {
                    if (out.stack.length == 0 && this.chunkIndex < this.chunks.length) {
                        out.stack.push(this.chunks[this.chunkIndex])
                        this.chunkIndex++
                        detectCycles(out.stack[0], out)
                    }
                    encodeLoop(out)
                    if (out.resume || this.chunkIndex == this.chunks.length) {
                        if (out.resume?.promise) {
                            out.resume.promise.then(() => {
                                this._read(0)
                            })
                        }
                        else {
                            this.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
                            if (!out.resume && this.chunkIndex == this.chunks.length) {
                                this.chunks = undefined
                                this.cb()
                            }
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
    encode = (value): Uint8Array => concat(encodeSync(value, this.state))
    get typeMap() { return this.state.typeMap }
}