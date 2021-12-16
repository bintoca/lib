export const enum registry {
    core,
    unicode,
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
export const enum op {
    magicNumber, //0bin
    setOpList, //(i:number) default:0
    noop, //()
    setStringPrefixIndex, //(i:number) default:0
    setStringPrefix, //(byteLength:number, bytes:utf8)
    setStringPrefixHttp, //(byteLength:number, bytes:utf8)
    setStringPrefixHttps, //(byteLength:number, bytes:utf8)
    extendStringPrefix, //(byteLength:number, bytes:utf8)
    shortenStringPrefix, //(byteLength:number)
    setRegistryIndex, //(i:number) default:0
    setDestinationList, //(i:number) default:0
    setSourceList, //(i:number) default:0
    incrementDestinationList, //(size:number)
    append_prefix_suffixes, //(count:number, [byteLength:number, bytes:utf8][])
    append_prefix_range, //(offset:number, runCount:number)
    append_from_registry, //(offset:number, runCount:number)
    append_from_sourceList, //(offset:number, runCount:number)
    append_Uint, //(offset:number, bits:number)
    append_UintNeg, //(offset:number, bits:number)
    append_sha256, //(count:number, btyes:count*32)
    load_link, //(i:number)
    save_config, //(id:number)
    load_config, //(id:number)
}
export type constructedList = { builtIn: any, offset: number, runCount: number }[]
export type pack = { lists: constructedList[], count: number }