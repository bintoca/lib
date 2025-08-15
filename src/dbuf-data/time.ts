export const tai_dbuf_epochOffsetSeconds = ((48 * 365 + 12) * 86400 + 37)
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
export const createLeapItem = (posix_seconds: number, tai_leap_seconds: number) => [posix_seconds, tai_leap_seconds, posix_seconds + tai_leap_seconds]
export const leapLookup = ietf_leap.map(x => createLeapItem(x[0] - ((70 * 365 + 17) * 24 * 60 * 60), x[1]))
export const getLeapSecondsFromPosix = (posix_seconds: number) => lookupLeapSecondsFromPosix(posix_seconds, leapLookup)
export const lookupLeapSecondsFromPosix = (posix_seconds: number, lookup: number[][]) => {
    for (let i = lookup.length - 1; i >= 0; i--) {
        if (posix_seconds >= lookup[i][0]) {
            return lookup[i][1]
        }
    }
    return lookup[0][1]
}
export const getLeapSecondsFromTAI = (tai_seconds: number) => lookupLeapSecondsFromTAI(tai_seconds, leapLookup)
export const lookupLeapSecondsFromTAI = (tai_seconds: number, lookup: number[][]) => {
    for (let i = lookup.length - 1; i >= 0; i--) {
        if (tai_seconds >= lookup[i][2]) {
            return lookup[i][1]
        }
    }
    return lookup[0][1]
}