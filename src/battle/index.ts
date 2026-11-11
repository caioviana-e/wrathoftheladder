/**
 * Fachada da cena de combate. A interface cria a batalha, repassa eventos e controla
 * velocidade/pausa. Nada aqui altera o estado do jogo.
 */

import Phaser from 'phaser';
import type { CombatEvent } from '../game/types';
import { ALTURA, BattleScene, LARGURA, type BonecoSetup, type ResolverBoneco } from './BattleScene';

export type { BonecoSetup };

export interface BattleHandle {
  eventos(evs: CombatEvent[]): void;
  velocidade(v: number): void;
  pausa(p: boolean): void;
  destruir(): void;
}

/** `resolver` devolve os dados de um boneco invocado no meio do combate. */
export function criarBatalha(parent: HTMLElement, setup: BonecoSetup[], resolver: ResolverBoneco): BattleHandle {
  const cena = new BattleScene(setup, resolver);
  const jogo = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: LARGURA,
    height: ALTURA,
    transparent: true,
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene: cena,
  });
  return {
    eventos: (evs) => cena.receber(evs),
    velocidade: (v) => cena.setVelocidade(v),
    pausa: (p) => cena.setPausa(p),
    destruir: () => jogo.destroy(true),
  };
}
