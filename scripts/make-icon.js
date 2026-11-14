// Genererer app/icon.png (512x512): gradient-firkant med play-trekant. Kør: node scripts/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 512;
const px = Buffer.alloc(S * S * 4);
const c1 = [123, 92, 255], c2 = [0, 164, 220];
const r = 90; // hjørneradius

function inRounded(x, y) {
    const cx = Math.min(Math.max(x, r), S - 1 - r), cy = Math.min(Math.max(y, r), S - 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
// Play-trekant
const A = [190, 140], B = [190, 372], C = [380, 256];
function inTri(x, y) {
    const s = (p, q, t) => (p[0] - t[0]) * (q[1] - t[1]) - (q[0] - t[0]) * (p[1] - t[1]);
    const P = [x, y], d1 = s(P, A, B), d2 = s(P, B, C), d3 = s(P, C, A);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (!inRounded(x, y)) continue;
    const t = (x + y) / (2 * S);
    let col = c1.map((v, k) => Math.round(v + (c2[k] - v) * t));
    if (inTri(x, y)) col = [255, 255, 255];
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
}

const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync(path.join(__dirname, '..', 'app', 'icon.png'), png);
console.log('app/icon.png skrevet');
