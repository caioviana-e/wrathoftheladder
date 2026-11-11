import { describe, expect, it } from 'vitest';
import { POLITICA_ALEATORIA, POLITICA_GULOSA } from '../src/game/ai';
import { CLASSES } from '../src/game/data/classes';
import { linhaAlcancada } from '../src/game/meta';
import { simularCorrida } from '../src/game/simulate';

/**
 * Regressão leve da calibração (a calibração completa é feita com `npm run sim`).
 * Amostras pequenas: só verifica tendências robustas.
 */
describe('Calibração (regressão)', () => {
  it('escolher com sinergia vai mais longe que escolher ao acaso, em toda especialização', () => {
    for (const cls of Object.values(CLASSES)) {
      for (const spec of cls!.specs) {
        let g = 0;
        let a = 0;
        for (let i = 0; i < 25; i++) {
          const p = { semente: `cal-${spec.id}-${i}`, classeId: cls!.id, specId: spec.id };
          g += linhaAlcancada(simularCorrida(p, POLITICA_GULOSA));
          a += linhaAlcancada(simularCorrida(p, POLITICA_ALEATORIA));
        }
        expect(g, spec.id).toBeGreaterThan(a);
      }
    }
  });

  it('a primeira corrida sem progressão quase nunca vence', () => {
    let v = 0;
    const N = 120;
    for (let i = 0; i < N; i++) {
      const cls = Object.values(CLASSES)[i % 4]!;
      const spec = cls.specs[i % 2]!;
      if (simularCorrida({ semente: `c1-${i}`, classeId: cls.id, specId: spec.id }, POLITICA_GULOSA).resultado === 'vitoria') v++;
    }
    expect(v / N).toBeLessThanOrEqual(0.1);
  });
});
