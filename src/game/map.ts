/**
 * Geração do mapa da masmorra (estilo "caminhos ramificados").
 *
 * - Linha 0: só combates. Linha do meio: mini-chefe (nó único). Penúltima: fogueiras. Última: chefe.
 * - Linhas comuns: 2–3 nós, ligados à linha seguinte sem cruzamentos.
 * - Regras: ≥ 2 elites, nenhuma elite nas 3 primeiras linhas, nenhum vendedor ligado a outro vendedor.
 */

import { EVENTS } from './data/events';
import type { DungeonDef } from './types';
import { MAPA, pesosQuantidadeInimigos } from './formulas';
import { Rng } from './rng';

export type NodeKind = 'combate' | 'elite' | 'evento' | 'fogueira' | 'vendedor' | 'tesouro' | 'miniChefe' | 'chefe';

export interface MapNode {
  id: string;
  linha: number;
  indice: number;
  /** Posição horizontal normalizada (0..1), para desenhar. */
  x: number;
  tipo: NodeKind;
  /** Inimigos (só em nós de combate). Definidos na geração: o mapa é o "plano" da corrida. */
  inimigos: string[];
  /** ids dos nós ligados na linha seguinte. */
  filhos: string[];
  /** Evento sorteado para nós de evento (sem repetir enquanto houver eventos novos). */
  eventoId?: string;
}

export interface DungeonMap {
  linhas: MapNode[][];
}

export const NOS_DE_COMBATE: readonly NodeKind[] = ['combate', 'elite', 'miniChefe', 'chefe'];

export function ehCombate(tipo: NodeKind): boolean {
  return NOS_DE_COMBATE.includes(tipo);
}

export function linhaMiniChefe(total: number): number {
  return Math.floor(total / 2);
}

export function nodeId(linha: number, indice: number): string {
  return `${linha}-${indice}`;
}

export function findNode(mapa: DungeonMap, id: string): MapNode | undefined {
  const [l, i] = id.split('-').map(Number);
  return mapa.linhas[l ?? -1]?.[i ?? -1];
}

export function pais(mapa: DungeonMap, no: MapNode): MapNode[] {
  return (mapa.linhas[no.linha - 1] ?? []).filter((p) => p.filhos.includes(no.id));
}

function cruza(a: [number, number], b: [number, number]): boolean {
  return (a[0] < b[0] && a[1] > b[1]) || (a[0] > b[0] && a[1] < b[1]);
}

/** Liga a linha `de` à linha `para` sem cruzamentos; todo nó tem ao menos 1 saída e 1 entrada. */
function ligar(de: MapNode[], para: MapNode[], rng: Rng): void {
  const arestas: [number, number][] = [];
  const temAresta = (i: number, j: number) => arestas.some(([a, b]) => a === i && b === j);
  const adicionar = (i: number, j: number): boolean => {
    if (temAresta(i, j) || arestas.some((e) => cruza(e, [i, j]))) return false;
    arestas.push([i, j]);
    return true;
  };
  const maisProximo = (x: number, nos: MapNode[]) => {
    let melhor = 0;
    nos.forEach((n, k) => {
      if (Math.abs(n.x - x) < Math.abs((nos[melhor] as MapNode).x - x)) melhor = k;
    });
    return melhor;
  };
  de.forEach((n, i) => adicionar(i, maisProximo(n.x, para)));
  para.forEach((n, j) => {
    if (!arestas.some(([, b]) => b === j)) adicionar(maisProximo(n.x, de), j);
  });
  de.forEach((_, i) => {
    if (rng.chance(MAPA.chanceLigacaoExtra)) {
      const atual = arestas.filter(([a]) => a === i).map(([, b]) => b);
      const cand = [Math.min(...atual) - 1, Math.max(...atual) + 1].filter((j) => j >= 0 && j < para.length);
      if (cand.length) adicionar(i, rng.pick(cand));
    }
  });
  arestas.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [i, j] of arestas) (de[i] as MapNode).filhos.push((para[j] as MapNode).id);
}

function sortearInimigos(no: MapNode, d: DungeonDef, rng: Rng): string[] {
  switch (no.tipo) {
    case 'combate': {
      const n = rng.weighted(pesosQuantidadeInimigos(no.linha), (x) => x.peso).n;
      return Array.from({ length: n }, () => rng.pick(d.inimigos.normais));
    }
    case 'elite':
      return [rng.pick(d.inimigos.elites)];
    case 'miniChefe':
      return [rng.pick(d.inimigos.miniChefes)];
    case 'chefe':
      return [rng.pick(d.inimigos.chefes)];
    default:
      return [];
  }
}

export function gerarMapa(semente: string, d: DungeonDef): DungeonMap {
  const rng = Rng.from(semente, 'mapa');
  const L = d.linhas;
  const meio = linhaMiniChefe(L);
  const linhas: MapNode[][] = [];

  // 1) Nós e tipos fixos por linha
  for (let linha = 0; linha < L; linha++) {
    const unico = linha === meio || linha === L - 1;
    const n = unico ? 1 : rng.int(MAPA.nosPorLinha.min, MAPA.nosPorLinha.max);
    const linhaNos: MapNode[] = [];
    for (let indice = 0; indice < n; indice++) {
      linhaNos.push({ id: nodeId(linha, indice), linha, indice, x: (indice + 0.5) / n, tipo: 'combate', inimigos: [], filhos: [] });
    }
    linhas.push(linhaNos);
  }

  // 2) Ligações
  for (let linha = 0; linha < L - 1; linha++) ligar(linhas[linha] as MapNode[], linhas[linha + 1] as MapNode[], rng);
  const mapa: DungeonMap = { linhas };

  // 3) Tipos
  const tipos = Object.keys(MAPA.pesos) as (keyof typeof MAPA.pesos)[];
  for (const linhaNos of linhas) {
    for (const no of linhaNos) {
      const l = no.linha;
      if (l === 0) no.tipo = 'combate';
      else if (l === meio) no.tipo = 'miniChefe';
      else if (l === L - 2) no.tipo = 'fogueira';
      else if (l === L - 1) no.tipo = 'chefe';
      else {
        const permitidos = tipos.filter((t) => {
          if (t === 'elite' && l < MAPA.linhasSemElite) return false;
          if (t === 'fogueira' && (l < 3 || l === L - 3)) return false;
          if (t === 'vendedor' && pais(mapa, no).some((p) => p.tipo === 'vendedor')) return false;
          return true;
        });
        no.tipo = rng.weighted(permitidos, (t) => MAPA.pesos[t]);
      }
    }
  }

  // 4) Garante o mínimo de elites convertendo combates elegíveis
  const elites = () => linhas.flat().filter((n) => n.tipo === 'elite').length;
  const candidatos = rng.shuffle(linhas.flat().filter((n) => n.tipo === 'combate' && n.linha >= MAPA.linhasSemElite));
  while (elites() < MAPA.minElites && candidatos.length) (candidatos.pop() as MapNode).tipo = 'elite';

  // 5) Inimigos e eventos
  let baralho: string[] = [];
  for (const no of linhas.flat()) {
    no.inimigos = sortearInimigos(no, d, rng);
    if (no.tipo === 'evento') {
      if (baralho.length === 0) baralho = rng.shuffle(EVENTS.map((e) => e.id));
      no.eventoId = baralho.pop() as string;
    }
  }
  return mapa;
}
