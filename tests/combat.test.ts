import { describe, expect, it } from 'vitest';
import { Combat } from '../src/game/combat/engine';
import { LIMITE_COMBATE_S } from '../src/game/formulas';
import { Rng } from '../src/game/rng';
import type { AbilityDef, CombatantInit, CombatEvent, ResourceDef, UltimateDef } from '../src/game/types';
import { boneco, combatente, stats } from './helpers';

function rodar(heroi: CombatantInit, inimigos: CombatantInit[], semente = 't', ateSegundos?: number) {
  const eventos: CombatEvent[] = [];
  const c = new Combat(heroi, inimigos, Rng.from(semente), { onEvent: (e) => eventos.push(e) });
  if (ateSegundos === undefined) c.run();
  else while (!c.terminado && c.t < ateSegundos) c.step();
  return { c, eventos };
}

type DanoEv = Extract<CombatEvent, { tipo: 'dano' }>;
const danos = (ev: CombatEvent[]) => ev.filter((e): e is DanoEv => e.tipo === 'dano');

const heroi = (p: Partial<CombatantInit> = {}) => combatente({ uid: 'heroi', side: 'heroi', ...p });

describe('Combate: básico', () => {
  it('é determinístico: mesma semente → mesmos eventos', () => {
    const h = heroi({ stats: stats({ critChance: 0.3 }) });
    const i = [combatente({ uid: 'a', side: 'inimigo', stats: stats({ vidaMax: 60, dano: 4 }) })];
    expect(rodar(h, i, 'x').eventos).toEqual(rodar(h, i, 'x').eventos);
    expect(rodar(h, i, 'x').eventos).not.toEqual(rodar(h, i, 'y').eventos);
  });

  it('herói vence um inimigo fraco e o resultado lista os mortos', () => {
    const { c } = rodar(heroi({ stats: stats({ dano: 10, aps: 2 }) }), [
      combatente({ uid: 'a', side: 'inimigo', stats: stats({ vidaMax: 50, dano: 1 }) }),
    ]);
    expect(c.resultado?.vencedor).toBe('heroi');
    expect(c.resultado?.inimigosMortos).toEqual(['a']);
    expect(c.resultado?.vidaFinalHeroi).toBeGreaterThan(0);
  });

  it('herói perde quando morre', () => {
    const { c, eventos } = rodar(heroi({ stats: stats({ vidaMax: 20, dano: 1 }) }), [
      combatente({ uid: 'a', side: 'inimigo', stats: stats({ vidaMax: 500, dano: 15, aps: 2 }) }),
    ]);
    expect(c.resultado?.vencedor).toBe('inimigo');
    expect(eventos.some((e) => e.tipo === 'morte' && e.uid === 'heroi')).toBe(true);
  });

  it('estourar o tempo limite é derrota', () => {
    const { c } = rodar(heroi({ stats: stats({ dano: 0 }) }), [boneco()]);
    expect(c.resultado?.vencedor).toBe('inimigo');
    expect(c.resultado?.motivo).toBe('tempo');
    expect(c.resultado?.duracao).toBeCloseTo(LIMITE_COMBATE_S, 1);
  });

  it('ataques respeitam ataques por segundo', () => {
    const { eventos } = rodar(heroi({ stats: stats({ aps: 2 }) }), [boneco()], 't', 10);
    const n = danos(eventos).filter((e) => e.de === 'heroi').length;
    expect(n).toBeGreaterThanOrEqual(19);
    expect(n).toBeLessThanOrEqual(20);
  });
});

