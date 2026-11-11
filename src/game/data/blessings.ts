/**
 * Bênçãos de facção (dados declarativos).
 *
 * Cada bênção declara `valores` (na raridade comum, nível 1) e um `efeito` que monta
 * modificadores, gatilhos e bônus condicionais a partir desses valores já escalados
 * por raridade e nível (src/game/blessings.ts). Valores em `fixos` não escalam
 * (chances, durações, intervalos). A engine não conhece nenhuma bênção específica.
 *
 * Na descrição: {chave} mostra o número; {chave%} mostra em porcentagem.
 */

import type { CondMod, FactionId, Modifier, Raridade, StatKey, Tag, TriggeredEffect } from '../types';

export interface BlessingPayload {
  modificadores?: Modifier[];
  gatilhos?: Omit<TriggeredEffect, 'id'>[];
  condMods?: Omit<CondMod, 'id'>[];
}

export interface BlessingDef<K extends string = string> {
  id: string;
  nome: string;
  /** null para bênçãos duplas. */
  faccao: FactionId | null;
  tags: Tag[];
  descricao: string;
  valores: Record<K, number>;
  fixos?: K[];
  efeito: (v: Record<K, number>) => BlessingPayload;
  /** Bênção dupla: exige ao menos 1 bênção de cada facção. */
  dupla?: [FactionId, FactionId];
  /** Raridade fixa (duplas são sempre épicas). */
  raridadeFixa?: Raridade;
}

function def<K extends string>(d: Omit<BlessingDef<K>, 'fixos' | 'efeito'> & { fixos?: NoInfer<K>[]; efeito: (v: Record<NoInfer<K>, number>) => BlessingPayload }): BlessingDef {
  return d as unknown as BlessingDef;
}

const mod = (stat: StatKey, op: Modifier['op'], value: number): Modifier => ({ stat, op, value, source: 'bencao' });

// ---------------------------------------------------------------------------
// Kirin Tor: arcano e crítico
// ---------------------------------------------------------------------------

const KIRIN_TOR = [
  def({
    id: 'menteAfiada',
    nome: 'Mente Afiada',
    faccao: 'kirinTor',
    tags: ['critico'],
    descricao: '+{crit%} de chance de crítico.',
    valores: { crit: 0.05 },
    efeito: (v) => ({ modificadores: [mod('critChance', 'add', v.crit)] }),
  }),
  def({
    id: 'poderArcano',
    nome: 'Poder Arcano',
    faccao: 'kirinTor',
    tags: ['arcano'],
    descricao: '+{dano%} de dano.',
    valores: { dano: 0.08 },
    efeito: (v) => ({ modificadores: [mod('dano', 'mult', v.dano)] }),
  }),
  def({
    id: 'misseisArcanos',
    nome: 'Mísseis Arcanos',
    faccao: 'kirinTor',
    tags: ['arcano'],
    descricao: 'Ataques têm {chance%} de chance de disparar um míssil que causa {mult%} do dano como arcano.',
    valores: { chance: 0.25, mult: 0.6 },
    fixos: ['chance'],
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoAtacar',
          chance: v.chance,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: v.mult }, escola: 'arcano' }],
        },
      ],
    }),
  }),
  def({
    id: 'focoVioleta',
    nome: 'Foco Violeta',
    faccao: 'kirinTor',
    tags: ['critico'],
    descricao: '+{critDano%} de dano crítico.',
    valores: { critDano: 0.25 },
    efeito: (v) => ({ modificadores: [mod('critDano', 'add', v.critDano)] }),
  }),
  def({
    id: 'explosaoArcana',
    nome: 'Explosão Arcana',
    faccao: 'kirinTor',
    tags: ['arcano', 'critico'],
    descricao: 'Críticos liberam uma explosão: {mult%} do dano como arcano em todos os inimigos (recarga 2 s).',
    valores: { mult: 0.45 },
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoCritar',
          recargaInterna: 2,
          efeitos: [{ tipo: 'dano', alvo: 'todosInimigos', valor: { dano: v.mult }, escola: 'arcano', podeCritar: false }],
        },
      ],
    }),
  }),
  def({
    id: 'barreiraPrismatica',
    nome: 'Barreira Prismática',
    faccao: 'kirinTor',
    tags: ['arcano', 'escudo'],
    descricao: 'Começa cada combate com um escudo de {escudo%} da vida máxima.',
    valores: { escudo: 0.1 },
    efeito: (v) => ({
      gatilhos: [{ gatilho: 'inicioCombate', efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { vidaMax: v.escudo }, duracao: 30 }] }],
    }),
  }),
  def({
    id: 'presencaDeEspirito',
    nome: 'Presença de Espírito',
    faccao: 'kirinTor',
    tags: ['arcano'],
    descricao: 'Usar uma habilidade carrega a suprema em +{carga} pontos.',
    valores: { carga: 5 },
    efeito: (v) => ({ gatilhos: [{ gatilho: 'aoUsarHabilidade', efeitos: [{ tipo: 'cargaSuprema', valor: v.carga }] }] }),
  }),
  def({
    id: 'golpePreciso',
    nome: 'Golpe Preciso',
    faccao: 'kirinTor',
    tags: ['critico'],
    descricao: '+{crit%} de chance de crítico contra alvos acima de 70% da vida.',
    valores: { crit: 0.15 },
    efeito: (v) => ({ condMods: [{ quando: { alvoVidaAcima: 0.7 }, critChanceExtra: v.crit }] }),
  }),
];

