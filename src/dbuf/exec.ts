import { parse, ParseState, Scope, Item } from '@bintoca/dbuf'
import { r } from '@bintoca/dbuf/registry'

export type ExecState = {}
export const execError = (i: Item, message: string) => { return { type: r.bind, items: [r.error, ] } }
export const exec_item = (i: Item): Scope => {
    if (typeof i == 'number' || i instanceof Uint8Array) {
        throw execError(i, '')
    }
    return { type: r.bind, items: [r.error] }
}
export const exec = (root: Scope) => {
    const early = root.items.filter(x => typeof x == 'object' && (x as Scope).type == r.bind && (x as Scope).items[0] == r.return_early_error)
    for (let x of early) {
        const e = exec_item(x)
        if (e.type == r.bind && e.items[0] == r.error) {
            return e
        }
    }
    const last = root.items[root.items.length - 1]
    return exec_item(last)
}
