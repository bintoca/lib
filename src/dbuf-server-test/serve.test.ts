import { getBodyStream, getFrameBodyStream, getStructuredFrame } from "@bintoca/dbuf-server/serve";
import { testGetBodyStream, testGetFrameBodyStream, testGetStructuredFrame } from "@bintoca/dbuf-server-test/testSets";
import * as b64Auto from 'es-arraybuffer-base64/auto'
const b64Shim = b64Auto

testGetBodyStream(test, expect, getBodyStream)
testGetFrameBodyStream(test, expect, getFrameBodyStream)
testGetStructuredFrame(test, expect, getStructuredFrame)