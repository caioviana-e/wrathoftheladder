/**
 * Itens amaldiçoados (Saronita) e consumíveis (dados declarativos).
 */

import type { Modifier, StatKey } from '../types';
import type { BlessingPayload } from './blessings';

const mod = (stat: StatKey, op: Modifier['op'], value: number): Modifier => ({ stat, op, value, source: 'item' });

export interface CursedItemDef {
  id: string;
  nome: string;
  bonusTexto: string;
  maldicaoTexto: string;
  bonus: BlessingPayload;
  /** Removida ao purificar no vendedor (o bônus continua). */
  maldicao: BlessingPayload;
}

export const CURSED_ITEMS: CursedItemDef[] = [
  {
    id: 'laminaDeSaronita',
    nome: 'Lâmina de Saronita',
    bonusTexto: '+50% de dano.',
    maldicaoTexto: 'Perde 1% da vida máxima por segundo em combate.',
    bonus: { modificadores: [mod('dano', 'mult', 0.5)] },
    maldicao: { gatilhos: [{ gatilho: 'intervalo', intervalo: 1, efeitos: [{ tipo: 'perderVida', fracao: 0.01 }] }] },
  },
  {
    id: 'couracaDeSaronita',
    nome: 'Couraça de Saronita',
    bonusTexto: '+20% de armadura.',
    maldicaoTexto: '−20% de ataques por segundo.',
    bonus: { modificadores: [mod('armadura', 'add', 0.2)] },
    maldicao: { modificadores: [mod('aps', 'mult', -0.2)] },
  },
  {
    id: 'olhoDeSaronita',
    nome: 'Olho de Saronita',
    bonusTexto: '+15% de chance de crítico e +50% de dano crítico.',
    maldicaoTexto: '−20% de vida máxima.',
    bonus: { modificadores: [mod('critChance', 'add', 0.15), mod('critDano', 'add', 0.5)] },
    maldicao: { modificadores: [mod('vidaMax', 'mult', -0.2)] },
  },
  {
    id: 'coracaoDeSaronita',
    nome: 'Coração de Saronita',
    bonusTexto: '+40% de vida máxima.',
    maldicaoTexto: '−25% de dano.',
    bonus: { modificadores: [mod('vidaMax', 'mult', 0.4)] },
    maldicao: { modificadores: [mod('dano', 'mult', -0.25)] },
  },
];

export const CURSED_BY_ID: Record<string, CursedItemDef> = Object.fromEntries(CURSED_ITEMS.map((i) => [i.id, i]));

export interface ConsumableDef {
  id: string;
  nome: string;
  icone: string;
  descricao: string;
  preco: number;
  /** 'imediato': efeito na hora (fora do combate). 'proximoCombate': vale só para o próximo combate. */
  uso: 'imediato' | 'proximoCombate';
  curaFracao?: number;
  payload?: BlessingPayload;
}

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'pocaoDeCura', nome: 'Poção de Cura', icone: '🧪', descricao: 'Cura 40% da vida máxima.', preco: 30, uso: 'imediato', curaFracao: 0.4 },
  {
    id: 'frascoDePoder',
    nome: 'Frasco de Poder Implacável',
    icone: '⚗️',
    descricao: '+25% de dano no próximo combate.',
    preco: 35,
    uso: 'proximoCombate',
    payload: { modificadores: [mod('dano', 'mult', 0.25)] },
  },
  {
    id: 'frascoDaRocha',
    nome: 'Frasco da Rocha',
    icone: '🛡️',
    descricao: 'Escudo de 30% da vida máxima no início do próximo combate.',
    preco: 30,
    uso: 'proximoCombate',
    payload: { gatilhos: [{ gatilho: 'inicioCombate', efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { vidaMax: 0.3 }, duracao: 30 }] }] },
  },
  {
    id: 'elixirDaPrecisao',
    nome: 'Elixir da Precisão',
    icone: '🎯',
    descricao: '+15% de chance de crítico no próximo combate.',
    preco: 30,
    uso: 'proximoCombate',
    payload: { modificadores: [mod('critChance', 'add', 0.15)] },
  },
  {
    id: 'pocaoDeFuror',
    nome: 'Poção de Furor',
    icone: '🔥',
    descricao: 'Começa o próximo combate com o recurso cheio e a suprema em 50%.',
    preco: 25,
    uso: 'proximoCombate',
    payload: {
      gatilhos: [
        {
          gatilho: 'inicioCombate',
          efeitos: [
            { tipo: 'recurso', valor: 1000 },
            { tipo: 'cargaSuprema', valor: 50 },
          ],
        },
      ],
    },
  },
];

export const CONSUMABLES_BY_ID: Record<string, ConsumableDef> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));
