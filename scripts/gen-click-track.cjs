// Generates a metronome click-track WAV for timing verification.
// Clicks land on every beat at a fixed BPM (accent every 4th beat), so a
// beatmap whose notes sit on integer beats should have blocks reach the hit
// zone exactly when the click sounds. Used by beatmaps/sync-test.json.
//
// Usage: node scripts/gen-click-track.cjs [bpm] [beats] > (writes to public/)
const fs = require('fs');
const path = require('path');

const SR = 44100;
const BPM = Number(process.argv[2]) || 120;
const BEATS = Number(process.argv[3]) || 32;
const beatDur = 60 / BPM;
const totalDur = BEATS * beatDur + 0.5;
const N = Math.floor(SR * totalDur);
const data = new Float32Array(N);

for (let b = 0; b < BEATS; b++) {
  const start = Math.floor(b * beatDur * SR);
  const accent = b % 4 === 0;
  const freq = accent ? 1600 : 1100;
  const amp = accent ? 0.7 : 0.45;
  const len = Math.floor(0.045 * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 60);
    if (start + i < N) data[start + i] += Math.sin(2 * Math.PI * freq * t) * env * amp;
  }
}

const dataSize = N * 2;
const buf = Buffer.alloc(44 + dataSize);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, data[i]));
  buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
}

const out = path.join(__dirname, '..', 'public', `click-${BPM}bpm.wav`);
fs.writeFileSync(out, buf);
console.log(`Wrote ${out}: ${(buf.length / 1024).toFixed(0)}KB, ${totalDur.toFixed(2)}s, ${BEATS} beats @ ${BPM} BPM`);
