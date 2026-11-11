/**
 * Regras genéricas de bênçãos: escala por raridade/nível, montagem da build,
 * ofertas, duplas e tags. Nada aqui conhece uma bênção específica.
 */

import { ALL_BLESSINGS, DUAL_BLESSINGS, FACTION_BLESSINGS, getBlessing, type BlessingDef, type BlessingPayload } from './data/blessings';
import { FACTIONS } from './data/factions';
import {
  BONUS_POR_NIVEL,
  NIVEL_MAX,
  OFERTA_TAMANHO,
  PESO_OFERTA,
  PESO_RARIDADE,
  POTENCIA_RARIDADE,
  RARIDADES,
} from './formulas';
import type { Rng } from './rng';
import type { CondMod, FactionId, Modifier, Raridade, Tag, TriggeredEffect } from './types';

export interface OwnedBlessing {
  id: string;
  nivel: number;
  raridade: Raridade;
}

export interface BlessingOffer {
  id: string;
  raridade: Raridade;
}

export interface Build {
  modificadores: Modifier[];
  gatilhos: TriggeredEffect[];
  condMods: CondMod[];
}

export const BUILD_VAZIA = (): Build => ({ modificadores: [], gatilhos: [], condMods: [] });

export function indiceRaridade(r: Raridade): number {
  return RARIDADES.indexOf(r);
}

export function maiorRaridade(a: Raridade, b: Raridade): Raridade {
  return indiceRaridade(a) >= indiceRaridade(b) ? a : b;
}

export function potencia(raridade: Raridade, nivel: number): number {
  return POTENCIA_RARIDADE[raridade] * (1 + BONUS_POR_NIVEL * (nivel - 1));
}

export function valoresEscalados(def: BlessingDef, raridade: Raridade, nivel: number): Record<string, number> {
  const p = potencia(raridade, nivel);
  const fixos = new Set<string>(def.fixos ?? []);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(def.valores)) out[k] = fixos.has(k) ? v : v * p;
  return out;
}

function formatarNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

/** Descrição com os números da raridade/nível pedidos. */
export function descreverBencao(def: BlessingDef, raridade: Raridade, nivel: number): string {
  const v = valoresEscalados(def, raridade, nivel);
  return def.descricao.replace(/\{(\w+)(%?)\}/g, (_m, chave: string, pct: string) => {
    const x = v[chave];
    if (x === undefined) return `{${chave}}`;
    return pct ? `${Math.round(x * 100)}%` : formatarNumero(Math.round(x * 10) / 10);
  });
}

export function payloadDaBencao(b: OwnedBlessing): BlessingPayload {
  const def = getBlessing(b.id);
  return def.efeito(valoresEscalados(def, b.raridade, b.nivel));
}

/** Junta vários payloads numa build, dando ids únicos aos gatilhos e bônus condicionais. */
export function mesclar(build: Build, payload: BlessingPayload, prefixo: string): void {
  for (const m of payload.modificadores ?? []) build.modificadores.push({ ...m, source: prefixo });
  (payload.gatilhos ?? []).forEach((g, i) => build.gatilhos.push({ ...g, id: `${prefixo}#${i}` }));
  (payload.condMods ?? []).forEach((c, i) => build.condMods.push({ ...c, id: `${prefixo}#c${i}` }));
}

// ---------------------------------------------------------------------------
// Facções, duplas e tags
// ---------------------------------------------------------------------------

export function faccoesPossuidas(bencaos: readonly OwnedBlessing[]): Set<FactionId> {
  const s = new Set<FactionId>();
  for (const b of bencaos) {
    const f = getBlessing(b.id).faccao;
    if (f) s.add(f);
  }
  return s;
}

/** Duplas cujos requisitos estão cumpridos e que o jogador ainda não tem. */
export function duplasLiberadas(bencaos: readonly OwnedBlessing[]): BlessingDef[] {
  const f = faccoesPossuidas(bencaos);
  const tem = new Set(bencaos.map((b) => b.id));
  return DUAL_BLESSINGS.filter((d) => d.dupla && f.has(d.dupla[0]) && f.has(d.dupla[1]) && !tem.has(d.id));
}

/** Duplas que passam a ser liberadas se o jogador pegar `id`. */
export function duplasQueCompleta(bencaos: readonly OwnedBlessing[], id: string): BlessingDef[] {
  const antes = new Set(duplasLiberadas(bencaos).map((d) => d.id));
  return duplasLiberadas([...bencaos, { id, nivel: 1, raridade: 'comum' }]).filter((d) => !antes.has(d.id));
}

export function contarTags(bencaos: readonly OwnedBlessing[]): [Tag, number][] {
  const m = new Map<Tag, number>();
  for (const b of bencaos) for (const t of getBlessing(b.id).tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ---------------------------------------------------------------------------
// Ofertas
// ---------------------------------------------------------------------------

export function sortearRaridade(rng: Rng, minima: Raridade = 'comum'): Raridade {
  const min = indiceRaridade(minima);
  const opcoes = RARIDADES.filter((_, i) => i >= min);
  return rng.weighted(opcoes, (r) => PESO_RARIDADE[r]);
}

export interface OfertaParams {
  bencaos: readonly OwnedBlessing[];
  favoritas: readonly FactionId[];
  raridadeMin?: Raridade;
  faccao?: FactionId;
  n?: number;
}

export function gerarOferta(rng: Rng, p: OfertaParams): BlessingOffer[] {
  const possuidas = new Map(p.bencaos.map((b) => [b.id, b]));
  const ativa = (b: BlessingDef) => !b.faccao || FACTIONS[b.faccao].ativa;
  const candidatos: BlessingDef[] = [
    ...FACTION_BLESSINGS.filter((b) => ativa(b) && (!p.faccao || b.faccao === p.faccao)),
    ...(p.faccao ? [] : duplasLiberadas(p.bencaos)),
  ].filter((b) => (possuidas.get(b.id)?.nivel ?? 0) < NIVEL_MAX);

  const peso = (b: BlessingDef) => {
    let w = PESO_OFERTA.base;
    if (b.faccao && p.favoritas.includes(b.faccao)) w *= PESO_OFERTA.faccaoFavorita;
    if (possuidas.has(b.id)) w *= PESO_OFERTA.repetida;
    if (b.dupla) w *= PESO_OFERTA.dupla;
    return w;
  };

  const escolhidas: BlessingDef[] = [];
  const restantes = [...candidatos];
  const n = p.n ?? OFERTA_TAMANHO;
  while (escolhidas.length < n && restantes.length) {
    const b = rng.weighted(restantes, peso);
    escolhidas.push(b);
    restantes.splice(restantes.indexOf(b), 1);
  }
  return escolhidas.map((b) => ({ id: b.id, raridade: b.raridadeFixa ?? sortearRaridade(rng, p.raridadeMin) }));
}

/** Adiciona (ou sobe de nível) uma bênção. Repetida: +1 nível e fica com a maior raridade. */
export function adicionarBencao(bencaos: OwnedBlessing[], oferta: BlessingOffer): OwnedBlessing {
  const atual = bencaos.find((b) => b.id === oferta.id);
  if (atual) {
    atual.nivel = Math.min(NIVEL_MAX, atual.nivel + 1);
    atual.raridade = maiorRaridade(atual.raridade, oferta.raridade);
    return atual;
  }
  const nova = { id: oferta.id, nivel: 1, raridade: oferta.raridade };
  bencaos.push(nova);
  return nova;
}

export function todasAsBencaos(): BlessingDef[] {
  return ALL_BLESSINGS;
}
