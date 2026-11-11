import { describe, expect, it } from 'vitest';
import { EVENTS, getEvent } from '../src/game/data/events';
import { CURSED_ITEMS } from '../src/game/data/items';
import { getEnemy } from '../src/game/data/enemies';
import { PRECO_PURIFICAR } from '../src/game/formulas';
import {
  comprar,
  concluirEvento,
  createRun,
  escolhaDisponivel,
  escolherOpcaoEvento,
  montarBuild,
  podeComprar,
  sairDaLoja,
  statsDoHeroi,
  type RunState,
} from '../src/game/run';
import { irAte } from './helpers';

const novo = (semente: string) => createRun({ semente, classeId: 'guerreiro', specId: 'armas' });

/** Corrida posicionada num evento específico. */
function noEvento(eventoId: string, semente = 'ev'): RunState {
  const run = novo(semente);
  const no = run.mapa.linhas.flat().find((n) => n.tipo === 'evento');
  if (!no) throw new Error('mapa sem evento');
  no.eventoId = eventoId;
  irAte(run, 'evento');
  return run;
}

describe('Eventos', () => {
  it('MVP tem ao menos 8 eventos, cada um com 2–3 escolhas e inimigos válidos', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
    for (const e of EVENTS) {
      expect(e.escolhas.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.escolhas.length, e.id).toBeLessThanOrEqual(3);
      for (const c of e.escolhas)
        for (const r of c.resultados)
          for (const op of r.ops) if (op.op === 'combate') for (const id of op.inimigos) expect(() => getEnemy(id)).not.toThrow();
    }
  });

  it('o mapa atribui eventos aos nós de evento sem repetir enquanto houver novos', () => {
    for (let i = 0; i < 50; i++) {
      const run = novo(`m${i}`);
      const ids = run.mapa.linhas.flat().filter((n) => n.tipo === 'evento').map((n) => n.eventoId);
      for (const id of ids) expect(() => getEvent(id ?? '')).not.toThrow();
      if (ids.length <= EVENTS.length) expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('Altar de Saronita: trocar vida máxima por item amaldiçoado', () => {
    const run = noEvento('altarDeSaronita');
    const antes = statsDoHeroi(run).vidaMax;
    escolherOpcaoEvento(run, 0);
    expect(run.heroi.itens.length).toBe(1);
    expect(run.evento?.resultado).toContain('Você obtém');
    concluirEvento(run);
    expect(run.etapa).toBe('mapa');
    // o item pode alterar a vida máxima, mas o modificador do altar está lá
    expect(run.heroi.modificadores.some((m) => m.source === 'evento' && m.stat === 'vidaMax')).toBe(true);
    expect(statsDoHeroi(run).vidaMax).not.toBe(antes);
  });

  it('Brann: revela o mapa e a próxima recompensa de combate é perdida', () => {
    const run = noEvento('brann');
    escolherOpcaoEvento(run, 0);
    concluirEvento(run);
    expect(run.mapaRevelado).toBe(true);
    expect(run.perderProximaRecompensa).toBe(true);
  });

  it('escolhas com requisito de ouro ficam indisponíveis sem ouro', () => {
    const run = noEvento('mercadorSuspeito');
    run.ouro = 10;
    expect(escolhaDisponivel(run, 0)).toBe(false);
    expect(() => escolherOpcaoEvento(run, 0)).toThrow();
    run.ouro = 100;
    escolherOpcaoEvento(run, 0);
    expect(run.ouro).toBe(40);
  });

  it('oferta pendente vira tela de recompensa e emboscada vira combate', () => {
    const ofertas = noEvento('santuarioDeHodir');
    escolherOpcaoEvento(ofertas, 0);
    concluirEvento(ofertas);
    expect(ofertas.etapa).toBe('recompensa');
    expect(ofertas.oferta?.faccao).toBe('filhosDeHodir');

    let viuEmboscada = false;
    for (let i = 0; i < 40 && !viuEmboscada; i++) {
      const run = noEvento('arsenalAbandonado', `arsenal${i}`);
      escolherOpcaoEvento(run, 0);
      concluirEvento(run);
      if (run.etapa === 'combate') {
        viuEmboscada = true;
        expect(run.encontro?.inimigos).toEqual(['loboDeUtgarde', 'loboDeUtgarde']);
      } else expect(run.etapa).toBe('recompensa');
    }
    expect(viuEmboscada).toBe(true);
  });

  it('resultado do evento é determinístico pela semente', () => {
    const a = noEvento('fonteDoFiorde', 'x');
    const b = noEvento('fonteDoFiorde', 'x');
    escolherOpcaoEvento(a, 0);
    escolherOpcaoEvento(b, 0);
    expect(a.evento?.resultado).toBe(b.evento?.resultado);
  });
});

describe('Itens amaldiçoados', () => {
  it('têm bônus e maldição; purificar remove só a maldição', () => {
    const run = novo('it');
    run.heroi.itens.push({ id: 'laminaDeSaronita', purificado: false });
    const b = montarBuild(run);
    expect(b.modificadores.some((m) => m.source === 'laminaDeSaronita')).toBe(true);
    expect(b.gatilhos.some((g) => g.id.startsWith('laminaDeSaronita:maldicao'))).toBe(true);
    run.heroi.itens[0]!.purificado = true;
    const p = montarBuild(run);
    expect(p.modificadores.some((m) => m.source === 'laminaDeSaronita')).toBe(true);
    expect(p.gatilhos.some((g) => g.id.startsWith('laminaDeSaronita:maldicao'))).toBe(false);
    expect(CURSED_ITEMS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Vendedor goblin', () => {
  function naLoja(): RunState {
    for (let i = 0; i < 60; i++) {
      const run = novo(`loja${i}`);
      if (irAte(run, 'vendedor')) return run;
    }
    throw new Error('sem vendedor alcançável');
  }

  it('vende bênçãos, consumíveis, cura e purificação; respeita o ouro', () => {
    const run = naLoja();
    const tipos = run.loja?.map((i) => i.tipo);
    expect(tipos?.filter((t) => t === 'bencao').length).toBe(3);
    expect(tipos?.filter((t) => t === 'consumivel').length).toBe(2);
    expect(tipos).toContain('cura');
    expect(tipos).toContain('purificar');

    run.ouro = 0;
    expect(run.loja?.some((_, i) => podeComprar(run, i))).toBe(false);

    run.ouro = 1000;
    const iBencao = run.loja!.findIndex((i) => i.tipo === 'bencao');
    comprar(run, iBencao);
    expect(run.heroi.bencaos.length).toBe(1);
    expect(podeComprar(run, iBencao)).toBe(false); // vendido

    const iPur = run.loja!.findIndex((i) => i.tipo === 'purificar');
    expect(podeComprar(run, iPur)).toBe(false); // nada a purificar
    run.heroi.itens.push({ id: 'olhoDeSaronita', purificado: false });
    const ouro = run.ouro;
    comprar(run, iPur);
    expect(run.heroi.itens[0]?.purificado).toBe(true);
    expect(run.ouro).toBe(ouro - PRECO_PURIFICAR);

    sairDaLoja(run);
    expect(run.etapa).toBe('mapa');
  });
});