describe('Combate: dano', () => {
  it('armadura reduz dano físico integralmente e mágico pela metade', () => {
    const alvo = boneco('b', { stats: stats({ vidaMax: 100000, dano: 0, aps: 0.2, armadura: 0.5 }) });
    const fis = danos(rodar(heroi({ stats: stats({ dano: 100 }) }), [alvo], 't', 5).eventos).filter((e) => e.de === 'heroi');
    expect(fis.length).toBeGreaterThan(0);
    for (const e of fis) {
      expect(e.valor).toBeGreaterThanOrEqual(45);
      expect(e.valor).toBeLessThanOrEqual(55);
    }
    const mag = danos(rodar(heroi({ stats: stats({ dano: 100 }), ataqueEscola: 'fogo' }), [alvo], 't', 5).eventos).filter(
      (e) => e.de === 'heroi',
    );
    expect(mag.length).toBeGreaterThan(0);
    for (const e of mag) {
      expect(e.valor).toBeGreaterThanOrEqual(67);
      expect(e.valor).toBeLessThanOrEqual(83);
    }
  });

  it('crítico multiplica pelo dano crítico', () => {
    const { eventos } = rodar(heroi({ stats: stats({ dano: 100, critChance: 1, critDano: 2 }) }), [boneco()], 't', 3);
    const meus = danos(eventos).filter((x) => x.de === 'heroi');
    expect(meus.length).toBeGreaterThan(0);
    for (const e of meus) {
      expect(e.critico).toBe(true);
      expect(e.valor).toBeGreaterThanOrEqual(180);
      expect(e.valor).toBeLessThanOrEqual(220);
    }
  });

  it('escudo absorve dano antes da vida', () => {
    const h = heroi({
      stats: stats({ dano: 0 }),
      gatilhos: [{ id: 'esc', gatilho: 'inicioCombate', efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { base: 1000 }, duracao: 60 }] }],
    });
    const { c, eventos } = rodar(h, [combatente({ uid: 'a', side: 'inimigo', stats: stats({ dano: 10, aps: 2 }) })], 't', 5);
    const recebidos = danos(eventos).filter((e) => e.para === 'heroi');
    expect(recebidos.length).toBeGreaterThan(0);
    for (const e of recebidos) {
      expect(e.valor).toBe(0);
      expect(e.absorvido).toBeGreaterThan(0);
    }
    expect(c.heroi.vida).toBe(100);
  });

  it('bônus condicional: crítico garantido em alvo congelado (forma do "Estilhaçar")', () => {
    const h = heroi({
      stats: stats({ dano: 10, critChance: 0 }),
      gatilhos: [
        {
          id: 'gelar',
          gatilho: 'inicioCombate',
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'congelamento', duracao: 100, valor: {} }],
        },
      ],
      condMods: [{ id: 'estilhacar', quando: { alvoComStatus: 'congelamento' }, critChanceExtra: 1 }],
    });
    const ev = danos(rodar(h, [boneco()], 't', 5).eventos).filter((e) => e.de === 'heroi');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.critico)).toBe(true);
  });
});

