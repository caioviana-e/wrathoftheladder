/**
 * Ponte reativa entre a engine pura (src/game) e a interface Svelte.
 * - `run` é o RunState envolvido em $state; as ações da engine o modificam diretamente.
 * - O combate roda aqui num laço requestAnimationFrame em ticks fixos; a velocidade só
 *   muda quantos ticks rodam por quadro. Os eventos vão para os ouvintes (cena Phaser).
 */

import { Combat } from '../game/combat/engine';
import { getClass } from '../game/data/classes';
import { getEnemy } from '../game/data/enemies';
import { STATUSES } from '../game/data/statuses';
import { TICK } from '../game/formulas';
import * as R from '../game/run';
import type { RunState } from '../game/run';
import { comprarNo, finalizarCorrida, novoMeta, parametrosDaCorrida, type EscolhaInicial, type MetaState } from '../game/meta';
import { deBase64, desserializar, paraBase64, SAVE_CHAVE, SAVE_VERSAO, serializar, type SaveData } from '../game/save';
import type { Combatant, CombatEvent, EnemyTier, ResourceKind, Side, StatusId } from '../game/types';
import { formatarEvento, type LogLine } from './log';

export type Tela = 'inicio' | 'mapa' | 'combate' | 'recompensa' | 'fogueira' | 'tesouro' | 'evento' | 'vendedor' | 'fim';
export type Velocidade = 1 | 2 | 3;

export interface StatusView {
  id: StatusId;
  nome: string;
  icone: string;
  pilhas: number;
  restante: number;
}

export interface CombatantView {
  uid: string;
  nome: string;
  side: Side;
  tier: EnemyTier | null;
  cor: string;
  vivo: boolean;
  vida: number;
  vidaMax: number;
  recurso: number;
  recursoMax: number;
  recursoNome: string | null;
  recursoKind: ResourceKind | null;
  carga: number;
  cargaMax: number;
  supremaNome: string | null;
  statuses: StatusView[];
}

export interface CombatView {
  t: number;
  terminado: boolean;
  vencedor: Side | null;
  combatentes: CombatantView[];
}

const MAX_LOG = 80;
/** Evita "espiral" quando a aba volta do segundo plano. */
const MAX_DT = 0.1;

