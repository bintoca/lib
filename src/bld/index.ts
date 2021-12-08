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
    count,
    list
}
export type constructedList = { builtIn: builtInList, offset: number, count: number }[]
export type pack = { lists: constructedList[], count: number }