<script lang="ts">
  import { CLASSES } from '../../../game/data/classes';
  import { ACHIEVEMENTS, RELICS_BY_ID } from '../../../game/data/meta';
  import type { Dificuldade } from '../../../game/formulas';
  import { metaBonus } from '../../../game/meta';
  import type { ClassDef } from '../../../game/types';
  import { game } from '../../game.svelte';

  const classes = Object.values(CLASSES) as ClassDef[];
  const meta = $derived(game.meta);
  let classe = $state<ClassDef | null>(null);
  let specId = $state<string | null>(null);
  let dificuldade = $state<Dificuldade>('normal');
  let semente = $state('');

  const bloqueada = (c: ClassDef) => !meta.classesDesbloqueadas.includes(c.id);
  const requisito = (c: ClassDef) => ACHIEVEMENTS.find((a) => a.desbloqueia?.classe === c.id);
  const reliquia = $derived(meta.reliquiaEquipada ? RELICS_BY_ID[meta.reliquiaEquipada] : null);
  const bonus = $derived(metaBonus(meta));

  function escolherClasse(c: ClassDef) {
    if (bloqueada(c)) return;
    classe = c;
    specId = null;
  }

  function comecar() {
    if (classe && specId) game.novaCorrida({ classeId: classe.id, specId, dificuldade, semente });
  }
</script>

<ol class="passos">
  <li class:ativo={!classe}>1. Classe</li>
  <li class:ativo={!!classe && !specId}>2. Especialização</li>
  <li class:ativo={!!classe && !!specId}>3. Relíquia e dificuldade</li>
</ol>

<h2>Classe</h2>
<div class="grade">
  {#each classes as c (c.id)}
    {@const req = requisito(c)}
    <button class="cartao" class:selecionado={classe?.id === c.id} class:bloqueado={bloqueada(c)} style:--cor={c.cor} onclick={() => escolherClasse(c)} aria-disabled={bloqueada(c)}>
      <strong style:color={bloqueada(c) ? undefined : c.cor}>{bloqueada(c) ? '🔒 ' : ''}{c.nome}</strong>
      <span class="sutil">{c.descricao}</span>
      {#if bloqueada(c) && req}
        <small class="req">Conquista: {req.nome}: {req.descricao}</small>
      {:else}
        <small>Recurso: {c.recurso.nome} · Vida {c.base.vidaMax} · Dano {c.base.dano}</small>
      {/if}
    </button>
  {/each}
</div>

{#if classe}
  <h2>Especialização</h2>
  <div class="grade">
    {#each classe.specs as s (s.id)}
      <button class="cartao" class:selecionado={specId === s.id} style:--cor={classe.cor} onclick={() => (specId = s.id)}>
        <strong>{s.nome}</strong>
        <span class="sutil">{s.descricao}</span>
        <ul>
          {#each s.habilidades as h (h.id)}
            <li><b>{h.nome}</b>: {h.descricao}</li>
          {/each}
          <li class="suprema"><b>Suprema: {s.suprema.nome}</b>: {s.suprema.descricao}</li>
        </ul>
      </button>
    {/each}
  </div>
{/if}

{#if classe && specId}
  <h2>Preparação</h2>
  <div class="preparo painel">
    <div>
      <h3>Relíquia equipada</h3>
      {#if reliquia}
        <p>{reliquia.icone} <b>{reliquia.nome}</b>: {reliquia.descricao}</p>
      {:else}
        <p class="sutil">{meta.reliquias.length ? 'Nenhuma equipada (troque na aba Relíquias).' : 'Nenhuma relíquia conquistada ainda. Elites e chefes podem deixar relíquias.'}</p>
      {/if}
    </div>
    <div>
      <h3>Dificuldade</h3>
      <div class="dific" role="radiogroup" aria-label="Dificuldade">
        <button role="radio" aria-checked={dificuldade === 'normal'} class:ativo={dificuldade === 'normal'} onclick={() => (dificuldade = 'normal')}>Normal</button>
        <button
          role="radio"
          aria-checked={dificuldade === 'heroico'}
          class:ativo={dificuldade === 'heroico'}
          disabled={!meta.heroicoDesbloqueado}
          title={meta.heroicoDesbloqueado ? 'Inimigos mais fortes, ×1,5 Emblemas' : 'Vença a Fortaleza Utgarde no Normal para liberar'}
          onclick={() => (dificuldade = 'heroico')}>{meta.heroicoDesbloqueado ? '' : '🔒 '}Heroico</button
        >
      </div>
    </div>
    <div>
      <h3>Bônus permanentes</h3>
      <p class="sutil bonus">
        Vida +{Math.round(bonus.vidaPct * 100)}% · Dano +{Math.round(bonus.danoPct * 100)}% · Crítico +{Math.round(bonus.critChance * 100)}% · Armadura +{Math.round(bonus.armadura * 100)}%
        {#if bonus.relancamentos}· +{bonus.relancamentos} relanç.{/if}
        {#if bonus.pocoes}· {bonus.pocoes} poção{/if}
        {#if bonus.bencaoInicial}· bênção inicial{/if}
      </p>
    </div>
  </div>
{/if}

<div class="acoes">
  <label>
    Semente (opcional)
    <input bind:value={semente} placeholder="aleatória" maxlength="32" />
  </label>
  <button class="primario" disabled={!classe || !specId} onclick={comecar}>Começar corrida</button>
</div>

<style>
  h2 {
    margin-top: 1.25rem;
    font-size: 1.05rem;
    color: var(--gelo);
  }
  h3 {
    margin: 0 0 0.3rem;
    font-size: 0.8rem;
    color: var(--texto-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .passos {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 0.85rem;
  }
  .passos li {
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--borda);
    color: var(--texto-2);
  }
  .passos li.ativo {
    color: var(--ouro);
    border-color: var(--ouro);
  }
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: 0.75rem;
  }
  .cartao {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    text-align: left;
    padding: 1rem;
    border-radius: var(--raio);
    border: 1px solid var(--borda);
    background: linear-gradient(180deg, var(--painel-2), var(--painel));
  }
  .cartao.selecionado {
    border-color: var(--cor, var(--ouro));
    box-shadow: 0 0 0 1px var(--cor, var(--ouro)), 0 0 18px color-mix(in srgb, var(--cor, var(--ouro)) 35%, transparent);
  }
  .cartao.bloqueado {
    opacity: 0.55;
    border-style: dashed;
    cursor: not-allowed;
  }
  .cartao ul {
    margin: 0.25rem 0 0;
    padding-left: 1rem;
    font-size: 0.85rem;
  }
  .suprema {
    color: var(--ouro);
  }
  small {
    color: var(--texto-2);
  }
  .req {
    color: var(--ouro);
  }
  .preparo {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: 1rem;
  }
  .preparo p {
    margin: 0;
    font-size: 0.9rem;
  }
  .dific {
    display: flex;
    gap: 0.4rem;
  }
  .dific button.ativo {
    border-color: var(--ouro);
    color: var(--ouro);
  }
  .bonus {
    line-height: 1.5;
  }
  .acoes {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--texto-2);
  }
  input {
    font: inherit;
    color: var(--texto);
    background: var(--bg-2);
    border: 1px solid var(--borda);
    border-radius: 8px;
    padding: 0.5rem 0.7rem;
    width: min(240px, 100%);
  }
  .acoes .primario {
    padding: 0.8rem 1.6rem;
    font-size: 1.05rem;
  }
</style>