// ---------------------------------------------------------------------------
// Cruzada Argêntea: defesa, escudos e cura
// ---------------------------------------------------------------------------

const CRUZADA = [
  def({
    id: 'feInabalavel',
    nome: 'Fé Inabalável',
    faccao: 'cruzadaArgentea',
    tags: ['defesa'],
    descricao: '+{vida%} de vida máxima.',
    valores: { vida: 0.1 },
    efeito: (v) => ({ modificadores: [mod('vidaMax', 'mult', v.vida)] }),
  }),
  def({
    id: 'armaduraAbencoada',
    nome: 'Armadura Abençoada',
    faccao: 'cruzadaArgentea',
    tags: ['defesa'],
    descricao: '+{arm%} de armadura.',
    valores: { arm: 0.05 },
    efeito: (v) => ({ modificadores: [mod('armadura', 'add', v.arm)] }),
  }),
  def({
    id: 'escudoDivino',
    nome: 'Escudo Divino',
    faccao: 'cruzadaArgentea',
    tags: ['escudo'],
    descricao: 'Começa cada combate com um escudo de {escudo%} da vida máxima (20 s).',
    valores: { escudo: 0.15 },
    efeito: (v) => ({
      gatilhos: [{ gatilho: 'inicioCombate', efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { vidaMax: v.escudo }, duracao: 20 }] }],
    }),
  }),
  def({
    id: 'luzCurativa',
    nome: 'Luz Curativa',
    faccao: 'cruzadaArgentea',
    tags: ['cura'],
    descricao: 'A cada 5 s, cura {cura%} da vida máxima.',
    valores: { cura: 0.03 },
    efeito: (v) => ({ gatilhos: [{ gatilho: 'intervalo', intervalo: 5, efeitos: [{ tipo: 'cura', alvo: 'self', valor: { vidaMax: v.cura } }] }] }),
  }),
  def({
    id: 'retribuicao',
    nome: 'Retribuição',
    faccao: 'cruzadaArgentea',
    tags: ['defesa', 'sagrado'],
    descricao: 'Ao receber dano, {chance%} de chance de golpear o atacante com {mult%} do dano como sagrado.',
    valores: { chance: 0.3, mult: 0.6 },
    fixos: ['chance'],
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoReceberDano',
          chance: v.chance,
          recargaInterna: 0.5,
          efeitos: [{ tipo: 'dano', alvo: 'atacante', valor: { dano: v.mult }, escola: 'sagrado' }],
        },
      ],
    }),
  }),
  def({
    id: 'juramentoDoCruzado',
    nome: 'Juramento do Cruzado',
    faccao: 'cruzadaArgentea',
    tags: ['escudo'],
    descricao: 'Ao cair abaixo de 35% da vida, ganha um escudo de {escudo%} da vida máxima (uma vez por combate).',
    valores: { escudo: 0.25 },
    efeito: (v) => ({
      gatilhos: [{ gatilho: 'vidaAbaixo', limiar: 0.35, efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { vidaMax: v.escudo }, duracao: 15 }] }],
    }),
  }),
  def({
    id: 'bencaoDaVitoria',
    nome: 'Bênção da Vitória',
    faccao: 'cruzadaArgentea',
    tags: ['cura'],
    descricao: 'Ao matar um inimigo, cura {cura%} da vida máxima.',
    valores: { cura: 0.06 },
    efeito: (v) => ({ gatilhos: [{ gatilho: 'aoMatar', efeitos: [{ tipo: 'cura', alvo: 'self', valor: { vidaMax: v.cura } }] }] }),
  }),
  def({
    id: 'consagracao',
    nome: 'Consagração',
    faccao: 'cruzadaArgentea',
    tags: ['sagrado'],
    descricao: 'A cada 4 s, causa {mult%} do dano como sagrado em todos os inimigos.',
    valores: { mult: 0.4 },
    efeito: (v) => ({
      gatilhos: [
        { gatilho: 'intervalo', intervalo: 4, efeitos: [{ tipo: 'dano', alvo: 'todosInimigos', valor: { dano: v.mult }, escola: 'sagrado' }] },
      ],
    }),
  }),
];