function novaSemente(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${(a[0] as number).toString(36)}${(a[1] as number).toString(36)}`;
}

class GameStore {
  run = $state<RunState | null>(null);
  meta = $state<MetaState>(novoMeta());
  /** Mensagem de erro de save (ex.: localStorage indisponível). */
  avisoSave = $state<string | null>(null);
  combate = $state.raw<CombatView | null>(null);
  log = $state.raw<LogLine[]>([]);
  velocidade = $state<Velocidade>(1);
  pausado = $state(false);

  private sim: Combat | null = null;
  private cores: Record<string, string> = {};
  private ouvintes = new Set<(evs: CombatEvent[]) => void>();
  private raf = 0;
  private ultimo = 0;
  private acumulado = 0;
  private logId = 0;

  constructor() {
    this.carregar();
  }

  get tela(): Tela {
    const run = this.run;
    if (!run) return 'inicio';
    if (this.combate) return 'combate';
    switch (run.etapa) {
      case 'mapa':
        return 'mapa';
      case 'combate':
        return 'combate';
      case 'recompensa':
        return 'recompensa';
      case 'fim':
        return 'fim';
      case 'no': {
        const tipo = R.noAtual(run)?.tipo;
        if (tipo === 'fogueira' || tipo === 'tesouro' || tipo === 'evento' || tipo === 'vendedor') return tipo;
        return 'mapa';
      }
    }
  }

  // ---------------------------------------------------------------------
  // Save (localStorage + Base64)
  // ---------------------------------------------------------------------

  private dadosSave(): SaveData {
    return {
      versao: SAVE_VERSAO,
      meta: $state.snapshot(this.meta) as MetaState,
      corrida: this.run ? ($state.snapshot(this.run) as RunState) : null,
      salvoEm: new Date().toISOString(),
    };
  }

  private carregar(): void {
    try {
      const texto = localStorage.getItem(SAVE_CHAVE);
      if (!texto) return;
      const s = desserializar(texto);
      this.meta = s.meta;
      this.run = s.corrida;
    } catch (e) {
      this.avisoSave = `Não foi possível ler o save (${String(e)}). Um novo progresso foi iniciado.`;
    }
  }

  salvar(): void {
    try {
      localStorage.setItem(SAVE_CHAVE, serializar(this.dadosSave()));
    } catch (e) {
      this.avisoSave = `Não foi possível salvar (${String(e)}).`;
    }
  }

  /** Depois de cada ação: aplica o fim de corrida à meta (uma vez) e salva. */
  private depois(): void {
    if (this.run?.etapa === 'fim' && !this.run.resumoFinal) finalizarCorrida(this.meta, this.run);
    this.salvar();
  }

  exportar(): string {
    return paraBase64(this.dadosSave());
  }

  importar(texto: string): void {
    const s = deBase64(texto);
    this.encerrarCombate();
    this.meta = s.meta;
    this.run = s.corrida;
    this.salvar();
  }

  apagarProgresso(): void {
    this.encerrarCombate();
    this.meta = novoMeta();
    this.run = null;
    try {
      localStorage.removeItem(SAVE_CHAVE);
    } catch {
      // sem armazenamento: nada a apagar
    }
  }

  // ---------------------------------------------------------------------
  // Meta-progressão
  // ---------------------------------------------------------------------

  comprarNo(id: string): void {
    comprarNo(this.meta, id);
    this.salvar();
  }

  equiparReliquia(id: string | null): void {
    this.meta.reliquiaEquipada = id;
    this.salvar();
  }

  // ---------------------------------------------------------------------
  // Corrida
  // ---------------------------------------------------------------------

  novaCorrida(e: Omit<EscolhaInicial, 'semente' | 'reliquia'> & { semente?: string }): void {
    this.encerrarCombate();
    const params = parametrosDaCorrida(this.meta, {
      ...e,
      semente: e.semente?.trim() || novaSemente(),
      reliquia: this.meta.reliquiaEquipada,
    });
    this.run = R.createRun(params);
    this.depois();
  }

  /** Volta ao acampamento depois do fim da corrida. */
  sair(): void {
    this.encerrarCombate();
    this.run = null;
    this.salvar();
  }

  /** Desiste da corrida atual (conta como derrota e ainda rende Emblemas). */
  abandonar(): void {
    if (!this.run) return;
    this.encerrarCombate();
    R.abandonarCorrida(this.run);
    this.depois();
  }

  escolherNo(id: string): void {
    if (!this.run) return;
    R.escolherNo(this.run, id);
    this.depois();
    if (this.run.etapa === 'combate') this.iniciarCombate();
  }

  escolherBencao(i: number): void {
    if (this.run) R.escolherBencao(this.run, i);
    this.depois();
  }

  relancar(): void {
    if (this.run) R.relancarOferta(this.run);
    this.depois();
  }

  pularRecompensa(): void {
    if (this.run) R.pularRecompensa(this.run);
    this.depois();
  }

  descansar(): void {
    if (this.run) R.descansar(this.run);
    this.depois();
  }

  melhorar(id: string): void {
    if (this.run) R.melhorarBencao(this.run, id);
    this.depois();
  }

  abrirTesouro(): void {
    if (this.run) R.abrirTesouro(this.run);
    this.depois();
  }

  escolherNoEvento(i: number): void {
    if (this.run) R.escolherOpcaoEvento(this.run, i);
    this.depois();
  }

  concluirEvento(): void {
    if (!this.run) return;
    R.concluirEvento(this.run);
    this.depois();
    if (this.run.etapa === 'combate') this.iniciarCombate();
  }

  comprar(i: number): void {
    if (this.run) R.comprar(this.run, i);
    this.depois();
  }

  sairDaLoja(): void {
    if (this.run) R.sairDaLoja(this.run);
    this.depois();
  }

  usarConsumivel(i: number): void {
    if (this.run) R.usarConsumivel(this.run, i);
    this.depois();
  }

  // ---------------------------------------------------------------------
  // Combate
  // ---------------------------------------------------------------------

  /** Inscreve um ouvinte de eventos de combate (a cena Phaser). Retorna a função de cancelar. */
  ouvir(fn: (evs: CombatEvent[]) => void): () => void {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  /** Recomeça o combate do nó atual (mesma semente → mesmo combate). Usado ao entrar na tela. */
  iniciarCombate(): void {
    const run = this.run;
    if (!run) return;
    this.encerrarCombate();
    // A engine recebe uma cópia simples do estado: o combate nunca escreve na corrida.
    this.sim = R.prepararCombate($state.snapshot(run) as RunState, { registrarEventos: true });
    const cls = getClass(run.classeId);
    this.cores = { heroi: cls.cor };
    for (const c of this.sim.inimigos) this.cores[c.uid] = getEnemy(c.defId).cor;
    this.log = [];
    this.logId = 0;
    this.pausado = false;
    this.acumulado = 0;
    this.atualizarView();
    this.ultimo = performance.now();
    this.raf = requestAnimationFrame(this.quadro);
  }

  /** Termina o combate na hora (sem animar o resto). */
  resolverAgora(): void {
    if (!this.sim || this.sim.terminado) return;
    const evs: CombatEvent[] = [];
    while (!this.sim.terminado) evs.push(...this.sim.step());
    this.processar(evs);
  }

  /** Depois do fim do combate: aplica o resultado à corrida e sai da tela de combate. */
  concluirCombate(): void {
    const sim = this.sim;
    if (!sim?.resultado || !this.run) return;
    this.encerrarCombate();
    R.resolverCombate(this.run, sim.resultado);
    this.depois();
  }

  setVelocidade(v: Velocidade): void {
    this.velocidade = v;
  }

  alternarPausa(): void {
    this.pausado = !this.pausado;
  }

  /** Dados mínimos para a cena montar os bonecos (todos, ou só o uid pedido). */
  setupBatalha(uid?: string): { uid: string; nome: string; side: Side; cor: string; tier: EnemyTier | null; classe: string | null }[] {
    if (!this.sim) return [];
    return this.sim.combatentes
      .filter((c) => !uid || c.uid === uid)
      .map((c) => ({
        uid: c.uid,
        nome: c.nome,
        side: c.side,
        cor: this.cores[c.uid] ?? (c.side === 'inimigo' ? getEnemy(c.defId).cor : '#ccc'),
        tier: c.tier ?? null,
        classe: c.side === 'heroi' ? c.defId : null,
      }));
  }

  private encerrarCombate(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sim = null;
    this.combate = null;
  }

  private quadro = (agora: number): void => {
    const sim = this.sim;
    if (!sim) return;
    const dt = Math.min(MAX_DT, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    if (!this.pausado && !sim.terminado) {
      this.acumulado += dt * this.velocidade;
      const evs: CombatEvent[] = [];
      while (this.acumulado >= TICK && !sim.terminado) {
        evs.push(...sim.step());
        this.acumulado -= TICK;
      }
      this.processar(evs);
    }
    if (!sim.terminado) this.raf = requestAnimationFrame(this.quadro);
  };

  private processar(evs: CombatEvent[]): void {
    if (!this.sim) return;
    if (evs.length) {
      for (const fn of this.ouvintes) fn(evs);
      const nome = (uid: string) => this.sim?.combatentes.find((c) => c.uid === uid)?.nome ?? uid;
      const novas: LogLine[] = [];
      for (const e of evs) {
        const l = formatarEvento(e, nome);
        if (l) novas.push({ ...l, id: ++this.logId });
      }
      if (novas.length) this.log = [...this.log, ...novas].slice(-MAX_LOG);
    }
    this.atualizarView();
  }

  private atualizarView(): void {
    const sim = this.sim;
    if (!sim) return;
    this.combate = {
      t: sim.t,
      terminado: sim.terminado,
      vencedor: sim.resultado?.vencedor ?? null,
      combatentes: sim.combatentes.map((c) => this.viewDe(c)),
    };
  }

  private viewDe(c: Combatant): CombatantView {
    return {
      uid: c.uid,
      nome: c.nome,
      side: c.side,
      tier: c.tier ?? null,
      cor: this.cores[c.uid] ?? '#ccc',
      vivo: c.vivo,
      vida: Math.max(0, Math.round(c.vida)),
      vidaMax: c.stats.vidaMax,
      recurso: Math.floor(c.recursoAtual),
      recursoMax: c.recurso ? c.stats.recursoMax : 0,
      recursoNome: c.recurso?.nome ?? null,
      recursoKind: c.recurso?.kind ?? null,
      carga: c.cargaSuprema,
      cargaMax: c.suprema?.cargaMax ?? 0,
      supremaNome: c.suprema?.nome ?? null,
      statuses: c.statuses.map((s) => ({ id: s.id, nome: STATUSES[s.id].nome, icone: STATUSES[s.id].icone, pilhas: s.pilhas, restante: s.restante })),
    };
  }
}

export const game = new GameStore();
