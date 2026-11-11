import type { MapNode } from '../src/game/map';
import { describe, expect, it } from 'vitest';
import { POLITICA_ALEATORIA, POLITICA_GULOSA } from '../src/game/ai';
import { CURA_FOGUEIRA, MAX_CONSUMIVEIS } from '../src/game/formulas';

import {
  abrirTesouro,
  bencaosMelhoraveis,
  createRun,
  descansar,
  escolherBencao,
  escolherNo,
  ganharConsumivel,
  linhaAtual,
  melhorarBencao,
  montarBuild,
  noAtual,
  nosDisponiveis,
  prepararCombate,
  relancarOferta,
  resolverCombate,
  statsDoHeroi,
  usarConsumivel,
  type RunState,
} from '../src/game/run';
import { simularCorrida } from '../src/game/simulate';
import { irAte } from './helpers';
import type { CombatResult } from '../src/game/types';

const novo = (semente = 'r') => createRun({ semente, classeId: 'guerreiro', specId: 'armas' });
const vitoria = (vida = 100, mortos: string[] = []): CombatResult => ({ vencedor: 'heroi', motivo: 'eliminacao', duracao: 5, vidaFinalHeroi: vida, inimigosMortos: mortos });

describe('Corrida: mapa e combate', () => {
  it('começa no mapa com os nós da linha 0 disponíveis', () => {
    const run = novo();
    expect(run.etapa).toBe('mapa');
    expect(linhaAtual(run)).toBe(-1);
    expect(nosDisponiveis(run).map((n) => n.id)).toEqual(run.mapa.linhas[0]?.map((n) => n.id));
  });

  it('só aceita nós válidos e segue as ligações do mapa', () => {
    const run = novo();
    expect(() => escolherNo(run, '5-0')).toThrow();
    const primeiro = nosDisponiveis(run)[0] as MapNode;
    escolherNo(run, primeiro.id);
    expect(run.etapa).toBe('combate');
    expect(nosDisponiveis(run)).toEqual([]);
    resolverCombate(run, vitoria());
    escolherBencao(run, 0);
    expect(nosDisponiveis(run).map((n) => n.id)).toEqual(primeiro.filhos);
  });

  it('mesma semente + mesmas escolhas = mesma corrida', () => {
    const p = { semente: 'det', classeId: 'guerreiro' as const, specId: 'armas' };
    expect(simularCorrida(p, POLITICA_GULOSA)).toEqual(simularCorrida(p, POLITICA_GULOSA));
  });

  it('o estado é JSON puro e o combate do nó atual se repete após salvar/carregar', () => {
    const run = createRun({ semente: 'save', classeId: 'mago', specId: 'fogo' });
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    const copia = JSON.parse(JSON.stringify(run));
    expect(copia).toEqual(run);
    expect(prepararCombate(copia).run()).toEqual(prepararCombate(run).run());
  });

  it('vitória dá ouro e abre oferta de 3 bênçãos; escolher volta ao mapa', () => {
    const run = novo();
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    resolverCombate(run, vitoria(100, ['guerreiroVrykul']));
    expect(run.ouro).toBeGreaterThan(0);
    expect(run.etapa).toBe('recompensa');
    expect(run.oferta?.opcoes.length).toBe(3);
    expect(run.estatisticas.abates.guerreiroVrykul).toBe(1);
    expect(run.estatisticas.bencaosVistas.length).toBe(3);
    escolherBencao(run, 0);
    expect(run.etapa).toBe('mapa');
    expect(run.heroi.bencaos.length).toBe(1);
  });

  it('relançar troca as opções e gasta um relançamento', () => {
    const run = novo('rel');
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    resolverCombate(run, vitoria());
    const antes = JSON.stringify(run.oferta?.opcoes);
    const n = run.relancamentos;
    relancarOferta(run);
    expect(run.relancamentos).toBe(n - 1);
    expect(JSON.stringify(run.oferta?.opcoes)).not.toBe(antes);
    if (run.relancamentos === 0) expect(() => relancarOferta(run)).toThrow();
  });

  it('elite garante bênção rara ou melhor', () => {
    for (let i = 0; i < 20; i++) {
      const run = novo(`elite${i}`);
      if (!irAte(run, 'elite')) continue;
      resolverCombate(run, vitoria());
      for (const o of run.oferta?.opcoes ?? []) expect(['rara', 'epica', 'lendaria']).toContain(o.raridade);
    }
  });

  it('derrota registra a linha de morte', () => {
    const run = novo('d');
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    resolverCombate(run, { vencedor: 'inimigo', motivo: 'eliminacao', duracao: 5, vidaFinalHeroi: 0, inimigosMortos: [] });
    expect(run.resultado).toBe('derrota');
    expect(run.linhaMorte).toBe(0);
    expect(run.etapa).toBe('fim');
  });

  it('vencer o chefe termina a corrida com vitória', () => {
    const run = novo('c');
    irAte(run, 'chefe');
    expect(noAtual(run)?.tipo).toBe('chefe');
    resolverCombate(run, vitoria(10, ['senhorDeUtgarde']));
    expect(run.resultado).toBe('vitoria');
    expect(run.etapa).toBe('fim');
  });

  it('o chefe invoca adds no combate real (mecânica de fase)', () => {
    const run = novo('inv');
    irAte(run, 'chefe');
    run.heroi.modificadores.push({ stat: 'dano', op: 'mult', value: 3, source: 'teste' }, { stat: 'vidaMax', op: 'mult', value: 5, source: 'teste' });
    run.heroi.vida = statsDoHeroi(run).vidaMax;
    const tipos: string[] = [];
    const r = prepararCombate(run, { onEvent: (e) => tipos.push(e.tipo) }).run();
    expect(tipos).toContain('mecanica');
    expect(tipos).toContain('invocacao');
    expect(r.inimigosMortos).toContain('escravoAtormentado');
  });
});

