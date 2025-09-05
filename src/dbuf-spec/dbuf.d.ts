interface Uint8ArrayConstructor {
    fromBase64(s: string, op?: { alphabet?: 'base64' | 'base64url', lastChunkHandling?: 'loose' | 'strict' | 'stop-before-partial' }): Uint8Array<ArrayBuffer>
    fromHex(s: string): Uint8Array<ArrayBuffer>
}
interface Uint8Array {
    toBase64(options?: { alphabet?: 'base64' | 'base64url', omitPadding?: boolean }): string
    toHex(): string
}
interface DataView {
    getFloat16(byteOffset: number, littleEndian?: boolean): number
}