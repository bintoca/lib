import { Duplex } from 'stream'
import { EncoderState, DecoderState, encodeLoop, decodeLoop, encodeSync, decodeSync, concat, resetEncoder, EncoderOptions, DecoderOptions, detectShared, setupDecoder, setupEncoder, EncodeSyncOptions, DecodeSyncOptions, bufferSourceToUint8Array, decodePromises } from '@bintoca/cbor/core'

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
                            this.doRead = false
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

export class Decoder extends Duplex {
    constructor(options?: DecoderOptions & { superOpts?}) {
        super({ readableObjectMode: true, writableObjectMode: false, ...options?.superOpts })
        this.state = setupDecoder(options)
    }
    protected state: DecoderState
    protected cb: (error?: Error | null) => void
    protected doRead: boolean
    protected finalcb: (error?: Error | null) => void
    _writev(chunks: { chunk: any, encoding: BufferEncoding }[], callback: (error?: Error | null) => void) {
        if (chunks.some(x => x.encoding as string != 'buffer')) {
            this.destroy(new Error('invalid chunk encoding'))
            return
        }
        this.state.queue.push(...chunks.map(x => x.chunk))
        this.cb = callback
        if (this.doRead) {
            this._read(0)
        }
    }
    _final(callback: (error?: Error | null) => void) {
        this.finalcb = callback
        if (this.doRead) {
            this._read(0)
        }
    }
    _read(size) {
        try {
            this.doRead = true
            if (this.state.queue.length > 0) {
                let queueBytesStart = this.state.queue.reduce((a, b) => a + b.byteLength, 0)
                let queueBytesBefore, queueBytesAfter
                let result
                do {
                    queueBytesBefore = this.state.queue.reduce((a, b) => a + b.byteLength, 0)
                    result = decodeLoop(this.state)
                    queueBytesAfter = this.state.queue.reduce((a, b) => a + b.byteLength, 0)
                }
                while (this.state.stack.length > 0 && this.state.queue.length > 0 && queueBytesBefore != queueBytesAfter)
                if (this.state.stack.length == 0 && queueBytesStart != queueBytesAfter) {
                    this.doRead = false
                    if (this.state.promises.length > 0) {
                        Promise.all(this.state.promises).then(x => {
                            result = decodePromises(result, x)
                            this.state.promises = []
                            this.push(result === null ? nullSymbol : result)
                        }).catch(x => this.destroy(x))
                    }
                    else {
                        this.push(result === null ? nullSymbol : result)
                    }
                }
                if (this.state.queue.length == 0 || queueBytesBefore == queueBytesAfter) {
                    this._complete()
                }
            }
            else {
                this._complete()
            }
        }
        catch (e) {
            if (this.cb) {
                this.cb(e)
            }
            this.destroy(e)
        }
    }
    protected _complete = () => {
        if (this.cb) {
            const cb = this.cb
            this.cb = undefined
            cb()
        }
        if (this.finalcb) {
            if (this.state.stack.length > 0) {
                this.destroy(new Error('unfinished stack depth: ' + this.state.stack.length))
            }
            else if (this.state.stopPosition !== undefined) {
                this.destroy(new Error('unexpected end of buffer: ' + this.state.stopPosition))
            }
            this.push(null)
            this.finalcb()
        }
    }
    decode = (value, op?: DecodeSyncOptions) => concat(decodeSync(value, this.state, op))
}