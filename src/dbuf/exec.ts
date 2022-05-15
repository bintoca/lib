import { parse, Scope, Item, isError, createEncoder, write_scope, finishWrite, createError, non_text_sym } from '@bintoca/dbuf/codec'
import { r } from '@bintoca/dbuf/registry'
import { concat } from '@bintoca/dbuf/util'

export const noop_sym = Symbol.for('https://bintoca.com/symbol/noop')
export const exec_item = (i: Item): Scope => {
    if (typeof i == 'number' || i instanceof Uint8Array) {
        return createError(r.error_internal)
    }
    return createError(r.error_internal)
}
export const exec = (root: Scope): Scope => {
    const early = root.items.filter(x => typeof x == 'object' && (x as Scope).type == r.bind && (x as Scope).items[0] == r.execute_early)
    for (let x of early) {
        const e = exec_item(x)
        if (isError(e)) {
            return e
        }
    }
    const last = root.items[root.items.length - 1]
    if (last === r.placeholder) {
        return { type: noop_sym, items: [] }
    }
    return exec_item(last)
}
export const run = (b: BufferSource): BufferSource => {
    const p = parse(b)
    const es = createEncoder()
    write_scope(isError(p) ? { type: non_text_sym, items: [p] } : exec(p), es)
    finishWrite(es)
    return concat(es.buffers)
}