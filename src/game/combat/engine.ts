/**
 * Motor de combate automático, determinístico, em ticks fixos (formulas.TICK).
 * Só depende do Rng recebido: mesma seed + mesmos combatentes = mesmo combate,
 * em qualquer velocidade (a velocidade só muda quantos ticks rodam por quadro).
 *
 */

import {
  CONGELAMENTO_MULT_NAO_NORMAL,
  IMUNIDADE_CONGELAMENTO_S,
  DOENCA_REDUCAO_CURA,
  GCD,
  INTERVALO_DOT,
  LIMITES,
  LIMITE_COMBATE_S,
  PRIMEIRO_ATAQUE,
  TICK,
  arredondarDano,
  reducaoArmadura,
  rolarVariancia,
} from '../formulas';
import { STATUSES } from '../data/statuses';
import { computeStats } from '../stats';
import type { Rng } from '../rng';
import type {
  AlvoEfeito,
  BossMechanic,
  Combatant,
  CombatantInit,
  CombatEvent,
  CombatResult,
  Effect,
  Escola,
  Gatilho,
  OrigemDano,
  Side,
  StatusId,
} from '../types';
import { avaliarEscala, checarCondicao, condModAplica, findStatus, fracaoVida, hasStatus } from './conditions';

const EPS = 1e-9;

export interface CombatOptions {
  /** Guarda os eventos de cada tick para quem chamar step() (UI). O sim desliga. */
  registrarEventos?: boolean;
  /** Recebe cada evento assim que acontece. */
  onEvent?: (e: CombatEvent) => void;
  /** Monta um inimigo invocado no meio do combate (mecânicas de chefe). */
  criarInvocacao?: (defId: string, uid: string) => CombatantInit;
}

function intervaloMecanica(m: BossMechanic): number {
  switch (m.tipo) {
    case 'invocar':
      return m.intervalo;
    case 'escudoRapido':
    case 'autocura':
    case 'golpeForte':
      return m.aCada;
    default:
      return Infinity;
  }
}

interface EfeitoCtx {
  alvo?: Combatant | null;
  atacante?: Combatant | null;
  danoCausado?: number;
}

interface DanoOpts {
  podeCritar: boolean;
  ignoraArmadura: boolean;
  variancia: boolean;
}

function criarCombatente(init: CombatantInit, rng: Rng): Combatant {
  const vidaMax = init.stats.vidaMax;
  const recursoMax = init.recurso ? init.stats.recursoMax : 0;
  const intervalo = 1 / init.stats.aps;
  const gatilhoEstado: Combatant['gatilhoEstado'] = {};
  for (const g of init.gatilhos) gatilhoEstado[g.id] = { recarga: 0, acumulado: 0, disparado: false };
  return {
    ...init,
    habilidades: [...init.habilidades].sort((a, b) => a.prioridade - b.prioridade),
    vida: Math.max(1, Math.min(vidaMax, Math.round(init.vida ?? vidaMax))),
    recursoAtual: init.recurso ? recursoMax * init.recurso.inicioFracao : 0,
    cargaSuprema: 0,
    ataqueTimer: intervalo * rng.float(PRIMEIRO_ATAQUE.min, PRIMEIRO_ATAQUE.max),
    gcd: 0,
    recargas: {},
    statuses: [],
    vivo: true,
    gatilhoEstado,
    enrage: { dano: 1, aps: 1 },
    imuneCongelarAte: 0,
    mecanicaEstado: (init.mecanicas ?? []).map((m) => ({
      proxima: 'primeiraEm' in m && m.primeiraEm !== undefined ? m.primeiraEm : intervaloMecanica(m),
      disparada: false,
      avisoAte: null,
      escudoAte: null,
    })),
  };
}

export class Combat {
  t = 0;
  private ticks = 0;
  readonly combatentes: Combatant[];
  resultado: CombatResult | null = null;

