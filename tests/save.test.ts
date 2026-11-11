import { describe, expect, it } from 'vitest';
import { POLITICA_GULOSA } from '../src/game/ai';
import { finalizarCorrida, novoMeta } from '../src/game/meta';
import { createRun, escolherNo, nosDisponiveis, prepararCombate, RUN_VERSAO } from '../src/game/run';
import { deBase64, desserializar, migrar, novoSave, paraBase64, SAVE_VERSAO, serializar } from '../src/game/save';
import { simularCorrida } from '../src/game/simulate';

describe('Save', () => {
  it('ida e volta preserva meta e corrida em andamento (retoma no mesmo nó e mesmo combate)', () => {
    const s = novoSave();
    s.meta.emblemas = 42;
    s.meta.arvore.vigor = 2;
    const run = createRun({ semente: 'salvar', classeId: 'guerreiro', specId: 'armas' });
    escolherNo(run, nosDisponiveis(run)[0]!.id);
    s.corrida = run;
    const volta = desserializar(serializar(s));
    expect(volta.meta.emblemas).toBe(42);
    expect(volta.meta.arvore.vigor).toBe(2);
    expect(volta.corrida).toEqual(run);
    expect(prepararCombate(volta.corrida!).run()).toEqual(prepararCombate(run).run());
  });

  it('Base64 funciona com acentos e rejeita lixo', () => {
    const s = novoSave();
    const run = simularCorrida({ semente: 'ação-ç', classeId: 'mago', specId: 'fogo' }, POLITICA_GULOSA);
    finalizarCorrida(s.meta, run);
    const b64 = paraBase64(s);
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(deBase64(b64)).toEqual(s);
    expect(() => deBase64('isto não é um save')).toThrow();
    expect(() => deBase64(btoa('[1,2,3]'))).toThrow();
  });

  it('migra save antigo (v0) e completa campos novos da meta com padrões', () => {
    const antigo = { emblemas: 7, arvore: { forca: 1 } };
    const s = migrar(antigo);
    expect(s.versao).toBe(SAVE_VERSAO);
    expect(s.meta.emblemas).toBe(7);
    expect(s.meta.arvore.forca).toBe(1);
    expect(s.meta.classesDesbloqueadas).toContain('guerreiro');
    expect(s.meta.estatisticas.corridas).toBe(0);
    expect(s.corrida).toBeNull();
  });

  it('save de versão mais nova é recusado', () => {
    expect(() => migrar({ versao: SAVE_VERSAO + 1, meta: novoMeta() })).toThrow();
  });

  it('corrida de formato antigo é descartada, mas a meta fica', () => {
    const s = novoSave();
    s.meta.emblemas = 3;
    const run = createRun({ semente: 'velha', classeId: 'mago', specId: 'fogo' });
    const bruto = JSON.parse(serializar({ ...s, corrida: { ...run, versao: RUN_VERSAO - 1 } }));
    const m = migrar(bruto);
    expect(m.corrida).toBeNull();
    expect(m.meta.emblemas).toBe(3);
  });
});
