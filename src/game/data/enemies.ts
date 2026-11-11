/**
 * Inimigos (dados declarativos). Nomes e números provisórios.
 * `base` é o valor na linha 0, dificuldade Normal; formulas.escalaInimigo cuida do resto.
 */

import type { EnemyDef } from '../types';

const lista: EnemyDef[] = [
  // ---- Normais -----------------------------------------------------------
  {
    id: 'guerreiroVrykul',
    nome: 'Guerreiro Vrykul',
    tier: 'normal',
    descricao: 'Guerreiro gigante de Utgarde. Golpes lentos e pesados.',
    base: { vidaMax: 55, dano: 7, aps: 0.6, armadura: 0.1 },
    ataqueEscola: 'fisico',
    cor: '#8a9bb0',
  },
  {
    id: 'ritualistaVrykul',
    nome: 'Ritualista Vrykul',
    tier: 'normal',
    descricao: 'Conjura sombras e espalha doença.',
    base: { vidaMax: 40, dano: 6, aps: 0.6, armadura: 0.03 },
    ataqueEscola: 'sombra',
    habilidades: [
      {
        id: 'toquePestilento',
        nome: 'Toque Pestilento',
        descricao: 'Aplica Doença.',
        custo: 0,
        recarga: 8,
        prioridade: 1,
        condicao: { alvoSemStatus: 'doenca' },
        efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'doenca', duracao: 6, valor: { dano: 0.35 } }],
      },
    ],
    cor: '#6b4a8a',
  },
  {
    id: 'loboDeUtgarde',
    nome: 'Lobo de Utgarde',
    tier: 'normal',
    descricao: 'Rápido e voraz. Suas mordidas sangram.',
    base: { vidaMax: 35, dano: 4, aps: 1.2, armadura: 0.05 },
    ataqueEscola: 'fisico',
    gatilhos: [
      {
        id: 'mordidaDilacerante',
        gatilho: 'aoAtacar',
        chance: 0.25,
        efeitos: [{ tipo: 'status', alvo: 'alvo', status: 'sangramento', duracao: 6, valor: { dano: 0.4 } }],
      },
    ],
    cor: '#9c8f7a',
  },
  {
    id: 'escravoAtormentado',
    nome: 'Escravo Atormentado',
    tier: 'normal',
    descricao: 'Prisioneiro quebrado, forçado a lutar.',
    base: { vidaMax: 30, dano: 5, aps: 0.8, armadura: 0 },
    ataqueEscola: 'fisico',
    cor: '#7a6a5a',
  },
  // ---- Elites -------------------------------------------------------------
  {
    id: 'domadorDeProtodracos',
    nome: 'Domador de Protodracos',
    tier: 'elite',
    descricao: 'Veterano vrykul que doma protodracos. Golpe esmagador periódico.',
    base: { vidaMax: 170, dano: 10, aps: 0.6, armadura: 0.15 },
    ataqueEscola: 'fisico',
    habilidades: [
      {
        id: 'golpeEsmagador',
        nome: 'Golpe Esmagador',
        descricao: 'Causa 250% do dano.',
        custo: 0,
        recarga: 9,
        prioridade: 1,
        efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.5 }, escola: 'fisico' }],
      },
    ],
    cor: '#b06a3a',
  },
  {
    id: 'berserkerVrykul',
    nome: 'Berserker Vrykul',
    tier: 'elite',
    descricao: 'Enfurece-se quando ferido.',
    base: { vidaMax: 150, dano: 9, aps: 0.8, armadura: 0.08 },
    ataqueEscola: 'fisico',
    gatilhos: [
      {
        id: 'furiaBerserker',
        gatilho: 'vidaAbaixo',
        limiar: 0.4,
        efeitos: [{ tipo: 'status', alvo: 'self', status: 'enfurecido', duracao: 60, valor: { base: 0.5 } }],
      },
    ],
    cor: '#a33b3b',
  },
  // ---- Mini-chefe e chefe (provisórios; mecânicas na fase 3) --------------
  {
    id: 'capitaoYmirjar',
    nome: 'Capitão da Guarda Ymirjar',
    tier: 'miniChefe',
    descricao: 'Comandante da guarda da fortaleza. Golpeia forte e se recupera entre os golpes.',
    base: { vidaMax: 290, dano: 7.5, aps: 0.7, armadura: 0.1 },
    ataqueEscola: 'fisico',
    mecanicas: [
      {
        tipo: 'golpeForte',
        nome: 'Golpe Devastador',
        texto: 'O capitão ergue o machado!',
        aCada: 11,
        aviso: 2,
        primeiraEm: 7,
        efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.2 }, escola: 'fisico' }],
      },
      { tipo: 'autocura', nome: 'Segundo Fôlego', texto: 'O capitão recupera o fôlego.', aCada: 14, fracaoVida: 0.06 },
    ],
    cor: '#c2b280',
  },
  {
    id: 'senhorDeUtgarde',
    nome: 'Senhor da Guerra de Utgarde',
    tier: 'chefe',
    descricao: 'Senhor da fortaleza. Nome e números provisórios: configure editando só os dados.',
    base: { vidaMax: 285, dano: 6.5, aps: 0.7, armadura: 0.15 },
    ataqueEscola: 'fisico',
    mecanicas: [
      {
        tipo: 'golpeForte',
        nome: 'Golpe Sombrio',
        texto: 'Sombras se acumulam na lâmina do senhor da guerra!',
        aCada: 12,
        aviso: 2,
        primeiraEm: 8,
        efeitos: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 1.9 }, escola: 'sombra' }],
      },
      {
        tipo: 'escudoRapido',
        nome: 'Barreira Profana',
        texto: 'Quebre a barreira antes que exploda!',
        aCada: 18,
        primeiraEm: 14,
        duracao: 5,
        valor: { vidaMax: 0.1 },
        punicao: [{ tipo: 'dano', alvo: 'alvo', valor: { dano: 2.5 }, escola: 'sombra', podeCritar: false }],
      },
      {
        tipo: 'fase',
        nome: 'Fúria de Utgarde',
        texto: 'Ferido, o senhor da guerra convoca a guarda e luta com mais ferocidade.',
        abaixoDeVida: 0.5,
        modificadores: [{ stat: 'dano', op: 'mult', value: 0.25, source: 'fase' }],
        efeitos: [{ tipo: 'invocar', inimigoId: 'escravoAtormentado', quantidade: 2, max: 2 }],
      },
      { tipo: 'enrage', nome: 'Ira Implacável', texto: 'O senhor da guerra perde a paciência!', aposSegundos: 75, danoMult: 1.6, apsMult: 1.4 },
    ],
    cor: '#3a2f5a',
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(lista.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Inimigo desconhecido: ${id}`);
  return e;
}
