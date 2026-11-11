import { aplicarLimites } from './formulas';
import type { Modifier, StatKey, Stats } from './types';

export const STAT_KEYS: readonly StatKey[] = [
  'vidaMax',
  'recursoMax',
  'dano',
  'aps',
  'critChance',
  'critDano',
  'armadura',
];

/** Valor final = (base + Σ add) × (1 + Σ mult), com os tetos de formulas.ts. */
export function computeStats(base: Stats, mods: readonly Modifier[]): Stats {
  const add: Record<StatKey, number> = { vidaMax: 0, recursoMax: 0, dano: 0, aps: 0, critChance: 0, critDano: 0, armadura: 0 };
  const mult: Record<StatKey, number> = { vidaMax: 0, recursoMax: 0, dano: 0, aps: 0, critChance: 0, critDano: 0, armadura: 0 };
  for (const m of mods) {
    if (m.op === 'add') add[m.stat] += m.value;
    else mult[m.stat] += m.value;
  }
  const out = { ...base };
  for (const k of STAT_KEYS) {
    out[k] = (base[k] + add[k]) * Math.max(0, 1 + mult[k]);
  }
  return aplicarLimites(out);
}
