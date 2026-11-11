import { describe, expect, it } from 'vitest';
import { FORTALEZA_UTGARDE } from '../src/game/data/dungeons';
import { MAPA } from '../src/game/formulas';
import { findNode, gerarMapa, linhaMiniChefe, pais, type DungeonMap, type MapNode } from '../src/game/map';

const SEMENTES = Array.from({ length: 300 }, (_, i) => `mapa-${i}`);
const L = FORTALEZA_UTGARDE.linhas;
const mapas: [string, DungeonMap][] = SEMENTES.map((s) => [s, gerarMapa(s, FORTALEZA_UTGARDE)]);

function indice(mapa: DungeonMap, id: string): number {
  return (findNode(mapa, id) as MapNode).indice;
}

describe('Geração de mapa', () => {
  it('é determinística', () => {
    expect(gerarMapa('x', FORTALEZA_UTGARDE)).toEqual(gerarMapa('x', FORTALEZA_UTGARDE));
    expect(gerarMapa('x', FORTALEZA_UTGARDE)).not.toEqual(gerarMapa('y', FORTALEZA_UTGARDE));
  });

  it('tem o número de linhas da masmorra e 2–3 nós nas linhas comuns', () => {
    for (const [s, m] of mapas) {
      expect(m.linhas.length, s).toBe(L);
      m.linhas.forEach((linha, l) => {
        if (l === linhaMiniChefe(L) || l === L - 1) expect(linha.length, s).toBe(1);
        else {
          expect(linha.length, s).toBeGreaterThanOrEqual(2);
          expect(linha.length, s).toBeLessThanOrEqual(3);
        }
      });
    }
  });

  it('linhas fixas: combate na 0, mini-chefe no meio, fogueiras na penúltima, chefe na última', () => {
    for (const [s, m] of mapas) {
      expect(m.linhas[0]!.every((n) => n.tipo === 'combate'), s).toBe(true);
      expect(m.linhas[linhaMiniChefe(L)]![0]!.tipo, s).toBe('miniChefe');
      expect(m.linhas[L - 2]!.every((n) => n.tipo === 'fogueira'), s).toBe(true);
      expect(m.linhas[L - 1]![0]!.tipo, s).toBe('chefe');
    }
  });

  it('todo nó tem saída (menos o chefe) e entrada (menos a linha 0)', () => {
    for (const [s, m] of mapas) {
      for (const n of m.linhas.flat()) {
        if (n.linha < L - 1) expect(n.filhos.length, `${s} ${n.id}`).toBeGreaterThan(0);
        else expect(n.filhos.length).toBe(0);
        if (n.linha > 0) expect(pais(m, n).length, `${s} ${n.id}`).toBeGreaterThan(0);
        for (const f of n.filhos) expect(findNode(m, f)?.linha).toBe(n.linha + 1);
      }
    }
  });

  it('ligações não se cruzam', () => {
    for (const [s, m] of mapas) {
      for (const linha of m.linhas) {
        const arestas = linha.flatMap((n) => n.filhos.map((f) => [n.indice, indice(m, f)] as const));
        for (const a of arestas)
          for (const b of arestas) {
            const cruza = (a[0] < b[0] && a[1] > b[1]) || (a[0] > b[0] && a[1] < b[1]);
            expect(cruza, `${s} ${a} × ${b}`).toBe(false);
          }
      }
    }
  });

  it(`tem ao menos ${MAPA.minElites} elites e nenhuma nas ${MAPA.linhasSemElite} primeiras linhas`, () => {
    for (const [s, m] of mapas) {
      const elites = m.linhas.flat().filter((n) => n.tipo === 'elite');
      expect(elites.length, s).toBeGreaterThanOrEqual(MAPA.minElites);
      expect(elites.every((e) => e.linha >= MAPA.linhasSemElite), s).toBe(true);
    }
  });

  it('nenhum vendedor leva direto a outro vendedor', () => {
    for (const [s, m] of mapas) {
      for (const n of m.linhas.flat()) {
        if (n.tipo !== 'vendedor') continue;
        for (const f of n.filhos) expect(findNode(m, f)?.tipo, s).not.toBe('vendedor');
      }
    }
  });

  it('nós de combate têm inimigos; os outros não', () => {
    for (const [s, m] of mapas) {
      for (const n of m.linhas.flat()) {
        const combate = ['combate', 'elite', 'miniChefe', 'chefe'].includes(n.tipo);
        if (combate) expect(n.inimigos.length, `${s} ${n.id}`).toBeGreaterThan(0);
        else expect(n.inimigos.length).toBe(0);
      }
    }
  });

  it('gera todos os tipos de nó em algum mapa', () => {
    const tipos = new Set(mapas.flatMap(([, m]) => m.linhas.flat().map((n) => n.tipo)));
    for (const t of ['combate', 'elite', 'evento', 'fogueira', 'vendedor', 'tesouro', 'miniChefe', 'chefe']) expect(tipos.has(t as never)).toBe(true);
  });
});
