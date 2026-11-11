/**
 * Duelo de referência: npm run duelo
 * DPS de cada especialização (sem bênçãos) contra um boneco, e quanto tempo
 * sobrevive contra um agressor padrão (dano 10, 0,7 ataques/s, 20% de armadura).
 */
import { buildHeroInit } from '../src/game/combatants';
import { Combat } from '../src/game/combat/engine';
import { CLASSES } from '../src/game/data/classes';
import { Rng } from '../src/game/rng';
import type { ClassDef, CombatantInit } from '../src/game/types';

const alvo = (dano: number, vida: number): CombatantInit => ({
  uid: 'alvo', defId: 'alvo', nome: 'Alvo', side: 'inimigo', tier: 'chefe',
  stats: { vidaMax: vida, recursoMax: 0, dano, aps: 0.7, critChance: 0.05, critDano: 1.5, armadura: 0.2 },
  recurso: null, ataqueEscola: 'fisico', habilidades: [], suprema: null, gatilhos: [], condMods: [],
});
console.log('Spec                    DPS(30s)  Sobrevive(s)  VidaMax');
for (const cls of Object.values(CLASSES) as ClassDef[]) {
  for (const spec of cls.specs) {
    let dps = 0;
    let sobrev = 0;
    const N = 40;
    let vida = 0;
    for (let i = 0; i < N; i++) {
      const h = buildHeroInit(cls, spec, { modificadores: [], gatilhos: [], condMods: [] }, 99999);
      vida = h.stats.vidaMax;
      const c = new Combat(h, [alvo(0, 1e9)], Rng.from('d', spec.id, i));
      while (c.t < 30) c.step();
      dps += (1e9 - c.inimigos[0]!.vida) / 30;
      const h2 = buildHeroInit(cls, spec, { modificadores: [], gatilhos: [], condMods: [] }, 99999);
      const c2 = new Combat(h2, [alvo(10, 1e9)], Rng.from('s', spec.id, i));
      sobrev += c2.run().duracao;
    }
    console.log(`${(cls.nome + '/' + spec.nome).padEnd(24)}${(dps / N).toFixed(1).padStart(8)}${(sobrev / N).toFixed(1).padStart(14)}${String(vida).padStart(9)}`);
  }
}
