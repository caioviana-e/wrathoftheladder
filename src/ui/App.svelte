<script lang="ts">
  import './theme.css';
  import { game } from './game.svelte';
  import Combate from './screens/Combate.svelte';
  import Evento from './screens/Evento.svelte';
  import Fim from './screens/Fim.svelte';
  import Fogueira from './screens/Fogueira.svelte';
  import Inicio from './screens/Inicio.svelte';
  import Loja from './screens/Loja.svelte';
  import Mapa from './screens/Mapa.svelte';
  import Recompensa from './screens/Recompensa.svelte';
  import Tesouro from './screens/Tesouro.svelte';
</script>

<main>
  {#key game.tela}
  <div class="surgir">
  {#if game.tela === 'inicio'}
    <Inicio />
  {:else if game.tela === 'mapa'}
    <Mapa />
  {:else if game.tela === 'combate'}
    <Combate />
  {:else if game.tela === 'recompensa'}
    <Recompensa />
  {:else if game.tela === 'fogueira'}
    <Fogueira />
  {:else if game.tela === 'tesouro'}
    <Tesouro />
  {:else if game.tela === 'evento'}
    <Evento />
  {:else if game.tela === 'vendedor'}
    <Loja />
  {:else if game.tela === 'fim'}
    <Fim />
  {/if}
  </div>
  {/key}
</main>
