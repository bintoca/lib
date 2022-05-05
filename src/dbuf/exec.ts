import { parse, ParseState, Scope } from '@bintoca/dbuf'
import { r } from '@bintoca/dbuf/registry'

export type ExecState = {}
export const exec = (s: Scope) => {
    const last = s.items[s.items.length - 1]
}
