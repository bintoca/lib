import {
    EncoderState, DecoderState, EncoderOptions, EncodeSyncOptions, DecodeSyncOptions, encodeLoop, decodeLoop, encodeSync, decodeSync, concat,
    resetEncoder, detectShared, setupEncoder, bufferSourceToUint8Array, DecoderOptions, setupDecoder, decodePromises
} from '@bintoca/cbor/core'
declare var ReadableStreamBYOBReader

export class Encoder {
    constructor(options?: EncoderOptions) {
        this.state = setupEncoder(options)
        const that = this
        if (typeof ReadableStream != 'undefined') {
            this.readable = new ReadableStream({
                type: typeof ReadableStreamBYOBReader == 'function' ? 'bytes' as undefined : undefined,
                pull(controller: ReadableStreamController<any> & { byobRequest?: { view: Uint8Array, respond: (n: number) => void } }) {
                    try {
                        const out = that.state
                        resetEncoder(out, controller.byobRequest?.view)
                        function process() {
                            if (out.stack.length == 0 && !out.resume) {
                                out.stack.push(that.chunk)
                                detectShared(out.stack[0], out)
                            }
                            encodeLoop(out)
                            if (out.resume?.promise) {
                                return out.resume.promise.then(() => {
                                    out.resume = undefined
                                    return process()
                                })
                            }
                            else {
                                if (controller.byobRequest) {
                                    if (out.length == 0) {
                                        controller.error(new Error('byob view is too small to write into'))
                                    }
                                    else {
                                        controller.byobRequest.respond(out.length)
                                    }
                                }
                                else {
                                    controller.enqueue(bufferSourceToUint8Array(out.view, 0, out.length))
                                }
                                if (out.stack.length == 0 && !out.resume) {
                                    that.hasChunk = false
                                    that.chunk = undefined
                                    that.writeResolve()
                                }
                            }
                        }
                        if (that.hasChunk) {
                            return process()
                        }
                        else {
                            if (that.hasClose) {
                                controller.close()
                                if (controller.byobRequest) {
                                    controller.byobRequest.respond(0)
                                }
                            }
                            else {
                                that.hasPull = true
                                return new Promise<void>((resolve, reject) => {
                                    that.pullResolve = () => {
                                        try {
                                            let r
                                            if (that.hasClose) {
                                                controller.close()
                                                if (controller.byobRequest) {
                                                    controller.byobRequest.respond(0)
                                                }
                                            }
                                            else {
                                                r = process()
                                            }
                                            resolve(r)
                                        }
                                        catch (e) {
                                            reject(e)
                                            if (that.hasChunk) {
                                                that.hasChunk = false
                                                that.chunk = undefined
                                                that.writeReject(e)
                                            }
                                        }
                                    }
                                })
                            }
                        }
                    }
                    catch (e) {
                        controller.error(e)
                        if (that.hasChunk) {
                            that.hasChunk = false
                            that.chunk = undefined
                            that.writeReject(e)
                        }
                    }
                },
                cancel() {
                    that.hasCancel = true
                    if (that.hasChunk) {
                        that.writeReject(new Error('readable cancelled'))
                    }
                }
            })
        }
        if (typeof WritableStream != 'undefined') {
            this.writable = new WritableStream({
                write(chunk) {
                    if (that.hasCancel) {
                        return Promise.reject(new Error('readable cancelled'))
                    }
                    const p = new Promise<void>((resolve, reject) => {
                        that.writeResolve = resolve
                        that.writeReject = reject
                    })
                    that.chunk = chunk
                    that.hasChunk = true
                    if (that.hasPull) {
                        that.hasPull = false
                        that.pullResolve()
                    }
                    return p
                },
                close() {
                    that.hasClose = true
                    if (that.hasPull) {
                        that.hasPull = false
                        that.pullResolve()
                    }
                },
                abort() {
                    that.hasClose = true
                    if (that.hasPull) {
                        that.hasPull = false
                        that.pullResolve()
                    }
                }
            })
        }
    }
    protected state: EncoderState
    protected writeResolve: () => void
    protected writeReject: (reason?) => void
    protected pullResolve: () => void
    protected hasPull: boolean
    protected hasClose: boolean
    protected chunk
    protected hasChunk: boolean
    protected hasCancel: boolean
    readable: ReadableStream
    writable: WritableStream
    encode = (value, op?: EncodeSyncOptions) => concat(encodeSync(value, this.state, op))
}

