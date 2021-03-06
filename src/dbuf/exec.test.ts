import { createStruct, createWrap, createError, createEncoder, write_scope, finishWrite, parse, Scope, non_text_sym, Item, parseErrorPos } from '@bintoca/dbuf/codec'
import { run } from '@bintoca/dbuf/exec'
import { r, u } from '@bintoca/dbuf/registry'
import { concat, strip } from '@bintoca/dbuf/util'

const sc = (type: r | symbol, items: Item[]) => { return { type, items } }
const bi = (x: Item, y: Item): Scope => sc(r.bind, [x, y])
const perr = (er: r, blocksRead: number, index?: number, bits?: number) => parseErrorPos({ dvOffset: blocksRead * 4, tempIndex: index, partialBlockRemaining: bits }, er)
test.each([
    [[r.IPv4, r.placeholder], bi(r.error, r.error_internal)],
])('run(%#)', (i, o) => {
    const es = createEncoder()
    write_scope({ type: non_text_sym, items: Array.isArray(i) ? i : [i] }, es)
    finishWrite(es)
    const b = run(concat(es.buffers))
    expect(strip(parse(b))).toEqual({ type: non_text_sym, items: Array.isArray(o) ? o : [o] })
})