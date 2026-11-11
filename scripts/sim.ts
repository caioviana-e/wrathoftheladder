/**
 * Simulação headless em modo campanha:
 *   npm run sim [-- --jogadores=200 --corridas=10 --semente=abc --classe=mago]
 *
 * Cada "jogador" faz várias corridas seguidas com a engine pura: ao fim de cada corrida
 * ganha Emblemas e relíquias, compra melhorias na árvore e equipa uma relíquia segundo o
 * seu perfil. Imprime a taxa de vitória por faixa de corridas e a linha de morte da 1ª.
 */

import { POLITICAS } from '../src/game/ai';
import { CLASSES } from '../src/game/data/classes';
import { getDungeon } from '../src/game/data/dungeons';
import { custoMinimoDaArvore, finalizarCorrida, novoMeta, parametrosDaCorrida } from '../src/game/meta';
import { Rng } from '../src/game/rng';
import { simularCorrida } from '../src/game/simulate';
import type { ClassDef, ClassId } from '../src/game/types';

function arg(nome: string, padrao: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.slice(nome.length + 3) : padrao;
}

const JOGADORES = Number(arg('jogadores', '200'));
const CORRIDAS = Number(arg('corridas', '10'));
const SEMENTE = arg('semente', 'sim');
const FILTRO = arg('classe', '');

const L = getDungeon('fortalezaUtgarde').linhas;
const FAIXAS: [string, number, number][] = [
  ['C1', 0, 0],
  ['C2–3', 1, 2],
  ['C4–6', 3, 5],
  ['C7–10', 6, 9],
];

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const padL = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);
const BARRAS = ' ▁▂▃▄▅▆▇█';
const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—');

const inicio = Date.now();
console.log(`\nCampanha: ${JOGADORES} jogadores × ${CORRIDAS} corridas · Fortaleza Utgarde (Normal, ${L} linhas) · semente "${SEMENTE}"`);
console.log(`Custo mínimo da árvore: ${custoMinimoDaArvore()} Emblemas\n`);
console.log(
  `${pad('Classe/Spec', 22)}${pad('Perfil', 10)}${FAIXAS.map(([n]) => padL(n, 8)).join('')}  ${padL('Emb.C1 mín/méd', 15)}  Morte na C1 (0→${L - 1})       <mini · mini–penúlt. · chefe`,
);
console.log('-'.repeat(22 + 10 + 8 * FAIXAS.length + 2 + 15 + 2 + L + 10));

let menorEmblemaC1 = Infinity;
for (const cls of Object.values(CLASSES) as ClassDef[]) {
  if (FILTRO && cls.id !== FILTRO) continue;
  for (const spec of cls.specs) {
    for (const pol of Object.values(POLITICAS)) {
      const vitorias = new Array<number>(CORRIDAS).fill(0);
      const mortesC1 = new Array<number>(L).fill(0);
      let somaEmbC1 = 0;
      let minEmbC1 = Infinity;
      for (let j = 0; j < JOGADORES; j++) {
        const meta = novoMeta();
        meta.classesDesbloqueadas = Object.keys(CLASSES) as ClassId[];
        const rngMeta = Rng.from(SEMENTE, 'meta', cls.id, spec.id, pol.id, j);
        for (let c = 0; c < CORRIDAS; c++) {
          const params = parametrosDaCorrida(meta, {
            semente: `${SEMENTE}-${cls.id}-${spec.id}-${pol.id}-${j}-${c}`,
            classeId: cls.id,
            specId: spec.id,
            reliquia: pol.escolherReliquia(meta, rngMeta),
            dificuldade: 'normal',
          });
          const run = simularCorrida(params, pol);
          const resumo = finalizarCorrida(meta, run);
          if (run.resultado === 'vitoria') vitorias[c]!++;
          if (c === 0) {
            somaEmbC1 += resumo.emblemas;
            minEmbC1 = Math.min(minEmbC1, resumo.emblemas);
            if (run.linhaMorte !== null) mortesC1[run.linhaMorte]!++;
          }
          pol.comprarArvore(meta, rngMeta);
        }
      }
      menorEmblemaC1 = Math.min(menorEmblemaC1, minEmbC1);
      const faixas = FAIXAS.map(([, a, b]) => {
        let v = 0;
        let n = 0;
        for (let c = a; c <= Math.min(b, CORRIDAS - 1); c++) {
          v += vitorias[c] ?? 0;
          n += JOGADORES;
        }
        return padL(pct(v, n), 8);
      }).join('');
      const max = Math.max(1, ...mortesC1);
      const hist = mortesC1.map((m) => BARRAS[Math.round((m / max) * (BARRAS.length - 1))]).join('');
      const moda = mortesC1.indexOf(Math.max(...mortesC1));
      const meio = Math.floor(L / 2);
      const totalMortes = mortesC1.reduce((a, b) => a + b, 0) || 1;
      const zona = (a: number, b: number) => `${Math.round((100 * mortesC1.slice(a, b + 1).reduce((x, y) => x + y, 0)) / totalMortes)}%`;
      const zonas = `${zona(0, meio - 1)} · ${zona(meio, L - 2)} · ${zona(L - 1, L - 1)}`;
      console.log(
        `${pad(`${cls.nome}/${spec.nome}`, 22)}${pad(pol.nome, 10)}${faixas}  ${padL(`${minEmbC1}/${(somaEmbC1 / JOGADORES).toFixed(1)}`, 15)}  |${hist}| moda ${String(moda).padStart(2)}   ${zonas}`,
      );
    }
  }
}
const ok = menorEmblemaC1 >= custoMinimoDaArvore();
console.log(`\nMenor ganho de Emblemas numa 1ª corrida: ${menorEmblemaC1} (${ok ? 'OK' : 'ABAIXO'} do custo mínimo da árvore).`);
console.log(`Linhas: mini-chefe = ${Math.floor(L / 2)}, fogueira = ${L - 2}, chefe = ${L - 1}. Tempo: ${((Date.now() - inicio) / 1000).toFixed(1)} s\n`);
