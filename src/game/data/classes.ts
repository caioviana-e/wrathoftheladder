/**
 * Classes e especializações (dados declarativos).
 * MVP: 4 classes com 2 especializações cada. As outras 6 classes do WotLK entram só como dados.
 */

import type { ClassDef, ClassId, Modifier, ResourceDef, StatKey } from '../types';

export const RECURSOS = {
  furia: {
    kind: 'furia',
    nome: 'Fúria',
    max: 100,
    inicioFracao: 0,
    regen: 0,
    ganhoAoBater: 12,
    ganhoAoApanhar: 80,
  },
  energia: {
    kind: 'energia',
    nome: 'Energia',
    max: 100,
    inicioFracao: 1,
    regen: 12,
  },
  mana: {
    kind: 'mana',
    nome: 'Mana',
    max: 300,
    inicioFracao: 1,
    regen: 5,
  },
  /** Prevista para o Cavaleiro da Morte (mecânica própria virá depois). */
  runas: {
    kind: 'runas',
    nome: 'Runas',
    max: 6,
    inicioFracao: 1,
    regen: 0.6,
  },
} as const satisfies Record<string, ResourceDef>;

const mod = (stat: StatKey, op: Modifier['op'], value: number): Modifier => ({ stat, op, value, source: 'especializacao' });

// ---------------------------------------------------------------------------
// Guerreiro
// ---------------------------------------------------------------------------

