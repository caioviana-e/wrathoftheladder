<script lang="ts">
  import { RELICS, type FonteReliquia } from '../../../game/data/meta';
  import { game } from '../../game.svelte';

  const meta = $derived(game.meta);
  const FONTE: Record<FonteReliquia, string> = { elite: 'Cai de elites', miniChefe: 'Cai do mini-chefe', chefe: 'Cai do chefe' };
</script>

<p class="sutil intro">Elites e chefes podem deixar relíquias permanentes. Antes de cada corrida você equipa <b>uma</b>.</p>

<div class="grade">
  <button class="rel painel" class:equipada={meta.reliquiaEquipada === null} onclick={() => game.equiparReliquia(null)}>
    <span class="icone">∅</span>
    <strong>Nenhuma</strong>
    <span class="sutil">Corrida sem relíquia.</span>
  </button>
  {#each RELICS as r (r.id)}
    {@const tem = meta.reliquias.includes(r.id)}
    {#if tem}
      <button class="rel painel" class:equipada={meta.reliquiaEquipada === r.id} onclick={() => game.equiparReliquia(r.id)}>
        <span class="icone">{r.icone}</span>
        <strong>{r.nome}</strong>
        <span>{r.descricao}</span>
        <small class="sutil">{FONTE[r.fonte]}</small>
        {#if meta.reliquiaEquipada === r.id}<span class="tag">Equipada</span>{/if}
      </button>
    {:else}
      <div class="rel painel desconhecida">
        <span class="icone">?</span>
        <strong>???</strong>
        <small class="sutil">{FONTE[r.fonte]}</small>
      </div>
    {/if}
  {/each}
</div>

<style>
  .intro {
    margin: 0 0 1rem;
  }
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
    gap: 0.75rem;
  }
  .rel {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    text-align: left;
    padding: 0.9rem;
    font: inherit;
    color: inherit;
  }
  .rel.equipada {
    border-color: var(--ouro);
    box-shadow: 0 0 14px rgba(230, 195, 92, 0.3);
  }
  .desconhecida {
    opacity: 0.5;
    border-style: dashed;
  }
  .icone {
    font-size: 1.8rem;
  }
  .tag {
    align-self: flex-start;
    font-size: 0.75rem;
    color: var(--ouro);
    border: 1px solid var(--ouro);
    border-radius: 999px;
    padding: 0 0.5rem;
  }
</style>
