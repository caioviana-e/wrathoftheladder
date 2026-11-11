/** Formata eventos de combate em linhas de registro (pt-BR). */

import { STATUSES } from '../game/data/statuses';
import type { CombatEvent, Escola } from '../game/types';

export interface LogLine {
  id: number;
  t: number;
  texto: string;
  tipo: 'dano' | 'critico' | 'cura' | 'status' | 'habilidade' | 'suprema' | 'morte' | 'fim' | 'info' | 'mecanica';
}

const ESCOLA: Record<Escola, string> = {
  fisico: 'físico',
  fogo: 'de fogo',
  gelo: 'de gelo',
  arcano: 'arcano',
  sombra: 'de sombra',
  sagrado: 'sagrado',
  natureza: 'de natureza',
};

export function formatarEvento(e: CombatEvent, nome: (uid: string) => string): Omit<LogLine, 'id'> | null {
  switch (e.tipo) {
    case 'inicio':
      return { t: e.t, tipo: 'info', texto: `Combate iniciado: ${e.combatentes.filter((c) => c.side === 'inimigo').map((c) => c.nome).join(', ')}.` };
    case 'dano': {
      if (e.origem.tipo === 'status') {
        return { t: e.t, tipo: 'status', texto: `${nome(e.para)} sofre ${e.valor} de ${STATUSES[e.origem.id].nome.toLowerCase()}.` };
      }
      const abs = e.absorvido > 0 ? ` (${e.absorvido} absorvido)` : '';
      const crit = e.critico ? ' CRÍTICO!' : '';
      return {
        t: e.t,
        tipo: e.critico ? 'critico' : 'dano',
        texto: `${nome(e.de)} causa ${e.valor} de dano ${ESCOLA[e.escola]} em ${nome(e.para)}${abs}.${crit}`,
      };
    }
    case 'cura':
      return { t: e.t, tipo: 'cura', texto: `${nome(e.para)} recupera ${e.valor} de vida.` };
    case 'statusAplicado':
      if (e.status === 'escudo') return { t: e.t, tipo: 'status', texto: `${nome(e.para)} recebe um escudo.` };
      return {
        t: e.t,
        tipo: 'status',
        texto: `${nome(e.para)} sofre ${STATUSES[e.status].nome}${e.pilhas > 1 ? ` (×${e.pilhas})` : ''}.`,
      };
    case 'statusExpirou':
      return null;
    case 'habilidade':
      return { t: e.t, tipo: e.suprema ? 'suprema' : 'habilidade', texto: `${nome(e.de)} usa ${e.nome}${e.suprema ? '!' : '.'}` };
    case 'morte':
      return { t: e.t, tipo: 'morte', texto: `${nome(e.uid)} morre.` };
    case 'mecanica':
      return { t: e.t, tipo: 'mecanica', texto: `${nome(e.de)}: ${e.nome}! ${e.texto}` };
    case 'invocacao':
      return { t: e.t, tipo: 'mecanica', texto: `${nome(e.de)} invoca ${e.nome}.` };
    case 'fim':
      return {
        t: e.t,
        tipo: 'fim',
        texto: e.vencedor === 'heroi' ? 'Vitória!' : e.motivo === 'tempo' ? 'Derrota por exaustão (tempo esgotado).' : 'Derrota.',
      };
  }
}
