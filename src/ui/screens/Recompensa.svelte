<script lang="ts">
  import { FACTIONS } from '../../game/data/factions';
  import { RARIDADE_INFO } from '../../game/data/rarities';
  import CartaBencao from '../components/CartaBencao.svelte';
  import PainelHeroi from '../components/PainelHeroi.svelte';
  import { game } from '../game.svelte';

  const run = $derived(game.run!);
  const oferta = $derived(run.oferta);
  const TITULO: Record<string, string> = {
    inicio: 'Favor das Facções: escolha uma bênção inicial',
    combate: 'Vitória! Escolha uma bênção',
    elite: 'Elite derrotada! Bênção rara ou melhor',
    miniChefe: 'Mini-chefe derrotado! Bênção rara ou melhor',
    tesouro: 'Tesouro encontrado',
    evento: 'Uma bênção se oferece',
  };
</script>

<section class="tela">
  <div class="principal">
    <h2>{TITULO[oferta?.origem ?? 'combate']}</h2>
    <p class="sutil">
      Escolha 1 de {oferta?.opcoes.length ?? 0}.
      {#if oferta?.faccao}Somente {FACTIONS[oferta.faccao].nome}.{/if}
      {#if oferta && oferta.raridadeMin !== 'comum'}Mínimo: <span style:color={RARIDADE_INFO[oferta.raridadeMin].cor}>{RARIDADE_INFO[oferta.raridadeMin].nome}</span>.{/if}
    </p>
    <div class="cartas">
      {#each oferta?.opcoes ?? [] as op, i (op.id + i)}
        <div class="entrada" style:animation-delay="{i * 90}ms">
          <CartaBencao id={op.id} raridade={op.raridade} bencaos={run.heroi.bencaos} oferta onclick={() => game.escolherBencao(i)} />
        </div>
      {/each}
    </div>
    <div class="acoes">
      <button onclick={() => game.relancar()} disabled={run.relancamentos <= 0} title="Troca as 3 opções">⟳ Relançar ({run.relancamentos})</button>
      <button onclick={() => game.pularRecompensa()}>Pular</button>
    </div>
  </div>
  <PainelHeroi {run} />
</section>

<style>
  .tela {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 860px) {
    .tela {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .principal {
    text-align: center;
  }
  h2 {
    color: var(--ouro);
  }
  .cartas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 1rem;
    margin: 1.25rem 0;
  }
  .cartas :global(.carta) {
    min-height: 230px;
    width: 100%;
    height: 100%;
  }
  .entrada {
    display: flex;
    animation: surgir 0.4s ease-out both;
  }
  .acoes {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
</style>
