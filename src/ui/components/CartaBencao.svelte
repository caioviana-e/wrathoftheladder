<script lang="ts">
  import type { Snippet } from 'svelte';
  import { descreverBencao, duplasQueCompleta, type OwnedBlessing } from '../../game/blessings';
  import { getBlessing } from '../../game/data/blessings';
  import { FACTIONS, TAG_NOMES } from '../../game/data/factions';
  import { RARIDADE_INFO } from '../../game/data/rarities';
  import type { Raridade } from '../../game/types';

  interface Props {
    id: string;
    raridade: Raridade;
    /** Bênçãos atuais do herói (para mostrar nível e duplas). */
    bencaos: readonly OwnedBlessing[];
    /** Mostra o nível resultante ao pegar (ofertas) em vez do nível atual. */
    oferta?: boolean;
    compacta?: boolean;
    onclick?: () => void;
    disabled?: boolean;
    rodape?: Snippet;
  }
  let { id, raridade, bencaos, oferta = false, compacta = false, onclick, disabled = false, rodape }: Props = $props();

  const def = $derived(getBlessing(id));
  const possuida = $derived(bencaos.find((b) => b.id === id));
  const nivel = $derived(oferta ? (possuida?.nivel ?? 0) + 1 : (possuida?.nivel ?? 1));
  const rar = $derived(RARIDADE_INFO[raridade]);
  const faccoes = $derived(def.dupla ? def.dupla.map((f) => FACTIONS[f]) : def.faccao ? [FACTIONS[def.faccao]] : []);
  const libera = $derived(oferta ? duplasQueCompleta(bencaos, id) : []);
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  class="carta"
  class:compacta
  class:dupla={!!def.dupla}
  style:--rar={rar.cor}
  role={onclick ? undefined : 'group'}
  {onclick}
  disabled={onclick ? disabled : undefined}
>
  <div class="topo">
    <span class="rar">{rar.nome}</span>
    {#if oferta}
      <span class="nivel" class:novo={!possuida}>{possuida ? `Nível ${nivel}` : 'Nova'}</span>
    {:else if nivel > 1}
      <span class="nivel">Nv {nivel}</span>
    {/if}
  </div>
  <strong class="nome">{def.nome}</strong>
  <div class="faccoes">
    {#each faccoes as f (f.id)}
      <span style:color={f.cor}>{f.icone} {f.nome}</span>
    {/each}
    {#if def.dupla}<span class="badge-dupla">Dupla</span>{/if}
  </div>
  <p class="desc">{descreverBencao(def, raridade, nivel)}</p>
  <div class="tags">
    {#each def.tags as t (t)}<span>{TAG_NOMES[t]}</span>{/each}
  </div>
  {#if libera.length}
    <p class="libera">✦ Libera dupla: {libera.map((d) => d.nome).join(', ')}</p>
  {/if}
  {#if rodape}{@render rodape()}{/if}
</svelte:element>

<style>
  .carta {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    text-align: left;
    padding: 1rem;
    border: 2px solid var(--rar);
    border-radius: var(--raio);
    background:
      radial-gradient(ellipse at top, color-mix(in srgb, var(--rar) 14%, transparent), transparent 70%),
      linear-gradient(180deg, var(--painel-2), var(--painel));
    box-shadow: 0 0 14px color-mix(in srgb, var(--rar) 25%, transparent), var(--sombra);
    font: inherit;
    color: inherit;
  }
  button.carta {
    cursor: pointer;
    transition: transform 0.12s;
  }
  button.carta:hover:not(:disabled) {
    transform: translateY(-3px);
    border-color: var(--rar);
    background:
      radial-gradient(ellipse at top, color-mix(in srgb, var(--rar) 22%, transparent), transparent 70%),
      linear-gradient(180deg, var(--painel-2), var(--painel));
  }
  .carta.dupla {
    border-style: double;
    border-width: 4px;
  }
  .compacta {
    padding: 0.6rem 0.7rem;
    gap: 0.25rem;
    font-size: 0.85rem;
    box-shadow: none;
  }
  .topo {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .rar {
    color: var(--rar);
    font-weight: 700;
  }
  .nivel {
    color: var(--ouro);
  }
  .nivel.novo {
    color: var(--gelo);
  }
  .nome {
    font-size: 1.15rem;
    color: var(--rar);
  }
  .compacta .nome {
    font-size: 0.95rem;
  }
  .faccoes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .badge-dupla {
    color: var(--r-epica);
    border: 1px solid var(--r-epica);
    border-radius: 999px;
    padding: 0 0.4rem;
  }
  .desc {
    margin: 0;
    line-height: 1.35;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: auto;
  }
  .tags span {
    font-size: 0.7rem;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    border: 1px solid #3a5072;
    background: #1a2a44;
    color: var(--texto-2);
  }
  .libera {
    margin: 0;
    font-size: 0.8rem;
    color: var(--r-epica);
    font-weight: 600;
  }
</style>
