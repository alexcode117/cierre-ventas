import { renderToBuffer } from '@react-pdf/renderer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ReportDoc from '../src/components/pdf/Report';
import { buildSession, loadFile } from '../src/lib/load';

const read = (f: string) => {
  const b = readFileSync(`public/ejemplos/${f}`);
  return loadFile(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
};

describe('informe PDF', () => {
  it('se genera con y sin mes anterior', async () => {
    const [cur, prev] = await Promise.all([read('ejemplo-agosto-2026.xlsx'), read('ejemplo-julio-2026.xlsx')]);
    mkdirSync('tests/.output', { recursive: true });
    for (const [name, s] of [['con-comparacion', buildSession(cur, prev)], ['sin-comparacion', buildSession(cur, null)]] as const) {
      const buf = await renderToBuffer(<ReportDoc s={s} />);
      expect(buf.subarray(0, 4).toString()).toBe('%PDF');
      writeFileSync(`tests/.output/informe-${name}.pdf`, buf);
    }
  });
});
