import { describe, expect, it } from 'vitest';
import { POLITICA_GULOSA, valorDoNo } from '../src/game/ai';
import { createRun, nosDisponiveis } from '../src/game/run';
import { Rng } from '../src/game/rng';
import { formatarEvento } from '../src/ui/log';

const nome = (uid: string) => ({ heroi: 'Herói', a: 'Lobo' })[uid] ?? uid;

describe('Registro de combate', () => {
  it('formata dano, crítico e absorção em pt-BR', () => {
    const l = formatarEvento(
      { t: 1000, tipo: 'dano', de: 'heroi', para: 'a', valor: 12, absorvido: 3, critico: true, escola: 'fogo', origem: { tipo: 'ataque' } },
      nome,
    );
    expect(l?.tipo).toBe('critico');
    expect(l?.texto).toBe('Herói causa 12 de dano de fogo em Lobo (3 absorvido). CRÍTICO!');
  });

  it('formata tiques de status e fim por tempo', () => {
    expect(
      formatarEvento(
        { t: 0, tipo: 'dano', de: 'heroi', para: 'a', valor: 4, absorvido: 0, critico: false, escola: 'fisico', origem: { tipo: 'status', id: 'sangramento' } },
        nome,
      )?.texto,
    ).toBe('Lobo sofre 4 de sangramento.');
    expect(formatarEvento({ t: 0, tipo: 'fim', vencedor: 'inimigo', motivo: 'tempo' }, nome)?.texto).toContain('exaustão');
  });
});

describe('Perfil guloso no mapa', () => {
  it('evita elite com pouca vida e prefere fogueira', () => {
    expect(valorDoNo('elite', 0.3)).toBeLessThan(valorDoNo('fogueira', 0.3));
    expect(valorDoNo('elite', 0.9)).toBeGreaterThan(valorDoNo('fogueira', 0.9));
  });

  it('sempre escolhe um índice válido', () => {
    const run = createRun({ semente: 'g', classeId: 'mago', specId: 'fogo' });
    const ops = nosDisponiveis(run);
    const i = POLITICA_GULOSA.escolherNo(run, ops, Rng.from('x'));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(ops.length);
  });
});
