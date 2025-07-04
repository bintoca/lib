import { writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Section, registry, codec, Paragraph, parseEnum, registryEnum, dbufWrite } from './specs'
import { Node, NodeType, createParser, setParserBuffer, createEncoder, finishWrite } from '@bintoca/dbuf/codec'
import { getRegistryIndex, isRegistrySymbol } from '@bintoca/dbuf/registry'
import { r } from './registryEnum'
import { buf2hex, strip } from '@bintoca/dbuf/util'
import { writeNode, parseFull, unpack, refineValues } from './pack'

const renderSpecLinkOnIndex = (id): string => `[${registryEnum[id]}](./specs/${registryEnum[id]}.md)`
const renderSpecLinkOnCodec = (id): string => `[${registryEnum[id]}](./registry/specs/${registryEnum[id]}.md)`
const renderSpecLink = (id): string => `[${registryEnum[id]}](./${registryEnum[id]}.md)`
const renderNodeTypeLink = (n: string): string => n//`[${n}](../node_types/${n}.md)`
const renderParseModeLink = (id): string => `[[parse mode ${parseModes[id]}]](../../codec.md)`
const renderParseMode = (id): string => `${parseModes[id]}`

const nodeTypes = parseEnum('./dbuf/codec.ts', 'NodeType')
const parseModes = parseEnum('./dbuf/codec.ts', 'ParseMode')
function nodeToString(n: Node, specLinkFunc, nodeLinkFunc): string {
    switch (n.type) {
        case NodeType.val:
        case NodeType.bit_val:
            if (n.registry !== undefined) {
                return specLinkFunc(n.registry)
            }
            return n.val.toString()
        case NodeType.parse_type_data:
            return `(${n.rootMagic ? `${specLinkFunc(r.magic_number)} ${specLinkFunc(r.magic_number)} ` : ''}${n.rootLittleEndian ? specLinkFunc(r.little_endian_marker) + ' ' : ''}${nodeToString(n.children[0], specLinkFunc, nodeLinkFunc)} ${n.children.length == 2 ? nodeToString(n.children[1], specLinkFunc, nodeLinkFunc) : ''})`
        default:
            return `(${n.registry !== undefined ? n.bitSize !== undefined ? `${specLinkFunc(n.registry)} ${n.bitSize}` : specLinkFunc(n.registry) : nodeLinkFunc(nodeTypes[n.type])}${n.children?.length ? ' ' + n.children.map(x => nodeToString(x, specLinkFunc, nodeLinkFunc)).join(' ') : ''})`
    }
}
function dbufToString(id, d: Node, specLinkFunc, nodeLinkFunc) {
    return nodeToString(dbufWriteParse(id, d), specLinkFunc, nodeLinkFunc)
}
function dbufUnpack(id, d: Node, p: any) {
    const up = refineKeys(refineValues(unpack(dbufWriteParse(id, d), true)))
    expect(up).toStrictEqual(p)
    return up
}
function dbufWriteParse(id, d: Node) {
    const st = createParser()
    const es = createEncoder()
    writeNode(es, d)
    finishWrite(es)
    const buf = es.buffers[0]
    setParserBuffer(buf, st)
    parseFull(st)
    const s = st.root
    if (!s) {
        console.log(st, buf)
    }
    try {
        expect(strip(s)).toEqual(strip(d))
    }
    catch (e) {
        console.log(id, e.message)
    }
    return s
}
const dbufToHex = (d: Node) => '0x' + buf2hex(dbufWrite(d))
const renderParagraph = (p: Paragraph, specLinkFunc, parseModeFunc): string => {
    return p.map(x => {
        if (typeof x == 'object') {
            if (x['rid'] !== undefined) {
                return specLinkFunc(x['rid'])
            }
            if (x['pid'] !== undefined) {
                return parseModeFunc(x['pid'])
            }
            if (x['item'] !== undefined) {
                const parseMode = x['parseMode'] !== undefined ? renderParseMode(x['parseMode']) + ' - ' : ''
                const registry = x['registry'] !== undefined ? specLinkFunc([x['registry']]) : ''
                return `- ${parseMode}${registry}${renderParagraph(x['item'], specLinkFunc, parseModeFunc)}\n`
            }
        }
        return x
    }).join('')
}
const renderSection = (section: Section, specLinkFunc, parseModeFunc): string => {
    let heading = ''
    for (let i = 0; i < section.heading; i++) {
        heading += '#'
    }
    const id = section.id.length ? section.id.join('.') + '.' : ''
    return heading + ` <a href="section-${id}">${id}</a> ${section.title}\n\n` + section.paragraphs.map(x => renderParagraph(x, specLinkFunc, parseModeFunc)).join('\n\n')
}
export type RefineStack = { val, index: number }[]
export const refineKeys = (v) => {
    const stack: RefineStack = [{ val: v, index: 0 }]
    let last
    while (stack.length) {
        const top = stack[stack.length - 1]
        if (Array.isArray(top.val)) {
            let i = 0
            for (let x of top.val) {
                const l = refineKeys(x)
                if (l !== undefined) {
                    top.val[i] = l
                }
                i++
            }
            last = stack.pop().val
        }
        else if (typeof top.val == 'object' && top.val !== null) {
            const ks = Object.keys(top.val)
            if (last !== undefined) {
                const k = ks[top.index]
                if (isRegistrySymbol(k)) {
                    top.val[registryEnum[getRegistryIndex(k)]] = last
                }
                top.index++
                last = undefined
            }
            if (top.index == ks.length) {
                last = stack.pop().val
                for (let k of ks) {
                    if (isRegistrySymbol(k)) {
                        delete top.val[k]
                    }
                }
            }
            else {
                stack.push({ val: top.val[ks[top.index]], index: 0 })
            }
        }
        else {
            last = stack.pop().val
            if (typeof last == 'string' && isRegistrySymbol(last)) {
                last = registryEnum[getRegistryIndex(last)]
            }
        }
    }
    return last
}
test('specs', () => {
    const folder = 'E:\\bintoca-gh\\dbuf\\'
    const registryFolder = join(folder, 'registry')
    const specsFolder = join(registryFolder, 'specs')
    const dir = readdirSync(specsFolder)
    for (let x of dir) {
        unlinkSync(join(specsFolder, x))
    }
    let indexTxt = ''
    const missing = []
    function noUnpack(k) {
        missing.push('no unpack ' + registryEnum[k])
        return ''
    }
    let symText = ''
    for (let k in registryEnum) {
        if (registry[k]) {
            indexTxt += `- ${k} - ${renderSpecLinkOnIndex(k)}\n`
            const fn = join(specsFolder, registryEnum[k] + '.md')
            const sp = registry[k]
            const txt = `## ${registryEnum[k]}\n\nID: ${k}\n\n${sp.paragraphs.map(x => renderParagraph(x, renderSpecLink, renderParseModeLink)).join('\n\n')}\n\n### Examples\n\n| Description | Binary | S-expression | Unpacked |\n|----|----|----|----|\n${sp.examples.map(x => `| ${x.description} | \`${dbufToHex(x.dbuf)}\` | ${dbufToString(k, x.dbuf, renderSpecLink, renderNodeTypeLink)} | ${x.unpack ? '<pre>' + JSON.stringify(dbufUnpack(k, x.dbuf, x.unpack)) + '</pre>' : noUnpack(k)} |`).join('\n')}`
            writeFileSync(fn, txt)
        }
        else {
            missing.push(registryEnum[k])
        }
        //symText += 'export const sym_' + registryEnum[k] + ' = getRegistrySymbol(r.' + registryEnum[k] + ')\n'
    }
    if (missing.length) {
        console.log('missing', missing)
    }
    writeFileSync(join(registryFolder, 'index.md'), '# DBUF Symbol Registry\n\nSubject to change until core semantics are settled\n\n' + indexTxt)
    writeFileSync(join(folder, 'codec.md'), codec.sections.map(x => renderSection(x, renderSpecLinkOnCodec, renderParseModeLink)).join('\n\n'))
})