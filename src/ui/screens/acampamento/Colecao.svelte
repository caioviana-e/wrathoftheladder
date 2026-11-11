<script lang="ts">
  import { descreverBencao } from '../../../game/blessings';
  import { ALL_BLESSINGS } from '../../../game/data/blessings';
  import { CLASSES } from '../../../game/data/classes';
  import { ENEMIES } from '../../../game/data/enemies';
  import { FACTIONS } from '../../../game/data/factions';
  import { ACHIEVEMENTS } from '../../../game/data/meta';
  import type { FactionId } from '../../../game/types';
  import { game } from '../../game.svelte';

  type Sub = 'bestiario' | 'bencaos' | 'conquistas' | 'historico';
  let sub = $state<Sub>('bestiario');
  const meta = $derived(game.meta);
  const inimigos = Object.values(ENEMIES);
  const TIER: Record<string, string> = { normal: 'Comum', elite: 'Elite', miniChefe: 'Mini-chefe', chefe: 'Chefe' };
  const grupos = $derived.by(() => {
    const m = new Map<FactionId | 'dupla', typeof ALL_BLESSINGS>();
    for (const b of ALL_BLESSINGS) {
      const k = b.faccao ?? 'dupla';
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return [...m.entries()];
  });
  const vistos = $derived(inimigos.filter((e) => (meta.bestiario[e.id] ?? 0) > 0).length);
</script>

<div class="subabas">
  <button class:ativa={sub === 'bestiario'} onclick={() => (sub = 'bestiario')}>Bestiário {vistos}/{inimigos.length}</button>
  <button class:ativa={sub === 'bencaos'} onclick={() => (sub = 'bencaos')}>Bênçãos {meta.bencaosObtidas.length}/{ALL_BLESSINGS.length}</button>
  <button class:ativa={sub === 'conquistas'} onclick={() => (sub = 'conquistas')}>Conquistas {meta.conquistas.length}/{ACHIEVEMENTS.length}</button>
  <button class:ativa={sub === 'historico'} onclick={() => (sub = 'historico')}>Histórico</button>
</div>

{#if sub === 'bestiario'}
  <div class="grade">
    {#each inimigos as e (e.id)}
      {@const n = meta.bestiario[e.id] ?? 0}
      <div class="item painel" class:desconhecido={n === 0}>
        <span class="forma" style:background={n ? e.cor : '#2a3a55'}></span>
        <div>
          <strong>{n ? e.nome : '???'}</strong>
          <small class="sutil">{TIER[e.tier]}{n ? ` · ${n} derrotado${n > 1 ? 's' : ''}` : ''}</small>
          {#if n}<p>{e.descricao}</p>{/if}
          {#if n && e.mecanicas?.length}<p class="mec">{e.mecanicas.map((m) => m.nome).join(' · ')}</p>{/if}
        </div>
      </div>
    {/each}
  </div>
{:else if sub === 'bencaos'}
  <p class="sutil">Bênçãos obtidas aparecem completas; as que você só viu em ofertas aparecem em cinza.</p>
  {#each grupos as [f, lista] (f)}
    {@const fac = f === 'dupla' ? null : FACTIONS[f]}
    <h3 style:color={fac?.cor ?? 'var(--r-epica)'}>{fac ? `${fac.icone} ${fac.nome}` : '✦ Bênçãos duplas'}</h3>
    <div class="grade">
      {#each lista as b (b.id)}
        {@const obtida = meta.bencaosObtidas.includes(b.id)}
        {@const vista = obtida || meta.bencaosVistas.includes(b.id)}
        <div class="item painel" class:desconhecido={!vista} class:vista={vista && !obtida}>
          <div>
            <strong>{vista ? b.nome : '???'}</strong>
            {#if vista}<p>{descreverBencao(b, b.raridadeFixa ?? 'comum', 1)}</p>{/if}
            {#if b.dupla}<small class="sutil">{b.dupla.map((x) => FACTIONS[x].nome).join(' + ')}</small>{/if}
          </div>
        </div>
      {/each}
    </div>
  {/each}
{:else if sub === 'conquistas'}
  <ul class="conquistas">
    {#each ACHIEVEMENTS as a (a.id)}
      {@const feita = meta.conquistas.includes(a.id)}
      <li class:feita>
        <span>{feita ? '✔' : '○'}</span>
        <div>
          <strong>{a.nome}</strong>
          <small class="sutil">{a.descricao}</small>
          {#if a.desbloqueia?.classe}<small class="ouro">Libera: {CLASSES[a.desbloqueia.classe]?.nome}</small>{/if}
          {#if a.desbloqueia?.heroico}<small class="ouro">Libera: dificuldade Heroico</small>{/if}
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <dl class="estat">
    <dt>Corridas</dt><dd>{meta.estatisticas.corridas}</dd>
    <dt>Vitórias</dt><dd>{meta.estatisticas.vitorias}</dd>
    <dt>Vitórias no Heroico</dt><dd>{meta.estatisticas.vitoriasHeroico}</dd>
    <dt>Melhor linha</dt><dd>{meta.estatisticas.melhorLinha}</dd>
    <dt>Emblemas ganhos</dt><dd>{meta.emblemasTotais}</dd>
  </dl>
  {#if meta.historico.length}
    <table>
      <thead><tr><th>Classe</th><th>Dificuldade</th><th>Resultado</th><th>Linha</th><th>Emblemas</th></tr></thead>
      <tbody>
        {#each meta.historico as h, i (i)}
          {@const c = CLASSES[h.classeId]}
          <tr>
            <td style:color={c?.cor}>{c?.nome} · {c?.specs.find((s) => s.id === h.specId)?.nome}</td>
            <td>{h.dificuldade === 'heroico' ? 'Heroico' : 'Normal'}</td>
            <td class:vit={h.resultado === 'vitoria'}>{h.resultado === 'vitoria' ? 'Vitória' : 'Derrota'}</td>
            <td>{h.linha}</td>
            <td class="ouro">{h.emblemas}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="sutil">Nenhuma corrida ainda.</p>
  {/if}
{/if}

<style>
  .subabas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .subabas button {
    padding: 0.35rem 0.8rem;
    font-size: 0.88rem;
  }
  .subabas button.ativa {
    border-color: var(--ouro);
    color: var(--ouro);
  }
  h3 {
    margin: 1rem 0 0.5rem;
    font-size: 0.95rem;
  }
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
    gap: 0.6rem;
  }
  .item {
    display: flex;
    gap: 0.6rem;
    padding: 0.7rem;
    box-shadow: none;
  }
  .item strong {
    display: block;
  }
  .item small {
    display: block;
  }
  .item p {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
  }
  .item .mec {
    color: #ff8a5c;
  }
  .desconhecido {
    opacity: 0.45;
    border-style: dashed;
  }
  .vista {
    opacity: 0.7;
    filter: grayscale(0.6);
  }
  .forma {
    flex: none;
    width: 28px;
    height: 28px;
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }
  .conquistas {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  .conquistas li {
    display: flex;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--borda);
    border-radius: 8px;
    opacity: 0.65;
  }
  .conquistas li.feita {
    opacity: 1;
    border-color: var(--ouro-2);
  }
  .conquistas small {
    display: block;
  }
  .estat {
    display: grid;
    grid-template-columns: auto auto;
    gap: 0.2rem 1.5rem;
    width: fit-content;
    margin: 0 0 1rem;
  }
  dt {
    color: var(--texto-2);
  }
  dd {
    margin: 0;
    text-align: right;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 0.4rem;
    border-bottom: 1px solid var(--borda);
  }
  th {
    color: var(--texto-2);
    font-weight: 500;
  }
  .vit {
    color: var(--ouro);
  }
  @media (max-width: 520px) {
    table th:nth-child(2),
    table td:nth-child(2) {
      display: none;
    }
  }
</style>
