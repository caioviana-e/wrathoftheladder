<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { BattleHandle } from '../../battle';
  import { NODE_INFO } from '../../game/data/nodes';
  import { noAtual } from '../../game/run';
  import Barra from '../components/Barra.svelte';
  import { game, type CombatantView, type Velocidade } from '../game.svelte';

  let canvasEl: HTMLDivElement | undefined = $state();
  let logEl: HTMLDivElement | undefined = $state();
  let batalha: BattleHandle | null = null;
  let carregando = $state(true);

  const view = $derived(game.combate);
  const heroi = $derived(view?.combatentes.find((c) => c.side === 'heroi') ?? null);
  const inimigos = $derived(view?.combatentes.filter((c) => c.side === 'inimigo') ?? []);
  const no = $derived(game.run ? noAtual(game.run) : null);

  const COR_RECURSO: Record<string, string> = {
    furia: 'var(--furia)',
    energia: 'var(--energia)',
    mana: 'var(--mana)',
    runas: 'var(--runas)',
  };

  onMount(() => {
    // A tela pode ser aberta após recarregar a corrida: (re)inicia o combate do nó atual.
    if (!game.combate) game.iniciarCombate();
    let cancelar: (() => void) | null = null;
    let vivo = true;
    import('../../battle').then(({ criarBatalha }) => {
      if (!vivo || !canvasEl) return;
      batalha = criarBatalha(canvasEl, game.setupBatalha(), (uid) => game.setupBatalha(uid)[0]);
      batalha.velocidade(game.velocidade);
      batalha.pausa(game.pausado);
      cancelar = game.ouvir((evs) => batalha?.eventos(evs));
      carregando = false;
    });
    return () => {
      vivo = false;
      cancelar?.();
      batalha?.destruir();
      batalha = null;
    };
  });

  $effect(() => {
    batalha?.velocidade(game.velocidade);
  });
  $effect(() => {
    batalha?.pausa(game.pausado);
  });
  $effect(() => {
    void game.log.length;
    tick().then(() => logEl?.scrollTo({ top: logEl.scrollHeight }));
  });

  function teclado(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (view?.terminado) game.concluirCombate();
      else game.alternarPausa();
    } else if (e.key === '1' || e.key === '2' || e.key === '3') game.setVelocidade(Number(e.key) as Velocidade);
  }

  const seg = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
</script>

<svelte:window onkeydown={teclado} />

