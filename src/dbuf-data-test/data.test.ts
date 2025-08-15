import { unpack } from '@bintoca/dbuf-data/unpack'
import { refineValues } from '@bintoca/dbuf-data/refine'
import { pack } from '@bintoca/dbuf-data/pack'
import { getLeapSecondsFromPosix, getLeapSecondsFromTAI } from '@bintoca/dbuf-data/time'
import { testGetLeapSecondsFromPosix, testPack, testUnpackRefine, testUnpackRefineSafe, testGetLeapSecondsFromTAI } from '@bintoca/dbuf-data-test/testSets'

testUnpackRefine(test, expect, unpack, refineValues)
testUnpackRefineSafe(test, expect, unpack, refineValues)
testPack(test, expect, pack)
testGetLeapSecondsFromPosix(test, expect, getLeapSecondsFromPosix)
testGetLeapSecondsFromTAI(test, expect, getLeapSecondsFromTAI)