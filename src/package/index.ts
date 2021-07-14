import tar from 'tar'
import acorn from 'acorn'
const TD = new TextDecoder()

export async function parseTar(t: NodeJS.ReadableStream): Promise<{ [k: string]: Buffer }> {
    return new Promise((resolve, reject) => {
        const files = {}
        const p: tar.ParseStream = new (tar.Parse as any)()
        const ent = (e: tar.ReadEntry) => {
            const fn = e.path.substring(e.path.indexOf('/') + 1)
            let chunks = []
            e.on('data', d => {
                chunks.push(d)
            })
            e.on('end', () => {
                if (fn && !fn.endsWith('/')) {
                    files[fn] = Buffer.concat(chunks)
                }
            })
        }
        p.on('entry', ent)
        p.on('end', () => {
            resolve(files)
        })
        t.on('error', er => {
            reject(er)
        })
        t.pipe(p)
    })
}
export function bb(files: { [k: string]: Buffer }) {
    let packageJSON
    try {
        packageJSON = JSON.parse(TD.decode(files['package.json']))
    }
    catch { }
    if (!packageJSON) {
        return { error: 'package.json not pressent or invalid' }
    }

    for (let k in files) {
        if (k.endsWith('.js') || k.endsWith('.cjs') || k.endsWith('.mjs')) {
            let ast: acorn.Node
            try {
                ast = acorn.parse(TD.decode(files[k]), { ecmaVersion: "latest", sourceType: 'module' })
                console.log(JSON.stringify(ast))
            }
            catch (e) {
                return { error: 'syntax error in "' + k + '" ' + e.message }
            }

        }
    }
}