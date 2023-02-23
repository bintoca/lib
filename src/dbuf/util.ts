import { Item, Slot } from '@bintoca/dbuf/codec'
export const bufToDV = (b: BufferSource, offset: number = 0, length?: number): DataView => b instanceof ArrayBuffer ? new DataView(b, offset, length !== undefined ? length : b.byteLength - offset) : new DataView(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufToU8 = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => b instanceof ArrayBuffer ? new Uint8Array(b, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const concat = (buffers: BufferSource[]): Uint8Array => {
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
export let log = (...x) => console.log(...x)
export const setLog = (l) => log = l
export let debugOn = []
export const setDebug = (x: string[]) => debugOn = x
export let debug = (...x) => {
    if (debugOn.some(d => d == x[0])) {
        console.debug(...x)
    }
}
export const strip = (x: Item) => {
    if (typeof x == 'object') {
        if (x instanceof Uint8Array) {
            return x
        }
        return { type: x.type, items: x.items.map(y => strip(y as Slot)) }
    }
    return x
}
export const zigzagEncode = (n: number) => (n >> 31) ^ (n << 1)
export const zigzagDecode = (n: number) => (n >>> 1) ^ -(n & 1)
export const unicodeOrdering = ' aeinost\n!"\',-./:;?ABCDEFGHIJKLMNOPQRSTUVWXYZbcdfghjklmpqruvwxyz\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f#$%&()*+0123456789<=>@[\\]^_`{|}~\x7f'
export const unicodeToTextLookup = []
export const textToUnicodeLookup = []
for (let x of unicodeOrdering) {
    unicodeToTextLookup[x.codePointAt(0)] = textToUnicodeLookup.length
    textToUnicodeLookup.push(x.codePointAt(0))
}
export const unicodeToText = (codePoint: number) => codePoint < 123 ? unicodeToTextLookup[codePoint] : codePoint
export const textToUnicode = (n: number) => n < 123 ? textToUnicodeLookup[n] : n

export const tai_gps_epochOffset = (10 * 365 + 7) * 86400 * 1000
//TODO move epoch to 2020 assuming no leap seconds after that
export const posixToTAI_millis = (posix_millis: number, leap_millis: number) => posix_millis - tai_gps_epochOffset + leap_millis
export const taiToPosix_millis = (tai_millis: number, leap_millis: number) => tai_millis + tai_gps_epochOffset - leap_millis
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
export const createLeapItem = (posix_millis: number, tai_leap_seconds: number) => [posix_millis, (tai_leap_seconds - 19) * 1000, posixToTAI_millis(posix_millis, (tai_leap_seconds - 19) * 1000)]
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