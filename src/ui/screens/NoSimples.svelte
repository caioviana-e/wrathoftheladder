<script lang="ts">
  import type { Snippet } from 'svelte';
  import PainelHeroi from '../components/PainelHeroi.svelte';
  import { game } from '../game.svelte';

  let { icone, titulo, children }: { icone: string; titulo: string; children: Snippet } = $props();
</script>

<section class="tela">
  <div class="conteudo painel">
    <div class="icone" aria-hidden="true">{icone}</div>
    <h2>{titulo}</h2>
    {@render children()}
  </div>
  {#if game.run}<PainelHeroi run={game.run} />{/if}
</section>

<style>
  .tela {
    max-width: 1150px;
    margin: 0 auto;
    padding: 2rem 1rem;
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
  .conteudo {
    text-align: center;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  .icone {
    font-size: 3.5rem;
  }
  h2 {
    color: var(--ouro);
  }
  .conteudo :global(.opcoes) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }
</style>
