<script lang="ts">
  import { getBlessing } from '../../game/data/blessings';
  import { CLASSES } from '../../game/data/classes';
  import { getEnemy } from '../../game/data/enemies';
  import { CURSED_BY_ID } from '../../game/data/items';
  import { ACHIEVEMENTS, RELICS_BY_ID } from '../../game/data/meta';
  import { RARIDADE_INFO } from '../../game/data/rarities';
  import { game } from '../game.svelte';

  const run = $derived(game.run!);
  const resumo = $derived(run.resumoFinal);
  const vitoria = $derived(run.resultado === 'vitoria');
  const L = $derived(run.mapa.linhas.length);
  const alcancada = $derived(vitoria ? L : (run.linhaMorte ?? 0) + 1);
  const abates = $derived(Object.entries(run.estatisticas.abates).sort((a, b) => b[1] - a[1]));
</script>

<section class="tela">
  <div class="painel cartao" class:vitoria>
    <h2>{vitoria ? 'Vitória!' : 'Você caiu na masmorra'}</h2>
    <p class="sutil">
      {run.dificuldade === 'heroico' ? 'Heroico' : 'Normal'} · Semente: <code>{run.semente}</code>
    </p>

    <div class="progresso" aria-label="Linha alcançada {alcancada} de {L}">
      {#each Array.from({ length: L }, (_, i) => i) as i (i)}
        <span class:feito={i < alcancada} class:morte={!vitoria && i === alcancada - 1}></span>
      {/each}
    </div>
    <p>Chegou à linha <strong>{alcancada}</strong> de {L}.</p>

    {#if resumo}
      <div class="emblemas">
        <strong>🏅 +{resumo.emblemas} Emblemas</strong>
        <ul>
          {#each resumo.detalhes as d, i (i)}<li><span>{d.rotulo}</span><span>+{d.valor}</span></li>{/each}
        </ul>
      </div>
      {#if resumo.reliquiasNovas.length || resumo.conquistasNovas.length || resumo.heroicoDesbloqueado}
        <div class="novidades">
          {#each resumo.reliquiasNovas as id (id)}
            {@const r = RELICS_BY_ID[id]}
            <p>{r?.icone} Nova relíquia: <b>{r?.nome}</b>: {r?.descricao}</p>
          {/each}
          {#each resumo.conquistasNovas as id (id)}
            {@const a = ACHIEVEMENTS.find((x) => x.id === id)}
            <p>🏆 Conquista: <b>{a?.nome}</b></p>
          {/each}
          {#each resumo.classesDesbloqueadas as c (c)}
            <p class="libera" style:color={CLASSES[c]?.cor}>🔓 Nova classe: <b>{CLASSES[c]?.nome}</b></p>
          {/each}
          {#if resumo.heroicoDesbloqueado}<p class="libera">🔓 Dificuldade <b>Heroico</b> liberada!</p>{/if}
        </div>
      {/if}
    {/if}

    <dl>
      <dt>Nós vencidos</dt><dd>{run.estatisticas.nosVencidos}</dd>
      <dt>Inimigos derrotados</dt><dd>{run.estatisticas.inimigosMortos}</dd>
      <dt>Elites</dt><dd>{run.estatisticas.elitesVencidas}</dd>
      <dt>Mini-chefes</dt><dd>{run.estatisticas.miniChefesVencidos}</dd>
      <dt>Chefes</dt><dd>{run.estatisticas.chefesVencidos}</dd>
      <dt>Ouro</dt><dd class="ouro">{run.ouro}</dd>
    </dl>

    {#if abates.length}
      <h3>Inimigos</h3>
      <p>{abates.map(([id, n]) => `${getEnemy(id).nome} ×${n}`).join(' · ')}</p>
    {/if}
    {#if run.heroi.bencaos.length}
      <h3>Bênçãos</h3>
      <p class="bencaos">
        {#each run.heroi.bencaos as b (b.id)}
          <span style:color={RARIDADE_INFO[b.raridade].cor}>{getBlessing(b.id).nome}{b.nivel > 1 ? ` (nv ${b.nivel})` : ''}</span>
        {/each}
      </p>
    {/if}
    {#if run.heroi.itens.length}
      <h3>Saronita</h3>
      <p>{run.heroi.itens.map((i) => CURSED_BY_ID[i.id]?.nome ?? i.id).join(' · ')}</p>
    {/if}

    <button class="primario" onclick={() => game.sair()}>Voltar ao acampamento</button>
  </div>
</section>

<style>
  .tela {
    max-width: 640px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .cartao {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    border-color: var(--perigo);
  }
  .cartao.vitoria {
    border-color: var(--ouro);
  }
  h2 {
    font-size: 1.8rem;
    color: var(--perigo);
  }
  .vitoria h2 {
    color: var(--ouro);
  }
  h3 {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
    color: var(--texto-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  h3 + p {
    margin: 0;
    font-size: 0.9rem;
  }
  .progresso {
    display: flex;
    gap: 3px;
    width: 100%;
    max-width: 420px;
  }
  .progresso span {
    flex: 1;
    height: 10px;
    border-radius: 2px;
    background: #22324d;
  }
  .progresso span.feito {
    background: var(--gelo);
  }
  .progresso span.morte {
    background: var(--perigo);
  }
  .emblemas {
    width: min(100%, 340px);
    padding: 0.75rem 1rem;
    border: 1px solid var(--ouro-2);
    border-radius: var(--raio);
    background: linear-gradient(180deg, #2a2412, #17140a);
  }
  .emblemas strong {
    color: var(--ouro);
    font-size: 1.25rem;
  }
  .emblemas ul {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    font-size: 0.85rem;
  }
  .emblemas li {
    display: flex;
    justify-content: space-between;
    color: var(--texto-2);
  }
  .novidades p {
    margin: 0.2rem 0;
  }
  .libera {
    color: var(--ouro);
  }
  .bencaos {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem 0.8rem;
  }
  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 0.2rem 1.5rem;
    margin: 0.5rem 0;
  }
  dt {
    color: var(--texto-2);
    text-align: left;
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  button {
    margin-top: 1rem;
  }
</style>
