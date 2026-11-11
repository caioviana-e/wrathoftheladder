<script lang="ts">
  import { CONSUMABLES_BY_ID } from '../../game/data/items';
  import { CURA_VENDEDOR } from '../../game/formulas';
  import { podeComprar } from '../../game/run';
  import CartaBencao from '../components/CartaBencao.svelte';
  import { game } from '../game.svelte';
  import NoSimples from './NoSimples.svelte';

  const run = $derived(game.run!);
  const loja = $derived(run.loja ?? []);
  const indices = (tipo: string) => loja.map((it, i) => ({ it, i })).filter((x) => x.it.tipo === tipo);
</script>

<NoSimples icone="💰" titulo="Vendedor goblin">
  <p class="sutil">"Tempo é dinheiro, amigo! E você tem <span class="ouro">{run.ouro}</span> de ouro."</p>

  <h3>Bênçãos</h3>
  <div class="grade">
    {#each indices('bencao') as { it, i } (i)}
      {#if it.tipo === 'bencao'}
        <CartaBencao id={it.oferta.id} raridade={it.oferta.raridade} bencaos={run.heroi.bencaos} oferta compacta onclick={() => game.comprar(i)} disabled={!podeComprar(run, i)}>
          {#snippet rodape()}
            <span class="preco" class:vendido={it.vendido}>{it.vendido ? 'Vendido' : `● ${it.preco}`}</span>
          {/snippet}
        </CartaBencao>
      {/if}
    {/each}
  </div>

  <h3>Mercadorias e serviços</h3>
  <div class="lista">
    {#each loja as it, i (i)}
      {#if it.tipo !== 'bencao'}
        {@const c = it.tipo === 'consumivel' ? CONSUMABLES_BY_ID[it.id] : null}
        <button class="item" disabled={!podeComprar(run, i)} onclick={() => game.comprar(i)}>
          <span class="nome">
            {#if it.tipo === 'consumivel'}{c?.icone} {c?.nome}
            {:else if it.tipo === 'cura'}❤️ Bandagens goblin
            {:else}✨ Purificar Saronita{/if}
          </span>
          <small class="sutil">
            {#if it.tipo === 'consumivel'}{c?.descricao}
            {:else if it.tipo === 'cura'}Cura {Math.round(CURA_VENDEDOR * 100)}% da vida.
            {:else}Remove a maldição de um item de Saronita (mantém o bônus).{/if}
          </small>
          <span class="preco" class:vendido={it.vendido}>{it.vendido ? 'Vendido' : `● ${it.preco}`}</span>
        </button>
      {/if}
    {/each}
  </div>

  <div class="opcoes">
    <button class="primario" onclick={() => game.sairDaLoja()}>Sair da loja</button>
  </div>
</NoSimples>

<style>
  h3 {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
    color: var(--texto-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    align-self: flex-start;
  }
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
    gap: 0.6rem;
    width: 100%;
  }
  .lista {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: 0.5rem;
    width: 100%;
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    text-align: left;
  }
  .nome {
    font-weight: 600;
  }
  .preco {
    color: var(--ouro);
    font-weight: 700;
    margin-top: auto;
  }
  .preco.vendido {
    color: var(--texto-2);
  }
</style>
