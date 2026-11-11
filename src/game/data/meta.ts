/**
 * Conteúdo da progressão permanente: árvore, relíquias, conquistas e Modos Difíceis (dados).
 */

import type { MetaBonus } from '../formulas';
import type { NodeKind } from '../map';
import type { ClassId, Modifier, StatKey } from '../types';
import type { BlessingPayload } from './blessings';

// ---------------------------------------------------------------------------
// Árvore permanente (bônus pequenos e controlados)
// ---------------------------------------------------------------------------

export interface TreeNodeDef {
  id: string;
  nome: string;
  icone: string;
  /** {v} = valor total no nível seguinte; {v%} em porcentagem. */
  descricao: string;
  /** Custo de cada nível (o tamanho define o nível máximo). */
  custos: number[];
  /** Bônus somado por nível. */
  porNivel: Partial<MetaBonus>;
  requer?: { id: string; nivel: number }[];
}

export const TREE: TreeNodeDef[] = [
  { id: 'vigor', nome: 'Vigor de Nortúndria', icone: '❤️', descricao: '+{v%} de vida máxima.', custos: [5, 10, 18], porNivel: { vidaPct: 0.05 } },
  { id: 'forca', nome: 'Treino de Combate', icone: '⚔️', descricao: '+{v%} de dano.', custos: [5, 10, 18], porNivel: { danoPct: 0.04 } },
  {
    id: 'precisao',
    nome: 'Olho Treinado',
    icone: '🎯',
    descricao: '+{v%} de chance de crítico.',
    custos: [10, 18],
    porNivel: { critChance: 0.02 },
    requer: [{ id: 'forca', nivel: 1 }],
  },
  {
    id: 'couraca',
    nome: 'Couraça Reforçada',
    icone: '🛡️',
    descricao: '+{v%} de armadura.',
    custos: [10, 18],
    porNivel: { armadura: 0.02 },
    requer: [{ id: 'vigor', nivel: 1 }],
  },
  { id: 'fortuna', nome: 'Bolsa Goblin', icone: '💰', descricao: '+{v%} de ouro na corrida.', custos: [6, 14], porNivel: { ouroPct: 0.1 } },
  {
    id: 'recuperacao',
    nome: 'Fôlego de Veterano',
    icone: '🩹',
    descricao: '+{v%} de cura após cada combate.',
    custos: [10, 20],
    porNivel: { curaPosCombate: 0.03 },
    requer: [{ id: 'vigor', nivel: 2 }],
  },
  { id: 'relancamento', nome: 'Segunda Opinião', icone: '⟳', descricao: '+{v} relançamento(s) por corrida.', custos: [12, 28], porNivel: { relancamentos: 1 } },
  {
    id: 'alforje',
    nome: 'Alforje do Aventureiro',
    icone: '🧪',
    descricao: 'Começa com {v} Poção de Cura.',
    custos: [12],
    porNivel: { pocoes: 1 },
    requer: [{ id: 'fortuna', nivel: 1 }],
  },
  {
    id: 'bencaoInicial',
    nome: 'Favor das Facções',
    icone: '✦',
    descricao: 'Começa a corrida escolhendo 1 de 3 bênçãos comuns.',
    custos: [20],
    porNivel: { bencaoInicial: 1 },
    requer: [{ id: 'relancamento', nivel: 1 }],
  },
];

export const TREE_BY_ID: Record<string, TreeNodeDef> = Object.fromEntries(TREE.map((n) => [n.id, n]));

// ---------------------------------------------------------------------------
// Relíquias (equipa 1 antes da corrida)
// ---------------------------------------------------------------------------

export type FonteReliquia = 'elite' | 'miniChefe' | 'chefe';

export interface RelicDef {
  id: string;
  nome: string;
  icone: string;
  descricao: string;
  fonte: FonteReliquia;
  payload: BlessingPayload;
}

const mod = (stat: StatKey, op: Modifier['op'], value: number): Modifier => ({ stat, op, value, source: 'reliquia' });

