import { describe, expect, it } from 'vitest';
import { Rng } from '../src/game/rng';

describe('Rng', () => {
  it('mesma semente gera a mesma sequência', () => {
    const a = Rng.from('abc');
    const b = Rng.from('abc');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('sementes diferentes geram sequências diferentes', () => {
    const a = Rng.from('abc');
    const b = Rng.from('abd');
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('rótulos diferenciam fluxos', () => {
    expect(Rng.from('s', 'combate', 1).next()).not.toBe(Rng.from('s', 'combate', 2).next());
  });

  it('valores ficam nos intervalos', () => {
    const r = Rng.from('intervalos');
    for (let i = 0; i < 5000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('int é aproximadamente uniforme', () => {
    const r = Rng.from('uniforme');
    const cont = [0, 0, 0, 0];
    for (let i = 0; i < 40000; i++) cont[r.int(0, 3)]!++;
    for (const c of cont) expect(c / 40000).toBeCloseTo(0.25, 1);
  });

  it('state/restore continua exatamente do mesmo ponto', () => {
    const a = Rng.from('salvar');
    a.next();
    const b = Rng.restore(a.state());
    for (let i = 0; i < 20; i++) expect(b.next()).toBe(a.next());
  });

  it('sample devolve itens distintos', () => {
    const r = Rng.from('amostra');
    const s = r.sample([1, 2, 3, 4, 5, 6, 7], 3);
    expect(new Set(s).size).toBe(3);
  });

  it('weighted respeita pesos zero', () => {
    const r = Rng.from('pesos');
    for (let i = 0; i < 200; i++) expect(r.weighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
  });
});
