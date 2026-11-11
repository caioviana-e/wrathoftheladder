<script lang="ts">
  import { game } from '../game.svelte';
  import Arvore from './acampamento/Arvore.svelte';
  import Colecao from './acampamento/Colecao.svelte';
  import Jogar from './acampamento/Jogar.svelte';
  import Opcoes from './acampamento/Opcoes.svelte';
  import Reliquias from './acampamento/Reliquias.svelte';

  type Aba = 'jogar' | 'arvore' | 'reliquias' | 'colecao' | 'opcoes';
  const ABAS: { id: Aba; nome: string }[] = [
    { id: 'jogar', nome: 'Jogar' },
    { id: 'arvore', nome: 'Árvore' },
    { id: 'reliquias', nome: 'Relíquias' },
    { id: 'colecao', nome: 'Coleção' },
    { id: 'opcoes', nome: 'Opções' },
  ];
  let aba = $state<Aba>('jogar');
</script>

<section class="acampamento">
  <header>
    <div>
      <h1>Masmorras de Nortúndria</h1>
      <p class="sutil">Acampamento da Vanguarda · Fiorde Uivante</p>
    </div>
    <div class="emblemas" title="Emblemas: moeda permanente, ganha em toda corrida">
      <span class="icone">🏅</span>
      <strong>{game.meta.emblemas}</strong>
      <small>Emblemas</small>
    </div>
  </header>

  {#if game.avisoSave}
    <p class="aviso" role="alert">{game.avisoSave} <button onclick={() => (game.avisoSave = null)}>OK</button></p>
  {/if}

  <div class="abas" role="tablist" aria-label="Acampamento">
    {#each ABAS as a (a.id)}
      <button role="tab" aria-selected={aba === a.id} class:ativa={aba === a.id} onclick={() => (aba = a.id)}>{a.nome}</button>
    {/each}
  </div>

  <div class="conteudo">
    {#if aba === 'jogar'}
      <Jogar />
    {:else if aba === 'arvore'}
      <Arvore />
    {:else if aba === 'reliquias'}
      <Reliquias />
    {:else if aba === 'colecao'}
      <Colecao />
    {:else}
      <Opcoes />
    {/if}
  </div>
</section>

<style>
  .acampamento {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1.25rem 1rem 3rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h1 {
    color: var(--ouro);
    font-size: clamp(1.5rem, 5vw, 2.4rem);
    margin: 0;
    text-shadow: 0 2px 12px rgba(230, 195, 92, 0.25);
  }
  header p {
    margin: 0.2rem 0 0;
  }
  .emblemas {
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    column-gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--ouro-2);
    border-radius: var(--raio);
    background: linear-gradient(180deg, #2a2412, #17140a);
  }
  .emblemas .icone {
    grid-row: span 2;
    font-size: 1.6rem;
  }
  .emblemas strong {
    color: var(--ouro);
    font-size: 1.3rem;
    line-height: 1;
  }
  .emblemas small {
    color: var(--texto-2);
  }
  .aviso {
    margin: 1rem 0 0;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--perigo);
    border-radius: 8px;
    background: rgba(224, 83, 61, 0.12);
  }
  .abas {
    display: flex;
    gap: 0.25rem;
    margin: 1.25rem 0 1rem;
    border-bottom: 1px solid var(--borda);
    overflow-x: auto;
  }
  .abas button {
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 0;
    background: none;
    padding: 0.6rem 0.9rem;
    color: var(--texto-2);
    white-space: nowrap;
  }
  .abas button.ativa {
    color: var(--ouro);
    border-bottom-color: var(--ouro);
  }
  .abas button:hover:not(.ativa) {
    background: rgba(255, 255, 255, 0.04);
    border-bottom-color: transparent;
  }
</style>
