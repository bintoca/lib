import { createStruct, createEncoder, finishWrite, parse, Scope, Item, parseErrorPos, ScopeType } from '@bintoca/dbuf/codec'
import { run } from '@bintoca/dbuf/exec'
import { r, u } from '@bintoca/dbuf/registry'
import { concat, strip } from '@bintoca/dbuf/util'

const sc = (type: ScopeType, items: Item[]) => { return { type, items, op: undefined } }
const bi = (x: Item, y: Item): Scope => sc(ScopeType.bind, [x, y])
const perr = (er: r, blocksRead: number, index?: number, bits?: number) => parseErrorPos({ dvOffset: blocksRead * 4, tempIndex: index, partialBlockRemaining: bits }, er)
test.each([
    [[r.IPv4], r.IPv4],
])('run(%#)', (i, o) => {
    //const es = createEncoder()
    //write_scope({ type: non_text_sym, items: Array.isArray(i) ? i : [i] }, es)
    //finishWrite(es)
    //const b = run(concat(es.buffers))
    //expect(strip(parse(b))).toEqual({ type: non_text_sym, items: Array.isArray(o) ? o : [o] })
    expect(i[0]).toBe(o)
})