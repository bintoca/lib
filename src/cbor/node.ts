import { Duplex } from 'stream'
import { EncoderState, DecoderState, encodeLoop, decodeLoop, encodeSync, concat, resetEncoder, EncoderOptions, detectShared, setupEncoder, EncodeSyncOptions, bufferSourceToUint8Array } from '@bintoca/cbor/core'

export const nullSymbol = Symbol.for('https://github.com/bintoca/lib/cbor/node/null')

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
        this.chunks = chunks.map(x => x.chunk === nullSymbol ? null : x.chunk)
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
                    resetEncoder(out)
                }
                while (true) {
                    if (out.stack.length == 0 && this.chunkIndex < this.chunks.length) {
                        out.stack.push(this.chunks[this.chunkIndex])
                        this.chunkIndex++
                        detectShared(out.stack[0], out)
                    }
                    encodeLoop(out)
                    if (out.resume || this.chunkIndex == this.chunks.length) {
                        if (out.resume?.promise) {
                            out.resume.promise.then(() => {
                                this._read(0)
                            })
                        }
                        else {
                            this.push(bufferSourceToUint8Array(out.view, 0, out.length))
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
    encode = (value, op?: EncodeSyncOptions) => concat(encodeSync(value, this.state, op))
}