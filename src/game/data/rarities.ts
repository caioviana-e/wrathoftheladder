import type { Raridade } from '../types';

export const RARIDADE_INFO: Record<Raridade, { nome: string; cor: string }> = {
  comum: { nome: 'Comum', cor: '#ffffff' },
  incomum: { nome: 'Incomum', cor: '#1eff00' },
  rara: { nome: 'Rara', cor: '#2b8cff' },
  epica: { nome: 'Épica', cor: '#a335ee' },
  lendaria: { nome: 'Lendária', cor: '#ff8000' },
};
