import type { MapNode } from '../src/game/map';
import { escolherNo, type RunState } from '../src/game/run';
import type { CombatantInit, Stats } from '../src/game/types';

export function stats(p: Partial<Stats> = {}): Stats {
  return { vidaMax: 100, recursoMax: 0, dano: 10, aps: 1, critChance: 0, critDano: 1.5, armadura: 0, ...p };
}

export function combatente(p: Partial<CombatantInit> & { uid: string; side: CombatantInit['side'] }): CombatantInit {
  return {
    defId: p.uid,
    nome: p.uid,
    stats: stats(),
    recurso: null,
    ataqueEscola: 'fisico',
    habilidades: [],
    suprema: null,
    gatilhos: [],
    condMods: [],
    ...p,
  };
}

/** Inimigo que não faz nada (aps mínimo e dano 0). */
export function boneco(uid = 'boneco', p: Partial<CombatantInit> = {}): CombatantInit {
  return combatente({ uid, side: 'inimigo', stats: stats({ vidaMax: 1000, dano: 0, aps: 0.2 }), ...p });
}

/** Leva a corrida até um nó do tipo pedido (seguindo pais válidos), se existir. */
export function irAte(run: RunState, tipo: MapNode['tipo']): MapNode | null {
  const alvo = run.mapa.linhas.flat().find((n) => n.tipo === tipo);
  if (!alvo) return null;
  const caminho: MapNode[] = [alvo];
  while ((caminho[0] as MapNode).linha > 0) {
    const atual = caminho[0] as MapNode;
    const pai = (run.mapa.linhas[atual.linha - 1] ?? []).find((p) => p.filhos.includes(atual.id));
    if (!pai) return null;
    caminho.unshift(pai);
  }
  run.caminho = caminho.slice(0, -1).map((n) => n.id);
  run.etapa = 'mapa';
  escolherNo(run, alvo.id);
  return alvo;
}

