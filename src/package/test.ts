import * as tar from 'tar'
import * as pack from '@bintoca/package'
import { ChunkType, FileType } from '@bintoca/loader'

function tarCreate(folder: string) {
    return tar.create({ gzip: true, prefix: 'package', cwd: './src/package/' + folder }, ['./'])
}
test('parseTar', async () => {
    const r = await pack.parseTar(tarCreate('pack1'))
    expect(Object.keys(r).sort()).toEqual(['package.json', 'package-lock.json', 'dist/index.js'].sort())
})
test.each([[0, '$AAAAA'], [1, '$BAAAA'], [63, '$$AAAA'], [64, '$ABAAA'], [4095, '$$$AAA'], [4096, '$AABAA'], [262143, '$$$$AA'], [262144, '$AAABA'], [16777215, '$$$$$A'], [16777216, '$AAAAB'], [1073741823, '$$$$$$']])('getSubstitueIdCore(%i)', (a, e) => {
    expect(pack.getSubstituteIdCore(a, 5, '$')).toEqual(e)
})
test.each([[{}, '$AAAAA'], [{ '$AAAAA': 1, '$BAAAA': 1, }, '$CAAAA']])('getSubstitueId', (a, e) => {
    expect(pack.getSubstituteId(a, 5, '$')).toEqual(e)
})
test('parseFiles', async () => {
    const files = await pack.parseTar(tarCreate('pack1'))
    const r = pack.parseFiles(files)
    expect(r.files['dist/index.js']).toEqual(new Map<number, any>([[1, FileType.js], [2, 920],
    [4, ['Math', 'Number']], [6, "$BAAAA"], [7, "$BAA"],
    [5, [new Map<number, any>([[1, "import * as $eeeee from "], [2, 'es😀d' ]]), new Map<number, any>([[1, "import { $AAAAA } from "], [2, 'a1' ]]), new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1' ]])]],
    [3, [new Map<number, any>([[1, ChunkType.Placeholder], [2, 31]]), "\r\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 27]]), "\r\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 23]]),
        "\r\nconst $AAA = ", new Map<number, any>([[1, ChunkType.This]]), "\r\nconst ar = () => ", new Map<number, any>([[1, ChunkType.This]]), "\r\nconst $ddddd = Number.EPSILON + Number.MAX_SAFE_INTEGER\r\n",
    new Map<number, any>([[1, ChunkType.Import]]),
    "('ss')\r\n" +
    "function f($vvvvv) {\r\n" +
    "    return this\r\n" +
    "}\r\n" +
    "class c {\r\n" +
    "    #$ppppp = this\r\n" +
    "    #clicked() {\r\n" +
    "        const h = Math.log(1) + this.#$ppppp\r\n" +
    "        try { } catch { }\r\n" +
    "    }\r\n" +
    "}\r\n" +
    "const cc = class { #v = this }\r\n" +
    "const fe = function () { return this }"]]]))
})