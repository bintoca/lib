import { Duplex } from 'stream'
import { Output, Input, parseItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSyncLoop, concat, encodeObjectFuncLoop, WorkingBuffer, writeItem, appendBuffer, resetOutput, defaultBufferSize, minViewSize } from '@bintoca/cbor/core'

export class Encoder extends Duplex {
    constructor(options?) {
        const { ...superOpts } = options || {}
        super({ readableObjectMode: false, writableObjectMode: true, ...superOpts })
        this.workingBuffer = { buffer: new ArrayBuffer(defaultBufferSize), offset: 0, newBufferSize: defaultBufferSize, minViewSize }
        this.output = { view: new DataView(this.workingBuffer.buffer, this.workingBuffer.offset, this.workingBuffer.buffer.byteLength - this.workingBuffer.offset), length: 0, stack: [], buffers: [], workingBuffer: this.workingBuffer }
    }
    private workingBuffer: WorkingBuffer
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
                    if (out.stack.length == 0) {
                        out.stack.push(this.chunks.shift())
                    }
                    encodeLoop(out, encodeObjectFuncLoop)
                    if (out.resumeItem || out.resumeBuffer || this.chunks.length == 0) {
                        this.push(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
                        if (this.chunks.length == 0) {
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
}