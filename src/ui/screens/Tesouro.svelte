<script lang="ts">
  import { game } from '../game.svelte';
  import NoSimples from './NoSimples.svelte';
</script>

<NoSimples icone="🎁" titulo="Tesouro">
  <p class="sutil">Um baú vrykul esquecido entre os escombros. Dentro, uma bênção incomum ou melhor.</p>
  <div class="opcoes">
    <button class="primario" onclick={() => game.abrirTesouro()}>Abrir o baú</button>
  </div>
</NoSimples>
