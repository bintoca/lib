export const enum builtInList {
    uint,
    core,
    links,
    noop,
    unicode,
    wikidataP,
    wikidataQ,
    wikidataL,
    private,
}
export const enum core {
    linkIndex,
    deleteIndex,
    updateIndex,
    insertIndex,
    runCount,
    list,

    value,
    biasedExponentBase2,
    biasedExponentWithSignBase2,
    biasedExponentBase10,
    biasedExponentWithSignBase10,
}
export const enum serialOp {
    setStringPrefixIndex, //(i:number) default:0
    setStringPrefix, //(byteLength:number, bytes:utf8)
    setStringPrefixHttp, //(byteLength:number, bytes:utf8)
    setStringPrefixHttps, //(byteLength:number, bytes:utf8)
    extendStringPrefix, //(byteLength:number, bytes:utf8)
    shortenStringPrefix, //(byteLength:number)
    setDestinationList, //(id:number) default:1
    setSourceList, //(id:number) default:0
    incrementDestinationList, //()
    append_suffixes_to_list, //(count:number, [byteLength:number, bytes:utf8][]) append to current destination using current prefix
    append_prefix_range, //(offset:number, runCount:number)
    append_from_sourceList, //(offset:number, runCount:number)
    append_Uint, //(offset:number, bits:number)
    append_UintNeg, //(offset:number, bits:number) 
}
export const enum op {
    add
}
export type constructedList = { builtIn: builtInList, offset: number, runCount: number }[]
export type pack = { lists: constructedList[], count: number }