describe('Combate: status', () => {
  it('sangramento causa dano por segundo, ignora armadura e expira', () => {
    const h = heroi({
      stats: stats({ dano: 0 }),
      gatilhos: [
        {
          id: 'sangrar',
          gatilho: 'inicioCombate',
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'sangramento', duracao: 3, valor: { base: 7 } }],
        },
      ],
    });
    const alvo = boneco('b', { stats: stats({ vidaMax: 1000, dano: 0, aps: 0.2, armadura: 0.5 }) });
    const { c, eventos } = rodar(h, [alvo], 't', 6);
    const tiques = danos(eventos).filter((e) => e.origem.tipo === 'status');
    expect(tiques.map((e) => e.valor)).toEqual([7, 7, 7]);
    expect(eventos.some((e) => e.tipo === 'statusExpirou' && e.status === 'sangramento')).toBe(true);
    expect(c.inimigos[0]?.statuses.length).toBe(0);
  });

  it('sangramento acumula pilhas até o máximo', () => {
    const h = heroi({
      stats: stats({ dano: 1, aps: 5 }),
      gatilhos: [
        { id: 's', gatilho: 'aoAtacar', efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'sangramento', duracao: 10, valor: { base: 1 } }] },
      ],
    });
    const { c } = rodar(h, [boneco()], 't', 3);
    expect(c.inimigos[0]?.statuses.find((s) => s.id === 'sangramento')?.pilhas).toBe(5);
  });

  it('congelamento impede ataques enquanto dura', () => {
    const h = heroi({
      stats: stats({ dano: 0 }),
      gatilhos: [
        { id: 'gelo', gatilho: 'inicioCombate', efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'congelamento', duracao: 4, valor: {} }] },
      ],
    });
    const { eventos } = rodar(h, [combatente({ uid: 'a', side: 'inimigo', stats: stats({ dano: 5, aps: 2 }) })], 't', 8);
    const golpes = danos(eventos).filter((e) => e.de === 'a');
    expect(golpes.length).toBeGreaterThan(0);
    expect(Math.min(...golpes.map((e) => e.t))).toBeGreaterThanOrEqual(4000);
  });

  it('congelamento dura metade em elites e chefes', () => {
    const h = heroi({
      stats: stats({ dano: 0 }),
      gatilhos: [
        { id: 'gelo', gatilho: 'inicioCombate', efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'congelamento', duracao: 4, valor: {} }] },
      ],
    });
    const { eventos } = rodar(h, [boneco('b', { tier: 'chefe' })], 't', 1);
    const ap = eventos.find((e) => e.tipo === 'statusAplicado');
    expect(ap?.tipo === 'statusAplicado' ? ap.duracao : -1).toBe(2);
  });

  it('lentidão reduz a frequência de ataques', () => {
    const lento = heroi({
      stats: stats({ aps: 2 }),
      gatilhos: [
        { id: 'l', gatilho: 'inicioCombate', efeitos: [{ tipo: 'status', alvo: 'self', status: 'lentidao', duracao: 100, valor: { base: 0.5 } }] },
      ],
    });
    const n = danos(rodar(lento, [boneco()], 't', 10).eventos).filter((e) => e.de === 'heroi').length;
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(10);
  });

  it('doença reduz a cura recebida pela metade', () => {
    const h = heroi({
      vida: 10,
      stats: stats({ dano: 0 }),
      gatilhos: [
        { id: 'doente', gatilho: 'inicioCombate', efeitos: [{ tipo: 'status', alvo: 'self', status: 'doenca', duracao: 100, valor: { base: 0 } }] },
        { id: 'curar', gatilho: 'intervalo', intervalo: 1, efeitos: [{ tipo: 'cura', alvo: 'self', valor: { base: 20 } }] },
      ],
    });
    const curas = rodar(h, [boneco()], 't', 1.5).eventos.filter((e): e is Extract<CombatEvent, { tipo: 'cura' }> => e.tipo === 'cura');
    expect(curas.map((c) => c.valor)).toEqual([10]);
  });
});

