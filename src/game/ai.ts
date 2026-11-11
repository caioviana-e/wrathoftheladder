/**
 * Perfis de jogador automáticos, usados pela simulação headless.
 * - aleatorio: escolhe qualquer opção válida.
 * - guloso: prioriza sinergia (tags/facções), bênçãos duplas, raridade, e joga o mapa
 *   de forma prudente (fogueira quando ferido, elite só com vida alta).
 */

import { contarTags, duplasQueCompleta, faccoesPossuidas, potencia, type BlessingOffer } from './blessings';
import { getBlessing } from './data/blessings';
import { getEvent, type EventOp } from './data/events';
import { CONSUMABLES_BY_ID } from './data/items';
import { POTENCIA_RARIDADE, RARIDADES } from './formulas';
import type { MapNode, NodeKind } from './map';
import type { Rng } from './rng';
import {
  bencaosMelhoraveis,
  escolhaDisponivel,
  getSpec,
  podeComprar,
  podeUsarConsumivel,
  statsDoHeroi,
  type RunState,
} from './run';
import { getClass } from './data/classes';
import { RELICS_BY_ID, TREE } from './data/meta';
import { comprarNo, podeComprarNo, type MetaState } from './meta';

export const RELANCAR = -1;
export const PULAR = -2;

export type DecisaoFogueira = { acao: 'descansar' } | { acao: 'melhorar'; id: string };

export interface Policy {
  id: string;
  nome: string;
  escolherNo(run: RunState, opcoes: readonly MapNode[], rng: Rng): number;
  /** Índice da bênção, RELANCAR ou PULAR. */
  escolherBencao(run: RunState, rng: Rng): number;
  escolherEvento(run: RunState, rng: Rng): number;
  fogueira(run: RunState, rng: Rng): DecisaoFogueira;
  /** Índice do item a comprar ou -1 para sair. */
  comprar(run: RunState, rng: Rng): number;
  /** Consumível a usar antes de entrar em `proximo` (-1 = nenhum). */
  usarConsumivel(run: RunState, proximo: MapNode, rng: Rng): number;
  /** Gasta Emblemas na árvore entre corridas (modifica a meta). */
  comprarArvore(meta: MetaState, rng: Rng): void;
  escolherReliquia(meta: MetaState, rng: Rng): string | null;
}

/** Compra nós da árvore enquanto houver Emblemas, escolhendo com `escolher`. */
function gastarEmblemas(meta: MetaState, escolher: (ids: string[]) => string): void {
  for (let k = 0; k < 50; k++) {
    const ids = TREE.map((n) => n.id).filter((id) => podeComprarNo(meta, id));
    if (!ids.length) return;
    comprarNo(meta, escolher(ids));
  }
}

const fracaoVida = (run: RunState) => run.heroi.vida / statsDoHeroi(run).vidaMax;

// ---------------------------------------------------------------------------
// Aleatório
// ---------------------------------------------------------------------------

export const POLITICA_ALEATORIA: Policy = {
  id: 'aleatorio',
  nome: 'Aleatório',
  escolherNo: (_run, opcoes, rng) => rng.int(0, opcoes.length - 1),
  escolherBencao: (run, rng) => rng.int(0, (run.oferta?.opcoes.length ?? 1) - 1),
  escolherEvento: (run, rng) => {
    const n = getEvent(run.evento?.id ?? '').escolhas.length;
    const ok = Array.from({ length: n }, (_, i) => i).filter((i) => escolhaDisponivel(run, i));
    return rng.pick(ok);
  },
  fogueira: (run, rng) => {
    const melh = bencaosMelhoraveis(run);
    return melh.length && rng.chance(0.5) ? { acao: 'melhorar', id: rng.pick(melh).id } : { acao: 'descansar' };
  },
  comprar: (run, rng) => {
    const ok = (run.loja ?? []).map((_, i) => i).filter((i) => podeComprar(run, i));
    return ok.length && rng.chance(0.5) ? rng.pick(ok) : -1;
  },
  usarConsumivel: (run, _proximo, rng) => {
    const ok = run.heroi.consumiveis.map((_, i) => i).filter((i) => podeUsarConsumivel(run, i));
    return ok.length && rng.chance(0.25) ? rng.pick(ok) : -1;
  },
  comprarArvore: (meta, rng) => gastarEmblemas(meta, (ids) => rng.pick(ids)),
  escolherReliquia: (meta, rng) => (meta.reliquias.length && rng.chance(0.7) ? rng.pick(meta.reliquias) : null),
};