export const GUERREIRO: ClassDef = {
  id: 'guerreiro',
  nome: 'Guerreiro',
  cor: '#C79C6E',
  descricao: 'Combatente corpo a corpo resistente. A Fúria sobe ao bater e ao apanhar.',
  recurso: RECURSOS.furia,
  ataqueEscola: 'fisico',
  base: { vidaMax: 170, recursoMax: RECURSOS.furia.max, dano: 12, aps: 0.8, critChance: 0.05, critDano: 1.5, armadura: 0.15 },
  specs: [
    {
      id: 'armas',
      nome: 'Armas',
      descricao: 'Golpes pesados, sangramentos e execuções.',
      faccoesFavoritas: ['laminaDeEbano', 'cruzadaArgentea'],
      habilidades: [
        {
          id: 'executar',
          nome: 'Executar',
          descricao: 'Golpe brutal em alvos com menos de 20% de vida.',
          custo: 25,
          recarga: 0,
          prioridade: 1,
          condicao: { alvoVidaAbaixo: 0.2 },
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 3 }, escola: 'fisico' }],
        },
        {
          id: 'golpeMortal',
          nome: 'Golpe Mortal',
          descricao: 'Golpe poderoso que causa 260% do dano.',
          custo: 30,
          recarga: 6,
          prioridade: 2,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.6 }, escola: 'fisico' }],
        },
        {
          id: 'dilacerar',
          nome: 'Dilacerar',
          descricao: 'Aplica Sangramento (30% do dano por segundo, 9 s).',
          custo: 10,
          recarga: 3,
          prioridade: 3,
          condicao: { alvoSemStatus: 'sangramento' },
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'sangramento', duracao: 9, valor: { dano: 0.3 } }],
        },
      ],
      suprema: {
        id: 'tempestadeDeLaminas',
        nome: 'Tempestade de Lâminas',
        descricao: 'Gira com a arma e atinge todos os inimigos com 250% do dano.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 4,
        cargaPorDanoRecebido: 60,
        efeitos: [{ tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 2.5 }, escola: 'fisico' }],
      },
    },
    {
      id: 'protecao',
      nome: 'Proteção',
      descricao: 'Escudo erguido: muita vida e armadura, menos dano.',
      faccoesFavoritas: ['cruzadaArgentea', 'filhosDeHodir'],
      modificadores: [mod('vidaMax', 'mult', 0.05), mod('armadura', 'add', 0.03), mod('dano', 'mult', -0.24)],
      habilidades: [
        {
          id: 'golpeDeEscudo',
          nome: 'Golpe de Escudo',
          descricao: 'Causa 160% do dano e ganha um escudo de 5% da vida máxima.',
          custo: 20,
          recarga: 8,
          prioridade: 1,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: 1.6 }, escola: 'fisico' },
            { tipo: 'escudo', alvo: 'self', valor: { vidaMax: 0.05 }, duracao: 8 },
          ],
        },
        {
          id: 'revanche',
          nome: 'Revanche',
          descricao: 'Contra-ataque rápido: 130% do dano.',
          custo: 5,
          recarga: 4,
          prioridade: 2,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 1.3 }, escola: 'fisico' }],
        },
        {
          id: 'trovoada',
          nome: 'Trovoada',
          descricao: 'Atinge todos com 70% do dano e aplica Lentidão de 15% por 5 s.',
          custo: 15,
          recarga: 10,
          prioridade: 3,
          efeitos: [
            { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 0.7 }, escola: 'fisico' },
            { tipo: 'status', alvo: 'todosInimigos', status: 'lentidao', duracao: 5, valor: { base: 0.15 } },
          ],
        },
      ],
      suprema: {
        id: 'muralhaDeEscudos',
        nome: 'Muralha de Escudos',
        descricao: 'Escudo de 20% da vida máxima e 150% do dano em todos os inimigos.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 2,
        cargaPorDanoRecebido: 40,
        efeitos: [
          { tipo: 'escudo', alvo: 'self', valor: { vidaMax: 0.2 }, duracao: 10 },
          { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 1.5 }, escola: 'fisico' },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mago
// ---------------------------------------------------------------------------

export const MAGO: ClassDef = {
  id: 'mago',
  nome: 'Mago',
  cor: '#69CCF0',
  descricao: 'Conjurador frágil de dano alto. Mana alta que regenera devagar.',
  recurso: RECURSOS.mana,
  ataqueEscola: 'fogo',
  base: { vidaMax: 135, recursoMax: RECURSOS.mana.max, dano: 12, aps: 0.7, critChance: 0.08, critDano: 1.5, armadura: 0.08 },
  specs: [
    {
      id: 'fogo',
      nome: 'Fogo',
      descricao: 'Explosões, queimaduras e críticos.',
      faccoesFavoritas: ['kirinTor', 'aliancaCinerea'],
      modificadores: [mod('vidaMax', 'mult', 0.08)],
      habilidades: [
        {
          id: 'ignicao',
          nome: 'Ignição Pirolítica',
          descricao: 'Grande bola de fogo: 340% do dano e Queimadura (40% do dano por segundo, 6 s).',
          custo: 80,
          recarga: 12,
          prioridade: 1,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: 3.4 }, escola: 'fogo' },
            { tipo: 'status', alvo: 'alvo', status: 'queimadura', duracao: 6, valor: { dano: 0.4 } },
          ],
        },
        {
          id: 'brasaViva',
          nome: 'Brasa Viva',
          descricao: 'Aplica Queimadura (50% do dano por segundo, 8 s) em alvos sem queimadura.',
          custo: 25,
          recarga: 0,
          prioridade: 2,
          condicao: { alvoSemStatus: 'queimadura' },
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'queimadura', duracao: 8, valor: { dano: 0.5 } }],
        },
        {
          id: 'impactoFlamejante',
          nome: 'Impacto Flamejante',
          descricao: 'Rajada instantânea: 220% do dano.',
          custo: 35,
          recarga: 6,
          prioridade: 3,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.2 }, escola: 'fogo' }],
        },
      ],
      suprema: {
        id: 'chuvaDeChamas',
        nome: 'Chuva de Chamas',
        descricao: 'Atinge todos os inimigos com 220% do dano e os incendeia.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 5,
        cargaPorDanoRecebido: 40,
        efeitos: [
          { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 2.2 }, escola: 'fogo' },
          { tipo: 'status', alvo: 'todosInimigos', status: 'queimadura', duracao: 6, valor: { dano: 0.35 } },
        ],
      },
    },
    {
      id: 'gelo',
      nome: 'Gelo',
      descricao: 'Controle: lentidão, congelamento e golpes em alvos congelados.',
      faccoesFavoritas: ['filhosDeHodir', 'kirinTor'],
      ataqueEscola: 'gelo',
      modificadores: [mod('dano', 'mult', -0.16)],
      habilidades: [
        {
          id: 'lancaGelida',
          nome: 'Lança Gélida',
          descricao: 'Em alvos congelados: 240% do dano como gelo.',
          custo: 30,
          recarga: 0,
          prioridade: 1,
          condicao: { alvoComStatus: 'congelamento' },
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.4 }, escola: 'gelo' }],
        },
        {
          id: 'novaCongelante',
          nome: 'Nova Congelante',
          descricao: 'Congela todos os inimigos por 2,5 s e causa 60% do dano.',
          custo: 60,
          recarga: 18,
          prioridade: 2,
          efeitos: [
            { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 0.6 }, escola: 'gelo' },
            { tipo: 'status', alvo: 'todosInimigos', status: 'congelamento', duracao: 2.5, valor: {} },
          ],
        },
        {
          id: 'setaDeGelo',
          nome: 'Seta de Gelo',
          descricao: '160% do dano como gelo e Lentidão de 15% por 4 s.',
          custo: 25,
          recarga: 2.5,
          prioridade: 3,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: 1.6 }, escola: 'gelo' },
            { tipo: 'status', alvo: 'alvo', status: 'lentidao', duracao: 4, valor: { base: 0.15 } },
          ],
        },
      ],
      suprema: {
        id: 'nevascaGlacial',
        nome: 'Nevasca Glacial',
        descricao: '160% do dano como gelo em todos os inimigos e os congela por 1,5 s.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 5,
        cargaPorDanoRecebido: 40,
        efeitos: [
          { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 1.6 }, escola: 'gelo' },
          { tipo: 'status', alvo: 'todosInimigos', status: 'congelamento', duracao: 1.5, valor: {} },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Ladino
// ---------------------------------------------------------------------------

export const LADINO: ClassDef = {
  id: 'ladino',
  nome: 'Ladino',
  cor: '#FFF569',
  descricao: 'Golpes rápidos e críticos. Energia baixa que regenera rápido.',
  recurso: RECURSOS.energia,
  ataqueEscola: 'fisico',
  base: { vidaMax: 150, recursoMax: RECURSOS.energia.max, dano: 8, aps: 1.15, critChance: 0.1, critDano: 1.6, armadura: 0.1 },
  specs: [
    {
      id: 'assassinato',
      nome: 'Assassinato',
      descricao: 'Venenos que se acumulam e golpes que os exploram.',
      faccoesFavoritas: ['laminaDeEbano', 'kirinTor'],
      modificadores: [mod('vidaMax', 'mult', 0.15)],
      habilidades: [
        {
          id: 'envenenamento',
          nome: 'Envenenamento',
          descricao: 'Em alvos envenenados: 260% do dano como natureza.',
          custo: 35,
          recarga: 6,
          prioridade: 1,
          condicao: { alvoComStatus: 'veneno' },
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.6 }, escola: 'natureza' }],
        },
        {
          id: 'mutilar',
          nome: 'Mutilar',
          descricao: '170% do dano e 1 pilha de Veneno (30% do dano por segundo, 8 s).',
          custo: 40,
          recarga: 0,
          prioridade: 2,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: 1.7 }, escola: 'fisico' },
            { tipo: 'status', alvo: 'alvo', status: 'veneno', duracao: 8, valor: { dano: 0.3 } },
          ],
        },
        {
          id: 'venenoMortal',
          nome: 'Veneno Mortal',
          descricao: 'Aplica 2 pilhas de Veneno (30% do dano por segundo, 8 s).',
          custo: 25,
          recarga: 6,
          prioridade: 3,
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'veneno', duracao: 8, valor: { dano: 0.3 }, pilhas: 2 }],
        },
      ],
      suprema: {
        id: 'vendeta',
        nome: 'Vendeta',
        descricao: 'Aplica 5 pilhas de Veneno e causa 200% do dano.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 3,
        cargaPorDanoRecebido: 50,
        efeitos: [
          { tipo: 'status', alvo: 'alvo', status: 'veneno', duracao: 10, valor: { dano: 0.3 }, pilhas: 5 },
          { tipo: 'dano', alvo: 'alvo', valor: { dano: 2 }, escola: 'natureza' },
        ],
      },
    },
    {
      id: 'combate',
      nome: 'Combate',
      descricao: 'Ataques velozes e explosões de dano.',
      faccoesFavoritas: ['kirinTor', 'cruzadaArgentea'],
      modificadores: [mod('aps', 'mult', 0.1), mod('vidaMax', 'mult', 0.12)],
      habilidades: [
        {
          id: 'eviscerar',
          nome: 'Eviscerar',
          descricao: 'Finalizador: 280% do dano.',
          custo: 35,
          recarga: 6,
          prioridade: 1,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.8 }, escola: 'fisico' }],
        },
        {
          id: 'fatiarEPicar',
          nome: 'Fatiar e Picar',
          descricao: 'Fica enfurecido por 10 s (+25% de dano).',
          custo: 25,
          recarga: 14,
          prioridade: 2,
          condicao: { selfSemStatus: 'enfurecido' },
          efeitos: [{ tipo: 'status', alvo: 'self', status: 'enfurecido', duracao: 10, valor: { base: 0.25 } }],
        },
        {
          id: 'golpeSinistro',
          nome: 'Golpe Sinistro',
          descricao: '170% do dano.',
          custo: 40,
          recarga: 0,
          prioridade: 3,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 1.7 }, escola: 'fisico' }],
        },
      ],
      suprema: {
        id: 'furiaDasLaminas',
        nome: 'Fúria das Lâminas',
        descricao: '120% do dano em todos os inimigos e +50% de dano por 8 s.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 3,
        cargaPorDanoRecebido: 50,
        efeitos: [
          { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 1.2 }, escola: 'fisico' },
          { tipo: 'status', alvo: 'self', status: 'enfurecido', duracao: 8, valor: { base: 0.5 } },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Sacerdote
// ---------------------------------------------------------------------------

export const SACERDOTE: ClassDef = {
  id: 'sacerdote',
  nome: 'Sacerdote',
  cor: '#FFFFFF',
  descricao: 'Conjurador que se sustenta com curas e escudos. Mana alta.',
  recurso: RECURSOS.mana,
  ataqueEscola: 'sagrado',
  base: { vidaMax: 140, recursoMax: RECURSOS.mana.max, dano: 10, aps: 0.7, critChance: 0.06, critDano: 1.5, armadura: 0.05 },
  specs: [
    {
      id: 'sombra',
      nome: 'Sombra',
      descricao: 'Dano de sombra contínuo que também cura.',
      faccoesFavoritas: ['laminaDeEbano', 'kirinTor'],
      ataqueEscola: 'sombra',
      modificadores: [mod('vidaMax', 'mult', 0.1)],
      habilidades: [
        {
          id: 'palavraSombriaDor',
          nome: 'Palavra Sombria: Dor',
          descricao: 'Aplica Doença (55% do dano por segundo, 12 s).',
          custo: 30,
          recarga: 0,
          prioridade: 1,
          condicao: { alvoSemStatus: 'doenca' },
          efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'doenca', duracao: 12, valor: { dano: 0.55 } }],
        },
        {
          id: 'toqueVampirico',
          nome: 'Toque Vampírico',
          descricao: '120% do dano como sombra e cura 9% da vida máxima.',
          custo: 45,
          recarga: 8,
          prioridade: 2,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: 1.2 }, escola: 'sombra' },
            { tipo: 'cura', alvo: 'self', valor: { vidaMax: 0.09 } },
          ],
        },
        {
          id: 'acoiteMental',
          nome: 'Açoite Mental',
          descricao: '230% do dano como sombra.',
          custo: 40,
          recarga: 4,
          prioridade: 3,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.3 }, escola: 'sombra' }],
        },
      ],
      suprema: {
        id: 'explosaoMentalSombria',
        nome: 'Explosão Mental Sombria',
        descricao: '250% do dano como sombra em todos os inimigos e cura 10% da vida máxima.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 5,
        cargaPorDanoRecebido: 40,
        efeitos: [
          { tipo: 'dano', alvo: 'todosInimigos', valor: { dano: 2.5 }, escola: 'sombra' },
          { tipo: 'cura', alvo: 'self', valor: { vidaMax: 0.1 } },
        ],
      },
    },
    {
      id: 'disciplina',
      nome: 'Disciplina',
      descricao: 'Escudos e golpes sagrados que curam.',
      faccoesFavoritas: ['cruzadaArgentea', 'kirinTor'],
      modificadores: [mod('vidaMax', 'mult', 0.1)],
      habilidades: [
        {
          id: 'palavraDePoderEscudo',
          nome: 'Palavra de Poder: Escudo',
          descricao: 'Escudo de 15% da vida máxima por 10 s.',
          custo: 50,
          recarga: 18,
          prioridade: 1,
          condicao: { selfSemStatus: 'escudo' },
          efeitos: [{ tipo: 'escudo', alvo: 'self', valor: { vidaMax: 0.15 }, duracao: 10 }],
        },
        {
          id: 'penitencia',
          nome: 'Penitência',
          descricao: '210% do dano como sagrado e cura 3% da vida máxima.',
          custo: 35,
          recarga: 6,
          prioridade: 2,
          efeitos: [
            { tipo: 'dano', alvo: 'alvo', valor: { dano: 2.1 }, escola: 'sagrado' },
            { tipo: 'cura', alvo: 'self', valor: { vidaMax: 0.03 } },
          ],
        },
        {
          id: 'castigo',
          nome: 'Castigo',
          descricao: '150% do dano como sagrado.',
          custo: 20,
          recarga: 2,
          prioridade: 3,
          efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 1.5 }, escola: 'sagrado' }],
        },
      ],
      suprema: {
        id: 'barreiraDivina',
        nome: 'Barreira Divina',
        descricao: 'Escudo de 25% da vida máxima e cura 10%.',
        cargaMax: 100,
        cargaPorSegundo: 3,
        cargaPorAcerto: 3,
        cargaPorDanoRecebido: 40,
        efeitos: [
          { tipo: 'escudo', alvo: 'self', valor: { vidaMax: 0.25 }, duracao: 12 },
          { tipo: 'cura', alvo: 'self', valor: { vidaMax: 0.1 } },
        ],
      },
    },
  ],
};

export const CLASSES: Partial<Record<ClassId, ClassDef>> = {
  guerreiro: GUERREIRO,
  mago: MAGO,
  ladino: LADINO,
  sacerdote: SACERDOTE,
};

/** Classes disponíveis desde o início; as outras são desbloqueadas por conquistas. */
export const CLASSES_INICIAIS: ClassId[] = ['guerreiro', 'mago'];

export function getClass(id: ClassId): ClassDef {
  const c = CLASSES[id];
  if (!c) throw new Error(`Classe desconhecida: ${id}`);
  return c;
}
