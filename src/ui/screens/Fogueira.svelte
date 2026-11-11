<script lang="ts">
  import { CURA_FOGUEIRA } from '../../game/formulas';
  import { bencaosMelhoraveis, statsDoHeroi } from '../../game/run';
  import CartaBencao from '../components/CartaBencao.svelte';
  import { game } from '../game.svelte';
  import NoSimples from './NoSimples.svelte';

  const run = $derived(game.run!);
  const vidaMax = $derived(statsDoHeroi(run).vidaMax);
  const cura = $derived(Math.min(vidaMax - run.heroi.vida, Math.round(vidaMax * CURA_FOGUEIRA)));
  const melhoraveis = $derived(bencaosMelhoraveis(run));
  let melhorando = $state(false);
</script>

<NoSimples icone="🔥" titulo="Fogueira">
  {#if !melhorando}
    <p class="sutil">O calor afasta o frio de Nortúndria por alguns instantes. Escolha uma opção.</p>
    <div class="opcoes">
      <button class="primario" onclick={() => game.descansar()}>Descansar: curar {Math.round(CURA_FOGUEIRA * 100)}% (+{cura} de vida)</button>
      <button disabled={melhoraveis.length === 0} onclick={() => (melhorando = true)}>Aprimorar uma bênção (+1 nível)</button>
    </div>
  {:else}
    <p class="sutil">Escolha a bênção a aprimorar. A carta mostra o efeito no próximo nível.</p>
    <div class="grade">
      {#each melhoraveis as b (b.id)}
        <CartaBencao id={b.id} raridade={b.raridade} bencaos={run.heroi.bencaos} oferta compacta onclick={() => game.melhorar(b.id)} />
      {/each}
    </div>
    <button onclick={() => (melhorando = false)}>Voltar</button>
  {/if}
</NoSimples>

<style>
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: 0.6rem;
    width: 100%;
  }
</style>
