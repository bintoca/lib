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