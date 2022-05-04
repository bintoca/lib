export const bufToDV = (b: BufferSource, offset: number = 0, length?: number): DataView => b instanceof ArrayBuffer ? new DataView(b, offset, length !== undefined ? length : b.byteLength - offset) : new DataView(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)
export const bufToU8 = (b: BufferSource, offset: number = 0, length?: number): Uint8Array => b instanceof ArrayBuffer ? new Uint8Array(b, offset, length !== undefined ? length : b.byteLength - offset) : new Uint8Array(b.buffer, b.byteOffset + offset, length !== undefined ? length : b.byteLength - offset)

export const zigzagEncode = (n: number) => (n >> 31) ^ (n << 1)
export const zigzagDecode = (n: number) => (n >>> 1) ^ -(n & 1)
export const unicodeToTextLookup = [64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 10, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
    3, 11, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 12, 13, 14, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 15,
    121, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 122, 123, 124, 125, 126,
    127, 4, 42, 43, 44, 5, 45, 46, 47, 48, 49, 50, 51, 52, 53, 6, 54, 55, 56, 57, 7, 58, 59, 60, 61, 62, 63
]
export const textToUnicodeLookup = [, , , 32, 97, 101, 111, 116, , , 10, 33, 44, 45, 46, 63,
    65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
    98, 99, 100, 102, 103, 104, 105, 106, 107, 108, 109, 110, 112, 113, 114, 115, 117, 118, 119, 120, 121, 122,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
    64, 91, 92, 93, 94, 95, 96
]
export const unicodeToText = (codePoint: number) => codePoint < 123 ? unicodeToTextLookup[codePoint] : codePoint + 5
export const textToUnicode = (n: number) => n < 128 ? textToUnicodeLookup[n] : n - 5

export const epochOffset = (10 * 365 + 7) * 86400 * 1000 //GPS epoch
export const posixToTAI_millis = (posix_millis: number, leap_millis: number) => posix_millis - epochOffset + leap_millis
export const taiToPosix_millis = (tai_millis: number, leap_millis: number) => tai_millis + epochOffset - leap_millis
export const ietf_leap = [
    // 2272060800, 10,
    // 2287785600, 11,
    // 2303683200, 12,
    // 2335219200, 13,
    // 2366755200, 14,
    // 2398291200, 15,
    // 2429913600, 16,
    // 2461449600, 17,
    // 2492985600, 18,
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
export const leapLookup = ietf_leap.map(x => [(x[0] - ((70 * 365 + 17) * 24 * 60 * 60)) * 1000, (x[1] - 19) * 1000])
leapLookup[0][0] += 5 * 24 * 60 * 60 * 1000
for (let x of leapLookup) {
    x.push(posixToTAI_millis(x[0], x[1]))
}
export const getLeap_millis = (posix_millis: number) => getLeap_millis_lookup(posix_millis, leapLookup)
export const getLeap_millis_lookup = (posix_millis: number, lookup: number[][]) => {
    for (let i = lookup.length - 1; i >= 0; i--) {
        if (posix_millis >= lookup[i][0]) {
            return lookup[i][1]
        }
    }
    throw 'input is before epoch start'
}
export const getLeap_millis_tai = (tai_millis: number) => getLeap_millis_lookup_tai(tai_millis, leapLookup)
export const getLeap_millis_lookup_tai = (tai_millis: number, lookup: number[][]) => {
    for (let i = lookup.length - 1; i >= 0; i--) {
        if (tai_millis >= lookup[i][2]) {
            return lookup[i][1]
        }
    }
    throw 'input is before epoch start '
}