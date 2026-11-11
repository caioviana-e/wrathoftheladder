/**
 * TODAS as fórmulas e constantes de balanceamento ficam aqui.
 * Ao calibrar a dificuldade, mexa só neste arquivo (e nos números em data/).
 */

import type { EnemyTier, Stats } from './types';

// ---------------------------------------------------------------------------
// Combate
// ---------------------------------------------------------------------------

/** Passo fixo da simulação, em segundos de jogo. */
export const TICK = 0.05;
/** Limite de duração de um combate; ao estourar, o herói perde (exaustão). */
export const LIMITE_COMBATE_S = 120;
/** Recarga global entre habilidades (segundos). */
export const GCD = 1.0;
/** Variação aleatória do dano direto: ±10%. */
export const VARIANCIA_DANO = 0.1;
/** Intervalo entre tiques de dano periódico (segundos). */
export const INTERVALO_DOT = 1.0;
/** Doença reduz a cura recebida nesta fração. */
export const DOENCA_REDUCAO_CURA = 0.5;
/** Quanto a armadura vale contra dano mágico (físico = 1). */
export const ARMADURA_FATOR_MAGICO = 0.5;

export const LIMITES = {
  armaduraMax: 0.75,
  critChanceMax: 1,
  apsMin: 0.2,
  apsMax: 5,
  lentidaoMax: 0.7,
} as const;

/** Atraso do primeiro ataque, como fração do intervalo entre ataques. */
export const PRIMEIRO_ATAQUE = { min: 0.3, max: 0.8 } as const;

/** Dano bruto de um golpe/efeito antes de crítico, bônus e armadura. */
export function rolarVariancia(valor: number, roll01: number): number {
  return valor * (1 - VARIANCIA_DANO + 2 * VARIANCIA_DANO * roll01);
}

/** Redução por armadura. DoTs ignoram armadura. */
export function reducaoArmadura(armadura: number, fisico: boolean): number {
  const a = Math.min(LIMITES.armaduraMax, Math.max(0, armadura));
  return fisico ? a : a * ARMADURA_FATOR_MAGICO;
}

/** Arredondamento final de dano/cura: inteiro, mínimo 1 para dano. */
export function arredondarDano(v: number): number {
  return Math.max(1, Math.round(v));
}

// ---------------------------------------------------------------------------
// Escala de inimigos
// ---------------------------------------------------------------------------

/** Multiplicadores por categoria de inimigo. */
export const TIER_MULT: Record<EnemyTier, { vida: number; dano: number }> = {
  normal: { vida: 1, dano: 1 },
  elite: { vida: 1, dano: 1 },
  miniChefe: { vida: 1, dano: 1 },
  chefe: { vida: 1, dano: 1 },
};

/** Crescimento por linha do mapa (linear, para manter números contidos). */
export const CRESCIMENTO_POR_LINHA = { vida: 0.1, dano: 0.045 } as const;

export const DIFICULDADE_MULT = {
  normal: { vida: 1, dano: 1 },
  heroico: { vida: 1.5, dano: 1.35 },
} as const;

export type Dificuldade = keyof typeof DIFICULDADE_MULT;

/**
 * Depois do mini-chefe, inimigos comuns e elites ficam mais perigosos: a corrida típica
 * morre entre o mini-chefe e a linha anterior ao chefe (não só no chefe).
 */
export const SEGUNDA_METADE = { vida: 1.08, dano: 1.12 } as const;

export function escalaInimigo(
  linha: number,
  tier: EnemyTier,
  dificuldade: Dificuldade,
  totalLinhas = 15,
): { vida: number; dano: number } {
  const t = TIER_MULT[tier];
  const d = DIFICULDADE_MULT[dificuldade];
  const segunda = linha > Math.floor(totalLinhas / 2) && (tier === 'normal' || tier === 'elite');
  return {
    vida: (1 + CRESCIMENTO_POR_LINHA.vida * linha) * t.vida * d.vida * (segunda ? SEGUNDA_METADE.vida : 1),
    dano: (1 + CRESCIMENTO_POR_LINHA.dano * linha) * t.dano * d.dano * (segunda ? SEGUNDA_METADE.dano : 1),
  };
}

/** Quantidade de inimigos num nó de combate normal, conforme a linha. */
export function pesosQuantidadeInimigos(linha: number): { n: number; peso: number }[] {
  if (linha < 2) return [{ n: 1, peso: 1 }];
  if (linha < 5)
    return [
      { n: 1, peso: 2 },
      { n: 2, peso: 2 },
    ];
  return [
    { n: 1, peso: 1 },
    { n: 2, peso: 3 },
    { n: 3, peso: 2 },
  ];
}

// ---------------------------------------------------------------------------
// Corrida
// ---------------------------------------------------------------------------

/** Cura automática ao fim de cada combate vencido (fração da vida máxima). */
export const CURA_POS_COMBATE = 0.12;
/** Cura da fogueira (fração da vida máxima). */
export const CURA_FOGUEIRA = 0.3;

/** Ouro por vitória, por categoria. */
export const OURO_POR_VITORIA: Record<EnemyTier, number> = {
  normal: 15,
  elite: 35,
  miniChefe: 60,
  chefe: 0,
};

// ---------------------------------------------------------------------------
// Bênçãos
// ---------------------------------------------------------------------------

