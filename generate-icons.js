// Генератор PNG иконок без внешних зависимостей
const zlib = require('zlib');
const fs   = require('fs');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length);
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([lb, tb, data, cb]);
}

function makePNG(size) {
  const rowLen = size * 3;
  const raw = Buffer.alloc(size * (rowLen + 1));

  // Фон #080c14
  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const o = y * (rowLen + 1) + 1 + x * 3;
      raw[o] = 8; raw[o+1] = 12; raw[o+2] = 20;
    }
  }

  const cx = size / 2, cy = size / 2, r = size * 0.42;

  // Фиолетовый круг
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x-cx)*(x-cx) + (y-cy)*(y-cy) < r*r) {
        const o = y * (rowLen + 1) + 1 + x * 3;
        raw[o] = 139; raw[o+1] = 92; raw[o+2] = 246;
      }
    }
  }

  // Белая молния
  function dot(px, py, tk) {
    px = Math.round(px); py = Math.round(py);
    for (let dy = -tk; dy <= tk; dy++) {
      for (let dx = -tk; dx <= tk; dx++) {
        if (dx*dx+dy*dy <= tk*tk) {
          const nx = px+dx, ny = py+dy;
          if (nx>=0 && nx<size && ny>=0 && ny<size) {
            const o = ny*(rowLen+1)+1+nx*3;
            raw[o]=255; raw[o+1]=255; raw[o+2]=255;
          }
        }
      }
    }
  }
  function line(x1,y1,x2,y2,tk){
    const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)*2);
    for(let i=0;i<=steps;i++){const t=i/steps;dot(x1+(x2-x1)*t,y1+(y2-y1)*t,tk);}
  }

  const tk = Math.max(2, Math.round(size * 0.055));
  const s  = size;
  line(s*0.58, s*0.18, s*0.43, s*0.50, tk);
  line(s*0.43, s*0.50, s*0.55, s*0.50, tk);
  line(s*0.55, s*0.50, s*0.40, s*0.82, tk);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=2; // 8-bit RGB

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const idat = zlib.deflateSync(raw, {level:6});
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

fs.mkdirSync('public', {recursive:true});
[192, 512, 180].forEach(s => {
  fs.writeFileSync(`public/icon-${s}.png`, makePNG(s));
  console.log(`✅ icon-${s}.png`);
});
console.log('Done!');