export const RELICS: RelicDef[] = [
  { id: 'presaDeProtodraco', nome: 'Presa de Protodraco', icone: '🦷', descricao: '+8% de dano.', fonte: 'elite', payload: { modificadores: [mod('dano', 'mult', 0.08)] } },
  { id: 'amuletoVrykul', nome: 'Amuleto Vrykul', icone: '📿', descricao: '+8% de vida máxima.', fonte: 'elite', payload: { modificadores: [mod('vidaMax', 'mult', 0.08)] } },
  {
    id: 'runaDoInverno',
    nome: 'Runa do Inverno',
    icone: '❄️',
    descricao: 'Ataques têm 15% de chance de aplicar Lentidão de 20% por 3 s.',
    fonte: 'elite',
    payload: {
      gatilhos: [{ gatilho: 'aoAtacar', chance: 0.15, efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'lentidao', duracao: 3, valor: { base: 0.2 } }] }],
    },
  },
  {
    id: 'chifreDeGuerra',
    nome: 'Chifre de Guerra',
    icone: '📯',
    descricao: 'Começa cada combate enfurecido por 6 s (+20% de dano).',
    fonte: 'elite',
    payload: { gatilhos: [{ gatilho: 'inicioCombate', efeitos: [{ tipo: 'status', alvo: 'self', status: 'enfurecido', duracao: 6, valor: { base: 0.2 } }] }] },
  },
  {
    id: 'insigniaDoCapitao',
    nome: 'Insígnia do Capitão',
    icone: '🎖️',
    descricao: '+4% de chance de crítico e +15% de dano crítico.',
    fonte: 'miniChefe',
    payload: { modificadores: [mod('critChance', 'add', 0.04), mod('critDano', 'add', 0.15)] },
  },
  {
    id: 'elmoYmirjar',
    nome: 'Elmo Ymirjar',
    icone: '⛑️',
    descricao: 'Começa cada combate com um escudo de 12% da vida máxima.',
    fonte: 'miniChefe',
    payload: { gatilhos: [{ gatilho: 'inicioCombate', efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { vidaMax: 0.12 }, duracao: 20 }] }] },
  },
  {
    id: 'coroaDoSenhorDaGuerra',
    nome: 'Coroa do Senhor da Guerra',
    icone: '👑',
    descricao: '+8% de dano e +8% de vida máxima.',
    fonte: 'chefe',
    payload: { modificadores: [mod('dano', 'mult', 0.08), mod('vidaMax', 'mult', 0.08)] },
  },
  {
    id: 'laminaDeUtgarde',
    nome: 'Lâmina de Utgarde',
    icone: '🗡️',
    descricao: 'Críticos causam 40% do dano extra como sombra (recarga 1 s).',
    fonte: 'chefe',
    payload: {
      gatilhos: [
        { gatilho: 'aoCritar', recargaInterna: 1, efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 0.4 }, escola: 'sombra', podeCritar: false }] },
      ],
    },
  },
];

export const RELICS_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Conquistas (desbloqueios)
// ---------------------------------------------------------------------------

export type CondicaoConquista =
  | { tipo: 'alcancar'; no: NodeKind }
  | { tipo: 'vencer'; no: NodeKind }
  | { tipo: 'vencerMasmorra'; dificuldade: 'normal' | 'heroico' }
  | { tipo: 'corridas'; n: number };

export interface AchievementDef {
  id: string;
  nome: string;
  descricao: string;
  condicao: CondicaoConquista;
  desbloqueia?: { classe?: ClassId; heroico?: boolean };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'dianteDoCapitao',
    nome: 'Diante do Capitão',
    descricao: 'Chegue ao mini-chefe.',
    condicao: { tipo: 'alcancar', no: 'miniChefe' },
    desbloqueia: { classe: 'ladino' },
  },
  {
    id: 'cacadorDeElites',
    nome: 'Caçador de Elites',
    descricao: 'Derrote uma elite.',
    condicao: { tipo: 'vencer', no: 'elite' },
    desbloqueia: { classe: 'sacerdote' },
  },
  {
    id: 'conquistadorDeUtgarde',
    nome: 'Conquistador de Utgarde',
    descricao: 'Vença a Fortaleza Utgarde no Normal.',
    condicao: { tipo: 'vencerMasmorra', dificuldade: 'normal' },
    desbloqueia: { heroico: true },
  },
  { id: 'heroiDeUtgarde', nome: 'Herói de Utgarde', descricao: 'Vença a Fortaleza Utgarde no Heroico.', condicao: { tipo: 'vencerMasmorra', dificuldade: 'heroico' } },
  { id: 'persistente', nome: 'Persistente', descricao: 'Complete 5 corridas.', condicao: { tipo: 'corridas', n: 5 } },
];

// ---------------------------------------------------------------------------
// Modos Difíceis (estrutura pronta; NÃO ativos no MVP)
// ---------------------------------------------------------------------------

/** Modificador opcional que soma pontos de dificuldade (estilo Ulduar/Calor do Hades). */
export interface HardModeDef {
  id: string;
  nome: string;
  descricao: string;
  /** Pontos de dificuldade por nível. */
  pontos: number;
  maxNivel: number;
  /** Efeito por nível, aplicado sobre os inimigos/corrida quando implementado. */
  porNivel: { inimigoVidaPct?: number; inimigoDanoPct?: number; curaPct?: number; ouroPct?: number; enrageAntecipado?: number };
}

export const HARD_MODES: HardModeDef[] = [
  { id: 'fortalezaReforcada', nome: 'Fortaleza Reforçada', descricao: '+10% de vida dos inimigos por nível.', pontos: 1, maxNivel: 3, porNivel: { inimigoVidaPct: 0.1 } },
  { id: 'furiaVrykul', nome: 'Fúria Vrykul', descricao: '+8% de dano dos inimigos por nível.', pontos: 2, maxNivel: 3, porNivel: { inimigoDanoPct: 0.08 } },
  { id: 'frioCortante', nome: 'Frio Cortante', descricao: '−25% de cura recebida por nível.', pontos: 2, maxNivel: 2, porNivel: { curaPct: -0.25 } },
  { id: 'impacienciaDoSenhor', nome: 'Impaciência do Senhor', descricao: 'O enrage dos chefes vem 15 s mais cedo por nível.', pontos: 3, maxNivel: 2, porNivel: { enrageAntecipado: 15 } },
];