// ---------------------------------------------------------------------------
// Cavaleiros da Lâmina de Ébano: drenar vida e doença
// ---------------------------------------------------------------------------

const LAMINA = [
  def({
    id: 'sedeDeSangue',
    nome: 'Sede de Sangue',
    faccao: 'laminaDeEbano',
    tags: ['drenar'],
    descricao: 'Ataques curam {roubo%} do dano causado.',
    valores: { roubo: 0.08 },
    efeito: (v) => ({ gatilhos: [{ gatilho: 'aoAtacar', efeitos: [{ tipo: 'cura', alvo: 'self', valor: { danoCausado: v.roubo } }] }] }),
  }),
  def({
    id: 'praga',
    nome: 'Praga',
    faccao: 'laminaDeEbano',
    tags: ['doenca'],
    descricao: 'Ataques têm {chance%} de chance de aplicar Doença ({mult%} do dano por segundo, 6 s).',
    valores: { chance: 0.3, mult: 0.3 },
    fixos: ['chance'],
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoAtacar',
          chance: v.chance,
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'doenca', duracao: 6, valor: { dano: v.mult } }],
        },
      ],
    }),
  }),
  def({
    id: 'golpeDaPeste',
    nome: 'Golpe da Peste',
    faccao: 'laminaDeEbano',
    tags: ['doenca'],
    descricao: '+{dano%} de dano contra alvos com Doença.',
    valores: { dano: 0.18 },
    efeito: (v) => ({ condMods: [{ quando: { alvoComStatus: 'doenca' }, danoMult: v.dano }] }),
  }),
  def({
    id: 'toqueNecrotico',
    nome: 'Toque Necrótico',
    faccao: 'laminaDeEbano',
    tags: ['doenca', 'sombra'],
    descricao: 'Habilidades aplicam Doença ({mult%} do dano por segundo, 6 s).',
    valores: { mult: 0.35 },
    efeito: (v) => ({
      gatilhos: [{ gatilho: 'aoUsarHabilidade', efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'doenca', duracao: 6, valor: { dano: v.mult } }] }],
    }),
  }),
  def({
    id: 'explosaoDeCadaver',
    nome: 'Explosão de Cadáver',
    faccao: 'laminaDeEbano',
    tags: ['sombra'],
    descricao: 'Inimigos que você mata explodem: {mult%} do dano como sombra em todos os inimigos.',
    valores: { mult: 0.8 },
    efeito: (v) => ({
      gatilhos: [{ gatilho: 'aoMatar', efeitos: [{ tipo: 'dano', alvo: 'todosInimigos', valor: { dano: v.mult }, escola: 'sombra' }] }],
    }),
  }),
  def({
    id: 'forcaProfana',
    nome: 'Força Profana',
    faccao: 'laminaDeEbano',
    tags: ['sombra'],
    descricao: '+{dano%} de dano.',
    valores: { dano: 0.08 },
    efeito: (v) => ({ modificadores: [mod('dano', 'mult', v.dano)] }),
  }),
  def({
    id: 'pactoDeSangue',
    nome: 'Pacto de Sangue',
    faccao: 'laminaDeEbano',
    tags: ['drenar', 'critico'],
    descricao: 'Críticos curam {roubo%} do dano causado.',
    valores: { roubo: 0.25 },
    efeito: (v) => ({ gatilhos: [{ gatilho: 'aoCritar', efeitos: [{ tipo: 'cura', alvo: 'self', valor: { danoCausado: v.roubo } }] }] }),
  }),
  def({
    id: 'ceifar',
    nome: 'Ceifar',
    faccao: 'laminaDeEbano',
    tags: ['drenar'],
    descricao: '+{dano%} de dano contra alvos abaixo de 35% da vida.',
    valores: { dano: 0.25 },
    efeito: (v) => ({ condMods: [{ quando: { alvoVidaAbaixo: 0.35 }, danoMult: v.dano }] }),
  }),
];

