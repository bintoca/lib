import { Node, NodeType } from '@bintoca/dbuf/codec'

export const bufToDV = (b: BufferSource, offset: number = 0, length?: number): DataView => !b['buffer'] ? new DataView(b as ArrayBuffer, offset, length !== undefined ? length : b.byteLength - offset) : new DataView((b as ArrayBufferView).buffer, (b as ArrayBufferView).byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufToU8 = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => !b['buffer'] ? new Uint8Array(b as ArrayBuffer, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array((b as ArrayBufferView).buffer, (b as ArrayBufferView).byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const concatBuffers = (buffers: BufferSource[]): Uint8Array => {
    if (buffers.length == 1) {
        return buffers[0] instanceof Uint8Array ? buffers[0] : bufToU8(buffers[0])
    }
    const u = new Uint8Array(buffers.reduce((a, b) => a + b.byteLength, 0))
    let offset = 0
    for (let b of buffers) {
        u.set(b instanceof Uint8Array ? b : bufToU8(b), offset)
        offset += b.byteLength
    }
    return u
}
export function buf2hex(buffer: ArrayBuffer): string {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}
export const strip = (x: Node): Node => {
    if (typeof x == 'object') {
        if (x.children) {
            return { type: x.type, children: x.children.map(y => strip(y)), arraySize: x.arraySize, bitSize: x.type == NodeType.bits ? undefined : x.bitSize, choiceShared: x.choiceShared ? true : undefined }
        }
        if (x.type == NodeType.val) {
            return { type: x.type, val: x.val }
        }
        if (x.type == NodeType.bit_val) {
            return { type: x.type, val: x.val, bitSize: x.bitSize }
        }
    }
    return x
}
export const tai_dbuf_epochOffset = ((48 * 365 + 12) * 86400 + 37) * 1000
//https://data.iana.org/time-zones/tzdb-2024b/leap-seconds.list
export const ietf_leap = [
    [2272060800, 10],
    [2287785600, 11],
    [2303683200, 12],
    [2335219200, 13],
    [2366755200, 14],
    [2398291200, 15],
    [2429913600, 16],
    [2461449600, 17],
    [2492985600, 18],
    [2524521600, 19],
    [2571782400, 20],
    [2603318400, 21],
    [2634854400, 22],
    [2698012800, 23],
    [2776982400, 24],
    [2840140800, 25],
    [2871676800, 26],
    [2918937600, 27],
    [2950473600, 28],
    [2982009600, 29],
    [3029443200, 30],
    [3076704000, 31],
    [3124137600, 32],
    [3345062400, 33],
    [3439756800, 34],
    [3550089600, 35],
    [3644697600, 36],
    [3692217600, 37],
]
export const createLeapItem = (posix_millis: number, tai_leap_seconds: number) => [posix_millis, tai_leap_seconds * 1000, posix_millis + tai_leap_seconds * 1000]
export const leapLookup = ietf_leap.map(x => createLeapItem((x[0] - ((70 * 365 + 17) * 24 * 60 * 60)) * 1000, x[1]))
export const getLeap_millis = (posix_millis: number) => getLeap_millis_lookup(posix_millis, leapLookup)
export const getLeap_millis_lookup = (posix_millis: number, lookup: number[][]) => {
    for (let i = lookup.length - 1; i >= 0; i--) {
        if (posix_millis >= lookup[i][0]) {
            return lookup[i][1]
        }
    }
    return lookup[0][1]
}
export const getLeap_millis_tai = (tai_millis: number) => getLeap_millis_lookup_tai(tai_millis, leapLookup)
export const getLeap_millis_lookup_tai = (tai_millis: number, lookup: number[][]) => {
    for (let i = lookup.length - 1; i >= 0; i--) {
        if (tai_millis >= lookup[i][2]) {
            return lookup[i][1]
        }
    }
    return lookup[0][1]
}