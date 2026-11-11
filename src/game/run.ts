/**
 * Estado da corrida e ações sobre ele.
 *
 * O RunState é JSON puro. As ações recebem o estado e o modificam (sem efeitos externos).
 * Toda aleatoriedade vem de fluxos derivados de semente + rótulos fixos (id do nó etc.),
 * então mesma semente + mesmas escolhas = mesma corrida, e um save pode ser retomado
 * do nó atual com o mesmo resultado.
 *
 * Fluxo: 'mapa' → ('combate' | 'no') → ('recompensa')? → 'mapa' … → 'fim'.
 */

import {
  BUILD_VAZIA,
  adicionarBencao,
  gerarOferta,
  mesclar,
  payloadDaBencao,
  type BlessingOffer,
  type Build,
  type OwnedBlessing,
} from './blessings';
import { buildEnemyInit, buildHeroInit, heroStats, metaParaModificadores } from './combatants';
import { Combat, type CombatOptions } from './combat/engine';
import { getClass } from './data/classes';
import { getDungeon } from './data/dungeons';
import { getEnemy } from './data/enemies';
import { getEvent, type EventOp } from './data/events';
import { CONSUMABLES, CONSUMABLES_BY_ID, CURSED_BY_ID, CURSED_ITEMS } from './data/items';
import { RELICS, RELICS_BY_ID } from './data/meta';
import {
  CHANCE_RELIQUIA,
  CURA_FOGUEIRA,
  CURA_POS_COMBATE,
  CURA_VENDEDOR,
  LOJA,
  MAX_CONSUMIVEIS,
  META_ZERO,
  NIVEL_MAX,
  OURO_POR_VITORIA,
  PRECO_BENCAO,
  PRECO_CURA_VENDEDOR,
  PRECO_PURIFICAR,
  RARIDADE_MINIMA,
  RELANCAMENTOS_INICIAIS,
  type Dificuldade,
  type MetaBonus,
} from './formulas';
import { ehCombate, findNode, gerarMapa, type DungeonMap, type MapNode, type NodeKind } from './map';
import { Rng } from './rng';
import type { ClassDef, ClassId, CombatResult, EnemyTier, FactionId, Modifier, Raridade, SpecDef, Stats } from './types';

export const RUN_VERSAO = 4;

export type Etapa = 'mapa' | 'no' | 'combate' | 'recompensa' | 'fim';
export type OrigemOferta = 'inicio' | 'combate' | 'elite' | 'miniChefe' | 'tesouro' | 'evento';

/** Resumo calculado ao fim da corrida (Emblemas, relíquias, conquistas). Preenchido por meta.ts. */
export interface ResumoFinal {
  emblemas: number;
  detalhes: { rotulo: string; valor: number }[];
  reliquiasNovas: string[];
  conquistasNovas: string[];
  classesDesbloqueadas: ClassId[];
  heroicoDesbloqueado: boolean;
}

export interface RunStats {
  nosVencidos: number;
  inimigosMortos: number;
  elitesVencidas: number;
  miniChefesVencidos: number;
  chefesVencidos: number;
  /** Contagem de abates por id de inimigo (base do bestiário). */
  abates: Record<string, number>;
  /** Bênçãos que apareceram em ofertas (base do catálogo). */
  bencaosVistas: string[];
}

export interface OwnedItem {
  id: string;
  purificado: boolean;
}

export type LojaItem = { preco: number; vendido: boolean } & (
  | { tipo: 'bencao'; oferta: BlessingOffer }
  | { tipo: 'consumivel'; id: string }
  | { tipo: 'cura' }
  | { tipo: 'purificar' }
);

