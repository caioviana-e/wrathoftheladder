/** Monta CombatantInit a partir dos dados (herói e inimigos). */

import { escalaInimigo, type Dificuldade, type MetaBonus } from './formulas';
import { computeStats } from './stats';
import type { ClassDef, CombatantInit, CondMod, EnemyDef, Modifier, SpecDef, Stats, TriggeredEffect } from './types';

export function metaParaModificadores(meta: MetaBonus): Modifier[] {
  const out: Modifier[] = [];
  if (meta.vidaPct) out.push({ stat: 'vidaMax', op: 'mult', value: meta.vidaPct, source: 'meta' });
  if (meta.danoPct) out.push({ stat: 'dano', op: 'mult', value: meta.danoPct, source: 'meta' });
  if (meta.critChance) out.push({ stat: 'critChance', op: 'add', value: meta.critChance, source: 'meta' });
  if (meta.armadura) out.push({ stat: 'armadura', op: 'add', value: meta.armadura, source: 'meta' });
  return out;
}

export function heroStats(cls: ClassDef, spec: SpecDef, mods: readonly Modifier[]): Stats {
  return computeStats(cls.base, [...(spec.modificadores ?? []), ...mods]);
}

export interface HeroBuild {
  modificadores: Modifier[];
  gatilhos: TriggeredEffect[];
  condMods: CondMod[];
}

export function buildHeroInit(cls: ClassDef, spec: SpecDef, build: HeroBuild, vida: number): CombatantInit {
  return {
    uid: 'heroi',
    defId: cls.id,
    nome: `${cls.nome} (${spec.nome})`,
    side: 'heroi',
    stats: heroStats(cls, spec, build.modificadores),
    vida,
    recurso: cls.recurso,
    ataqueEscola: spec.ataqueEscola ?? cls.ataqueEscola,
    habilidades: spec.habilidades,
    suprema: spec.suprema,
    gatilhos: build.gatilhos,
    condMods: build.condMods,
  };
}

export function buildEnemyInit(def: EnemyDef, linha: number, dificuldade: Dificuldade, uid: string, totalLinhas = 15): CombatantInit {
  const esc = escalaInimigo(linha, def.tier, dificuldade, totalLinhas);
  const stats = computeStats(
    {
      vidaMax: def.base.vidaMax * esc.vida,
      recursoMax: 0,
      dano: def.base.dano * esc.dano,
      aps: def.base.aps,
      critChance: def.base.critChance ?? 0.05,
      critDano: def.base.critDano ?? 1.5,
      armadura: def.base.armadura,
    },
    [],
  );
  return {
    uid,
    defId: def.id,
    nome: def.nome,
    side: 'inimigo',
    tier: def.tier,
    stats,
    recurso: null,
    ataqueEscola: def.ataqueEscola,
    habilidades: def.habilidades ?? [],
    suprema: null,
    gatilhos: def.gatilhos ?? [],
    condMods: [],
    ...(def.mecanicas ? { mecanicas: def.mecanicas } : {}),
  };
}
