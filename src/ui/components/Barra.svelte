<script lang="ts">
  interface Props {
    valor: number;
    max: number;
    cor: string;
    fundo?: string;
    rotulo?: string;
    altura?: string;
  }
  let { valor, max, cor, fundo = 'rgba(0,0,0,0.45)', rotulo, altura = '14px' }: Props = $props();
  const pct = $derived(max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0);
</script>

<div class="barra" style:height={altura} style:background={fundo} role="meter" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={max} aria-label={rotulo}>
  <div class="preenchido" style:width="{pct}%" style:background={cor}></div>
  {#if rotulo}<span>{rotulo}</span>{/if}
</div>

<style>
  .barra {
    position: relative;
    width: 100%;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .preenchido {
    height: 100%;
    transition: width 0.15s linear;
  }
  span {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 600;
    text-shadow: 0 1px 2px #000;
    white-space: nowrap;
  }
</style>