  private readonly rng: Rng;
  private readonly registrar: boolean;
  private readonly onEvent: ((e: CombatEvent) => void) | undefined;
  private readonly criarInvocacao: CombatOptions['criarInvocacao'];
  private contInvocacoes = 0;
  private buffer: CombatEvent[] = [];
  /** >0 enquanto efeitos de gatilho estão sendo aplicados: impede cascatas. */
  private profundidade = 0;
  private iniciado = false;

  constructor(heroi: CombatantInit, inimigos: CombatantInit[], rng: Rng, opts: CombatOptions = {}) {
    this.rng = rng;
    this.registrar = opts.registrarEventos ?? false;
    this.onEvent = opts.onEvent;
    this.criarInvocacao = opts.criarInvocacao;
    this.combatentes = [criarCombatente(heroi, rng), ...inimigos.map((i) => criarCombatente(i, rng))];
  }

  get heroi(): Combatant {
    return this.combatentes[0] as Combatant;
  }

  get inimigos(): Combatant[] {
    return this.combatentes.slice(1);
  }

  get terminado(): boolean {
    return this.resultado !== null;
  }

  /** Avança um tick. Retorna os eventos do tick se registrarEventos estiver ligado. */
  step(): CombatEvent[] {
    this.buffer = [];
    if (this.resultado) return this.buffer;
    if (!this.iniciado) this.iniciar();

    // Relógio por contagem inteira de ticks: evita acumular erro de ponto flutuante.
    this.ticks++;
    this.t = this.ticks * TICK;
    // Cópia: invocações feitas neste tick só agem no próximo.
    for (const c of [...this.combatentes]) {
      if (!c.vivo) continue;
      this.tickCombatente(c);
      if (this.verificarFim()) break;
    }
    if (!this.resultado && this.t >= LIMITE_COMBATE_S - EPS) this.finalizar('inimigo', 'tempo');
    return this.buffer;
  }

  /** Roda até o fim (uso headless: sim e testes). */
  run(): CombatResult {
    while (!this.resultado) this.step();
    return this.resultado as CombatResult;
  }

  // -------------------------------------------------------------------------

  private emit(e: CombatEvent): void {
    if (this.registrar) this.buffer.push(e);
    if (this.onEvent) this.onEvent(e);
  }

  private get ms(): number {
    return Math.round(this.t * 1000);
  }

  private iniciar(): void {
    this.iniciado = true;
    if (this.registrar || this.onEvent) {
      this.emit({
        t: 0,
        tipo: 'inicio',
        combatentes: this.combatentes.map((c) => ({
          uid: c.uid,
          nome: c.nome,
          side: c.side,
          vida: c.vida,
          vidaMax: c.stats.vidaMax,
        })),
      });
    }
    for (const c of this.combatentes) this.dispararGatilhos(c, 'inicioCombate', {});
  }

  private oponentes(c: Combatant): Combatant[] {
    return this.combatentes.filter((o) => o.vivo && o.side !== c.side);
  }

  private alvoPrincipal(c: Combatant): Combatant | null {
    for (const o of this.combatentes) if (o.vivo && o.side !== c.side) return o;
    return null;
  }

