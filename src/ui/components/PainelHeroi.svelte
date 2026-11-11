<script lang="ts">
  import { contarTags, descreverBencao } from '../../game/blessings';
  import { getBlessing } from '../../game/data/blessings';
  import { getClass } from '../../game/data/classes';
  import { FACTIONS, TAG_NOMES } from '../../game/data/factions';
  import { CONSUMABLES_BY_ID, CURSED_BY_ID } from '../../game/data/items';
  import { RARIDADE_INFO } from '../../game/data/rarities';
  import { MAX_CONSUMIVEIS } from '../../game/formulas';
  import { getSpec, podeUsarConsumivel, statsDoHeroi, type RunState } from '../../game/run';
  import type { FactionId } from '../../game/types';
  import { game } from '../game.svelte';
  import Barra from './Barra.svelte';

  let { run }: { run: RunState } = $props();

  const cls = $derived(getClass(run.classeId));
  const spec = $derived(getSpec(cls, run.specId));
  const s = $derived(statsDoHeroi(run));
  const tags = $derived(contarTags(run.heroi.bencaos));
  const grupos = $derived.by(() => {
    const m = new Map<FactionId | 'dupla', typeof run.heroi.bencaos>();
    for (const b of run.heroi.bencaos) {
      const k = getBlessing(b.id).faccao ?? 'dupla';
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return [...m.entries()];
  });
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  // No celular os detalhes começam recolhidos para o mapa caber na tela.
  const largo = typeof matchMedia === 'function' ? matchMedia('(min-width: 761px)').matches : true;
</script>

<aside class="painel">
  <h3 style:color={cls.cor}>{cls.nome} · {spec.nome}</h3>
  <Barra valor={run.heroi.vida} max={s.vidaMax} cor="var(--vida)" rotulo="{run.heroi.vida} / {s.vidaMax}" altura="18px" />
  <p class="linha">
    <span class="ouro">● {run.ouro}</span> ouro
    <span class="sep">·</span>
    <span title="Relançamentos de oferta">⟳ {run.relancamentos}</span>
  </p>

  <section>
    <h4>Consumíveis <small>{run.heroi.consumiveis.length}/{MAX_CONSUMIVEIS}</small></h4>
    {#if run.heroi.consumiveis.length === 0}
      <p class="sutil vazio">Nenhum.</p>
    {:else}
      <ul class="consumiveis">
        {#each run.heroi.consumiveis as id, i (i)}
          {@const c = CONSUMABLES_BY_ID[id]}
          <li>
            <button
              class="consumivel"
              disabled={!podeUsarConsumivel(run, i)}
              title="{c?.nome}: {c?.descricao}{run.etapa !== 'mapa' ? ' (use no mapa)' : ''}"
              onclick={() => game.usarConsumivel(i)}>{c?.icone} <span>{c?.nome}</span></button
            >
          </li>
        {/each}
      </ul>
    {/if}
    {#if run.heroi.buffs.length}
      <p class="buffs">Ativo no próximo combate: {run.heroi.buffs.map((b) => CONSUMABLES_BY_ID[b]?.nome).join(', ')}</p>
    {/if}
  </section>

  <details open={largo}>
    <summary>Build, atributos e itens</summary>

    {#if tags.length}
      <h4>Sinergias</h4>
      <ul class="tags">
        {#each tags as [t, n] (t)}<li>{TAG_NOMES[t]} <b>{n}</b></li>{/each}
      </ul>
    {/if}

    <h4>Bênçãos <small>{run.heroi.bencaos.length}</small></h4>
    {#if grupos.length === 0}
      <p class="sutil vazio">Nenhuma ainda.</p>
    {/if}
    {#each grupos as [faccao, lista] (faccao)}
      {@const f = faccao === 'dupla' ? null : FACTIONS[faccao]}
      <div class="grupo">
        <span class="faccao" style:color={f?.cor ?? 'var(--r-epica)'}>{f ? `${f.icone} ${f.nome}` : '✦ Duplas'}</span>
        <ul>
          {#each lista as b (b.id)}
            <li title={descreverBencao(getBlessing(b.id), b.raridade, b.nivel)} style:color={RARIDADE_INFO[b.raridade].cor}>
              {getBlessing(b.id).nome}{b.nivel > 1 ? ` ${'I'.repeat(Math.min(b.nivel, 3))}${b.nivel > 3 ? `+${b.nivel - 3}` : ''}` : ''}
            </li>
          {/each}
        </ul>
      </div>
    {/each}

    {#if run.heroi.itens.length}
      <h4>Itens de Saronita</h4>
      <ul class="itens">
        {#each run.heroi.itens as it (it.id)}
          {@const d = CURSED_BY_ID[it.id]}
          <li>
            <b>{d?.nome}</b>: {d?.bonusTexto}
            {#if it.purificado}<span class="purificado">(purificado)</span>{:else}<span class="maldicao">{d?.maldicaoTexto}</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h4>Atributos</h4>
    <dl>
      <dt>Dano</dt><dd>{s.dano.toFixed(1)}</dd>
      <dt>Ataques/s</dt><dd>{s.aps.toFixed(2)}</dd>
      <dt>Crítico</dt><dd>{pct(s.critChance)}</dd>
      <dt>Dano crítico</dt><dd>{pct(s.critDano)}</dd>
      <dt>Armadura</dt><dd>{pct(s.armadura)}</dd>
      <dt>{cls.recurso.nome}</dt><dd>{Math.round(s.recursoMax)}</dd>
    </dl>
  </details>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
  }
  h4 {
    margin: 0.6rem 0 0.25rem;
    font-size: 0.78rem;
    color: var(--texto-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  h4 small {
    font-weight: 400;
  }
  .linha {
    margin: 0;
  }
  .sep {
    color: var(--texto-2);
    margin: 0 0.3rem;
  }
  .vazio {
    margin: 0;
    font-size: 0.85rem;
  }
  summary {
    cursor: pointer;
    color: var(--texto-2);
    font-size: 0.85rem;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .consumiveis {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .consumivel {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }
  .buffs {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--gelo);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .tags li {
    font-size: 0.75rem;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    border: 1px solid #3a5072;
    background: #1a2a44;
  }
  .tags b {
    color: var(--ouro);
  }
  .grupo {
    margin-bottom: 0.35rem;
    font-size: 0.85rem;
  }
  .faccao {
    font-weight: 600;
    font-size: 0.8rem;
  }
  .grupo ul {
    padding-left: 0.9rem;
  }
  .grupo li {
    cursor: help;
  }
  .itens li {
    font-size: 0.82rem;
    margin-bottom: 0.25rem;
  }
  .maldicao {
    color: var(--perigo);
    display: block;
  }
  .purificado {
    color: var(--vida);
  }
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.15rem 1rem;
    margin: 0;
    font-size: 0.88rem;
  }
  dt {
    color: var(--texto-2);
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