export interface RunState {
  versao: number;
  semente: string;
  classeId: ClassId;
  specId: string;
  dungeonId: string;
  dificuldade: Dificuldade;
  meta: MetaBonus;
  /** Relíquia equipada no início (permanente, da coleção). */
  reliquia: string | null;
  /** Relíquias já conquistadas antes da corrida (não caem de novo). */
  reliquiasPossuidas: string[];
  /** Relíquias conquistadas nesta corrida. */
  reliquiasObtidas: string[];
  /** Modos Difíceis ativos (estrutura pronta; sempre vazio no MVP). */
  modosDificeis: string[];
  mapa: DungeonMap;
  /** ids dos nós visitados, em ordem. O último é o nó atual. */
  caminho: string[];
  /** Brann: mostra inimigos e eventos de todos os nós. */
  mapaRevelado: boolean;
  heroi: {
    vida: number;
    /** Modificadores permanentes da corrida (progressão, eventos). */
    modificadores: Modifier[];
    bencaos: OwnedBlessing[];
    itens: OwnedItem[];
    consumiveis: string[];
    /** Consumíveis ativos para o próximo combate. */
    buffs: string[];
  };
  ouro: number;
  relancamentos: number;
  etapa: Etapa;
  /** Combate pendente/atual (nó de combate ou emboscada de evento). */
  encontro: { inimigos: string[]; tipo: NodeKind } | null;
  oferta: { opcoes: BlessingOffer[]; origem: OrigemOferta; raridadeMin: Raridade; faccao: FactionId | null; rolagem: number } | null;
  evento: { id: string; escolha: number | null; resultado: string | null; pendentes: EventOp[] } | null;
  loja: LojaItem[] | null;
  perderProximaRecompensa: boolean;
  resultado: 'emAndamento' | 'vitoria' | 'derrota';
  /** Linha onde morreu (null se não morreu). */
  linhaMorte: number | null;
  estatisticas: RunStats;
  /** Preenchido uma única vez quando a corrida termina e a meta é atualizada. */
  resumoFinal: ResumoFinal | null;
}

export interface NewRunParams {
  semente: string;
  classeId: ClassId;
  specId: string;
  dungeonId?: string;
  dificuldade?: Dificuldade;
  meta?: Partial<MetaBonus>;
  reliquia?: string | null;
  reliquiasPossuidas?: string[];
}

// ---------------------------------------------------------------------------
// Criação e consultas
// ---------------------------------------------------------------------------

export function getSpec(cls: ClassDef, specId: string): SpecDef {
  const s = cls.specs.find((x) => x.id === specId);
  if (!s) throw new Error(`Especialização desconhecida: ${cls.id}/${specId}`);
  return s;
}

export function createRun(p: NewRunParams): RunState {
  const dungeonId = p.dungeonId ?? 'fortalezaUtgarde';
  const meta: MetaBonus = { ...META_ZERO, ...(p.meta ?? {}) };
  const run: RunState = {
    versao: RUN_VERSAO,
    semente: p.semente,
    classeId: p.classeId,
    specId: p.specId,
    dungeonId,
    dificuldade: p.dificuldade ?? 'normal',
    meta,
    reliquia: p.reliquia ?? null,
    reliquiasPossuidas: [...(p.reliquiasPossuidas ?? [])],
    reliquiasObtidas: [],
    modosDificeis: [],
    mapa: gerarMapa(p.semente, getDungeon(dungeonId)),
    caminho: [],
    mapaRevelado: false,
    heroi: { vida: 0, modificadores: metaParaModificadores(meta), bencaos: [], itens: [], consumiveis: [], buffs: [] },
    ouro: 0,
    relancamentos: RELANCAMENTOS_INICIAIS + meta.relancamentos,
    etapa: 'mapa',
    encontro: null,
    oferta: null,
    evento: null,
    loja: null,
    perderProximaRecompensa: false,
    resultado: 'emAndamento',
    linhaMorte: null,
    estatisticas: {
      nosVencidos: 0,
      inimigosMortos: 0,
      elitesVencidas: 0,
      miniChefesVencidos: 0,
      chefesVencidos: 0,
      abates: {},
      bencaosVistas: [],
    },
    resumoFinal: null,
  };
  run.heroi.vida = statsDoHeroi(run).vidaMax;
  for (let i = 0; i < meta.pocoes; i++) ganharConsumivel(run, 'pocaoDeCura');
  if (meta.bencaoInicial > 0) ofertar(run, 'inicio', 'comum', null);
  return run;
}

function classeESpec(run: RunState): { cls: ClassDef; spec: SpecDef } {
  const cls = getClass(run.classeId);
  return { cls, spec: getSpec(cls, run.specId) };
}

