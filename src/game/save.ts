/**
 * Save: formato versionado, migração e exportação/importação em Base64.
 * Puro (sem localStorage): a ponte da interface decide onde guardar a string.
 *
 * Regras:
 * - `SaveData.versao` versiona o envelope; cada migração leva da versão N para N+1.
 * - A meta é completada com valores padrão (campos novos ganham default, nada se perde).
 * - Uma corrida salva com `RunState.versao` diferente da atual é descartada (a meta fica),
 *   porque o formato interno da corrida muda entre fases e não vale a pena migrá-lo.
 */

import { novoMeta, META_VERSAO, type MetaState } from './meta';
import { RUN_VERSAO, type RunState } from './run';

export const SAVE_VERSAO = 1;
export const SAVE_CHAVE = 'nortundria.save';

export interface SaveData {
  versao: number;
  meta: MetaState;
  corrida: RunState | null;
  salvoEm: string;
}

export function novoSave(): SaveData {
  return { versao: SAVE_VERSAO, meta: novoMeta(), corrida: null, salvoEm: new Date(0).toISOString() };
}

type Bruto = Record<string, unknown>;

/** Migrações do envelope: índice = versão de origem. */
const MIGRACOES: Record<number, (s: Bruto) => Bruto> = {
  /** v0 (protótipo): meta e corrida soltas no topo. */
  0: (s) => ({ versao: 1, meta: s.meta ?? s, corrida: s.corrida ?? null, salvoEm: s.salvoEm ?? new Date(0).toISOString() }),
};

function ehObjeto(x: unknown): x is Bruto {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function completarMeta(bruto: unknown): MetaState {
  const base = novoMeta();
  if (!ehObjeto(bruto)) return base;
  const m = { ...base, ...bruto } as MetaState;
  m.estatisticas = { ...base.estatisticas, ...(ehObjeto(bruto.estatisticas) ? bruto.estatisticas : {}) };
  for (const cls of base.classesDesbloqueadas) if (!m.classesDesbloqueadas.includes(cls)) m.classesDesbloqueadas.push(cls);
  m.versao = META_VERSAO;
  return m;
}

/** Converte qualquer save conhecido para o formato atual. Lança erro se não for um save. */
export function migrar(bruto: unknown): SaveData {
  if (!ehObjeto(bruto)) throw new Error('Save inválido');
  let s: Bruto = bruto;
  let v = typeof s.versao === 'number' ? s.versao : 0;
  if (v > SAVE_VERSAO) throw new Error(`Save de uma versão mais nova (${v})`);
  while (v < SAVE_VERSAO) {
    const m = MIGRACOES[v];
    if (!m) throw new Error(`Sem migração da versão ${v}`);
    s = m(s);
    v++;
  }
  const corrida = ehObjeto(s.corrida) && s.corrida.versao === RUN_VERSAO ? (s.corrida as unknown as RunState) : null;
  return {
    versao: SAVE_VERSAO,
    meta: completarMeta(s.meta),
    corrida,
    salvoEm: typeof s.salvoEm === 'string' ? s.salvoEm : new Date(0).toISOString(),
  };
}

export function serializar(save: SaveData): string {
  return JSON.stringify(save);
}

export function desserializar(texto: string): SaveData {
  return migrar(JSON.parse(texto));
}

/** Base64 seguro para UTF-8 (nomes com acento). */
export function paraBase64(save: SaveData): string {
  const bytes = new TextEncoder().encode(serializar(save));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function deBase64(texto: string): SaveData {
  const bin = atob(texto.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return desserializar(new TextDecoder().decode(bytes));
}
