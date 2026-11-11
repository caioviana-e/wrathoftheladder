/** Execução headless de corridas completas (simulação e testes). */

import { PULAR, RELANCAR, type Policy } from './ai';
import { Rng } from './rng';
import {
  abrirTesouro,
  comprar,
  concluirEvento,
  createRun,
  descansar,
  escolherBencao,
  escolherNo,
  escolherOpcaoEvento,
  melhorarBencao,
  noAtual,
  nosDisponiveis,
  prepararCombate,
  pularRecompensa,
  relancarOferta,
  resolverCombate,
  sairDaLoja,
  statsDoHeroi,
  usarConsumivel,
  type NewRunParams,
  type RunState,
} from './run';

/** Resolve o nó atual (não-combate) segundo a política. */
function resolverNo(run: RunState, pol: Policy, rng: Rng): void {
  const no = noAtual(run);
  if (!no) throw new Error('Sem nó atual');
  switch (no.tipo) {
    case 'fogueira': {
      const d = pol.fogueira(run, rng);
      if (d.acao === 'melhorar') melhorarBencao(run, d.id);
      else descansar(run);
      return;
    }
    case 'tesouro':
      abrirTesouro(run);
      return;
    case 'evento':
      if (run.evento?.escolha === null) escolherOpcaoEvento(run, pol.escolherEvento(run, rng));
      concluirEvento(run);
      return;
    case 'vendedor': {
      for (let k = 0; k < 10; k++) {
        const i = pol.comprar(run, rng);
        if (i < 0) break;
        comprar(run, i);
      }
      sairDaLoja(run);
      return;
    }
    default:
      throw new Error(`Nó sem resolução: ${no.tipo}`);
  }
}

/** Informação de cada combate, para diagnóstico/calibração. */
export interface InfoCombate {
  tipo: string;
  linha: number;
  vidaAntes: number;
  vidaMax: number;
  resultado: import('./types').CombatResult;
}

export function simularCorrida(params: NewRunParams, pol: Policy, aoCombater?: (i: InfoCombate) => void): RunState {
  const run = createRun(params);
  const rng = Rng.from(params.semente, 'politica', pol.id);
  let guarda = 0;
  while (run.etapa !== 'fim') {
    if (++guarda > 2000) throw new Error('simularCorrida: laço sem fim');
    switch (run.etapa) {
      case 'mapa': {
        const opcoes = nosDisponiveis(run);
        const no = opcoes[pol.escolherNo(run, opcoes, rng)];
        if (!no) throw new Error('Política escolheu nó inválido');
        for (let k = 0; k < 3; k++) {
          const c = pol.usarConsumivel(run, no, rng);
          if (c < 0) break;
          usarConsumivel(run, c);
        }
        escolherNo(run, no.id);
        break;
      }
      case 'combate': {
        const r = prepararCombate(run).run();
        if (aoCombater) {
          aoCombater({
            tipo: run.encontro?.tipo ?? 'combate',
            linha: noAtual(run)?.linha ?? -1,
            vidaAntes: run.heroi.vida,
            vidaMax: statsDoHeroi(run).vidaMax,
            resultado: r,
          });
        }
        resolverCombate(run, r);
        break;
      }
      case 'no':
        resolverNo(run, pol, rng);
        break;
      case 'recompensa': {
        const i = pol.escolherBencao(run, rng);
        if (i === RELANCAR && run.relancamentos > 0) relancarOferta(run);
        else if (i === PULAR || i < 0) pularRecompensa(run);
        else escolherBencao(run, i);
        break;
      }
    }
  }
  return run;
}
