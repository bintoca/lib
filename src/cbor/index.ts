import { EncoderState, DecoderState, EncoderOptions, decodeItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSync, concat, resetOutput, detectCycles, setupEncoder } from '@bintoca/cbor/core'
declare var ReadableStreamBYOBReader

export class Encoder {
    constructor(options?: EncoderOptions) {
        this.state = setupEncoder(options)
        const that = this
        if (typeof ReadableStream == 'undefined') {
            throw new Error('ReadableStream is undefined. If this is a Node.js application you probably want to import { Encoder } from "@bintoca/cbor/node"')
        }
        else {
            this.readable = new ReadableStream({
                type: typeof ReadableStreamBYOBReader == 'function' ? 'bytes' as undefined : undefined,
                pull(controller: ReadableStreamController<any> & { byobRequest?: { view: Uint8Array, respond: (n: number) => void } }) {
                    try {
                        const out = that.state
                        resetOutput(out, controller.byobRequest?.view)
                        function process() {
                            if (out.stack.length == 0 && !out.resume) {
                                out.stack.push(that.chunk)
                                detectCycles(out.stack[0], out)
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
                                    controller.enqueue(new Uint8Array(out.view.buffer, out.view.byteOffset, out.length))
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
                }
            })
        }
        if (typeof WritableStream != 'undefined') {
            this.writable = new WritableStream({
                write(chunk) {
                    if (that.hasCancel) {
                        return Promise.reject('readable cancelled')
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
    encode = (value): Uint8Array => concat(encodeSync(value, this.state))
}
