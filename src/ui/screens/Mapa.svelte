<script lang="ts">
  import { tick } from 'svelte';
  import { getDungeon } from '../../game/data/dungeons';
  import { getEnemy } from '../../game/data/enemies';
  import { getEvent } from '../../game/data/events';
  import { NODE_INFO } from '../../game/data/nodes';
  import { findNode, type MapNode } from '../../game/map';
  import { noAtual, nosDisponiveis } from '../../game/run';
  import PainelHeroi from '../components/PainelHeroi.svelte';
  import { game } from '../game.svelte';

  const run = $derived(game.run!);
  const dungeon = $derived(getDungeon(run.dungeonId));
  const linhas = $derived(run.mapa.linhas);
  const L = $derived(linhas.length);

  const ALT_LINHA = 76;
  const MARGEM = 44;
  const altura = $derived((L - 1) * ALT_LINHA + MARGEM * 2);

  const xPct = (n: MapNode) => 8 + n.x * 84;
  const yPx = (n: MapNode) => MARGEM + (L - 1 - n.linha) * ALT_LINHA;

  const visitados = $derived(new Set(run.caminho));
  const disponiveis = $derived(new Set(nosDisponiveis(run).map((n) => n.id)));
  const atual = $derived(noAtual(run));

  /** Nós ainda alcançáveis a partir da posição atual. */
  const alcancaveis = $derived.by(() => {
    const set = new Set<string>();
    const pilha = atual ? [...atual.filhos] : (linhas[0] ?? []).map((n) => n.id);
    while (pilha.length) {
      const id = pilha.pop() as string;
      if (set.has(id)) continue;
      set.add(id);
      pilha.push(...(findNode(run.mapa, id)?.filhos ?? []));
    }
    return set;
  });

  const arestasPercorridas = $derived(new Set(run.caminho.slice(1).map((id, i) => `${run.caminho[i]}>${id}`)));

  /** Inimigos e eventos só aparecem com o mapa revelado (Brann), exceto mini-chefe e chefe. */
  function dica(n: MapNode): string {
    const info = NODE_INFO[n.tipo];
    const revela = run.mapaRevelado || n.tipo === 'miniChefe' || n.tipo === 'chefe';
    const inimigos = revela && n.inimigos.length ? `\nInimigos: ${n.inimigos.map((id) => getEnemy(id).nome).join(', ')}` : '';
    const evento = run.mapaRevelado && n.eventoId ? `\nEvento: ${getEvent(n.eventoId).nome}` : '';
    return `${info.nome}: ${info.descricao}${inimigos}${evento}`;
  }

  let mapaEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    void run.caminho.length;
    tick().then(() => mapaEl?.querySelector('.disponivel')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  });
</script>

