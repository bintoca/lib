import { parse, Scope, Item, isError, createEncoder, finishWrite } from '@bintoca/dbuf/codec'
import { r } from '@bintoca/dbuf/registry'
import { concat, log } from '@bintoca/dbuf/util'

export type ExecutionState = { stack: { scope: Scope, index: number }[], returns: Item[] }
export const execError = (s: ExecutionState, er: Scope | r): Scope => {
    return null
}
export const clone = (x: Item, parent: Scope, parentIndex: number): Item => {
    if (typeof x == 'number') {
        return x
    }
    if (x instanceof Uint8Array) {
        return x
    }
    const i: Scope = { type: x.type, items: undefined, parent, parentIndex, op:undefined }
    i.items = x.items.map(y => clone(y, i, x.parentIndex))
    return i
}
export const exec_item = (s: ExecutionState, sc: Scope, index: number): Item => {
    s.stack.push({ scope: sc, index })
    const i = sc.items[index]
    let res: Item
    if (typeof i == 'number') {
        res = i
    }
    else if (i instanceof Uint8Array) {
        throw 'unreachable'
    }
    else {
        switch (i.type) {
            
        }
    }
    s.stack.pop()
    return res
}
export const exec = (root: Scope): ExecutionState => {
    const st: ExecutionState = { stack: [], returns: [] }
    try {
        let ind = 0
        
        return st
    }
    catch (e) {
        if (isError(e)) {
            return e
        }
        //log(e, st)
        st.returns.push(execError(st, r.error_internal))
        return st
    }
}
export const run = (b: BufferSource): BufferSource => {
    const p = parse(b)
    const es = createEncoder()
    if (isError(p)) {
        //write_scope({ type: non_text_sym, items: [p] }, es)
    }
    else {
        //write_scope({ type: non_text_sym, items: exec(p).returns }, es)
    }
    finishWrite(es)
    return concat(es.buffers)
}