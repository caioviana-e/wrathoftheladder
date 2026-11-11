<script lang="ts">
  import { TREE, TREE_BY_ID } from '../../../game/data/meta';
  import { custoProximoNivel, descreverNo, nivelNo, podeComprarNo, requisitosCumpridos } from '../../../game/meta';
  import { game } from '../../game.svelte';

  const meta = $derived(game.meta);
</script>

<p class="sutil intro">
  Gaste Emblemas em bônus permanentes. Eles são pequenos de propósito: a força de verdade vem das bênçãos dentro da corrida.
</p>

<div class="grade">
  {#each TREE as n (n.id)}
    {@const nivel = nivelNo(meta, n.id)}
    {@const max = n.custos.length}
    {@const custo = custoProximoNivel(meta, n.id)}
    {@const liberado = requisitosCumpridos(meta, n.id)}
    <div class="no painel" class:completo={nivel >= max} class:travado={!liberado}>
      <div class="topo">
        <span class="icone">{n.icone}</span>
        <div>
          <strong>{n.nome}</strong>
          <div class="niveis" aria-label="Nível {nivel} de {max}">
            {#each Array.from({ length: max }, (_, i) => i) as i (i)}<span class:on={i < nivel}></span>{/each}
          </div>
        </div>
      </div>
      <p>{nivel > 0 ? `Atual: ${descreverNo(n.id, nivel)}` : descreverNo(n.id, 1)}</p>
      {#if nivel > 0 && nivel < max}<p class="sutil">Próximo: {descreverNo(n.id, nivel + 1)}</p>{/if}
      {#if !liberado}
        <p class="req">Requer: {(n.requer ?? []).map((r) => `${TREE_BY_ID[r.id]?.nome} ${r.nivel}`).join(', ')}</p>
      {/if}
      {#if custo !== null}
        <button class="primario" disabled={!podeComprarNo(meta, n.id)} onclick={() => game.comprarNo(n.id)}>Comprar · 🏅 {custo}</button>
      {:else}
        <span class="max">Nível máximo</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .intro {
    margin: 0 0 1rem;
  }
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 0.75rem;
  }
  .no {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.9rem;
  }
  .no.completo {
    border-color: var(--ouro-2);
  }
  .no.travado {
    opacity: 0.6;
  }
  .topo {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }
  .icone {
    font-size: 1.6rem;
    width: 2.4rem;
    height: 2.4rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--borda);
    background: var(--bg-2);
  }
  .niveis {
    display: flex;
    gap: 3px;
    margin-top: 0.25rem;
  }
  .niveis span {
    width: 18px;
    height: 6px;
    border-radius: 2px;
    background: #2a3a55;
  }
  .niveis span.on {
    background: var(--ouro);
  }
  p {
    margin: 0;
    font-size: 0.88rem;
  }
  .req {
    color: var(--perigo);
    font-size: 0.8rem;
  }
  button {
    margin-top: auto;
  }
  .max {
    margin-top: auto;
    color: var(--ouro);
    font-size: 0.85rem;
    font-weight: 600;
  }
</style>