/** Build da corrida: bênçãos + itens (+ consumíveis ativos, se pedido). */
export function montarBuild(run: RunState, incluirBuffs = false): Build {
  const b = BUILD_VAZIA();
  for (const m of run.heroi.modificadores) b.modificadores.push(m);
  for (const bencao of run.heroi.bencaos) mesclar(b, payloadDaBencao(bencao), bencao.id);
  for (const it of run.heroi.itens) {
    const def = CURSED_BY_ID[it.id];
    if (!def) continue;
    mesclar(b, def.bonus, it.id);
    if (!it.purificado) mesclar(b, def.maldicao, `${it.id}:maldicao`);
  }
  const rel = run.reliquia ? RELICS_BY_ID[run.reliquia] : undefined;
  if (rel) mesclar(b, rel.payload, `reliquia:${rel.id}`);
  if (incluirBuffs) {
    for (const id of run.heroi.buffs) {
      const c = CONSUMABLES_BY_ID[id];
      if (c?.payload) mesclar(b, c.payload, `buff:${id}`);
    }
  }
  return b;
}

/** Atributos fora de combate (sem consumíveis ativos). */
export function statsDoHeroi(run: RunState): Stats {
  const { cls, spec } = classeESpec(run);
  return heroStats(cls, spec, montarBuild(run).modificadores);
}

/** Executa uma mudança na build mantendo a vida coerente: ganho de vida máxima também cura. */
function comVidaAjustada(run: RunState, fn: () => void): void {
  const antes = statsDoHeroi(run).vidaMax;
  fn();
  const depois = statsDoHeroi(run).vidaMax;
  run.heroi.vida = Math.max(1, Math.min(depois, run.heroi.vida + Math.max(0, depois - antes)));
}

function curarFracao(run: RunState, fracao: number): number {
  const vidaMax = statsDoHeroi(run).vidaMax;
  const antes = run.heroi.vida;
  run.heroi.vida = Math.max(1, Math.min(vidaMax, run.heroi.vida + Math.round(vidaMax * fracao)));
  return run.heroi.vida - antes;
}

export function noAtual(run: RunState): MapNode | null {
  const id = run.caminho[run.caminho.length - 1];
  return id ? (findNode(run.mapa, id) ?? null) : null;
}

function exigirNoAtual(run: RunState): MapNode {
  const n = noAtual(run);
  if (!n) throw new Error('Corrida sem nó atual');
  return n;
}

/** Linha do nó atual (-1 antes do primeiro nó). */
export function linhaAtual(run: RunState): number {
  return noAtual(run)?.linha ?? -1;
}

export function nosDisponiveis(run: RunState): MapNode[] {
  if (run.etapa !== 'mapa') return [];
  const atual = noAtual(run);
  if (!atual) return [...(run.mapa.linhas[0] ?? [])];
  return atual.filhos.map((id) => findNode(run.mapa, id)).filter((n): n is MapNode => !!n);
}

