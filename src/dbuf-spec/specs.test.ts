import { writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Section, registry, codec, Paragraph, parseEnum, registryEnum, dbufWrite } from './specs'
import { finishWrite, createEncoder, writeNode } from '@bintoca/dbuf-codec/encode'
import { Node, NodeType } from '@bintoca/dbuf-codec/common'
import { getRegistryIndex } from '@bintoca/dbuf-data/registry'
import { unpack, parseFull } from '@bintoca/dbuf-data/unpack'
import { refineValues } from '@bintoca/dbuf-data/refine'
import * as b64Auto from 'es-arraybuffer-base64/auto'
const b64Shim = b64Auto

export const strip = (x: Node): Node => {
    if (typeof x == 'object') {
        if (x.children) {
            return { type: x.type, children: x.children.map(y => strip(y)), arraySize: x.arraySize, bitSize: x.type == NodeType.bits ? undefined : x.bitSize, choiceShared: x.choiceShared ? true : undefined }
        }
        if (x.type == NodeType.val) {
            return { type: x.type, val: x.val }
        }
        if (x.type == NodeType.bit_val) {
            return { type: x.type, val: x.val, bitSize: x.bitSize }
        }
    }
    return x
}
const renderSpecLinkOnIndex = (id): string => `[${registryEnum[id]}](./specs/${registryEnum[id]}.md)`
const renderSpecLinkOnCodec = (id): string => `[${registryEnum[id]}](./registry/specs/${registryEnum[id]}.md)`
const renderSpecLink = (id): string => `[${registryEnum[id]}](./${registryEnum[id]}.md)`
const renderNodeTypeLink = (n: string): string => n//`[${n}](../node_types/${n}.md)`
const renderParseModeLink = (id): string => `[[parse mode ${parseModes[id]}]](../../codec.md)`
const renderParseMode = (id): string => `${parseModes[id]}`
const renderSpecLinkHTML = (id): string => `<a href="./${registryEnum[id]}.md">${registryEnum[id]}</a>`

const nodeTypes = parseEnum('./dbuf-codec/common.ts', 'NodeType')
const parseModes = parseEnum('./dbuf-codec/common.ts', 'ParseMode')
function nodeToString(n: Node, specLinkFunc, nodeLinkFunc, nest: number): string {
    switch (n.type) {
        case NodeType.val:
        case NodeType.bit_val:
            if (n.registry !== undefined) {
                return nestToString(nest) + specLinkFunc(n.registry)
            }
            return nestToString(nest) + n.val.toString()
        case NodeType.bytes:
        case NodeType.u8Text:
            return nestToString(nest) + '0x' + n.u8.toHex()
        case NodeType.parse_type_data:
            return `${nestToString(nest)}(${n.rootMagic ? `magic_number_prefix ` : ''}${n.rootLittleEndian ? 'little_endian_marker ' : ''}${nest ? specLinkFunc(n.registry) : ''}<br>${nodeToString(n.children[0], specLinkFunc, nodeLinkFunc, nest + 1)} ${n.children.length == 2 ? '<br>' + nodeToString(n.children[1], specLinkFunc, nodeLinkFunc, nest + 1) : ''}<br>${nestToString(nest)})`
        default:
            return `${nestToString(nest)}(${n.registry !== undefined ? n.bitSize !== undefined ? `${specLinkFunc(n.registry)} ${n.bitSize}` : specLinkFunc(n.registry) : nodeLinkFunc(nodeTypes[n.type])}${n.children?.length ? ' ' + n.children.map(x => '<br>' + nodeToString(x, specLinkFunc, nodeLinkFunc, nest + 1)).join(' ') : ''}<br>${nestToString(nest)})`
    }
}
const nestToString = (n: number): string => Array(n * 3).fill(0).map(x => '&nbsp;').join('')
function dbufToString(id, d: Node, specLinkFunc, nodeLinkFunc) {
    return nodeToString(dbufWriteParse(id, d), specLinkFunc, nodeLinkFunc, 0)
}
function dbufUnpack(id, d: Node, p: any) {
    const up = refineKeys(refineValues(unpack(dbufWriteParse(id, d), true)))
    expect(up).toStrictEqual(p)
    return up
}
function dbufWriteParse(id, d: Node) {
    const es = createEncoder()
    writeNode(es, d)
    finishWrite(es)
    const buf = es.buffers[0]
    const st = parseFull(buf)
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
const dbufToHex = (d: Node) => '0x' + dbufWrite(d).toHex()
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
    return heading + ` ${section.title}\n\n` + section.paragraphs.map(x => renderParagraph(x, specLinkFunc, parseModeFunc)).join('\n\n')
}
export type RefineStack = { val, index: number }[]
export const refineKeys = (v) => {
    const stack: RefineStack = [{ val: v, index: 0 }]
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
    }
    else if (typeof top.val == 'object' && top.val !== null) {
        const ks = Reflect.ownKeys(top.val)
        for (let k of ks) {
            let vs = top.val[k]
            if (typeof vs == 'symbol') {
                vs = top.val[k] = registryEnum[getRegistryIndex(vs)]
            }
            if (typeof vs == 'object') {
                vs = top.val[k] = refineKeys(vs)
            }
            if (typeof k == 'symbol') {
                top.val[registryEnum[getRegistryIndex(k)]] = vs
                delete top.val[k]
            }
        }
    }
    else if (typeof v == 'symbol') {
        return registryEnum[getRegistryIndex(v)]
    }
    return v
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
            const txt = `## ${registryEnum[k]}\n\nID: ${k}\n\n${sp.paragraphs.map(x => renderParagraph(x, renderSpecLink, renderParseModeLink)).join('\n\n')}\n\n### Examples\n\n<table><tr><th>Description</th><th>Binary</th><th>S-expression</th><th>Unpacked</th></tr>${sp.examples.map(x => `<tr><td>${x.description}</td><td>${dbufToHex(x.dbuf)}</td><td>${dbufToString(k, x.dbuf, renderSpecLinkHTML, renderNodeTypeLink)}</td><td>${x.unpack ? '<pre>' + JSON.stringify(dbufUnpack(k, x.dbuf, x.unpack), null, 2) + '</pre>' : noUnpack(k)}</td>`).join('\n')}</table>`
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
    const codecReg = parseEnum('./dbuf-codec/registry.ts', 'r')
    for (let k in codecReg) {
        expect(codecReg[k]).toBe(registryEnum[k])
    }
    const dataReg = parseEnum('./dbuf-data/registry.ts', 'r')
    for (let k in dataReg) {
        expect(dataReg[k]).toBe(registryEnum[k])
    }
    const serverReg = parseEnum('./dbuf-server/registry.ts', 'r')
    for (let k in serverReg) {
        expect(serverReg[k]).toBe(registryEnum[k])
    }
    writeFileSync(join(registryFolder, 'index.md'), '# DBUF Symbol Registry\n\nSubject to change until core semantics are settled\n\n' + indexTxt)
    writeFileSync(join(folder, 'codec.md'), codec.sections.map(x => renderSection(x, renderSpecLinkOnCodec, renderParseModeLink)).join('\n\n'))
})