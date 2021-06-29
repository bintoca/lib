import { Output, Input, EncoderOptions, parseItem, finishItem, encodeLoop, decodeLoop, finalChecks, encodeSync, concat, defaultBufferSize, defaultMinViewSize, resetOutput, detectCycles } from '@bintoca/cbor/core'
declare var ReadableStreamBYOBReader

export class Encoder {
    constructor(options?: EncoderOptions) {
        let { backingView, newBufferSize, minViewSize, useWTF8, encodeCycles } = options || {}
        backingView = backingView || new Uint8Array(newBufferSize || defaultBufferSize)
        newBufferSize = newBufferSize || defaultBufferSize
        minViewSize = minViewSize || defaultMinViewSize
        this.output = { view: new DataView(backingView.buffer, backingView.byteOffset, backingView.byteLength), length: 0, stack: [], buffers: [], backingView, offset: 0, newBufferSize, minViewSize, useWTF8, encodeCycles }
        const that = this
        if (typeof ReadableStream == 'undefined') {
            throw new Error('ReadableStream is undefined. If this is a Node.js application you probably want to import { Encoder } from "@bintoca/cbor/node"')
        }
        else {
            this.readable = new ReadableStream({
                type: typeof ReadableStreamBYOBReader == 'function' ? 'bytes' as undefined : undefined,
                pull(controller: ReadableStreamController<any> & { byobRequest?: { view: Uint8Array, respond: (n: number) => void } }) {
                    try {
                        const out = that.output
                        resetOutput(out, controller.byobRequest?.view)
                        function process() {
                            if (out.stack.length == 0 && !out.resumeItem && !out.resumeBuffer) {
                                out.stack.push(that.chunk)
                                detectCycles(out.stack[0], out)
                            }
                            encodeLoop(out)
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
                            if (out.stack.length == 0 && !out.resumeItem && !out.resumeBuffer) {
                                that.hasChunk = false
                                that.chunk = undefined
                                that.writeResolve()
                            }
                        }
                        if (that.hasChunk) {
                            process()
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
                                            if (that.hasClose) {
                                                controller.close()
                                                if (controller.byobRequest) {
                                                    controller.byobRequest.respond(0)
                                                }
                                            }
                                            else {
                                                process()
                                            }
                                            resolve()
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
    private output: Output
    private writeResolve: () => void
    private writeReject: (reason?) => void
    private pullResolve: () => void
    private hasPull: boolean
    private hasClose: boolean
    private chunk
    private hasChunk: boolean
    private hasCancel: boolean
    readable: ReadableStream
    writable: WritableStream
    encode = (value): Uint8Array => concat(encodeSync(value, this.output))
}
export const decode = (b: BufferSource, op?: { allowExcessBuffer?: boolean, endPosition?: number }): any => {
    const src: Input = { buffer: b, position: 0 }
    const v = decodeLoop(src, parseItem, finishItem)
    finalChecks(src, op)
    return v
}