  private tickCombatente(c: Combatant): void {
    this.tickStatuses(c);
    if (!c.vivo) return;

    if (c.recurso && c.recurso.regen > 0) {
      c.recursoAtual = Math.min(c.stats.recursoMax, c.recursoAtual + c.recurso.regen * TICK);
    }

    for (const g of c.gatilhos) {
      const st = c.gatilhoEstado[g.id];
      if (!st) continue;
      if (st.recarga > 0) st.recarga -= TICK;
      if (g.gatilho === 'intervalo' && g.intervalo) {
        st.acumulado += TICK;
        if (st.acumulado >= g.intervalo - EPS) {
          st.acumulado -= g.intervalo;
          this.dispararUm(c, g.id, {});
        }
      } else if (g.gatilho === 'vidaAbaixo' && !st.disparado && g.limiar !== undefined && fracaoVida(c) < g.limiar) {
        st.disparado = true;
        this.dispararUm(c, g.id, {});
      }
      if (!c.vivo) return;
    }

    const congelado = hasStatus(c, 'congelamento');
    if (c.mecanicas?.length) {
      this.tickMecanicas(c, congelado);
      if (!c.vivo || this.semOponentes(c)) return;
    }

    // Congelado: nada avança (ataque, recargas, suprema, mecânicas temporizadas).
    if (congelado) return;

    if (c.suprema) {
      c.cargaSuprema += c.suprema.cargaPorSegundo * TICK;
      if (c.cargaSuprema >= c.suprema.cargaMax - EPS) this.usarSuprema(c);
      if (!c.vivo || this.semOponentes(c)) return;
    }

    c.gcd -= TICK;
    for (const id in c.recargas) c.recargas[id] = (c.recargas[id] ?? 0) - TICK;
    if (c.gcd <= EPS) this.tentarHabilidades(c);
    if (!c.vivo || this.semOponentes(c)) return;

    const lent = findStatus(c, 'lentidao');
    const fator = lent ? 1 - Math.min(LIMITES.lentidaoMax, lent.potencia) : 1;
    c.ataqueTimer -= TICK * fator;
    if (c.ataqueTimer <= EPS) {
      c.ataqueTimer += 1 / (c.stats.aps * c.enrage.aps);
      const alvo = this.alvoPrincipal(c);
      if (alvo) {
        this.causarDano(c, alvo, c.stats.dano, c.ataqueEscola, { tipo: 'ataque' }, {
          podeCritar: true,
          ignoraArmadura: false,
          variancia: true,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mecânicas de chefe (cardápio declarativo em BossMechanic)
  // -------------------------------------------------------------------------

  private emitMecanica(c: Combatant, m: BossMechanic, aviso: boolean, texto = m.texto): void {
    this.emit({ t: this.ms, tipo: 'mecanica', de: c.uid, nome: m.nome, texto, aviso });
  }

  private tickMecanicas(c: Combatant, congelado: boolean): void {
    const ms = c.mecanicas ?? [];
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i] as BossMechanic;
      const st = c.mecanicaEstado[i];
      if (!st || !c.vivo) continue;
      const origem: OrigemDano = { tipo: 'habilidade', id: 'mecanica:' + m.tipo };
      if (m.tipo === 'enrage') {
        if (!st.disparada && this.t >= m.aposSegundos - EPS) {
          st.disparada = true;
          c.enrage = { dano: m.danoMult, aps: m.apsMult };
          this.emitMecanica(c, m, false);
        }
        continue;
      }
      if (m.tipo === 'fase') {
        if (!st.disparada && fracaoVida(c) < m.abaixoDeVida) {
          st.disparada = true;
          const frac = fracaoVida(c);
          c.stats = computeStats(c.stats, m.modificadores);
          c.vida = Math.max(1, Math.round(frac * c.stats.vidaMax));
          this.emitMecanica(c, m, false);
          if (m.efeitos) this.aplicarEfeitos(c, m.efeitos, {}, origem);
        }
        continue;
      }
      if (congelado) continue;
      if (m.tipo === 'golpeForte' && st.avisoAte !== null) {
        if (this.t >= st.avisoAte - EPS) {
          st.avisoAte = null;
          this.aplicarEfeitos(c, m.efeitos, {}, origem);
        }
        continue;
      }
      if (m.tipo === 'escudoRapido' && st.escudoAte !== null) {
        if (this.t >= st.escudoAte - EPS) {
          st.escudoAte = null;
          const esc = findStatus(c, 'escudo');
          if (esc && esc.potencia > 0) {
            this.removerStatus(c, 'escudo');
            this.emitMecanica(c, m, false, 'O escudo não foi quebrado a tempo!');
            this.aplicarEfeitos(c, m.punicao, {}, origem);
          }
        }
        continue;
      }
      st.proxima -= TICK;
      if (st.proxima > EPS) continue;
      st.proxima += intervaloMecanica(m);
      switch (m.tipo) {
        case 'golpeForte':
          st.avisoAte = this.t + m.aviso;
          this.emitMecanica(c, m, true);
          break;
        case 'escudoRapido':
          // A duração do status passa um pouco do prazo, para a checagem acima ainda ver o escudo.
          this.aplicarStatus(c, c, 'escudo', m.duracao + 2 * TICK, avaliarEscala(m.valor, c), 1);
          st.escudoAte = this.t + m.duracao;
          this.emitMecanica(c, m, true);
          break;
        case 'autocura':
          this.emitMecanica(c, m, false);
          this.curar(c, c, c.stats.vidaMax * m.fracaoVida);
          break;
        case 'invocar':
          this.emitMecanica(c, m, false);
          this.invocar(c, m.inimigoId, m.quantidade, m.max);
          break;
      }
      if (this.verificarFim()) return;
    }
  }

  private invocar(fonte: Combatant, defId: string, quantidade: number, max: number): void {
    if (!this.criarInvocacao) return;
    let vivos = this.combatentes.filter((o) => o.vivo && o.invocadoPor === fonte.uid).length;
    for (let k = 0; k < quantidade && vivos < max; k++, vivos++) {
      const uid = fonte.uid + '-inv' + ++this.contInvocacoes;
      const c = criarCombatente({ ...this.criarInvocacao(defId, uid), side: fonte.side }, this.rng);
      c.invocadoPor = fonte.uid;
      this.combatentes.push(c);
      this.emit({ t: this.ms, tipo: 'invocacao', de: fonte.uid, uid, defId, nome: c.nome, vida: c.vida, vidaMax: c.stats.vidaMax });
      this.dispararGatilhos(c, 'inicioCombate', {});
    }
  }

  private semOponentes(c: Combatant): boolean {
    return this.alvoPrincipal(c) === null;
  }

  private tickStatuses(c: Combatant): void {
    for (const s of [...c.statuses]) {
      const def = STATUSES[s.id];
      if (def.tipo === 'dot') {
        s.proximoTique -= TICK;
        if (s.proximoTique <= EPS) {
          s.proximoTique += INTERVALO_DOT;
          const fonte = this.combatentes.find((o) => o.uid === s.origem) ?? c;
          this.causarDano(fonte, c, s.potencia * s.pilhas, def.escola ?? 'fisico', { tipo: 'status', id: s.id }, {
            podeCritar: false,
            ignoraArmadura: true,
            variancia: false,
          });
          if (!c.vivo) return;
        }
      }
      s.restante -= TICK;
      if (s.restante <= EPS || (s.id === 'escudo' && s.potencia <= 0)) {
        this.removerStatus(c, s.id);
      }
    }
  }

  private removerStatus(c: Combatant, id: StatusId): void {
    const i = c.statuses.findIndex((s) => s.id === id);
    if (i < 0) return;
    c.statuses.splice(i, 1);
    if (id === 'congelamento' && c.tier && c.tier !== 'normal') c.imuneCongelarAte = this.t + IMUNIDADE_CONGELAMENTO_S;
    this.emit({ t: this.ms, tipo: 'statusExpirou', para: c.uid, status: id });
  }

  private tentarHabilidades(c: Combatant): void {
    const alvo = this.alvoPrincipal(c);
    if (!alvo) return;
    for (const h of c.habilidades) {
      if ((c.recargas[h.id] ?? 0) > EPS) continue;
      if (h.custo > c.recursoAtual + EPS) continue;
      if (h.condicao && !checarCondicao(h.condicao, c, alvo)) continue;
      c.recursoAtual -= h.custo;
      c.recargas[h.id] = h.recarga;
      c.gcd = GCD;
      this.emit({ t: this.ms, tipo: 'habilidade', de: c.uid, id: h.id, nome: h.nome, suprema: false });
      this.aplicarEfeitos(c, h.efeitos, { alvo }, { tipo: 'habilidade', id: h.id });
      this.dispararGatilhos(c, 'aoUsarHabilidade', { alvo });
      return;
    }
  }

  private usarSuprema(c: Combatant): void {
    const sup = c.suprema;
    const alvo = this.alvoPrincipal(c);
    if (!sup || !alvo) return;
    c.cargaSuprema = 0;
    this.emit({ t: this.ms, tipo: 'habilidade', de: c.uid, id: sup.id, nome: sup.nome, suprema: true });
    this.aplicarEfeitos(c, sup.efeitos, { alvo }, { tipo: 'suprema', id: sup.id });
    this.dispararGatilhos(c, 'aoUsarSuprema', { alvo });
  }

  // -------------------------------------------------------------------------
  // Efeitos
  // -------------------------------------------------------------------------

  private resolverAlvos(fonte: Combatant, alvo: AlvoEfeito, ctx: EfeitoCtx): Combatant[] {
    switch (alvo) {
      case 'self':
        return fonte.vivo ? [fonte] : [];
      case 'alvo': {
        const a = ctx.alvo && ctx.alvo.vivo ? ctx.alvo : this.alvoPrincipal(fonte);
        return a ? [a] : [];
      }
      case 'todosInimigos':
        return this.oponentes(fonte);
      case 'inimigoAleatorio': {
        const ops = this.oponentes(fonte);
        return ops.length ? [this.rng.pick(ops)] : [];
      }
      case 'atacante':
        return ctx.atacante && ctx.atacante.vivo ? [ctx.atacante] : [];
      default:
        return [];
    }
  }

  private aplicarEfeitos(fonte: Combatant, efeitos: readonly Effect[], ctx: EfeitoCtx, origem: OrigemDano): void {
    for (const e of efeitos) {
      switch (e.tipo) {
        case 'dano': {
          const valor = avaliarEscala(e.valor, fonte, ctx.danoCausado);
          for (const a of this.resolverAlvos(fonte, e.alvo, ctx)) {
            if (!a.vivo) continue;
            this.causarDano(fonte, a, valor, e.escola, origem, {
              podeCritar: e.podeCritar ?? true,
              ignoraArmadura: e.ignoraArmadura ?? false,
              variancia: true,
            });
          }
          break;
        }
        case 'cura':
          this.curar(fonte, fonte, avaliarEscala(e.valor, fonte, ctx.danoCausado));
          break;
        case 'escudo':
          if (fonte.vivo) this.aplicarStatus(fonte, fonte, 'escudo', e.duracao, avaliarEscala(e.valor, fonte, ctx.danoCausado), 1);
          break;
        case 'status': {
          const pot = avaliarEscala(e.valor, fonte, ctx.danoCausado);
          for (const a of this.resolverAlvos(fonte, e.alvo, ctx)) {
            this.aplicarStatus(fonte, a, e.status, e.duracao, pot, e.pilhas ?? 1);
          }
          break;
        }
        case 'recurso':
          if (fonte.recurso) fonte.recursoAtual = Math.min(fonte.stats.recursoMax, Math.max(0, fonte.recursoAtual + e.valor));
          break;
        case 'cargaSuprema':
          if (fonte.suprema) fonte.cargaSuprema += e.valor;
          break;
        case 'perderVida':
          this.perderVida(fonte, e.fracao, origem);
          break;
        case 'invocar':
          this.invocar(fonte, e.inimigoId, e.quantidade, e.max);
          break;
      }
      if (this.verificarFim()) return;
    }
  }

  private aplicarStatus(fonte: Combatant, alvo: Combatant, id: StatusId, duracao: number, potencia: number, pilhas: number): void {
    if (!alvo.vivo || duracao <= 0) return;
    const def = STATUSES[id];
    let dur = duracao;
    if (id === 'congelamento' && alvo.tier && alvo.tier !== 'normal') {
      if (this.t < alvo.imuneCongelarAte - EPS) return;
      dur *= CONGELAMENTO_MULT_NAO_NORMAL;
    }
    const pot = id === 'lentidao' ? Math.min(LIMITES.lentidaoMax, potencia) : potencia;

    const atual = findStatus(alvo, id);
    if (atual) {
      atual.restante = Math.max(atual.restante, dur);
      atual.potencia = Math.max(atual.potencia, pot);
      if (def.reaplicar === 'acumular') atual.pilhas = Math.min(def.maxPilhas, atual.pilhas + pilhas);
      atual.origem = fonte.uid;
      this.emit({ t: this.ms, tipo: 'statusAplicado', de: fonte.uid, para: alvo.uid, status: id, pilhas: atual.pilhas, duracao: atual.restante });
      return;
    }
    const nova = {
      id,
      restante: dur,
      pilhas: Math.min(def.maxPilhas, Math.max(1, pilhas)),
      potencia: pot,
      proximoTique: INTERVALO_DOT,
      origem: fonte.uid,
    };
    alvo.statuses.push(nova);
    this.emit({ t: this.ms, tipo: 'statusAplicado', de: fonte.uid, para: alvo.uid, status: id, pilhas: nova.pilhas, duracao: dur });
  }

  /** Perda de vida pura (custos de maldição etc.): sem armadura, escudo, crítico ou gatilhos. */
  private perderVida(c: Combatant, fracao: number, origem: OrigemDano): void {
    if (!c.vivo || fracao <= 0) return;
    const valor = Math.max(1, Math.round(c.stats.vidaMax * fracao));
    c.vida -= valor;
    this.emit({ t: this.ms, tipo: 'dano', de: c.uid, para: c.uid, valor, absorvido: 0, critico: false, escola: 'sombra', origem });
    if (c.vida <= 0) {
      c.vida = 0;
      c.vivo = false;
      this.emit({ t: this.ms, tipo: 'morte', uid: c.uid, por: null });
    }
  }

  private curar(fonte: Combatant, alvo: Combatant, valor: number): void {
    if (!alvo.vivo || valor <= 0) return;
    let v = valor;
    if (hasStatus(alvo, 'doenca')) v *= 1 - DOENCA_REDUCAO_CURA;
    const real = Math.min(alvo.stats.vidaMax - alvo.vida, Math.round(v));
    if (real <= 0) return;
    alvo.vida += real;
    this.emit({ t: this.ms, tipo: 'cura', de: fonte.uid, para: alvo.uid, valor: real });
  }

  /** Aplica dano com crítico, bônus condicionais, armadura e escudo. Retorna o dano na vida. */
  private causarDano(fonte: Combatant, alvo: Combatant, bruto: number, escola: Escola, origem: OrigemDano, o: DanoOpts): number {
    if (!alvo.vivo || bruto <= 0) return 0;
    let v = o.variancia ? rolarVariancia(bruto, this.rng.next()) : bruto;

    let critico = false;
    if (origem.tipo !== 'status') {
      let critChance = fonte.stats.critChance;
      let mult = 1;
      for (const m of fonte.condMods) {
        if (!condModAplica(m, alvo, escola, origem)) continue;
        mult *= 1 + (m.danoMult ?? 0);
        critChance += m.critChanceExtra ?? 0;
      }
      const furia = findStatus(fonte, 'enfurecido');
      if (furia) mult *= 1 + furia.potencia;
      mult *= fonte.enrage.dano;
      v *= mult;
      if (o.podeCritar && this.rng.chance(critChance)) {
        critico = true;
        v *= fonte.stats.critDano;
      }
    }
    if (!o.ignoraArmadura) v *= 1 - reducaoArmadura(alvo.stats.armadura, escola === 'fisico');

    const valor = arredondarDano(v);
    let absorvido = 0;
    const escudo = findStatus(alvo, 'escudo');
    if (escudo && escudo.potencia > 0) {
      absorvido = Math.min(valor, Math.floor(escudo.potencia));
      escudo.potencia -= absorvido;
    }
    const real = valor - absorvido;
    alvo.vida -= real;
    this.emit({ t: this.ms, tipo: 'dano', de: fonte.uid, para: alvo.uid, valor: real, absorvido, critico, escola, origem });

    // Recursos e carga da suprema
    if (origem.tipo === 'ataque' && fonte.recurso?.ganhoAoBater) {
      fonte.recursoAtual = Math.min(fonte.stats.recursoMax, fonte.recursoAtual + fonte.recurso.ganhoAoBater);
    }
    if (real > 0 && alvo.recurso?.ganhoAoApanhar) {
      alvo.recursoAtual = Math.min(alvo.stats.recursoMax, alvo.recursoAtual + (alvo.recurso.ganhoAoApanhar * real) / alvo.stats.vidaMax);
    }
    if (fonte.suprema && (origem.tipo === 'ataque' || origem.tipo === 'habilidade')) fonte.cargaSuprema += fonte.suprema.cargaPorAcerto;
    if (alvo.suprema && real > 0) alvo.cargaSuprema += (alvo.suprema.cargaPorDanoRecebido * real) / alvo.stats.vidaMax;

    const morreu = alvo.vida <= 0;
    if (morreu) {
      alvo.vida = 0;
      alvo.vivo = false;
      this.emit({ t: this.ms, tipo: 'morte', uid: alvo.uid, por: fonte.uid });
    }

    if (origem.tipo !== 'status') {
      const ctx: EfeitoCtx = { alvo, danoCausado: real + absorvido };
      if (origem.tipo === 'ataque') this.dispararGatilhos(fonte, 'aoAtacar', ctx);
      if (critico) this.dispararGatilhos(fonte, 'aoCritar', ctx);
    }
    if (!morreu && real > 0) this.dispararGatilhos(alvo, 'aoReceberDano', { atacante: fonte, danoCausado: real });
    if (morreu && fonte !== alvo) this.dispararGatilhos(fonte, 'aoMatar', { alvo });
    return real;
  }

  // -------------------------------------------------------------------------
  // Gatilhos
  // -------------------------------------------------------------------------

  private dispararGatilhos(c: Combatant, gatilho: Gatilho, ctx: EfeitoCtx): void {
    if (this.profundidade > 0 || !c.vivo || c.gatilhos.length === 0) return;
    for (const g of c.gatilhos) {
      if (g.gatilho === gatilho) this.dispararUm(c, g.id, ctx);
    }
  }

  private dispararUm(c: Combatant, id: string, ctx: EfeitoCtx): void {
    if (this.profundidade > 0 || !c.vivo) return;
    const g = c.gatilhos.find((x) => x.id === id);
    const st = c.gatilhoEstado[id];
    if (!g || !st || st.recarga > EPS) return;
    const alvo = ctx.alvo ?? this.alvoPrincipal(c);
    if (g.condicao && !checarCondicao(g.condicao, c, alvo)) return;
    if (g.chance !== undefined && g.chance < 1 && !this.rng.chance(g.chance)) return;
    st.recarga = g.recargaInterna ?? 0;
    this.profundidade++;
    try {
      this.aplicarEfeitos(c, g.efeitos, { ...ctx, alvo }, { tipo: 'gatilho', id: g.id });
    } finally {
      this.profundidade--;
    }
  }

  // -------------------------------------------------------------------------

  private verificarFim(): boolean {
    if (this.resultado) return true;
    if (!this.heroi.vivo) {
      this.finalizar('inimigo', 'eliminacao');
      return true;
    }
    if (this.inimigos.every((i) => !i.vivo)) {
      this.finalizar('heroi', 'eliminacao');
      return true;
    }
    return false;
  }

  private finalizar(vencedor: Side, motivo: 'eliminacao' | 'tempo'): void {
    this.resultado = {
      vencedor,
      motivo,
      duracao: this.t,
      vidaFinalHeroi: Math.max(0, Math.round(this.heroi.vida)),
      inimigosMortos: this.inimigos.filter((i) => !i.vivo).map((i) => i.defId),
    };
    this.emit({ t: this.ms, tipo: 'fim', vencedor, motivo });
  }
}
