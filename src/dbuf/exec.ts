import { parse, Scope, Item, Slot, isError, createEncoder, write_scope, finishWrite, createError, non_text_sym } from '@bintoca/dbuf/codec'
import { r } from '@bintoca/dbuf/registry'
import { concat, log } from '@bintoca/dbuf/util'

export type ExecutionState = { stack: { scope: Scope, index: number }[], returns: Slot[], has_shared: boolean }
export const execError = (s: ExecutionState, er: Scope | r): Scope => {
    return createError(er)
}
export const exec_item = (s: ExecutionState, sc: Scope, index: number): Slot => {
    if (s.stack.length >= 1000) {
        throw execError(s, r.error_max_execution_stack)
    }
    s.stack.push({ scope: sc, index })
    const i = sc.items[index]
    let res: Slot
    if (typeof i == 'number') {
        res = i
    }
    else if (i instanceof Uint8Array) {
        res = execError(s, r.error_internal)
    }
    else if (i.type == r.back_reference) {
        res = exec_item(s, i.op.item_scope, i.op.item_position)
    }
    s.stack.pop()
    return res
}
export const exec = (root: Scope): ExecutionState => {
    const st: ExecutionState = { stack: [], returns: [], has_shared: root.has_shared }
    try {
        st.returns.push(exec_item(st, root, root.items.length - 1))
        return st
    }
    catch (e) {
        if (isError(e)) {
            return e
        }
        log(e, st)
        st.returns.push(execError(st, r.error_internal))
        return st
    }
}
export const run = (b: BufferSource): BufferSource => {
    const p = parse(b)
    const es = createEncoder()
    if (isError(p)) {
        write_scope({ type: non_text_sym, items: [p] }, es)
    }
    else {
        const res = exec(p)
        const it = []
        for (let x of res.returns) {
            if (typeof x == 'number') {
                it.push(x)
            }
            else {
                if (res.has_shared) {
                    throw 'not implemented'
                }
                else {
                    it.push(x)
                }
            }
        }
        write_scope({ type: non_text_sym, items: it }, es)
    }
    finishWrite(es)
    return concat(es.buffers)
}