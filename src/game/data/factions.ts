import type { FactionId, Tag } from '../types';

export interface FactionDef {
  id: FactionId;
  nome: string;
  cor: string;
  icone: string;
  descricao: string;
  /** Facções previstas mas ainda sem bênçãos não aparecem nas ofertas. */
  ativa: boolean;
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  kirinTor: { id: 'kirinTor', nome: 'Kirin Tor', cor: '#c77dff', icone: '✦', descricao: 'Magia arcana e golpes críticos.', ativa: true },
  cruzadaArgentea: {
    id: 'cruzadaArgentea',
    nome: 'Cruzada Argêntea',
    cor: '#f0e6c0',
    icone: '✚',
    descricao: 'Defesa, escudos e cura.',
    ativa: true,
  },
  laminaDeEbano: {
    id: 'laminaDeEbano',
    nome: 'Cavaleiros da Lâmina de Ébano',
    cor: '#7fd1a0',
    icone: '☠',
    descricao: 'Drenar vida e espalhar doença.',
    ativa: true,
  },
  filhosDeHodir: { id: 'filhosDeHodir', nome: 'Filhos de Hodir', cor: '#8fd8ff', icone: '❄', descricao: 'Gelo, lentidão e congelamento.', ativa: true },
  aliancaCinerea: { id: 'aliancaCinerea', nome: 'Aliança Cinérea', cor: '#ff8a3d', icone: '🜂', descricao: 'Fogo (em breve).', ativa: false },
  oraculos: { id: 'oraculos', nome: 'Oráculos e Frenocoração', cor: '#7ee07e', icone: '❦', descricao: 'Natureza e veneno (em breve).', ativa: false },
};

export const TAG_NOMES: Record<Tag, string> = {
  arcano: 'Arcano',
  critico: 'Crítico',
  escudo: 'Escudo',
  cura: 'Cura',
  defesa: 'Defesa',
  sagrado: 'Sagrado',
  drenar: 'Drenar',
  doenca: 'Doença',
  sombra: 'Sombra',
  gelo: 'Gelo',
  lentidao: 'Lentidão',
  congelamento: 'Congelamento',
  sangramento: 'Sangramento',
  fogo: 'Fogo',
  veneno: 'Veneno',
};
