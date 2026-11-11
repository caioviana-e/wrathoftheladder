import { describe, expect, it } from 'vitest';
import { LIMITES } from '../src/game/formulas';
import { computeStats } from '../src/game/stats';
import { stats } from './helpers';

describe('computeStats', () => {
  it('aplica (base + add) × (1 + mult)', () => {
    const s = computeStats(stats({ dano: 10 }), [
      { stat: 'dano', op: 'add', value: 2, source: 'a' },
      { stat: 'dano', op: 'mult', value: 0.5, source: 'b' },
      { stat: 'dano', op: 'mult', value: 0.25, source: 'c' },
    ]);
    expect(s.dano).toBeCloseTo(12 * 1.75);
  });

  it('respeita os tetos de armadura e crítico', () => {
    const s = computeStats(stats(), [
      { stat: 'armadura', op: 'add', value: 5, source: 'x' },
      { stat: 'critChance', op: 'add', value: 5, source: 'x' },
    ]);
    expect(s.armadura).toBe(LIMITES.armaduraMax);
    expect(s.critChance).toBe(LIMITES.critChanceMax);
  });

  it('vida máxima é inteira e no mínimo 1', () => {
    expect(computeStats(stats({ vidaMax: 100 }), [{ stat: 'vidaMax', op: 'mult', value: 0.123, source: 'x' }]).vidaMax).toBe(112);
    expect(computeStats(stats(), [{ stat: 'vidaMax', op: 'mult', value: -5, source: 'x' }]).vidaMax).toBe(1);
  });
});