// ---------------------------------------------------------------------------
// Filhos de Hodir: gelo, lentidão e congelamento
// ---------------------------------------------------------------------------

const HODIR = [
  def({
    id: 'toqueGelido',
    nome: 'Toque Gélido',
    faccao: 'filhosDeHodir',
    tags: ['lentidao', 'gelo'],
    descricao: 'Ataques têm {chance%} de chance de aplicar Lentidão de {lent%} por 4 s.',
    valores: { chance: 0.35, lent: 0.25 },
    fixos: ['chance'],
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoAtacar',
          chance: v.chance,
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'lentidao', duracao: 4, valor: { base: v.lent } }],
        },
      ],
    }),
  }),
  def({
    id: 'nevasca',
    nome: 'Nevasca',
    faccao: 'filhosDeHodir',
    tags: ['gelo', 'lentidao'],
    descricao: 'A cada 6 s, causa {mult%} do dano como gelo em todos os inimigos e os deixa lentos.',
    valores: { mult: 0.5 },
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'intervalo',
          intervalo: 6,
          efeitos: [
            { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: v.mult }, escola: 'gelo' },
            { tipo: 'status', alvo: 'todosInimigos', status: 'lentidao', duracao: 3, valor: { base: 0.2 } },
          ],
        },
      ],
    }),
  }),
  def({
    id: 'peleDeGelo',
    nome: 'Pele de Gelo',
    faccao: 'filhosDeHodir',
    tags: ['gelo', 'defesa'],
    descricao: '+{arm%} de armadura e +{vida%} de vida máxima.',
    valores: { arm: 0.03, vida: 0.05 },
    efeito: (v) => ({ modificadores: [mod('armadura', 'add', v.arm), mod('vidaMax', 'mult', v.vida)] }),
  }),
  def({
    id: 'prisaoDeGelo',
    nome: 'Prisão de Gelo',
    faccao: 'filhosDeHodir',
    tags: ['congelamento', 'gelo'],
    descricao: 'Ataques têm {chance%} de chance de congelar o alvo por {dur} s (recarga 5 s).',
    valores: { chance: 0.12, dur: 1.5 },
    fixos: ['chance'],
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoAtacar',
          chance: v.chance,
          recargaInterna: 5,
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'congelamento', duracao: v.dur, valor: {} }],
        },
      ],
    }),
  }),
  def({
    id: 'lancaDeGelo',
    nome: 'Lança de Gelo',
    faccao: 'filhosDeHodir',
    tags: ['gelo', 'lentidao'],
    descricao: '+{dano%} de dano contra alvos com Lentidão.',
    valores: { dano: 0.18 },
    efeito: (v) => ({ condMods: [{ quando: { alvoComStatus: 'lentidao' }, danoMult: v.dano }] }),
  }),
  def({
    id: 'frioPenetrante',
    nome: 'Frio Penetrante',
    faccao: 'filhosDeHodir',
    tags: ['congelamento'],
    descricao: '+{dano%} de dano contra alvos congelados.',
    valores: { dano: 0.35 },
    efeito: (v) => ({ condMods: [{ quando: { alvoComStatus: 'congelamento' }, danoMult: v.dano }] }),
  }),
  def({
    id: 'coracaoGelado',
    nome: 'Coração Gelado',
    faccao: 'filhosDeHodir',
    tags: ['congelamento'],
    descricao: 'No início do combate, congela todos os inimigos por {dur} s.',
    valores: { dur: 1.5 },
    efeito: (v) => ({
      gatilhos: [
        { gatilho: 'inicioCombate', efeitos: [{ tipo: 'status', alvo: 'todosInimigos', status: 'congelamento', duracao: v.dur, valor: {} }] },
      ],
    }),
  }),
  def({
    id: 'estilhacoGelido',
    nome: 'Estilhaço Gélido',
    faccao: 'filhosDeHodir',
    tags: ['gelo', 'critico'],
    descricao: 'Críticos lançam um estilhaço: {mult%} do dano como gelo e Lentidão de 20% (recarga 1 s).',
    valores: { mult: 0.5 },
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoCritar',
          recargaInterna: 1,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: v.mult }, escola: 'gelo', podeCritar: false },
            { tipo: 'status', alvo: 'alvo', status: 'lentidao', duracao: 3, valor: { base: 0.2 } },
          ],
        },
      ],
    }),
  }),
];

