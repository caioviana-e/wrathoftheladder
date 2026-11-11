import type { NodeKind } from '../map';

export interface NodeInfo {
  nome: string;
  /** Ícone provisório (troque por sprite depois). */
  icone: string;
  descricao: string;
  cor: string;
}

export const NODE_INFO: Record<NodeKind, NodeInfo> = {
  combate: { nome: 'Combate', icone: '⚔️', descricao: '1 a 3 inimigos comuns.', cor: '#9fb3c8' },
  elite: { nome: 'Elite', icone: '💀', descricao: 'Inimigo forte, recompensa melhor.', cor: '#e0533d' },
  evento: { nome: 'Evento', icone: '❔', descricao: 'Uma escolha com risco e recompensa.', cor: '#b48ce0' },
  fogueira: { nome: 'Fogueira', icone: '🔥', descricao: 'Descansar ou se aprimorar.', cor: '#f0a040' },
  vendedor: { nome: 'Vendedor goblin', icone: '💰', descricao: 'Compre com o ouro da corrida.', cor: '#e6c35c' },
  tesouro: { nome: 'Tesouro', icone: '🎁', descricao: 'Um item grátis.', cor: '#5fd38d' },
  miniChefe: { nome: 'Mini-chefe', icone: '🛡️', descricao: 'Guardião no meio da masmorra.', cor: '#ff8a3d' },
  chefe: { nome: 'Chefe', icone: '👑', descricao: 'O senhor da masmorra.', cor: '#ff5050' },
};