<section class="tela">
  <header class="topo">
    <div>
      <h2>{dungeon.nome}{#if run.dificuldade === 'heroico'} <span class="heroico">Heroico</span>{/if}</h2>
      <p class="sutil">Escolha o próximo nó. Progresso: {(atual?.linha ?? -1) + 1} de {L} linhas.</p>
    </div>
    <button onclick={() => confirm('Abandonar a corrida? Conta como derrota (você ainda ganha os Emblemas do progresso).') && game.abandonar()}>Abandonar</button>
  </header>

  <div class="layout">
    <div class="mapa painel" bind:this={mapaEl}>
      <div class="area" style:height="{altura}px">
        <svg viewBox="0 0 100 {altura}" preserveAspectRatio="none" aria-hidden="true">
          {#each linhas as linha (linha[0]?.linha)}
            {#each linha as n (n.id)}
              {#each n.filhos as fid (fid)}
                {@const f = findNode(run.mapa, fid)}
                {#if f}
                  {@const feito = arestasPercorridas.has(`${n.id}>${f.id}`)}
                  {@const proxima = atual?.id === n.id && disponiveis.has(f.id)}
                  <line
                    x1={xPct(n)}
                    y1={yPx(n)}
                    x2={xPct(f)}
                    y2={yPx(f)}
                    class:feito
                    class:proxima
                    class:morta={!feito && !proxima && !(alcancaveis.has(f.id) && (alcancaveis.has(n.id) || n.id === atual?.id))}
                    vector-effect="non-scaling-stroke"
                  />
                {/if}
              {/each}
            {/each}
          {/each}
        </svg>
        {#each linhas.flat() as n (n.id)}
          {@const info = NODE_INFO[n.tipo]}
          <button
            class="no {n.tipo}"
            class:visitado={visitados.has(n.id)}
            class:atual={atual?.id === n.id}
            class:disponivel={disponiveis.has(n.id)}
            class:inalcancavel={!visitados.has(n.id) && !alcancaveis.has(n.id)}
            style:left="{xPct(n)}%"
            style:top="{yPx(n)}px"
            style:--cor={info.cor}
            disabled={!disponiveis.has(n.id)}
            title={dica(n)}
            aria-label={dica(n)}
            onclick={() => game.escolherNo(n.id)}
          >
            <span>{info.icone}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="lateral">
      <PainelHeroi {run} />
      <div class="painel legenda">
        <h4>Legenda</h4>
        <ul>
          {#each Object.entries(NODE_INFO) as [tipo, info] (tipo)}
            <li><span class="ic" style:--cor={info.cor}>{info.icone}</span> {info.nome}</li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
</section>

<style>
  .tela {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem;
  }
  .topo {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  .topo h2 {
    margin: 0;
    color: var(--ouro);
  }
  .heroico {
    font-size: 0.75rem;
    vertical-align: middle;
    padding: 0.1rem 0.5rem;
    border: 1px solid var(--perigo);
    border-radius: 999px;
    color: var(--perigo);
  }
  .topo p {
    margin: 0.2rem 0 0;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .lateral {
      order: -1;
    }
    .legenda {
      display: none;
    }
  }
  .mapa {
    padding: 0.5rem;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(143, 216, 255, 0.08), transparent 60%),
      linear-gradient(180deg, #0f1a2d, #0b1424);
  }
  .area {
    position: relative;
    width: 100%;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  line {
    stroke: #4a6286;
    stroke-width: 2;
    stroke-dasharray: 4 5;
  }
  line.morta {
    stroke: #26344b;
  }
  line.feito {
    stroke: var(--ouro);
    stroke-width: 3;
    stroke-dasharray: none;
  }
  line.proxima {
    stroke: var(--gelo);
    stroke-width: 2.5;
  }
  .no {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 46px;
    height: 46px;
    border-radius: 50%;
    padding: 0;
    display: grid;
    place-items: center;
    font-size: 1.3rem;
    background: radial-gradient(circle at 35% 30%, #2a3f62, #121d31);
    border: 2px solid color-mix(in srgb, var(--cor) 55%, #000);
  }
  .no.miniChefe,
  .no.chefe {
    width: 60px;
    height: 60px;
    font-size: 1.7rem;
  }
  .no.chefe::after,
  .no.miniChefe::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--cor) 60%, transparent);
    animation: aura 2.4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes aura {
    50% {
      transform: scale(1.12);
      opacity: 0.3;
    }
  }
  .no:disabled {
    opacity: 1;
    cursor: default;
  }
  .no.inalcancavel {
    opacity: 0.3;
    filter: grayscale(0.8);
  }
  .no.visitado {
    border-color: var(--ouro);
    filter: none;
    opacity: 0.85;
  }
  .no.atual {
    box-shadow: 0 0 0 3px var(--ouro), 0 0 16px var(--ouro);
    opacity: 1;
  }
  .no.disponivel {
    border-color: var(--cor);
    box-shadow: 0 0 14px color-mix(in srgb, var(--cor) 70%, transparent);
    animation: pulso 1.4s ease-in-out infinite;
  }
  .no.disponivel:hover {
    transform: translate(-50%, -50%) scale(1.12);
  }
  @keyframes pulso {
    50% {
      box-shadow: 0 0 22px var(--cor);
    }
  }
  .lateral {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .legenda h4 {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    color: var(--texto-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .legenda ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3rem;
    font-size: 0.85rem;
  }
  .ic {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    border: 1px solid var(--cor);
  }
</style>