export class Decoder {
    constructor(options?: DecoderOptions) {
        this.state = setupDecoder(options)
        const that = this
        if (typeof ReadableStream != 'undefined') {
            this.readable = new ReadableStream({
                pull(controller: ReadableStreamController<any>) {
                    return that._pullCore(controller)
                },
                cancel() {
                    that.hasCancel = true
                }
            })
        }
        if (typeof WritableStream != 'undefined') {
            this.writable = new WritableStream({
                write(chunk) {
                    if (that.hasCancel) {
                        return Promise.reject(new Error('readable cancelled'))
                    }
                    if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk)) {
                        that.state.queue.push(chunk)
                    }
                    else {
                        return Promise.reject(new Error('chunk is not a BufferSource'))
                    }
                    const p = new Promise<void>((resolve, reject) => {
                        that.writeResolve = resolve
                        that.writeReject = reject
                    })
                    if (that.hasPull) {
                        that.hasPull = false
                        that.pullResolve()
                    }
                    return p
                },
                close() {
                    that.hasClose = true
                    if (that.hasPull) {
                        that.hasPull = false
                        that.pullResolve()
                    }
                },
                abort() {
                    that.hasClose = true
                    if (that.hasPull) {
                        that.hasPull = false
                        that.pullResolve()
                    }
                }
            })
        }
    }
    protected _pullCore = (controller: ReadableStreamController<any>) => {
        const that = this
        try {
            if (that.state.queue.length > 0) {
                let queueBytesStart = that.state.queue.reduce((a, b) => a + b.byteLength, 0)
                let queueBytesBefore, queueBytesAfter
                let result
                do {
                    queueBytesBefore = that.state.queue.reduce((a, b) => a + b.byteLength, 0)
                    result = decodeLoop(that.state)
                    queueBytesAfter = that.state.queue.reduce((a, b) => a + b.byteLength, 0)
                }
                while (that.state.stack.length > 0 && that.state.queue.length > 0 && queueBytesBefore != queueBytesAfter)
                if (that.state.stack.length == 0 && queueBytesStart != queueBytesAfter) {
                    if (that.state.promises.length > 0) {
                        return Promise.all(that.state.promises).then(x => {
                            result = decodePromises(result, x)
                            that.state.promises = []
                            controller.enqueue(result)
                            if (that.state.queue.length == 0 || queueBytesBefore == queueBytesAfter) {
                                return that._complete(controller)
                            }
                        }).catch(x => {
                            controller.error(x)
                            if (that.writeReject) {
                                that.writeReject(x)
                            }
                        })
                    }
                    else {
                        controller.enqueue(result)
                    }
                }
                if (that.state.queue.length == 0 || queueBytesBefore == queueBytesAfter) {
                    return that._complete(controller)
                }
            }
            else {
                return that._complete(controller)
            }
        }
        catch (e) {
            controller.error(e)
            if (that.writeReject) {
                that.writeReject(e)
            }
        }
    }
    protected _complete = (controller: ReadableStreamController<any>) => {
        const that = this
        if (this.hasClose) {
            if (this.state.stack.length > 0) {
                controller.error(new Error('unfinished stack depth: ' + this.state.stack.length))
            }
            else if (this.state.stopPosition !== undefined) {
                controller.error(new Error('unexpected end of buffer: ' + this.state.stopPosition))
            }
            else {
                controller.close()
            }
        }
        else if (this.writeResolve) {
            const wr = this.writeResolve
            this.writeResolve = undefined
            this.writeReject = undefined
            wr()
        }
        else {
            this.hasPull = true
            return new Promise<void>((resolve, reject) => {
                that.pullResolve = () => {
                    const r = that._pullCore(controller)
                    resolve(r)
                }
            })
        }
    }
    protected state: DecoderState
    readable: ReadableStream
    writable: WritableStream
    protected writeResolve: () => void
    protected writeReject: (reason?) => void
    protected hasCancel: boolean
    protected hasClose: boolean
    protected pullResolve: () => void
    protected hasPull: boolean
    decode = (value: BufferSource | BufferSource[], op?: DecodeSyncOptions) => decodeSync(value, this.state, op)
}