describe('Combate: recursos, habilidades e suprema', () => {
  const furia: ResourceDef = { kind: 'furia', nome: 'Fúria', max: 100, inicioFracao: 0, regen: 0, ganhoAoBater: 10, ganhoAoApanhar: 100 };

  it('fúria começa em 0 e sobe ao bater', () => {
    const h = heroi({ recurso: furia, stats: stats({ recursoMax: 100, aps: 1 }) });
    const c = new Combat(h, [boneco()], Rng.from('f'));
    expect(c.heroi.recursoAtual).toBe(0);
    while (c.heroi.recursoAtual === 0) c.step();
    expect(c.heroi.recursoAtual).toBe(10);
  });

  it('fúria sobe ao apanhar, proporcional ao dano recebido', () => {
    const h = heroi({ recurso: furia, stats: stats({ recursoMax: 100, dano: 0 }) });
    const c = new Combat(h, [combatente({ uid: 'a', side: 'inimigo', stats: stats({ vidaMax: 9999, dano: 10, aps: 1 }) })], Rng.from('f'));
    while (c.heroi.vida === 100) c.step();
    // ganhoAoApanhar 100 com 100 de vida máxima: cada ponto de dano vira 1 de fúria.
    expect(c.heroi.recursoAtual).toBeCloseTo(100 - c.heroi.vida, 5);
  });

  it('mana começa cheia, é gasta e regenera', () => {
    const mana: ResourceDef = { kind: 'mana', nome: 'Mana', max: 100, inicioFracao: 1, regen: 10 };
    const hab: AbilityDef = { id: 'h', nome: 'H', descricao: '', custo: 100, recarga: 0, prioridade: 1, efeitos: [] };
    const c = new Combat(heroi({ recurso: mana, stats: stats({ recursoMax: 100 }), habilidades: [hab] }), [boneco()], Rng.from('m'));
    expect(c.heroi.recursoAtual).toBe(100);
    c.step();
    expect(c.heroi.recursoAtual).toBeLessThan(1);
    for (let i = 0; i < 20; i++) c.step(); // 1 s
    expect(c.heroi.recursoAtual).toBeGreaterThan(9);
  });

  it('habilidades seguem prioridade e condição (Executar só abaixo de 20%)', () => {
    const executar: AbilityDef = {
      id: 'executar',
      nome: 'Executar',
      descricao: '',
      custo: 0,
      recarga: 0,
      prioridade: 1,
      condicao: { alvoVidaAbaixo: 0.2 },
      efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { base: 1 }, escola: 'fisico' }],
    };
    const golpe: AbilityDef = {
      id: 'golpe',
      nome: 'Golpe',
      descricao: '',
      custo: 0,
      recarga: 0,
      prioridade: 2,
      efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { base: 10 }, escola: 'fisico' }],
    };
    const { eventos } = rodar(heroi({ stats: stats({ dano: 0 }), habilidades: [golpe, executar] }), [
      combatente({ uid: 'a', side: 'inimigo', stats: stats({ vidaMax: 100, dano: 0, aps: 0.2 }) }),
    ]);
    const usos = eventos.filter((e): e is Extract<CombatEvent, { tipo: 'habilidade' }> => e.tipo === 'habilidade');
    const primeiroExec = usos.findIndex((u) => u.id === 'executar');
    expect(primeiroExec).toBeGreaterThan(0);
    expect(usos.slice(0, primeiroExec).every((u) => u.id === 'golpe')).toBe(true);
    expect(usos.slice(primeiroExec).every((u) => u.id === 'executar')).toBe(true);
    // Recarga global: no máximo 1 habilidade por segundo.
    for (let i = 1; i < usos.length; i++) expect(usos[i]!.t - usos[i - 1]!.t).toBeGreaterThanOrEqual(999);
  });

  it('suprema dispara ao carregar e atinge todos os inimigos', () => {
    const sup: UltimateDef = {
      id: 'sup',
      nome: 'Suprema',
      descricao: '',
      cargaMax: 100,
      cargaPorSegundo: 50,
      cargaPorAcerto: 0,
      cargaPorDanoRecebido: 0,
      efeitos: [{ tipo: 'dano', alvo: 'todosInimigos', valor: { base: 5 }, escola: 'arcano' }],
    };
    const { c, eventos } = rodar(heroi({ stats: stats({ dano: 0 }), suprema: sup }), [boneco('a'), boneco('b')], 't', 2.01);
    expect(eventos.filter((e) => e.tipo === 'habilidade' && e.suprema).length).toBe(1);
    const alvos = danos(eventos)
      .filter((e) => e.origem.tipo === 'suprema')
      .map((e) => e.para)
      .sort();
    expect(alvos).toEqual(['a', 'b']);
    expect(c.heroi.cargaSuprema).toBeLessThan(10);
  });
});

