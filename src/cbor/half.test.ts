import { writeItemCore, getFloat16 } from '@bintoca/cbor/core'

test.each([1, -1])('number16(%i)', (sign) => {
    const dv = new DataView(new ArrayBuffer(9))
    for (let i = 0; i < 1024; i++) {
        for (let j = 0; j < 16; j++) {
            const v = (1 + (i / 1024)) * (2 ** j) * sign
            const w = writeItemCore(-1, v, dv, 0)
            if (Math.floor(v) !== v) {
                expect(w).toBe(3)
                expect(dv.getUint8(0)).toBe(0xf9)
                expect(dv.getUint16(1)).toBe(i + ((j + 15) << 10) + (sign < 0 ? 1 << 15 : 0))
                expect(getFloat16(dv, 1)).toBe(v)
            }
        }
        for (let j = 1; j < 15; j++) {
            const v = (1 + (i / 1024)) * (2 ** (j - 15)) * sign
            const w = writeItemCore(-1, v, dv, 0)
            if (Math.floor(v) !== v) {
                expect(w).toBe(3)
                expect(dv.getUint8(0)).toBe(0xf9)
                expect(dv.getUint16(1)).toBe(i + (j << 10) + (sign < 0 ? 1 << 15 : 0))
                expect(getFloat16(dv, 1)).toBe(v)
            }
        }
        {
            const v = (i / 1024) * (2 ** (-14)) * sign
            const w = writeItemCore(-1, v, dv, 0)
            if (Math.floor(v) !== v) {
                expect(w).toBe(3)
                expect(dv.getUint8(0)).toBe(0xf9)
                expect(dv.getUint16(1)).toBe(i + (sign < 0 ? 1 << 15 : 0))
                expect(getFloat16(dv, 1)).toBe(v)
            }
            if (Object.is(v, -0)) {
                expect(Object.is(getFloat16(dv, 1), -0)).toBeTruthy()
            }
        }
        {
            dv.setUint16(0, i + (31 << 10) + (sign < 0 ? 1 << 15 : 0))
            if (i == 0) {
                expect(getFloat16(dv, 0)).toBe(sign * Infinity)
            }
            else {
                expect(getFloat16(dv, 0)).toBeNaN()
            }
        }
        if (i != 0) {
            const v = (i / 1024) * (2 ** (-15)) * sign
            const w = writeItemCore(-1, v, dv, 0)
            if (i % 2) {
                expect(w).toBe(5)
                expect(dv.getUint8(0)).toBe(0xfa)
                expect(dv.getFloat32(1)).toBe(v)
            }
            else {
                expect(w).toBe(3)
                expect(dv.getUint8(0)).toBe(0xf9)
                expect(getFloat16(dv, 1)).toBe(v)
            }
        }
    }
}, 60000)