{#snippet ficha(c: CombatantView)}
  <div class="ficha" class:morto={!c.vivo} style:--cor={c.cor}>
    <div class="nome">
      <span class="marca"></span>
      <strong>{c.nome}</strong>
      {#if c.tier && c.tier !== 'normal'}<em class="tier">{c.tier === 'elite' ? 'Elite' : c.tier === 'miniChefe' ? 'Mini-chefe' : 'Chefe'}</em>{/if}
    </div>
    <Barra valor={c.vida} max={c.vidaMax} cor="var(--vida)" fundo="var(--vida-bg)" rotulo="{c.vida} / {c.vidaMax}" altura="16px" />
    {#if c.recursoKind && c.recursoMax > 0}
      <Barra valor={c.recurso} max={c.recursoMax} cor={COR_RECURSO[c.recursoKind] ?? 'var(--mana)'} rotulo="{c.recursoNome} {c.recurso}" altura="15px" />
    {/if}
    {#if c.supremaNome}
      <div class="suprema" class:pronta={c.carga >= c.cargaMax * 0.95}>
        <Barra valor={c.carga} max={c.cargaMax} cor="linear-gradient(90deg, #b8952f, #ffd76a)" rotulo="Suprema: {c.supremaNome} {Math.floor((c.carga / c.cargaMax) * 100)}%" altura="15px" />
      </div>
    {/if}
    {#if c.statuses.length}
      <ul class="status">
        {#each c.statuses as s (s.id)}
          <li class={s.id} title="{s.nome}: {s.restante.toFixed(1)} s">{s.icone} {s.nome}{s.pilhas > 1 ? ` ×${s.pilhas}` : ''} <small>{Math.ceil(s.restante)}s</small></li>
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<section class="tela">
  <header class="topo">
    <h2>
      {#if no}{NODE_INFO[no.tipo].icone} {NODE_INFO[no.tipo].nome} · linha {no.linha + 1}{/if}
    </h2>
    <div class="controles" role="group" aria-label="Controles de combate">
      <span class="tempo">{seg(view?.t ?? 0)}</span>
      <button onclick={() => game.alternarPausa()} disabled={view?.terminado} aria-pressed={game.pausado}>{game.pausado ? '▶ Continuar' : '⏸ Pausar'}</button>
      {#each [1, 2, 3] as v (v)}
        <button class:ativo={game.velocidade === v} aria-pressed={game.velocidade === v} onclick={() => game.setVelocidade(v as Velocidade)}>{v}x</button>
      {/each}
      <button onclick={() => game.resolverAgora()} disabled={view?.terminado} title="Resolver o combate sem animação">⏭</button>
    </div>
  </header>

  <div class="palco">
    <div class="canvas" bind:this={canvasEl}></div>
    {#if carregando}<div class="sobre sutil">Carregando…</div>{/if}
    {#if game.pausado && !view?.terminado}<div class="sobre pausa">Pausado</div>{/if}
    {#if view?.terminado}
      <div class="sobre resultado" class:vitoria={view.vencedor === 'heroi'}>
        <strong>{view.vencedor === 'heroi' ? 'Vitória!' : 'Derrota'}</strong>
        <button class="primario" onclick={() => game.concluirCombate()}>Continuar</button>
      </div>
    {/if}
  </div>

  <div class="fichas">
    <div class="lado">{#if heroi}{@render ficha(heroi)}{/if}</div>
    <div class="lado inimigos">
      {#each inimigos as c (c.uid)}{@render ficha(c)}{/each}
    </div>
  </div>

  <div class="log painel" bind:this={logEl} aria-live="off">
    {#each game.log as l (l.id)}
      <p class={l.tipo}><span class="t">{seg(l.t / 1000)}</span> {l.texto}</p>
    {/each}
  </div>
</section>

<style>
  .tela {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .topo {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .topo h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--ouro);
  }
  .controles {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .controles button {
    padding: 0.4rem 0.7rem;
  }
  .controles button.ativo {
    border-color: var(--ouro);
    color: var(--ouro);
  }
  .tempo {
    font-variant-numeric: tabular-nums;
    color: var(--texto-2);
    margin-right: 0.3rem;
  }
  .palco {
    position: relative;
    border-radius: var(--raio);
    overflow: hidden;
    border: 1px solid var(--borda);
    background: #0d1830;
    aspect-ratio: 800 / 360;
  }
  .canvas,
  .canvas :global(canvas) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .sobre {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 0.75rem;
    text-align: center;
  }
  .pausa {
    background: rgba(5, 10, 20, 0.45);
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .resultado {
    background: rgba(5, 10, 20, 0.6);
  }
  .resultado strong {
    font-size: clamp(1.6rem, 6vw, 2.6rem);
    color: var(--perigo);
  }
  .resultado.vitoria strong {
    color: var(--ouro);
  }
  .fichas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 640px) {
    .fichas {
      grid-template-columns: 1fr;
    }
  }
  .lado {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ficha {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.6rem 0.75rem;
    border-radius: var(--raio);
    border: 1px solid var(--borda);
    border-left: 4px solid var(--cor);
    background: var(--painel);
  }
  .ficha.morto {
    opacity: 0.4;
  }
  .nome {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
  }
  .tier {
    font-style: normal;
    font-size: 0.7rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    border: 1px solid var(--perigo);
    color: var(--perigo);
  }
  .suprema.pronta {
    filter: drop-shadow(0 0 6px #ffd76a);
  }
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .status li {
    font-size: 0.72rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: #22324d;
    border: 1px solid #3a5072;
  }
  .status li small {
    color: var(--texto-2);
  }
  .status .queimadura {
    border-color: #ff8a3d;
  }
  .status .sangramento {
    border-color: #c43a3a;
  }
  .status .veneno {
    border-color: #7ee07e;
  }
  .status .doenca {
    border-color: #9a7ad8;
  }
  .status .lentidao,
  .status .congelamento {
    border-color: var(--gelo);
  }
  .status .escudo,
  .status .enfurecido {
    border-color: var(--ouro);
  }
  .log {
    height: 180px;
    overflow-y: auto;
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
    line-height: 1.35;
  }
  .log p {
    margin: 0;
  }
  .log .t {
    color: #5d7393;
    font-variant-numeric: tabular-nums;
  }
  .log .critico {
    color: #ffd76a;
  }
  .log .cura {
    color: #5fd38d;
  }
  .log .status {
    color: #b9a3e8;
  }
  .log .habilidade {
    color: var(--gelo);
  }
  .log .suprema,
  .log .fim {
    color: var(--ouro);
    font-weight: 700;
  }
  .log .morte {
    color: var(--perigo);
  }
  .log .mecanica {
    color: #ff8a5c;
    font-weight: 600;
  }
</style>