describe('Combate: gatilhos', () => {
  it('aoCritar dispara efeitos e roubo de vida usa o dano causado', () => {
    const h = heroi({
      vida: 50,
      stats: stats({ dano: 20, critChance: 1, critDano: 1 }),
      gatilhos: [{ id: 'vampiro', gatilho: 'aoCritar', efeitos: [{ tipo: 'cura', alvo: 'self', valor: { danoCausado: 0.5 } }] }],
    });
    const { eventos } = rodar(h, [boneco()], 't', 2);
    const curas = eventos.filter((e): e is Extract<CombatEvent, { tipo: 'cura' }> => e.tipo === 'cura');
    expect(curas.length).toBeGreaterThan(0);
    for (const c of curas) expect(c.valor).toBeGreaterThanOrEqual(9);
  });

  it('vidaAbaixo dispara uma única vez', () => {
    const inimigo = combatente({
      uid: 'a',
      side: 'inimigo',
      stats: stats({ vidaMax: 200, dano: 0, aps: 0.2 }),
      gatilhos: [
        {
          id: 'raiva',
          gatilho: 'vidaAbaixo',
          limiar: 0.5,
          efeitos: [{ tipo: 'status', alvo: 'self', status: 'enfurecido', duracao: 999, valor: { base: 0.5 } }],
        },
      ],
    });
    const { eventos } = rodar(heroi({ stats: stats({ dano: 10, aps: 2 }) }), [inimigo]);
    expect(eventos.filter((e) => e.tipo === 'statusAplicado' && e.status === 'enfurecido').length).toBe(1);
  });

  it('gatilhos não disparam em cascata', () => {
    const h = heroi({
      stats: stats({ dano: 1, critChance: 1 }),
      gatilhos: [{ id: 'eco', gatilho: 'aoCritar', efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { base: 1 }, escola: 'arcano' }] }],
    });
    const { eventos } = rodar(h, [boneco()], 't', 3);
    const ataques = danos(eventos).filter((e) => e.origem.tipo === 'ataque').length;
    const ecos = danos(eventos).filter((e) => e.origem.tipo === 'gatilho').length;
    expect(ataques).toBeGreaterThan(0);
    expect(ecos).toBe(ataques);
  });
});

