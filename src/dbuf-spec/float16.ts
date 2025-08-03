export const getFloat16PolyFill = (dv: DataView, offset: number, littleEndian?: boolean): number => {
    const leadByte = dv.getUint8(offset + (littleEndian ? 1 : 0))
    const sign = leadByte & 0x80 ? -1 : 1
    const exp = (leadByte & 0x7C) >> 2
    const mant = ((leadByte & 0x03) << 8) | dv.getUint8(offset + (littleEndian ? 0 : 1))
    if (!exp) {
        return sign * 5.9604644775390625e-8 * mant
    } else if (exp === 0x1f) {
        return sign * (mant ? 0 / 0 : 2e308)
    }
    return sign * Math.pow(2, exp - 25) * (1024 + mant)
}
DataView.prototype.getFloat16 = function (
        byteOffset,
        littleEndian,
    ) {
        return getFloat16PolyFill(this, byteOffset, littleEndian);
    };