describe('Corrida: fogueira, tesouro, consumíveis', () => {
  it('fogueira: descansar cura 30% da vida máxima', () => {
    const run = createRun({ semente: 'f', classeId: 'mago', specId: 'fogo' });
    expect(irAte(run, 'fogueira')).not.toBeNull();
    run.heroi.vida = 1;
    descansar(run);
    expect(run.heroi.vida).toBe(1 + Math.round(statsDoHeroi(run).vidaMax * CURA_FOGUEIRA));
    expect(run.etapa).toBe('mapa');
  });

  it('fogueira: melhorar sobe o nível de uma bênção', () => {
    const run = novo('fm');
    run.heroi.bencaos.push({ id: 'poderArcano', nivel: 1, raridade: 'comum' });
    irAte(run, 'fogueira');
    expect(bencaosMelhoraveis(run).map((b) => b.id)).toEqual(['poderArcano']);
    const antes = statsDoHeroi(run).dano;
    melhorarBencao(run, 'poderArcano');
    expect(run.heroi.bencaos[0]?.nivel).toBe(2);
    expect(statsDoHeroi(run).dano).toBeGreaterThan(antes);
  });

  it('tesouro oferece bênção incomum ou melhor', () => {
    for (let i = 0; i < 40; i++) {
      const run = novo(`t${i}`);
      if (!irAte(run, 'tesouro')) continue;
      abrirTesouro(run);
      expect(run.etapa).toBe('recompensa');
      for (const o of run.oferta?.opcoes ?? []) expect(o.raridade).not.toBe('comum');
      return;
    }
    throw new Error('nenhum mapa com tesouro alcançável');
  });

  it('consumíveis: limite da bolsa, poção cura e frasco vale só para o próximo combate', () => {
    const run = novo('cons');
    for (let i = 0; i < MAX_CONSUMIVEIS; i++) expect(ganharConsumivel(run, 'pocaoDeCura')).toBe(true);
    expect(ganharConsumivel(run, 'pocaoDeCura')).toBe(false);
    run.heroi.vida = 10;
    usarConsumivel(run, 0);
    expect(run.heroi.vida).toBeGreaterThan(10);
    run.heroi.consumiveis = ['frascoDePoder'];
    usarConsumivel(run, 0);
    expect(run.heroi.buffs).toEqual(['frascoDePoder']);
    expect(montarBuild(run, true).modificadores.some((m) => m.source === 'buff:frascoDePoder')).toBe(true);
    expect(montarBuild(run).modificadores.some((m) => m.source === 'buff:frascoDePoder')).toBe(false);
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    resolverCombate(run, vitoria());
    expect(run.heroi.buffs).toEqual([]);
  });

  it('ganhar vida máxima também cura o ganho', () => {
    const run = novo('vm');
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    resolverCombate(run, vitoria(50));
    run.oferta!.opcoes[0] = { id: 'feInabalavel', raridade: 'comum' };
    const vidaAntes = run.heroi.vida;
    const maxAntes = statsDoHeroi(run).vidaMax;
    escolherBencao(run, 0);
    expect(run.heroi.vida - vidaAntes).toBe(statsDoHeroi(run).vidaMax - maxAntes);
  });
});

describe('Corrida: simulação', () => {
  it('corridas simuladas sempre terminam, com qualquer perfil', () => {
    for (let i = 0; i < 30; i++) {
      for (const pol of [POLITICA_ALEATORIA, POLITICA_GULOSA]) {
        const mago = i % 2 === 1;
        const r = simularCorrida({ semente: `fim-${i}`, classeId: mago ? 'mago' : 'guerreiro', specId: mago ? 'fogo' : 'armas' }, pol);
        expect(r.etapa).toBe('fim');
        expect(['vitoria', 'derrota']).toContain(r.resultado);
      }
    }
  });

  it('progressão permanente aumenta os atributos iniciais', () => {
    const base = novo('m');
    const meta = createRun({ semente: 'm', classeId: 'guerreiro', specId: 'armas', meta: { vidaPct: 0.1, danoPct: 0.1, critChance: 0, armadura: 0 } });
    expect(statsDoHeroi(meta).vidaMax).toBeGreaterThan(statsDoHeroi(base).vidaMax);
    expect(meta.heroi.vida).toBe(statsDoHeroi(meta).vidaMax);
  });
});
