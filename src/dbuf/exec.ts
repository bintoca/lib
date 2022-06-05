import { parse, Scope, Item, Slot, isError, createEncoder, write_scope, finishWrite, createError, non_text_sym } from '@bintoca/dbuf/codec'
import { r } from '@bintoca/dbuf/registry'
import { concat } from '@bintoca/dbuf/util'

export type ExecutionState = { stack: { scope: Scope, index: number }[] }
export const execError = (s: ExecutionState, er: Scope | r): Scope => {
    return createError(er)
}
export const exec_item = (s: ExecutionState, sc: Scope, index: number): Slot => {
    s.stack.push({ scope: sc, index })
    const i = sc.items[index]
    if (typeof i == 'number') {
        return i
    }
    if (i instanceof Uint8Array) {
        return execError(s, r.error_internal)
    }
    s.stack.pop()
    return execError(s, r.error_internal)
}
export const exec = (root: Scope): Slot => {
    const st: ExecutionState = { stack: [] }
    let i = 0
    for (let x of root.items) {
        if (typeof x == 'object' && (x as Scope).type == r.bind && (x as Scope).items[0] == r.execute_early) {
            const e = exec_item(st, root, i)
            if (isError(e)) {
                return e
            }
        }
        i++
    }
    return exec_item(st, root, root.items.length - 1)
}
export const run = (b: BufferSource): BufferSource => {
    const p = parse(b)
    const es = createEncoder()
    if (isError(p)) {
        write_scope({ type: non_text_sym, items: [p] }, es)
    }
    else {
        const res = exec(p)
        write_scope(typeof res == 'number' ? { type: non_text_sym, items: [p] } : res, es)
    }
    finishWrite(es)
    return concat(es.buffers)
}