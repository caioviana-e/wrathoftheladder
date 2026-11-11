import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const GAME = join(__dirname, '..', 'src', 'game');

describe('Arquitetura de src/game', () => {
  const fontes = arquivos(GAME).map((p) => ({ p, src: readFileSync(p, 'utf-8') }));

  it('não importa Svelte nem Phaser', () => {
    for (const { p, src } of fontes) expect(src, p).not.toMatch(/from ['"](svelte|phaser)/);
  });

  it('não usa Math.random()', () => {
    for (const { p, src } of fontes) expect(src, p).not.toMatch(/Math\.random\s*\(/);
  });
});
