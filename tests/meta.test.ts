import { describe, expect, it } from 'vitest';
import { POLITICA_GULOSA } from '../src/game/ai';
import { CLASSES, CLASSES_INICIAIS } from '../src/game/data/classes';
import { RELICS, TREE } from '../src/game/data/meta';
import { EMBLEMAS } from '../src/game/formulas';
import {
  calcularEmblemas,
  comprarNo,
  custoMinimoDaArvore,
  finalizarCorrida,
  metaBonus,
  novoMeta,
  parametrosDaCorrida,
  podeComprarNo,
} from '../src/game/meta';
import { createRun, escolherNo, montarBuild, nosDisponiveis, resolverCombate, statsDoHeroi, type RunState } from '../src/game/run';
import { simularCorrida } from '../src/game/simulate';
import type { ClassId } from '../src/game/types';
import { irAte } from './helpers';

function corridaTerminada(semente = 'fim'): RunState {
  return simularCorrida({ semente, classeId: 'guerreiro', specId: 'armas' }, POLITICA_GULOSA);
}

describe('Classes do MVP', () => {
  it('4 classes com 2 especializações; começa com Guerreiro e Mago', () => {
    const cls = Object.values(CLASSES);
    expect(cls.map((c) => c?.id).sort()).toEqual(['guerreiro', 'ladino', 'mago', 'sacerdote']);
    for (const c of cls) expect(c?.specs.length).toBe(2);
    expect(CLASSES_INICIAIS).toEqual(['guerreiro', 'mago']);
  });

  it('todas as especializações jogam uma corrida completa', () => {
    for (const c of Object.values(CLASSES)) {
      for (const s of c!.specs) {
        const r = simularCorrida({ semente: `spec-${s.id}`, classeId: c!.id, specId: s.id }, POLITICA_GULOSA);
        expect(r.etapa, s.id).toBe('fim');
      }
    }
  });
});

describe('Árvore permanente', () => {
  it('compra respeita custo, requisito e nível máximo', () => {
    const m = novoMeta();
    expect(podeComprarNo(m, 'vigor')).toBe(false);
    m.emblemas = 1000;
    expect(podeComprarNo(m, 'couraca')).toBe(false); // requer vigor 1
    comprarNo(m, 'vigor');
    expect(m.emblemas).toBe(1000 - 5);
    expect(podeComprarNo(m, 'couraca')).toBe(true);
    comprarNo(m, 'vigor');
    comprarNo(m, 'vigor');
    expect(podeComprarNo(m, 'vigor')).toBe(false); // máximo
    expect(() => comprarNo(m, 'vigor')).toThrow();
  });

  it('bônus são pequenos e se somam por nível', () => {
    const m = novoMeta();
    m.emblemas = 10000;
    for (const n of TREE) while (podeComprarNo(m, n.id)) comprarNo(m, n.id);
    const b = metaBonus(m);
    expect(b.vidaPct).toBeCloseTo(0.15);
    expect(b.danoPct).toBeCloseTo(0.12);
    expect(b.relancamentos).toBe(2);
    expect(b.pocoes).toBe(1);
    expect(b.bencaoInicial).toBe(1);
    // árvore cheia continua modesta
    expect(b.vidaPct).toBeLessThanOrEqual(0.2);
    expect(b.danoPct).toBeLessThanOrEqual(0.2);
  });

  it('bônus da árvore entram na corrida (relançamentos, poção, bênção inicial)', () => {
    const m = novoMeta();
    m.emblemas = 10000;
    for (const n of TREE) while (podeComprarNo(m, n.id)) comprarNo(m, n.id);
    const run = createRun(parametrosDaCorrida(m, { semente: 'a', classeId: 'mago', specId: 'fogo', reliquia: null, dificuldade: 'normal' }));
    expect(run.relancamentos).toBe(3);
    expect(run.heroi.consumiveis).toEqual(['pocaoDeCura']);
    expect(run.etapa).toBe('recompensa');
    expect(run.oferta?.origem).toBe('inicio');
    const base = createRun({ semente: 'a', classeId: 'mago', specId: 'fogo' });
    expect(statsDoHeroi(run).vidaMax).toBeGreaterThan(statsDoHeroi(base).vidaMax);
  });
});

