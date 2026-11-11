/**
 * Progressão permanente: Emblemas, árvore, relíquias, conquistas, coleção, desbloqueios.
 * Estado JSON puro; funções sem efeitos externos (quem salva é a ponte da interface).
 */

import { CLASSES_INICIAIS } from './data/classes';
import { ACHIEVEMENTS, RELICS_BY_ID, TREE, TREE_BY_ID, type AchievementDef } from './data/meta';
import { EMBLEMAS, META_ZERO, type Dificuldade, type MetaBonus } from './formulas';
import { getBlessing } from './data/blessings';
import type { NewRunParams, ResumoFinal, RunState } from './run';
import { findNode } from './map';
import type { ClassId } from './types';

export const META_VERSAO = 1;

export interface RunHistorico {
  classeId: ClassId;
  specId: string;
  dificuldade: Dificuldade;
  resultado: 'vitoria' | 'derrota';
  linha: number;
  emblemas: number;
}

export interface MetaState {
  versao: number;
  emblemas: number;
  emblemasTotais: number;
  /** Nível comprado de cada nó da árvore. */
  arvore: Record<string, number>;
  reliquias: string[];
  reliquiaEquipada: string | null;
  classesDesbloqueadas: ClassId[];
  conquistas: string[];
  heroicoDesbloqueado: boolean;
  /** Abates por inimigo (bestiário). */
  bestiario: Record<string, number>;
  /** Bênçãos já vistas em ofertas e já obtidas (catálogo). */
  bencaosVistas: string[];
  bencaosObtidas: string[];
  estatisticas: { corridas: number; vitorias: number; vitoriasHeroico: number; melhorLinha: number };
  /** Últimas corridas (mais recente primeiro). */
  historico: RunHistorico[];
}

export function novoMeta(): MetaState {
  return {
    versao: META_VERSAO,
    emblemas: 0,
    emblemasTotais: 0,
    arvore: {},
    reliquias: [],
    reliquiaEquipada: null,
    classesDesbloqueadas: [...CLASSES_INICIAIS],
    conquistas: [],
    heroicoDesbloqueado: false,
    bestiario: {},
    bencaosVistas: [],
    bencaosObtidas: [],
    estatisticas: { corridas: 0, vitorias: 0, vitoriasHeroico: 0, melhorLinha: 0 },
    historico: [],
  };
}

// ---------------------------------------------------------------------------
// Árvore
// ---------------------------------------------------------------------------

export function nivelNo(meta: MetaState, id: string): number {
  return meta.arvore[id] ?? 0;
}

export function custoProximoNivel(meta: MetaState, id: string): number | null {
  const def = TREE_BY_ID[id];
  if (!def) return null;
  return def.custos[nivelNo(meta, id)] ?? null;
}

export function requisitosCumpridos(meta: MetaState, id: string): boolean {
  const def = TREE_BY_ID[id];
  return !!def && (def.requer ?? []).every((r) => nivelNo(meta, r.id) >= r.nivel);
}

export function podeComprarNo(meta: MetaState, id: string): boolean {
  const custo = custoProximoNivel(meta, id);
  return custo !== null && requisitosCumpridos(meta, id) && meta.emblemas >= custo;
}

export function comprarNo(meta: MetaState, id: string): void {
  const custo = custoProximoNivel(meta, id);
  if (custo === null || !podeComprarNo(meta, id)) throw new Error(`Não é possível comprar ${id}`);
  meta.emblemas -= custo;
  meta.arvore[id] = nivelNo(meta, id) + 1;
}

export function custoMinimoDaArvore(): number {
  return Math.min(...TREE.filter((n) => !n.requer?.length).map((n) => n.custos[0] ?? Infinity));
}

/** Soma dos bônus da árvore. */
export function metaBonus(meta: MetaState): MetaBonus {
  const b: MetaBonus = { ...META_ZERO };
  for (const def of TREE) {
    const n = nivelNo(meta, def.id);
    if (!n) continue;
    for (const [k, v] of Object.entries(def.porNivel) as [keyof MetaBonus, number][]) b[k] += v * n;
  }
  return b;
}

/** Descrição de um nó com o valor total no nível indicado. */
export function descreverNo(id: string, nivel: number): string {
  const def = TREE_BY_ID[id];
  if (!def) return '';
  const [, v] = (Object.entries(def.porNivel)[0] ?? ['', 0]) as [string, number];
  const total = v * Math.max(1, nivel);
  return def.descricao.replace('{v%}', `${Math.round(total * 100)}%`).replace('{v}', String(total));
}

// ---------------------------------------------------------------------------
// Início da corrida
// ---------------------------------------------------------------------------

export interface EscolhaInicial {
  semente: string;
  classeId: ClassId;
  specId: string;
  reliquia: string | null;
  dificuldade: Dificuldade;
}

export function parametrosDaCorrida(meta: MetaState, e: EscolhaInicial): NewRunParams {
  if (!meta.classesDesbloqueadas.includes(e.classeId)) throw new Error('Classe bloqueada');
  if (e.dificuldade === 'heroico' && !meta.heroicoDesbloqueado) throw new Error('Heroico bloqueado');
  if (e.reliquia && !meta.reliquias.includes(e.reliquia)) throw new Error('Relíquia não conquistada');
  return {
    semente: e.semente,
    classeId: e.classeId,
    specId: e.specId,
    dificuldade: e.dificuldade,
    meta: metaBonus(meta),
    reliquia: e.reliquia,
    reliquiasPossuidas: [...meta.reliquias],
  };
}

// ---------------------------------------------------------------------------
// Fim da corrida
// ---------------------------------------------------------------------------

