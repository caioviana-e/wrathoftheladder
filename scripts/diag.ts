/**
 * Diagnóstico para calibração: npm run diag [-- --n=300 --perfil=guloso]
 * Por especialização (sem progressão): vitória e duração por tipo de encontro,
 * vida ao entrar, mortes por tempo esgotado.
 */
import { POLITICAS } from '../src/game/ai';
import { CLASSES } from '../src/game/data/classes';
import { simularCorrida } from '../src/game/simulate';
import type { ClassDef } from '../src/game/types';

function arg(nome: string, padrao: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.slice(nome.length + 3) : padrao;
}
const N = Number(arg('n', '300'));
const pol = POLITICAS[arg('perfil', 'guloso')]!;
const TIPOS = ['combate', 'elite', 'miniChefe', 'chefe'];
const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const padL = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

console.log(`\nDiagnóstico (${pol.nome}, sem progressão, ${N} corridas). Por tipo: vitória% · vida ao entrar% · duração média s · mortes por tempo`);
console.log(pad('Spec', 22) + TIPOS.map((t) => padL(t, 26)).join('') + padL('vitória', 9));
for (const cls of Object.values(CLASSES) as ClassDef[]) {
  for (const spec of cls.specs) {
    const acc: Record<string, { n: number; v: number; vida: number; dur: number; tempo: number }> = {};
    for (const t of TIPOS) acc[t] = { n: 0, v: 0, vida: 0, dur: 0, tempo: 0 };
    let vit = 0;
    for (let i = 0; i < N; i++) {
      const run = simularCorrida({ semente: `diag-${spec.id}-${i}`, classeId: cls.id, specId: spec.id }, pol, (c) => {
        const a = acc[c.tipo]!;
        a.n++;
        a.vida += c.vidaAntes / c.vidaMax;
        a.dur += c.resultado.duracao;
        if (c.resultado.vencedor === 'heroi') a.v++;
        else if (c.resultado.motivo === 'tempo') a.tempo++;
      });
      if (run.resultado === 'vitoria') vit++;
    }
    const cols = TIPOS.map((t) => {
      const a = acc[t]!;
      if (!a.n) return padL('—', 26);
      return padL(`${((100 * a.v) / a.n).toFixed(0)}% · ${((100 * a.vida) / a.n).toFixed(0)}% · ${(a.dur / a.n).toFixed(0)}s · ${a.tempo}`, 26);
    }).join('');
    console.log(pad(`${cls.nome}/${spec.nome}`, 22) + cols + padL(((100 * vit) / N).toFixed(1) + '%', 9));
  }
}