describe('Emblemas e fim de corrida', () => {
  it('toda corrida dá ao menos o mínimo, que compra 1 melhoria', () => {
    const run = createRun({ semente: 'x', classeId: 'guerreiro', specId: 'armas' });
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    resolverCombate(run, { vencedor: 'inimigo', motivo: 'eliminacao', duracao: 1, vidaFinalHeroi: 0, inimigosMortos: [] });
    expect(calcularEmblemas(run).total).toBe(EMBLEMAS.minimo);
    expect(EMBLEMAS.minimo).toBeGreaterThanOrEqual(custoMinimoDaArvore());
  });

  it('mais progresso = mais Emblemas; Heroico multiplica', () => {
    const run = corridaTerminada();
    const st = run.estatisticas;
    const esperado = EMBLEMAS.base + Math.round(st.nosVencidos * EMBLEMAS.porNo) + st.elitesVencidas * EMBLEMAS.porElite + st.miniChefesVencidos * EMBLEMAS.porMiniChefe;
    expect(calcularEmblemas(run).total).toBe(Math.max(EMBLEMAS.minimo, esperado + (run.resultado === 'vitoria' ? EMBLEMAS.porChefe + EMBLEMAS.vitoria : 0)));
    const heroico = { ...run, dificuldade: 'heroico' as const };
    expect(calcularEmblemas(heroico).total).toBeGreaterThan(calcularEmblemas(run).total);
  });

  it('finalizar atualiza meta (emblemas, bestiário, catálogo) uma única vez', () => {
    const m = novoMeta();
    const run = corridaTerminada('idem');
    const r1 = finalizarCorrida(m, run);
    const snap = JSON.stringify(m);
    const r2 = finalizarCorrida(m, run);
    expect(r2).toBe(r1);
    expect(JSON.stringify(m)).toBe(snap);
    expect(m.emblemas).toBe(r1.emblemas);
    expect(m.estatisticas.corridas).toBe(1);
    expect(Object.keys(m.bestiario).length).toBeGreaterThan(0);
    expect(m.bencaosVistas.length).toBeGreaterThan(0);
    expect(m.historico[0]?.emblemas).toBe(r1.emblemas);
  });

  it('conquistas desbloqueiam Ladino (mini-chefe), Sacerdote (elite) e Heroico (vitória)', () => {
    const m = novoMeta();
    const run = createRun({ semente: 'conq', classeId: 'guerreiro', specId: 'armas' });
    irAte(run, 'chefe'); // o caminho passa pelo mini-chefe
    run.estatisticas.elitesVencidas = 1;
    resolverCombate(run, { vencedor: 'heroi', motivo: 'eliminacao', duracao: 5, vidaFinalHeroi: 10, inimigosMortos: [] });
    const r = finalizarCorrida(m, run);
    expect(r.classesDesbloqueadas.sort()).toEqual(['ladino', 'sacerdote'] as ClassId[]);
    expect(r.heroicoDesbloqueado).toBe(true);
    expect(m.heroicoDesbloqueado).toBe(true);
  });

  it('classe bloqueada, Heroico bloqueado e relíquia não conquistada são recusados', () => {
    const m = novoMeta();
    const base = { semente: 's', specId: 'assassinato', reliquia: null, dificuldade: 'normal' as const };
    expect(() => parametrosDaCorrida(m, { ...base, classeId: 'ladino' })).toThrow();
    expect(() => parametrosDaCorrida(m, { ...base, classeId: 'guerreiro', specId: 'armas', dificuldade: 'heroico' })).toThrow();
    expect(() => parametrosDaCorrida(m, { ...base, classeId: 'guerreiro', specId: 'armas', reliquia: 'presaDeProtodraco' })).toThrow();
  });
});

describe('Relíquias', () => {
  it('chefe sempre deixa uma relíquia de chefe ainda não conquistada', () => {
    const run = createRun({ semente: 'rel', classeId: 'guerreiro', specId: 'armas', reliquiasPossuidas: ['coroaDoSenhorDaGuerra'] });
    irAte(run, 'chefe');
    resolverCombate(run, { vencedor: 'heroi', motivo: 'eliminacao', duracao: 5, vidaFinalHeroi: 10, inimigosMortos: [] });
    expect(run.reliquiasObtidas).toEqual(['laminaDeUtgarde']);
    const m = novoMeta();
    finalizarCorrida(m, run);
    expect(m.reliquias).toContain('laminaDeUtgarde');
  });

  it('relíquia equipada entra na build', () => {
    const run = createRun({ semente: 'eq', classeId: 'mago', specId: 'fogo', reliquia: 'presaDeProtodraco' });
    expect(montarBuild(run).modificadores.some((m) => m.source === 'reliquia:presaDeProtodraco')).toBe(true);
    expect(RELICS.filter((r) => r.fonte === 'elite').length).toBeGreaterThanOrEqual(2);
  });
});
