import * as tar from 'tar'
import * as pack from '@bintoca/package'
import { ParseFilesError } from '@bintoca/package'
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
    expect(r.files['dist/index.js']).toEqual(new Map<number, any>([[1, FileType.js], [2, 1637],
    [4, ['Math', 'Number', 'd2']], [6, "$BAAAA"], [7, "$BAA"],
    [5, [new Map<number, any>([[1, "import * as $eeeee from "], [2, 'es😀d']]), new Map<number, any>([[1, "import { $AAAAA } from "], [2, 'a1']]), new Map<number, any>([[1, "import $bbbbb from "], [2, 'b1']])]],
    [8, [new Map<number, any>([[1, "$AAA"]]), new Map<number, any>([[1, "f"]]), new Map<number, any>([[1, "c"]]), new Map<number, any>([[2, "export { ar }"]]), new Map<number, any>([[2, "export { c1 } from "], [3, 'c1']]),
    new Map<number, any>([[2, "export * from "], [3, 'd1']]), new Map<number, any>([[2, "export * as d2 from "], [3, 'd2']]), new Map<number, any>([[2, "export * as d3 from "], [3, 'd3']]), new Map<number, any>([[4, "$AAAAAAAA"]])]],
    [3, [new Map<number, any>([[1, ChunkType.Placeholder], [2, 31]]), "\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 27]]), "\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 23]]),
        "\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 6]]), " const $AAA = ", new Map<number, any>([[1, ChunkType.This]]),
        "\nconst ar = () => ", new Map<number, any>([[1, ChunkType.This]]), "\nconst $ddddd = Number.EPSILON + Number.MAX_SAFE_INTEGER\n",
    new Map<number, any>([[1, ChunkType.Import]]),
        "('ss')\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 6]]),
    " function f($vvvvv) {\n" +
    "    return this\n" +
    "}\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 6]]),
    " class c {\n" +
    "    #$ppppp = this\n" +
    "    #clicked() {\n" +
    "        const h = Math.log(1) + this.#$ppppp + d2\n" +
    "        try { } catch { }\n" +
    "    }\n" +
    "}\n",
    new Map<number, any>([[1, ChunkType.Placeholder], [2, 13]]), "\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 23]]), "\n",
    new Map<number, any>([[1, ChunkType.Placeholder], [2, 18]]), "\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 24]]), "\n", new Map<number, any>([[1, ChunkType.Placeholder], [2, 24]]), "\n",
        "var $AAAAAAAA=", " {}\nconst cc = class { #v = this }\n" +
    "const fe = function () { return this }"]]]))
})
test.each([['import a from "/x"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '/x']])],
['import a from "/x/a"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '/x/a']])],
['import a from ".b"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '.b']])],
['import a from "..b"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '..b']])],
['import a from "b"', new Map<number, any>([[1, FileType.js]])],
['import a from "./b"', new Map<number, any>([[1, FileType.js]])],
['import a from "../b"', new Map<number, any>([[1, FileType.js]])],
['import a from "../../b"', new Map<number, any>([[1, FileType.js]])],
['export {a} from "../../b"', new Map<number, any>([[1, FileType.js]])],
['import a from "../../../b"', new Map<number, any>([[1, FileType.error], [2, ParseFilesError.invalidSpecifier], [3, '../../../b']])],
])('parseFile', (a, e) => {
    const m = pack.parseFile('lib/lib/a.js', Buffer.from(a))
    if (m.get(1) == FileType.error) {
        expect(m).toEqual(e)
    }
    else {
        expect(m.get(1)).toBe(e.get(1))
    }
})