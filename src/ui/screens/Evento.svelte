<script lang="ts">
  import { getEvent } from '../../game/data/events';
  import { escolhaDisponivel } from '../../game/run';
  import { game } from '../game.svelte';
  import NoSimples from './NoSimples.svelte';

  const run = $derived(game.run!);
  const st = $derived(run.evento);
  const ev = $derived(st ? getEvent(st.id) : null);
  const pendente = $derived(st?.pendentes.find((p) => p.op === 'combate') ? 'Lutar!' : st?.pendentes.length ? 'Ver bênçãos' : 'Seguir');
</script>

{#if ev && st}
  <NoSimples icone={ev.icone} titulo={ev.nome}>
    <p class="texto">{ev.texto}</p>
    {#if st.escolha === null}
      <div class="escolhas">
        {#each ev.escolhas as e, i (i)}
          <button class="escolha" disabled={!escolhaDisponivel(run, i)} onclick={() => game.escolherNoEvento(i)}>
            <strong>{e.texto}</strong>
            {#if e.dica}<small>{e.dica}</small>{/if}
            {#if e.requisito?.ouro && e.requisito.ouro > run.ouro}<small class="falta">Ouro insuficiente</small>{/if}
          </button>
        {/each}
      </div>
    {:else}
      <p class="resultado"><em>{ev.escolhas[st.escolha]?.texto}</em>: {st.resultado}</p>
      <div class="opcoes">
        <button class="primario" onclick={() => game.concluirEvento()}>{pendente}</button>
      </div>
    {/if}
  </NoSimples>
{/if}

<style>
  .texto {
    max-width: 36rem;
    line-height: 1.5;
  }
  .escolhas {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: min(100%, 30rem);
  }
  .escolha {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    text-align: left;
    padding: 0.7rem 1rem;
  }
  .escolha small {
    color: var(--texto-2);
  }
  .escolha .falta {
    color: var(--perigo);
  }
  .resultado {
    max-width: 36rem;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--ouro);
    background: rgba(0, 0, 0, 0.25);
    text-align: left;
  }
  .resultado em {
    color: var(--ouro);
    font-style: normal;
  }
</style>
