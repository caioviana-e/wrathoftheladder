import type { DungeonDef } from '../types';

export const FORTALEZA_UTGARDE: DungeonDef = {
  id: 'fortalezaUtgarde',
  nome: 'Fortaleza Utgarde',
  descricao: 'A fortaleza vrykul no Fiorde Uivante. Introdução, sem mecânica especial.',
  linhas: 15,
  inimigos: {
    normais: ['guerreiroVrykul', 'ritualistaVrykul', 'loboDeUtgarde', 'escravoAtormentado'],
    elites: ['domadorDeProtodracos', 'berserkerVrykul'],
    miniChefes: ['capitaoYmirjar'],
    chefes: ['senhorDeUtgarde'],
  },
};

export const DUNGEONS: Record<string, DungeonDef> = {
  [FORTALEZA_UTGARDE.id]: FORTALEZA_UTGARDE,
};

export function getDungeon(id: string): DungeonDef {
  const d = DUNGEONS[id];
  if (!d) throw new Error(`Masmorra desconhecida: ${id}`);
  return d;
}