function voltarAoMapa(run: RunState): void {
  run.etapa = 'mapa';
  run.oferta = null;
  run.evento = null;
  run.loja = null;
  run.encontro = null;
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

export function escolherNo(run: RunState, id: string): MapNode {
  const no = nosDisponiveis(run).find((n) => n.id === id);
  if (!no) throw new Error(`Nó indisponível: ${id}`);
  run.caminho.push(no.id);
  if (ehCombate(no.tipo)) {
    run.encontro = { inimigos: [...no.inimigos], tipo: no.tipo };
    run.etapa = 'combate';
    return no;
  }
  run.etapa = 'no';
  if (no.tipo === 'evento') run.evento = { id: no.eventoId ?? 'brann', escolha: null, resultado: null, pendentes: [] };
  if (no.tipo === 'vendedor') run.loja = gerarLoja(run, no);
  return no;
}

// ---------------------------------------------------------------------------
// Combate
// ---------------------------------------------------------------------------

function tierDoTipo(tipo: NodeKind): EnemyTier {
  if (tipo === 'elite') return 'elite';
  if (tipo === 'miniChefe') return 'miniChefe';
  if (tipo === 'chefe') return 'chefe';
  return 'normal';
}

/** Monta o combate atual. A semente depende só da corrida e do nó. */
export function prepararCombate(run: RunState, opts: CombatOptions = {}): Combat {
  const no = exigirNoAtual(run);
  const enc = run.encontro;
  if (run.etapa !== 'combate' || !enc) throw new Error('Não há combate pendente');
  const { cls, spec } = classeESpec(run);
  const heroi = buildHeroInit(cls, spec, montarBuild(run, true), run.heroi.vida);
  const linha = no.linha;
  const L = run.mapa.linhas.length;
  const inimigos = enc.inimigos.map((id, i) => buildEnemyInit(getEnemy(id), linha, run.dificuldade, `inimigo${i}`, L));
  return new Combat(heroi, inimigos, Rng.from(run.semente, 'combate', no.id), {
    criarInvocacao: (defId, uid) => buildEnemyInit(getEnemy(defId), linha, run.dificuldade, uid, L),
    ...opts,
  });
}

export function resolverCombate(run: RunState, r: CombatResult): void {
  const no = exigirNoAtual(run);
  const enc = run.encontro;
  if (run.etapa !== 'combate' || !enc) throw new Error('Não há combate pendente');
  const st = run.estatisticas;
  for (const id of r.inimigosMortos) {
    st.inimigosMortos++;
    st.abates[id] = (st.abates[id] ?? 0) + 1;
  }
  run.heroi.buffs = [];
  run.encontro = null;
  if (r.vencedor !== 'heroi') {
    run.heroi.vida = 0;
    run.resultado = 'derrota';
    run.linhaMorte = no.linha;
    run.etapa = 'fim';
    return;
  }
  st.nosVencidos++;
  if (enc.tipo === 'elite') st.elitesVencidas++;
  if (enc.tipo === 'miniChefe') st.miniChefesVencidos++;
  if (enc.tipo === 'chefe') st.chefesVencidos++;
  run.ouro += Math.round(OURO_POR_VITORIA[tierDoTipo(enc.tipo)] * (1 + run.meta.ouroPct));
  sortearReliquia(run, enc.tipo);

  const vidaMax = statsDoHeroi(run).vidaMax;
  const cura = Math.round(vidaMax * (CURA_POS_COMBATE + run.meta.curaPosCombate));
  run.heroi.vida = Math.max(1, Math.min(vidaMax, r.vidaFinalHeroi + cura));

  if (enc.tipo === 'chefe') {
    run.resultado = 'vitoria';
    run.etapa = 'fim';
    return;
  }
  if (run.perderProximaRecompensa) {
    run.perderProximaRecompensa = false;
    voltarAoMapa(run);
    return;
  }
  const origem: OrigemOferta = enc.tipo === 'elite' ? 'elite' : enc.tipo === 'miniChefe' ? 'miniChefe' : 'combate';
  ofertar(run, origem, RARIDADE_MINIMA[origem], null);
}

/** Elites e chefes podem deixar uma relíquia permanente ainda não conquistada. */
function sortearReliquia(run: RunState, tipo: NodeKind): void {
  if (tipo !== 'elite' && tipo !== 'miniChefe' && tipo !== 'chefe') return;
  const no = exigirNoAtual(run);
  const rng = Rng.from(run.semente, 'reliquia', no.id);
  if (!rng.chance(CHANCE_RELIQUIA[tipo])) return;
  const ja = new Set([...run.reliquiasPossuidas, ...run.reliquiasObtidas]);
  const livres = RELICS.filter((r) => r.fonte === tipo && !ja.has(r.id));
  if (livres.length) run.reliquiasObtidas.push(rng.pick(livres).id);
}

// ---------------------------------------------------------------------------
// Ofertas de bênção
// ---------------------------------------------------------------------------

function gerarOpcoes(run: RunState, origem: OrigemOferta, raridadeMin: Raridade, faccao: FactionId | null, rolagem: number): BlessingOffer[] {
  const noId = noAtual(run)?.id ?? 'inicio';
  const rng = Rng.from(run.semente, 'oferta', noId, origem, rolagem);
  const { spec } = classeESpec(run);
  return gerarOferta(rng, {
    bencaos: run.heroi.bencaos,
    favoritas: spec.faccoesFavoritas,
    raridadeMin,
    ...(faccao ? { faccao } : {}),
  });
}

function ofertar(run: RunState, origem: OrigemOferta, raridadeMin: Raridade, faccao: FactionId | null): void {
  const opcoes = gerarOpcoes(run, origem, raridadeMin, faccao, 0);
  run.oferta = { opcoes, origem, raridadeMin, faccao, rolagem: 0 };
  registrarVistas(run, opcoes);
  run.etapa = opcoes.length ? 'recompensa' : 'mapa';
}

function registrarVistas(run: RunState, opcoes: readonly BlessingOffer[]): void {
  for (const o of opcoes) if (!run.estatisticas.bencaosVistas.includes(o.id)) run.estatisticas.bencaosVistas.push(o.id);
}

export function escolherBencao(run: RunState, indice: number): OwnedBlessing {
  const op = run.oferta?.opcoes[indice];
  if (run.etapa !== 'recompensa' || !op) throw new Error('Opção de bênção inválida');
  let nova: OwnedBlessing | null = null;
  comVidaAjustada(run, () => {
    nova = adicionarBencao(run.heroi.bencaos, op);
  });
  voltarAoMapa(run);
  return nova as unknown as OwnedBlessing;
}

export function relancarOferta(run: RunState): void {
  const o = run.oferta;
  if (run.etapa !== 'recompensa' || !o) throw new Error('Nada para relançar');
  if (run.relancamentos <= 0) throw new Error('Sem relançamentos');
  run.relancamentos--;
  o.rolagem++;
  o.opcoes = gerarOpcoes(run, o.origem, o.raridadeMin, o.faccao, o.rolagem);
  registrarVistas(run, o.opcoes);
}

export function pularRecompensa(run: RunState): void {
  if (run.etapa !== 'recompensa') throw new Error('Nenhuma recompensa pendente');
  voltarAoMapa(run);
}

// ---------------------------------------------------------------------------
// Fogueira e tesouro
// ---------------------------------------------------------------------------

function exigirNo(run: RunState, tipo: NodeKind): MapNode {
  const no = exigirNoAtual(run);
  if (no.tipo !== tipo || run.etapa !== 'no') throw new Error(`O nó atual não é ${tipo}`);
  return no;
}

export function descansar(run: RunState): void {
  exigirNo(run, 'fogueira');
  curarFracao(run, CURA_FOGUEIRA);
  run.estatisticas.nosVencidos++;
  voltarAoMapa(run);
}

export function bencaosMelhoraveis(run: RunState): OwnedBlessing[] {
  return run.heroi.bencaos.filter((b) => b.nivel < NIVEL_MAX);
}

export function melhorarBencao(run: RunState, id: string): void {
  exigirNo(run, 'fogueira');
  const b = bencaosMelhoraveis(run).find((x) => x.id === id);
  if (!b) throw new Error('Bênção não pode ser melhorada');
  comVidaAjustada(run, () => {
    b.nivel++;
  });
  run.estatisticas.nosVencidos++;
  voltarAoMapa(run);
}

export function abrirTesouro(run: RunState): void {
  exigirNo(run, 'tesouro');
  run.estatisticas.nosVencidos++;
  ofertar(run, 'tesouro', RARIDADE_MINIMA.tesouro, null);
}

// ---------------------------------------------------------------------------
// Consumíveis e itens
// ---------------------------------------------------------------------------

/** Ganha um consumível (ignorado se a bolsa estiver cheia). */
export function ganharConsumivel(run: RunState, id: string): boolean {
  if (run.heroi.consumiveis.length >= MAX_CONSUMIVEIS) return false;
  run.heroi.consumiveis.push(id);
  return true;
}

export function podeUsarConsumivel(run: RunState, indice: number): boolean {
  const id = run.heroi.consumiveis[indice];
  const c = id ? CONSUMABLES_BY_ID[id] : undefined;
  if (!c || run.etapa !== 'mapa') return false;
  if (c.uso === 'proximoCombate') return !run.heroi.buffs.includes(c.id);
  return run.heroi.vida < statsDoHeroi(run).vidaMax;
}

export function usarConsumivel(run: RunState, indice: number): void {
  if (!podeUsarConsumivel(run, indice)) throw new Error('Consumível não pode ser usado agora');
  const id = run.heroi.consumiveis[indice] as string;
  const c = CONSUMABLES_BY_ID[id];
  if (!c) return;
  run.heroi.consumiveis.splice(indice, 1);
  if (c.uso === 'imediato') {
    if (c.curaFracao) curarFracao(run, c.curaFracao);
  } else run.heroi.buffs.push(c.id);
}

function ganharItemAmaldicoado(run: RunState, rng: Rng): string | null {
  const ja = new Set(run.heroi.itens.map((i) => i.id));
  const livres = CURSED_ITEMS.filter((i) => !ja.has(i.id));
  if (!livres.length) return null;
  const item = rng.pick(livres);
  comVidaAjustada(run, () => run.heroi.itens.push({ id: item.id, purificado: false }));
  return item.nome;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export function escolhaDisponivel(run: RunState, indice: number): boolean {
  const ev = run.evento ? getEvent(run.evento.id) : null;
  const e = ev?.escolhas[indice];
  if (!e) return false;
  return (e.requisito?.ouro ?? 0) <= run.ouro;
}

export function escolherOpcaoEvento(run: RunState, indice: number): void {
  const no = exigirNo(run, 'evento');
  const st = run.evento;
  if (!st || st.escolha !== null) throw new Error('Evento já resolvido');
  if (!escolhaDisponivel(run, indice)) throw new Error('Escolha indisponível');
  const escolha = getEvent(st.id).escolhas[indice];
  if (!escolha) throw new Error('Escolha inválida');
  const rng = Rng.from(run.semente, 'evento', no.id, indice);
  const r = rng.weighted(escolha.resultados, (x) => x.peso);
  st.escolha = indice;
  const extras: string[] = [];
  for (const op of r.ops) {
    const txt = aplicarOp(run, op, rng);
    if (txt) extras.push(txt);
  }
  st.resultado = [r.texto, ...extras].join(' ');
}

/** Aplica uma operação de evento. Ofertas e combates ficam pendentes até concluir o evento. */
function aplicarOp(run: RunState, op: EventOp, rng: Rng): string | null {
  const st = run.evento;
  switch (op.op) {
    case 'vida': {
      const vidaMax = statsDoHeroi(run).vidaMax;
      const delta = Math.round(vidaMax * op.fracao);
      run.heroi.vida = Math.max(1, Math.min(vidaMax, run.heroi.vida + delta));
      return null;
    }
    case 'vidaMax':
      comVidaAjustada(run, () => run.heroi.modificadores.push({ stat: 'vidaMax', op: 'mult', value: op.fracao, source: 'evento' }));
      return null;
    case 'ouro':
      run.ouro = Math.max(0, run.ouro + op.valor);
      return null;
    case 'modificador':
      comVidaAjustada(run, () => run.heroi.modificadores.push(op.mod));
      return null;
    case 'relancamentos':
      run.relancamentos += op.valor;
      return null;
    case 'revelarMapa':
      run.mapaRevelado = true;
      return null;
    case 'perderProximaRecompensa':
      run.perderProximaRecompensa = true;
      return null;
    case 'itemAmaldicoado': {
      const nome = ganharItemAmaldicoado(run, rng);
      return nome ? `Você obtém: ${nome}.` : 'Nada mais restava no altar.';
    }
    case 'consumivel': {
      const id = op.id ?? rng.pick(CONSUMABLES).id;
      const c = CONSUMABLES_BY_ID[id];
      return ganharConsumivel(run, id) ? `Você obtém: ${c?.nome}.` : `Sua bolsa está cheia: ${c?.nome} ficou para trás.`;
    }
    case 'bencaoAleatoria': {
      const [oferta] = gerarOferta(rng, { bencaos: run.heroi.bencaos, favoritas: [], raridadeMin: op.raridade, n: 1 });
      if (!oferta) return null;
      comVidaAjustada(run, () => adicionarBencao(run.heroi.bencaos, { ...oferta, raridade: op.raridade }));
      registrarVistas(run, [oferta]);
      return null;
    }
    case 'ofertaBencao':
    case 'combate':
      st?.pendentes.push(op);
      return null;
  }
}

/** Depois de ler o resultado: segue para a oferta/emboscada pendente ou volta ao mapa. */
export function concluirEvento(run: RunState): void {
  exigirNo(run, 'evento');
  const st = run.evento;
  if (!st || st.escolha === null) throw new Error('Escolha uma opção primeiro');
  run.estatisticas.nosVencidos++;
  const combate = st.pendentes.find((p) => p.op === 'combate');
  const oferta = st.pendentes.find((p) => p.op === 'ofertaBencao');
  run.evento = null;
  if (combate && combate.op === 'combate') {
    run.encontro = { inimigos: [...combate.inimigos], tipo: 'combate' };
    run.etapa = 'combate';
  } else if (oferta && oferta.op === 'ofertaBencao') {
    ofertar(run, 'evento', oferta.raridadeMin ?? 'comum', oferta.faccao ?? null);
  } else voltarAoMapa(run);
}

// ---------------------------------------------------------------------------
// Vendedor goblin
// ---------------------------------------------------------------------------

function gerarLoja(run: RunState, no: MapNode): LojaItem[] {
  const rng = Rng.from(run.semente, 'loja', no.id);
  const { spec } = classeESpec(run);
  const bencaos = gerarOferta(rng, { bencaos: run.heroi.bencaos, favoritas: spec.faccoesFavoritas, n: LOJA.bencaos });
  const consumiveis = rng.sample(CONSUMABLES, LOJA.consumiveis);
  return [
    ...bencaos.map((oferta): LojaItem => ({ tipo: 'bencao', oferta, preco: PRECO_BENCAO[oferta.raridade], vendido: false })),
    ...consumiveis.map((c): LojaItem => ({ tipo: 'consumivel', id: c.id, preco: c.preco, vendido: false })),
    { tipo: 'cura', preco: PRECO_CURA_VENDEDOR, vendido: false },
    { tipo: 'purificar', preco: PRECO_PURIFICAR, vendido: false },
  ];
}

export function podeComprar(run: RunState, indice: number): boolean {
  const it = run.loja?.[indice];
  if (!it || it.vendido || it.preco > run.ouro || run.etapa !== 'no') return false;
  switch (it.tipo) {
    case 'consumivel':
      return run.heroi.consumiveis.length < MAX_CONSUMIVEIS;
    case 'cura':
      return run.heroi.vida < statsDoHeroi(run).vidaMax;
    case 'purificar':
      return run.heroi.itens.some((i) => !i.purificado);
    case 'bencao':
      return true;
  }
}

export function comprar(run: RunState, indice: number): void {
  exigirNo(run, 'vendedor');
  if (!podeComprar(run, indice)) throw new Error('Não é possível comprar este item');
  const it = run.loja?.[indice] as LojaItem;
  run.ouro -= it.preco;
  it.vendido = true;
  switch (it.tipo) {
    case 'bencao':
      comVidaAjustada(run, () => adicionarBencao(run.heroi.bencaos, it.oferta));
      registrarVistas(run, [it.oferta]);
      break;
    case 'consumivel':
      ganharConsumivel(run, it.id);
      break;
    case 'cura':
      curarFracao(run, CURA_VENDEDOR);
      break;
    case 'purificar': {
      const item = run.heroi.itens.find((i) => !i.purificado);
      if (item) comVidaAjustada(run, () => (item.purificado = true));
      break;
    }
  }
}

export function sairDaLoja(run: RunState): void {
  exigirNo(run, 'vendedor');
  run.estatisticas.nosVencidos++;
  voltarAoMapa(run);
}

// ---------------------------------------------------------------------------
// Abandono
// ---------------------------------------------------------------------------

/** Desistir conta como derrota na linha atual (os Emblemas do progresso ainda contam). */
export function abandonarCorrida(run: RunState): void {
  if (run.etapa === 'fim') return;
  run.resultado = 'derrota';
  run.linhaMorte = Math.max(0, linhaAtual(run));
  run.heroi.vida = 0;
  run.oferta = null;
  run.evento = null;
  run.loja = null;
  run.encontro = null;
  run.etapa = 'fim';
}