/** Ordem de prioridade do perfil guloso na árvore (repetições = próximos níveis). */
const PRIORIDADE_ARVORE = ['forca', 'vigor', 'forca', 'vigor', 'relancamento', 'precisao', 'couraca', 'forca', 'vigor', 'recuperacao', 'bencaoInicial', 'alforje', 'fortuna'];
const RANK_FONTE = { chefe: 3, miniChefe: 2, elite: 1 } as const;

// ---------------------------------------------------------------------------
// Guloso por sinergia
// ---------------------------------------------------------------------------

/** Valor heurístico de um tipo de nó conforme a vida atual (fração 0..1). */
export function valorDoNo(tipo: NodeKind, vida: number): number {
  switch (tipo) {
    case 'tesouro':
      return 5;
    case 'fogueira':
      return vida < 0.5 ? 6 : vida < 0.8 ? 2.5 : 0.5;
    case 'elite':
      return vida > 0.75 ? 4.5 : vida > 0.5 ? 1 : -4;
    case 'combate':
      return vida > 0.35 ? 3 : 0.5;
    case 'evento':
      return 2.5;
    case 'vendedor':
      return 2;
    default:
      return 0;
  }
}

/** Pontuação de uma bênção ofertada para a build atual. */
export function valorDaBencao(run: RunState, o: BlessingOffer): number {
  const def = getBlessing(o.id);
  const possuida = run.heroi.bencaos.find((b) => b.id === o.id);
  let v = possuida
    ? potencia(o.raridade, possuida.nivel + 1) - potencia(possuida.raridade, possuida.nivel) + 0.3
    : POTENCIA_RARIDADE[o.raridade];
  const tags = new Map(contarTags(run.heroi.bencaos));
  for (const t of def.tags) v += 0.3 * Math.min(4, tags.get(t) ?? 0);
  const faccoes = faccoesPossuidas(run.heroi.bencaos);
  if (def.faccao) {
    const mesmas = run.heroi.bencaos.filter((b) => getBlessing(b.id).faccao === def.faccao).length;
    v += 0.25 * Math.min(4, mesmas);
    if (!faccoes.has(def.faccao) && faccoes.size >= 2) v -= 0.3;
    const spec = getSpec(getClass(run.classeId), run.specId);
    if (spec.faccoesFavoritas.includes(def.faccao)) v += 0.3;
  }
  if (def.dupla) v += 1.2;
  v += 1.5 * duplasQueCompleta(run.heroi.bencaos, o.id).length;
  return v;
}

function valorOp(run: RunState, op: EventOp): number {
  const vida = fracaoVida(run);
  switch (op.op) {
    case 'vida':
      return op.fracao * (vida < 0.5 ? 14 : 7);
    case 'vidaMax':
      return op.fracao * 16;
    case 'ouro':
      return op.valor / 18;
    case 'ofertaBencao': {
      let v = 2.5;
      if (op.raridadeMin && RARIDADES.indexOf(op.raridadeMin) >= 2) v += 1;
      if (op.faccao && faccoesPossuidas(run.heroi.bencaos).has(op.faccao)) v += 0.6;
      return v;
    }
    case 'bencaoAleatoria':
      return 1.5 * POTENCIA_RARIDADE[op.raridade];
    case 'itemAmaldicoado':
      return vida > 0.6 ? 2 : 0.5;
    case 'consumivel':
      return run.heroi.consumiveis.length < 3 ? 1 : 0;
    case 'modificador':
      return 1.5;
    case 'relancamentos':
      return 0.7;
    case 'revelarMapa':
      return 0.2;
    case 'perderProximaRecompensa':
      return -2;
    case 'combate':
      return vida > 0.6 ? 1.5 : -1.5;
  }
}