describe('Combate: mecânicas de chefe', () => {
  type Mec = NonNullable<CombatantInit['mecanicas']>[number];
  const chefe = (mecanicas: Mec[], p: Partial<CombatantInit> = {}) =>
    combatente({ uid: 'chefe', side: 'inimigo', tier: 'chefe', stats: stats({ vidaMax: 1000, dano: 5, aps: 1 }), mecanicas, ...p });
  const mecs = (ev: CombatEvent[]) => ev.filter((e): e is Extract<CombatEvent, { tipo: 'mecanica' }> => e.tipo === 'mecanica');

  it('enrage por tempo multiplica dano e velocidade', () => {
    const h = heroi({ stats: stats({ vidaMax: 100000, dano: 0 }) });
    const { eventos } = rodar(h, [chefe([{ tipo: 'enrage', nome: 'Ira', texto: '', aposSegundos: 10, danoMult: 2, apsMult: 2 }])], 't', 20);
    expect(mecs(eventos).length).toBe(1);
    const golpes = danos(eventos).filter((e) => e.de === 'chefe');
    const antes = golpes.filter((e) => e.t < 10000);
    const depois = golpes.filter((e) => e.t >= 10100);
    expect(depois.length).toBeGreaterThan(antes.length * 1.6);
    expect(Math.min(...depois.map((e) => e.valor))).toBeGreaterThanOrEqual(9);
  });

  it('fase por % de vida aplica modificadores e efeitos uma vez', () => {
    const fase: Mec = {
      tipo: 'fase', nome: 'Fase 2', texto: '', abaixoDeVida: 0.5,
      modificadores: [{ stat: 'armadura', op: 'add', value: 0.5, source: 'f' }],
      efeitos: [{ tipo: 'cura', alvo: 'self', valor: { vidaMax: 0.1 } }],
    };
    const { c, eventos } = rodar(heroi({ stats: stats({ dano: 40, aps: 2 }) }), [chefe([fase])], 't', 30);
    expect(mecs(eventos).length).toBe(1);
    expect(c.inimigos[0]?.stats.armadura).toBeCloseTo(0.5);
    expect(eventos.some((e) => e.tipo === 'cura' && e.para === 'chefe')).toBe(true);
  });

  it('invocar adds respeita o máximo e precisa matar todos para vencer', () => {
    const inv: Mec = { tipo: 'invocar', nome: 'Chamado', texto: '', intervalo: 2, inimigoId: 'add', quantidade: 2, max: 3 };
    const eventos: CombatEvent[] = [];
    const c = new Combat(heroi({ stats: stats({ dano: 0 }) }), [chefe([inv], { stats: stats({ vidaMax: 50, dano: 0, aps: 0.2 }) })], Rng.from('i'), {
      onEvent: (e) => eventos.push(e),
      criarInvocacao: (defId, uid) => combatente({ uid, defId, side: 'inimigo', stats: stats({ vidaMax: 10, dano: 0, aps: 0.2 }) }),
    });
    while (c.t < 10) c.step();
    expect(eventos.filter((e) => e.tipo === 'invocacao').length).toBe(3);
    expect(c.inimigos.filter((i) => i.vivo).length).toBe(4);
  });

  it('escudo rápido: se não for quebrado a tempo, pune o herói', () => {
    const esc: Mec = {
      tipo: 'escudoRapido', nome: 'Barreira', texto: '', aCada: 100, primeiraEm: 1, duracao: 3,
      valor: { base: 10000 }, punicao: [{ tipo: 'dano', alvo: 'alvo', valor: { base: 77 }, escola: 'sombra', podeCritar: false, ignoraArmadura: true }],
    };
    const { eventos } = rodar(heroi({ stats: stats({ vidaMax: 1000, dano: 1 }) }), [chefe([esc], { stats: stats({ vidaMax: 1000, dano: 0, aps: 0.2 }) })], 't', 6);
    const punicao = (ev: CombatEvent[]) => danos(ev).some((e) => e.para === 'heroi' && e.origem.tipo === 'habilidade' && e.origem.id === 'mecanica:escudoRapido');
    expect(punicao(eventos)).toBe(true);
    // Quebrando rápido não há punição
    const { eventos: ev2 } = rodar(heroi({ stats: stats({ vidaMax: 1000, dano: 100, aps: 5 }) }), [
      chefe([{ ...esc, valor: { base: 50 } }], { stats: stats({ vidaMax: 100000, dano: 0, aps: 0.2 }) }),
    ], 't', 6);
    expect(punicao(ev2)).toBe(false);
  });

  it('autocura e golpe forte com aviso', () => {
    const { eventos } = rodar(heroi({ stats: stats({ vidaMax: 10000, dano: 30 }) }), [
      chefe([
        { tipo: 'autocura', nome: 'Cura', texto: '', aCada: 5, fracaoVida: 0.1 },
        { tipo: 'golpeForte', nome: 'Golpe', texto: '', aCada: 8, aviso: 2, efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { base: 500 }, escola: 'fisico', podeCritar: false, ignoraArmadura: true }] },
      ], { stats: stats({ vidaMax: 1000, dano: 0, aps: 0.2 }) }),
    ], 't', 11);
    expect(eventos.some((e) => e.tipo === 'cura' && e.para === 'chefe')).toBe(true);
    const aviso = mecs(eventos).find((e) => e.aviso);
    const golpe = danos(eventos).find((e) => e.para === 'heroi' && e.origem.tipo === 'habilidade' && e.origem.id === 'mecanica:golpeForte');
    expect(aviso?.t).toBe(8000);
    expect(golpe?.t).toBe(10000);
  });

  it('perderVida (custo de maldição) tira vida direto e pode matar', () => {
    const h = heroi({
      vida: 15,
      stats: stats({ vidaMax: 100, dano: 0, armadura: 0.7 }),
      gatilhos: [{ id: 'maldicao', gatilho: 'intervalo', intervalo: 1, efeitos: [{ tipo: 'perderVida', fracao: 0.1 }] }],
    });
    const { c } = rodar(h, [boneco()]);
    expect(c.resultado?.vencedor).toBe('inimigo');
    expect(c.resultado?.duracao).toBeCloseTo(2, 1);
  });
});
