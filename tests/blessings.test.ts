import { describe, expect, it } from 'vitest';
import {
  adicionarBencao,
  contarTags,
  descreverBencao,
  duplasLiberadas,
  duplasQueCompleta,
  gerarOferta,
  payloadDaBencao,
  potencia,
  valoresEscalados,
} from '../src/game/blessings';
import { ALL_BLESSINGS, DUAL_BLESSINGS, FACTION_BLESSINGS, getBlessing } from '../src/game/data/blessings';
import { FACTIONS } from '../src/game/data/factions';
import { NIVEL_MAX } from '../src/game/formulas';
import { Rng } from '../src/game/rng';
import type { OwnedBlessing } from '../src/game/blessings';

describe('Dados de bênçãos', () => {
  it('MVP: 4 facções ativas com 8 bênçãos cada e 4 duplas', () => {
    const ativas = Object.values(FACTIONS).filter((f) => f.ativa);
    expect(ativas.length).toBe(4);
    for (const f of ativas) expect(FACTION_BLESSINGS.filter((b) => b.faccao === f.id).length).toBe(8);
    expect(DUAL_BLESSINGS.length).toBe(4);
  });

  it('ids únicos e toda bênção gera payload e descrição sem placeholders', () => {
    expect(new Set(ALL_BLESSINGS.map((b) => b.id)).size).toBe(ALL_BLESSINGS.length);
    for (const b of ALL_BLESSINGS) {
      for (const r of ['comum', 'lendaria'] as const) {
        const desc = descreverBencao(b, r, 1);
        expect(desc, b.id).not.toMatch(/\{|\}|NaN|undefined/);
        const p = payloadDaBencao({ id: b.id, nivel: 1, raridade: r });
        const n = (p.modificadores?.length ?? 0) + (p.gatilhos?.length ?? 0) + (p.condMods?.length ?? 0);
        expect(n, b.id).toBeGreaterThan(0);
      }
    }
  });

  it('a dupla Kirin Tor + Filhos de Hodir é o Estilhaçar (crítico garantido em congelados)', () => {
    const d = getBlessing('estilhacar');
    expect(d.dupla).toEqual(['kirinTor', 'filhosDeHodir']);
    const p = payloadDaBencao({ id: 'estilhacar', nivel: 1, raridade: 'epica' });
    expect(p.condMods?.[0]).toMatchObject({ quando: { alvoComStatus: 'congelamento' }, critChanceExtra: 1 });
  });
});

describe('Escala por raridade e nível', () => {
  it('raridade e nível aumentam a potência', () => {
    expect(potencia('incomum', 1)).toBeGreaterThan(potencia('comum', 1));
    expect(potencia('comum', 2)).toBeGreaterThan(potencia('comum', 1));
  });

  it('valores fixos (chances) não escalam', () => {
    const def = getBlessing('misseisArcanos');
    const v = valoresEscalados(def, 'lendaria', 3);
    expect(v.chance).toBe(0.25);
    expect(v.mult).toBeCloseTo(0.6 * potencia('lendaria', 3));
  });

  it('descrição mostra os números da raridade', () => {
    expect(descreverBencao(getBlessing('poderArcano'), 'comum', 1)).toBe('+8% de dano.');
    expect(descreverBencao(getBlessing('poderArcano'), 'rara', 1)).toBe('+12% de dano.');
  });

  it('pegar repetida sobe de nível, fica com a maior raridade e respeita o máximo', () => {
    const lista: OwnedBlessing[] = [];
    adicionarBencao(lista, { id: 'praga', raridade: 'rara' });
    adicionarBencao(lista, { id: 'praga', raridade: 'comum' });
    expect(lista).toEqual([{ id: 'praga', nivel: 2, raridade: 'rara' }]);
    for (let i = 0; i < 10; i++) adicionarBencao(lista, { id: 'praga', raridade: 'epica' });
    expect(lista[0]?.nivel).toBe(NIVEL_MAX);
    expect(lista[0]?.raridade).toBe('epica');
  });
});

describe('Duplas e tags', () => {
  it('duplas são liberadas com uma bênção de cada facção', () => {
    const b: OwnedBlessing[] = [{ id: 'menteAfiada', nivel: 1, raridade: 'comum' }];
    expect(duplasLiberadas(b)).toEqual([]);
    expect(duplasQueCompleta(b, 'toqueGelido').map((d) => d.id)).toEqual(['estilhacar']);
    b.push({ id: 'toqueGelido', nivel: 1, raridade: 'comum' });
    expect(duplasLiberadas(b).map((d) => d.id)).toEqual(['estilhacar']);
    b.push({ id: 'estilhacar', nivel: 1, raridade: 'epica' });
    expect(duplasLiberadas(b)).toEqual([]);
  });

  it('conta tags das bênçãos', () => {
    const tags = new Map(
      contarTags([
        { id: 'menteAfiada', nivel: 1, raridade: 'comum' },
        { id: 'explosaoArcana', nivel: 1, raridade: 'comum' },
      ]),
    );
    expect(tags.get('critico')).toBe(2);
    expect(tags.get('arcano')).toBe(1);
  });
});

describe('Ofertas', () => {
  it('são determinísticas, distintas e respeitam raridade mínima e facção', () => {
    const p = { bencaos: [], favoritas: [], raridadeMin: 'rara' as const };
    expect(gerarOferta(Rng.from('o'), p)).toEqual(gerarOferta(Rng.from('o'), p));
    for (let i = 0; i < 200; i++) {
      const o = gerarOferta(Rng.from(`o${i}`), p);
      expect(new Set(o.map((x) => x.id)).size).toBe(3);
      for (const x of o) expect(['rara', 'epica', 'lendaria']).toContain(x.raridade);
      const f = gerarOferta(Rng.from(`f${i}`), { bencaos: [], favoritas: [], faccao: 'filhosDeHodir' });
      for (const x of f) expect(getBlessing(x.id).faccao).toBe('filhosDeHodir');
    }
  });

  it('facções favoritas aparecem com mais frequência', () => {
    let fav = 0;
    let total = 0;
    for (let i = 0; i < 2000; i++) {
      for (const x of gerarOferta(Rng.from(`fav${i}`), { bencaos: [], favoritas: ['kirinTor'] })) {
        total++;
        if (getBlessing(x.id).faccao === 'kirinTor') fav++;
      }
    }
    expect(fav / total).toBeGreaterThan(0.3); // sem favorita seria ~25%
  });

  it('duplas liberadas podem aparecer e são sempre épicas; bênçãos no nível máximo não aparecem', () => {
    const bencaos: OwnedBlessing[] = [
      { id: 'menteAfiada', nivel: NIVEL_MAX, raridade: 'comum' },
      { id: 'toqueGelido', nivel: 1, raridade: 'comum' },
    ];
    let viuDupla = false;
    for (let i = 0; i < 300; i++) {
      for (const x of gerarOferta(Rng.from(`d${i}`), { bencaos, favoritas: [] })) {
        expect(x.id).not.toBe('menteAfiada');
        if (x.id === 'estilhacar') {
          viuDupla = true;
          expect(x.raridade).toBe('epica');
        }
      }
    }
    expect(viuDupla).toBe(true);
  });
});
