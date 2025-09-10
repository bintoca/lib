import { map, u8Text } from '@bintoca/dbuf-codec/encode'
import { Node } from '@bintoca/dbuf-codec/common'

export const string = (s: string): Node => u8Text(new TextEncoder().encode(s))
export const char = (s: string): Node => map(s.codePointAt(0))