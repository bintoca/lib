import * as tar from 'tar'
import * as pack from '@bintoca/package'

function tarCreate(folder: string) {
    return tar.create({ gzip: true, prefix: 'package', cwd: './src/package/' + folder }, ['./'])
}
test('parseTar', async () => {
    const r = await pack.parseTar(tarCreate('pack1'))
    expect(Object.keys(r).sort()).toEqual(['package.json', 'package-lock.json', 'dist/index.js'].sort())
})
test('bb', async () => {
    const files = await pack.parseTar(tarCreate('pack1'))
    const r = pack.bb(files)
    expect(r).toBe(undefined)
})