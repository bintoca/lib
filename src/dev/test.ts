import * as tar from 'tar'
import { parseTar } from '@bintoca/dev/lib'

function tarCreate(folder: string) {
    return tar.create({ gzip: true, prefix: 'package', cwd: './src/dev/' + folder }, ['./'])
}
test('parseTar', async () => {
    const r = await parseTar(tarCreate('pack2'))
    expect(Object.keys(r).sort()).toEqual(['package.json', 'package-lock.json', 'dist/index.js'].sort())
    expect(2).toBe(2)
})