<script lang="ts">
  import { game } from '../../game.svelte';

  let exportado = $state('');
  let importar = $state('');
  let mensagem = $state<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  function exportar() {
    exportado = game.exportar();
    mensagem = null;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(exportado);
      mensagem = { tipo: 'ok', texto: 'Copiado para a área de transferência.' };
    } catch {
      mensagem = { tipo: 'erro', texto: 'Não foi possível copiar. Selecione o texto e copie manualmente.' };
    }
  }

  function aplicarImportacao() {
    if (!importar.trim()) return;
    if (!confirm('Importar substitui todo o progresso atual. Continuar?')) return;
    try {
      game.importar(importar);
      importar = '';
      mensagem = { tipo: 'ok', texto: 'Progresso importado.' };
    } catch (e) {
      mensagem = { tipo: 'erro', texto: `Save inválido: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  function apagar() {
    if (!confirm('Apagar TODO o progresso (Emblemas, árvore, relíquias, coleção)? Isso não pode ser desfeito.')) return;
    game.apagarProgresso();
    mensagem = { tipo: 'ok', texto: 'Progresso apagado.' };
  }
</script>

<div class="secoes">
  <section class="painel">
    <h3>Salvamento</h3>
    <p class="sutil">O jogo salva sozinho no navegador a cada ação. Uma corrida em andamento continua do mesmo nó ao reabrir.</p>
  </section>

  <section class="painel">
    <h3>Exportar</h3>
    <p class="sutil">Gera um código Base64 com todo o progresso (e a corrida atual).</p>
    <button onclick={exportar}>Gerar código</button>
    {#if exportado}
      <textarea readonly rows="4" onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()}>{exportado}</textarea>
      <button onclick={copiar}>Copiar</button>
    {/if}
  </section>

  <section class="painel">
    <h3>Importar</h3>
    <textarea rows="4" placeholder="Cole aqui o código exportado" bind:value={importar}></textarea>
    <button class="primario" disabled={!importar.trim()} onclick={aplicarImportacao}>Importar</button>
  </section>

  <section class="painel perigo">
    <h3>Apagar progresso</h3>
    <button onclick={apagar}>Apagar tudo</button>
  </section>

  {#if mensagem}
    <p class="msg" class:erro={mensagem.tipo === 'erro'} role="status">{mensagem.texto}</p>
  {/if}
</div>

<style>
  .secoes {
    display: grid;
    gap: 0.75rem;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
  p {
    margin: 0;
  }
  textarea {
    width: 100%;
    font: 0.8rem ui-monospace, monospace;
    color: var(--texto);
    background: var(--bg-2);
    border: 1px solid var(--borda);
    border-radius: 8px;
    padding: 0.5rem;
    word-break: break-all;
    resize: vertical;
  }
  .perigo {
    border-color: rgba(224, 83, 61, 0.5);
  }
  .perigo button {
    border-color: var(--perigo);
    color: var(--perigo);
  }
  .msg {
    color: var(--vida);
  }
  .msg.erro {
    color: var(--perigo);
  }
</style>