/** Linha alcançada (0-based) para estatísticas: vitória = última linha. */
export function linhaAlcancada(run: RunState): number {
  if (run.resultado === 'vitoria') return run.mapa.linhas.length - 1;
  return run.linhaMorte ?? Math.max(0, run.caminho.length - 1);
}

export function calcularEmblemas(run: RunState): { total: number; detalhes: { rotulo: string; valor: number }[] } {
  const st = run.estatisticas;
  const d: { rotulo: string; valor: number }[] = [{ rotulo: 'Participação', valor: EMBLEMAS.base }];
  if (st.nosVencidos) d.push({ rotulo: `Nós vencidos (${st.nosVencidos})`, valor: Math.round(st.nosVencidos * EMBLEMAS.porNo) });
  if (st.elitesVencidas) d.push({ rotulo: `Elites (${st.elitesVencidas})`, valor: st.elitesVencidas * EMBLEMAS.porElite });
  if (st.miniChefesVencidos) d.push({ rotulo: 'Mini-chefe', valor: st.miniChefesVencidos * EMBLEMAS.porMiniChefe });
  if (st.chefesVencidos) d.push({ rotulo: 'Chefe', valor: st.chefesVencidos * EMBLEMAS.porChefe });
  if (run.resultado === 'vitoria') d.push({ rotulo: 'Vitória', valor: EMBLEMAS.vitoria });
  let total = d.reduce((s, x) => s + x.valor, 0);
  if (run.dificuldade === 'heroico') {
    const extra = Math.round(total * (EMBLEMAS.multHeroico - 1));
    d.push({ rotulo: 'Bônus Heroico', valor: extra });
    total += extra;
  }
  if (total < EMBLEMAS.minimo) {
    d.push({ rotulo: 'Mínimo garantido', valor: EMBLEMAS.minimo - total });
    total = EMBLEMAS.minimo;
  }
  return { total, detalhes: d };
}

function cumpre(a: AchievementDef, meta: MetaState, run: RunState): boolean {
  const c = a.condicao;
  switch (c.tipo) {
    case 'alcancar':
      return run.caminho.some((id) => findNode(run.mapa, id)?.tipo === c.no);
    case 'vencer':
      if (c.no === 'elite') return run.estatisticas.elitesVencidas > 0;
      if (c.no === 'miniChefe') return run.estatisticas.miniChefesVencidos > 0;
      if (c.no === 'chefe') return run.estatisticas.chefesVencidos > 0;
      return run.estatisticas.nosVencidos > 0;
    case 'vencerMasmorra':
      return run.resultado === 'vitoria' && run.dificuldade === c.dificuldade;
    case 'corridas':
      return meta.estatisticas.corridas >= c.n;
  }
}

/**
 * Aplica o resultado de uma corrida terminada à meta. Idempotente: se a corrida já tem
 * `resumoFinal`, não faz nada e devolve o resumo existente.
 */
export function finalizarCorrida(meta: MetaState, run: RunState): ResumoFinal {
  if (run.resumoFinal) return run.resumoFinal;
  if (run.etapa !== 'fim') throw new Error('A corrida ainda não terminou');

  const { total, detalhes } = calcularEmblemas(run);
  meta.emblemas += total;
  meta.emblemasTotais += total;

  const st = meta.estatisticas;
  st.corridas++;
  if (run.resultado === 'vitoria') {
    st.vitorias++;
    if (run.dificuldade === 'heroico') st.vitoriasHeroico++;
  }
  const linha = linhaAlcancada(run);
  st.melhorLinha = Math.max(st.melhorLinha, linha + 1);

  for (const [id, n] of Object.entries(run.estatisticas.abates)) meta.bestiario[id] = (meta.bestiario[id] ?? 0) + n;
  for (const id of run.estatisticas.bencaosVistas) if (!meta.bencaosVistas.includes(id)) meta.bencaosVistas.push(id);
  for (const b of run.heroi.bencaos) {
    if (!meta.bencaosObtidas.includes(b.id)) meta.bencaosObtidas.push(b.id);
    if (!meta.bencaosVistas.includes(b.id)) meta.bencaosVistas.push(b.id);
  }

  const reliquiasNovas = run.reliquiasObtidas.filter((id) => RELICS_BY_ID[id] && !meta.reliquias.includes(id));
  meta.reliquias.push(...reliquiasNovas);

  const conquistasNovas: string[] = [];
  const classesDesbloqueadas: ClassId[] = [];
  let heroicoDesbloqueado = false;
  for (const a of ACHIEVEMENTS) {
    if (meta.conquistas.includes(a.id) || !cumpre(a, meta, run)) continue;
    meta.conquistas.push(a.id);
    conquistasNovas.push(a.id);
    const cls = a.desbloqueia?.classe;
    if (cls && !meta.classesDesbloqueadas.includes(cls)) {
      meta.classesDesbloqueadas.push(cls);
      classesDesbloqueadas.push(cls);
    }
    if (a.desbloqueia?.heroico && !meta.heroicoDesbloqueado) {
      meta.heroicoDesbloqueado = true;
      heroicoDesbloqueado = true;
    }
  }

  meta.historico.unshift({
    classeId: run.classeId,
    specId: run.specId,
    dificuldade: run.dificuldade,
    resultado: run.resultado === 'vitoria' ? 'vitoria' : 'derrota',
    linha: linha + 1,
    emblemas: total,
  });
  meta.historico = meta.historico.slice(0, 20);

  const resumo: ResumoFinal = { emblemas: total, detalhes, reliquiasNovas, conquistasNovas, classesDesbloqueadas, heroicoDesbloqueado };
  run.resumoFinal = resumo;
  return resumo;
}

/** Nome de bênção seguro para a coleção. */
export function nomeBencao(id: string): string {
  try {
    return getBlessing(id).nome;
  } catch {
    return id;
  }
}