// ---------------------------------------------------------------------------
// Bênçãos duplas (sempre épicas)
// ---------------------------------------------------------------------------

export const DUAL_BLESSINGS: BlessingDef[] = [
  def({
    id: 'estilhacar',
    nome: 'Estilhaçar',
    faccao: null,
    dupla: ['kirinTor', 'filhosDeHodir'],
    raridadeFixa: 'epica',
    tags: ['congelamento', 'critico'],
    descricao: 'Inimigos congelados recebem crítico garantido. Críticos têm {chance%} de chance de congelar por 1 s (recarga 4 s).',
    valores: { chance: 0.2 },
    fixos: ['chance'],
    efeito: (v) => ({
      condMods: [{ quando: { alvoComStatus: 'congelamento' }, critChanceExtra: 1 }],
      gatilhos: [
        {
          gatilho: 'aoCritar',
          chance: v.chance,
          recargaInterna: 4,
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'congelamento', duracao: 1, valor: {} }],
        },
      ],
    }),
  }),
  def({
    id: 'sangueConsagrado',
    nome: 'Sangue Consagrado',
    faccao: null,
    dupla: ['cruzadaArgentea', 'laminaDeEbano'],
    raridadeFixa: 'epica',
    tags: ['drenar', 'escudo'],
    descricao: 'Ao matar um inimigo, ganha um escudo de {escudo%} da vida máxima e cura {cura%} da vida máxima.',
    valores: { escudo: 0.12, cura: 0.05 },
    efeito: (v) => ({
      gatilhos: [
        {
          gatilho: 'aoMatar',
          efeitos: [
            { tipo: 'escudo', alvo: 'self', valor: { vidaMax: v.escudo }, duracao: 15 },
            { tipo: 'cura', alvo: 'self', valor: { vidaMax: v.cura } },
          ],
        },
      ],
    }),
  }),
  def({
    id: 'runaProfana',
    nome: 'Runa Profana',
    faccao: null,
    dupla: ['kirinTor', 'laminaDeEbano'],
    raridadeFixa: 'epica',
    tags: ['doenca', 'critico'],
    descricao: 'Críticos aplicam Doença ({mult%} do dano por segundo, 6 s). +{dano%} de dano crítico.',
    valores: { mult: 0.4, dano: 0.2 },
    efeito: (v) => ({
      modificadores: [mod('critDano', 'add', v.dano)],
      gatilhos: [{ gatilho: 'aoCritar', efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'doenca', duracao: 6, valor: { dano: v.mult } }] }],
    }),
  }),
  def({
    id: 'bastiaoGelido',
    nome: 'Bastião Gélido',
    faccao: null,
    dupla: ['cruzadaArgentea', 'filhosDeHodir'],
    raridadeFixa: 'epica',
    tags: ['congelamento', 'defesa'],
    descricao: 'Ao receber dano, {chance%} de chance de congelar o atacante por 2 s (recarga 4 s). +{arm%} de armadura.',
    valores: { chance: 0.25, arm: 0.05 },
    fixos: ['chance'],
    efeito: (v) => ({
      modificadores: [mod('armadura', 'add', v.arm)],
      gatilhos: [
        {
          gatilho: 'aoReceberDano',
          chance: v.chance,
          recargaInterna: 4,
          efeitos: [{ tipo: 'status', alvo: 'atacante', status: 'congelamento', duracao: 2, valor: {} }],
        },
      ],
    }),
  }),
];

export const FACTION_BLESSINGS: BlessingDef[] = [...KIRIN_TOR, ...CRUZADA, ...LAMINA, ...HODIR];
export const ALL_BLESSINGS: BlessingDef[] = [...FACTION_BLESSINGS, ...DUAL_BLESSINGS];
export const BLESSINGS_BY_ID: Record<string, BlessingDef> = Object.fromEntries(ALL_BLESSINGS.map((b) => [b.id, b]));

export function getBlessing(id: string): BlessingDef {
  const b = BLESSINGS_BY_ID[id];
  if (!b) throw new Error(`Bênção desconhecida: ${id}`);
  return b;
}