export const POLITICA_GULOSA: Policy = {
  id: 'guloso',
  nome: 'Guloso',
  escolherNo: (run, opcoes, rng) => {
    const vida = fracaoVida(run);
    let melhor = 0;
    let melhorValor = -Infinity;
    opcoes.forEach((n, i) => {
      const v = valorDoNo(n.tipo, vida) + rng.next() * 0.01; // desempate
      if (v > melhorValor) {
        melhorValor = v;
        melhor = i;
      }
    });
    return melhor;
  },
  escolherBencao: (run) => {
    const ops = run.oferta?.opcoes ?? [];
    const valores = ops.map((o) => valorDaBencao(run, o));
    const max = Math.max(...valores);
    if (max < 1.3 && run.relancamentos > 0) return RELANCAR;
    return valores.indexOf(max);
  },
  escolherEvento: (run) => {
    const ev = getEvent(run.evento?.id ?? '');
    let melhor = -1;
    let melhorValor = -Infinity;
    ev.escolhas.forEach((e, i) => {
      if (!escolhaDisponivel(run, i)) return;
      const total = e.resultados.reduce((s, r) => s + r.peso, 0);
      const v = e.resultados.reduce((s, r) => s + (r.peso / total) * r.ops.reduce((a, op) => a + valorOp(run, op), 0), 0);
      if (v > melhorValor) {
        melhorValor = v;
        melhor = i;
      }
    });
    return Math.max(0, melhor);
  },
  fogueira: (run) => {
    const melh = bencaosMelhoraveis(run);
    if (fracaoVida(run) < 0.55 || !melh.length) return { acao: 'descansar' };
    const melhor = [...melh].sort((a, b) => valorDaBencao(run, { id: b.id, raridade: b.raridade }) - valorDaBencao(run, { id: a.id, raridade: a.raridade }))[0];
    return melhor ? { acao: 'melhorar', id: melhor.id } : { acao: 'descansar' };
  },
  comprar: (run) => {
    const loja = run.loja ?? [];
    const vida = fracaoVida(run);
    const prioridade = (i: number): number => {
      const it = loja[i];
      if (!it) return -1;
      switch (it.tipo) {
        case 'cura':
          return vida < 0.5 ? 10 : -1;
        case 'purificar':
          return 6;
        case 'bencao':
          return valorDaBencao(run, it.oferta) >= 1.4 ? 5 + valorDaBencao(run, it.oferta) : -1;
        case 'consumivel':
          return it.id === 'pocaoDeCura' || run.heroi.consumiveis.length === 0 ? 2 : -1;
      }
    };
    const candidatos = loja
      .map((_, i) => i)
      .filter((i) => podeComprar(run, i) && prioridade(i) > 0)
      .sort((a, b) => prioridade(b) - prioridade(a));
    return candidatos[0] ?? -1;
  },
  usarConsumivel: (run, proximo) => {
    const vida = fracaoVida(run);
    const perigoso = proximo.tipo === 'elite' || proximo.tipo === 'miniChefe' || proximo.tipo === 'chefe';
    for (let i = 0; i < run.heroi.consumiveis.length; i++) {
      const c = CONSUMABLES_BY_ID[run.heroi.consumiveis[i] as string];
      if (!c || !podeUsarConsumivel(run, i)) continue;
      if (c.uso === 'imediato' && vida < 0.45) return i;
      if (c.uso === 'proximoCombate' && perigoso) return i;
    }
    return -1;
  },
  comprarArvore: (meta) =>
    gastarEmblemas(meta, (ids) => {
      const rank = (id: string) => {
        const i = PRIORIDADE_ARVORE.indexOf(id);
        return i < 0 ? 99 : i;
      };
      return [...ids].sort((a, b) => rank(a) - rank(b))[0] as string;
    }),
  escolherReliquia: (meta) => {
    const ord = [...meta.reliquias].sort((a, b) => (RANK_FONTE[RELICS_BY_ID[b]?.fonte ?? 'elite'] ?? 0) - (RANK_FONTE[RELICS_BY_ID[a]?.fonte ?? 'elite'] ?? 0));
    return ord[0] ?? null;
  },
};

export const POLITICAS: Record<string, Policy> = {
  aleatorio: POLITICA_ALEATORIA,
  guloso: POLITICA_GULOSA,
};