export const RARIDADES = ['comum', 'incomum', 'rara', 'epica', 'lendaria'] as const;

/** Multiplicador dos valores da bênção por raridade. */
export const POTENCIA_RARIDADE = { comum: 1, incomum: 1.25, rara: 1.5, epica: 1.8, lendaria: 2.2 } as const;
/** Cada nível acima do 1 soma esta fração à potência. */
export const BONUS_POR_NIVEL = 0.4;
export const NIVEL_MAX = 5;

/** Pesos para sortear a raridade de uma oferta. */
export const PESO_RARIDADE = { comum: 60, incomum: 26, rara: 10, epica: 3.5, lendaria: 0.5 } as const;

/** Raridade mínima garantida por origem da oferta. */
export const RARIDADE_MINIMA = {
  combate: 'comum',
  elite: 'rara',
  miniChefe: 'rara',
  tesouro: 'incomum',
} as const;

export const OFERTA_TAMANHO = 3;
/** Peso de cada bênção na oferta. */
export const PESO_OFERTA = {
  base: 1,
  /** Facções favoritas da especialização. */
  faccaoFavorita: 1.6,
  /** Bênção que o jogador já tem (subir de nível). */
  repetida: 0.8,
  /** Bênção dupla liberada. */
  dupla: 1.5,
} as const;

export const RELANCAMENTOS_INICIAIS = 1;

// ---------------------------------------------------------------------------
// Consumíveis, vendedor
// ---------------------------------------------------------------------------

export const MAX_CONSUMIVEIS = 3;

export const PRECO_BENCAO = { comum: 45, incomum: 70, rara: 100, epica: 150, lendaria: 220 } as const;
export const PRECO_CURA_VENDEDOR = 30;
export const CURA_VENDEDOR = 0.3;
export const PRECO_PURIFICAR = 50;
/** Itens à venda. */
export const LOJA = { bencaos: 3, consumiveis: 2 } as const;

// ---------------------------------------------------------------------------
// Progressão permanente
// ---------------------------------------------------------------------------

/** Bônus permanente agregado (soma da árvore) aplicado no início da corrida. */
export interface MetaBonus {
  vidaPct: number;
  danoPct: number;
  critChance: number;
  armadura: number;
  /** Relançamentos extras por corrida. */
  relancamentos: number;
  /** Poções de cura iniciais. */
  pocoes: number;
  /** 1 = começa a corrida escolhendo 1 de 3 bênçãos comuns. */
  bencaoInicial: number;
  /** Ouro extra (fração). */
  ouroPct: number;
  /** Cura pós-combate extra (fração da vida máxima). */
  curaPosCombate: number;
}

export const META_ZERO: MetaBonus = {
  vidaPct: 0,
  danoPct: 0,
  critChance: 0,
  armadura: 0,
  relancamentos: 0,
  pocoes: 0,
  bencaoInicial: 0,
  ouroPct: 0,
  curaPosCombate: 0,
};

/**
 * Emblemas ganhos em TODA corrida (inclusive derrotas), proporcionais ao progresso.
 * O mínimo garante comprar ao menos 1 melhoria da árvore já na primeira corrida.
 */
export const EMBLEMAS = {
  base: 2,
  porNo: 1.5,
  porElite: 3,
  porMiniChefe: 5,
  porChefe: 12,
  vitoria: 10,
  minimo: 5,
  multHeroico: 1.5,
} as const;

/** Chance de uma relíquia (ainda não conquistada) cair, por categoria. */
export const CHANCE_RELIQUIA = { elite: 0.3, miniChefe: 0.6, chefe: 1 } as const;

// ---------------------------------------------------------------------------
// Utilitário
// ---------------------------------------------------------------------------

export function aplicarLimites(s: Stats): Stats {
  return {
    vidaMax: Math.max(1, Math.round(s.vidaMax)),
    recursoMax: Math.max(0, s.recursoMax),
    dano: Math.max(0, s.dano),
    aps: Math.min(LIMITES.apsMax, Math.max(LIMITES.apsMin, s.aps)),
    critChance: Math.min(LIMITES.critChanceMax, Math.max(0, s.critChance)),
    critDano: Math.max(1, s.critDano),
    armadura: Math.min(LIMITES.armaduraMax, Math.max(0, s.armadura)),
  };
}

/** Congelamento dura menos em elites/chefes (evita travar chefe para sempre). */
export const CONGELAMENTO_MULT_NAO_NORMAL = 0.5;
/** Depois de descongelar, elites e chefes ficam imunes a congelamento por este tempo (s). */
export const IMUNIDADE_CONGELAMENTO_S = 4;

// ---------------------------------------------------------------------------
// Geração de mapa
// ---------------------------------------------------------------------------

export const MAPA = {
  /** Nós por linha comum (sorteado entre min e max). */
  nosPorLinha: { min: 2, max: 3 },
  /** Linhas iniciais sem elite. */
  linhasSemElite: 3,
  minElites: 2,
  /** Chance de ligar um nó a um segundo vizinho na linha seguinte (sem cruzar). */
  chanceLigacaoExtra: 0.35,
  /** Pesos dos tipos de nó nas linhas comuns. */
  pesos: {
    combate: 46,
    evento: 20,
    elite: 11,
    fogueira: 8,
    vendedor: 8,
    tesouro: 7,
  },
} as const;
