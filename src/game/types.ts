/**
 * Tipos centrais do jogo. Tudo aqui é dado serializável (JSON puro):
 * nada de funções, classes ou referências ao Svelte/Phaser.
 */

// ---------------------------------------------------------------------------
// Atributos e modificadores
// ---------------------------------------------------------------------------

export interface Stats {
  vidaMax: number;
  /** Máximo do recurso (Fúria/Energia/Mana). 0 se não usa recurso. */
  recursoMax: number;
  /** Dano base por golpe. Habilidades escalam a partir dele. */
  dano: number;
  /** Ataques automáticos por segundo. */
  aps: number;
  /** 0..1 */
  critChance: number;
  /** Multiplicador do crítico (1.5 = +50%). */
  critDano: number;
  /** Redução de dano direto, 0..ARMADURA_MAX. */
  armadura: number;
}

export type StatKey = keyof Stats;

/**
 * Modificador de atributo.
 * Valor final = (base + Σ add) × (1 + Σ mult), depois limitado pelos tetos de formulas.ts.
 */
export interface Modifier {
  stat: StatKey;
  op: 'add' | 'mult';
  value: number;
  /** De onde veio (id de bênção, relíquia, árvore…). Só para depuração/UI. */
  source: string;
}

// ---------------------------------------------------------------------------
// Escolas, recursos e status
// ---------------------------------------------------------------------------

export type Escola = 'fisico' | 'fogo' | 'gelo' | 'arcano' | 'sombra' | 'sagrado' | 'natureza';

export type ResourceKind = 'furia' | 'energia' | 'mana' | 'runas' | 'nenhum';

export interface ResourceDef {
  kind: ResourceKind;
  nome: string;
  max: number;
  /** Fração do máximo no início do combate (Fúria = 0, Mana = 1). */
  inicioFracao: number;
  /** Por segundo. */
  regen: number;
  /** Ganho ao acertar um ataque automático (Fúria). */
  ganhoAoBater?: number;
  /** Ganho ao receber dano igual a 100% da vida máxima (escala linear). */
  ganhoAoApanhar?: number;
}

export type StatusId =
  | 'queimadura'
  | 'sangramento'
  | 'veneno'
  | 'doenca'
  | 'lentidao'
  | 'congelamento'
  | 'escudo'
  | 'enfurecido';

export interface StatusDef {
  id: StatusId;
  nome: string;
  tipo: 'dot' | 'controle' | 'buff' | 'escudo';
  /** Como reaplicar: renovar (duração e maior potência) ou acumular pilhas. */
  reaplicar: 'renovar' | 'acumular';
  maxPilhas: number;
  escola?: Escola;
  descricao: string;
  /** Ícone provisório para a interface. */
  icone: string;
}

export interface ActiveStatus {
  id: StatusId;
  /** Segundos restantes. */
  restante: number;
  pilhas: number;
  /** DoT: dano por tique por pilha. Lentidão/enfurecido: fração. Escudo: absorção restante. */
  potencia: number;
  /** Acumulador para o próximo tique de DoT. */
  proximoTique: number;
  /** uid de quem aplicou (para créditos de morte/gatilhos). */
  origem: string;
}

// ---------------------------------------------------------------------------
// Efeitos declarativos (habilidades, gatilhos, bênçãos)
// ---------------------------------------------------------------------------

/**
 * Quanto vale um efeito: base + dano×Dano + vidaMax×VidaMax + danoCausado×(dano do evento).
 * Ex.: roubo de vida de 10% = { danoCausado: 0.1 }.
 */
export interface Escala {
  base?: number;
  dano?: number;
  vidaMax?: number;
  danoCausado?: number;
}

export type AlvoEfeito = 'alvo' | 'self' | 'todosInimigos' | 'inimigoAleatorio' | 'atacante';

export type Effect =
  | {
      tipo: 'dano';
      alvo: AlvoEfeito;
      valor: Escala;
      escola: Escola;
      podeCritar?: boolean;
      ignoraArmadura?: boolean;
    }
  | { tipo: 'cura'; alvo: 'self'; valor: Escala }
  | { tipo: 'escudo'; alvo: 'self'; valor: Escala; duracao: number }
  | {
      tipo: 'status';
      alvo: AlvoEfeito;
      status: StatusId;
      duracao: number;
      /** DoT: dano por tique; lentidão/enfurecido: fração (base). */
      valor: Escala;
      pilhas?: number;
    }
  | { tipo: 'recurso'; valor: number }
  | { tipo: 'cargaSuprema'; valor: number }
  /** Perda direta de vida (fração da vida máxima), sem armadura, crítico ou gatilhos. Pode matar. */
  | { tipo: 'perderVida'; fracao: number }
  /** Invoca inimigos (só faz sentido para o lado inimigo). Respeita o limite `max` de invocações vivas. */
  | { tipo: 'invocar'; inimigoId: string; quantidade: number; max: number };

export interface Condicao {
  alvoVidaAbaixo?: number;
  alvoVidaAcima?: number;
  selfVidaAbaixo?: number;
  alvoComStatus?: StatusId;
  alvoSemStatus?: StatusId;
  selfSemStatus?: StatusId;
}

export interface AbilityDef {
  id: string;
  nome: string;
  descricao: string;
  custo: number;
  /** Segundos. */
  recarga: number;
  /** Menor = tentada primeiro. */
  prioridade: number;
  condicao?: Condicao;
  efeitos: Effect[];
}

export interface UltimateDef {
  id: string;
  nome: string;
  descricao: string;
  /** Carga necessária (normalmente 100). */
  cargaMax: number;
  cargaPorSegundo: number;
  cargaPorAcerto: number;
  /** Carga ao receber dano igual a 100% da vida máxima. */
  cargaPorDanoRecebido: number;
  efeitos: Effect[];
}

// ---------------------------------------------------------------------------
// Gatilhos (base de bênçãos, relíquias e mecânicas de inimigos)
// ---------------------------------------------------------------------------

export type Gatilho =
  | 'inicioCombate'
  | 'aoAtacar'
  | 'aoCritar'
  | 'aoReceberDano'
  | 'aoMatar'
  | 'aoUsarHabilidade'
  | 'aoUsarSuprema'
  | 'intervalo'
  | 'vidaAbaixo';

export interface TriggeredEffect {
  id: string;
  gatilho: Gatilho;
  /** 0..1, padrão 1. */
  chance?: number;
  /** Recarga interna em segundos. */
  recargaInterna?: number;
  /** Para 'intervalo': a cada N segundos. */
  intervalo?: number;
  /** Para 'vidaAbaixo': fração da vida (dispara uma vez por combate). */
  limiar?: number;
  condicao?: Condicao;
  efeitos: Effect[];
}

/** Bônus condicional de dano/crítico (ex.: "+30% de dano em alvos congelados"). */
export interface CondMod {
  id: string;
  quando: {
    escola?: Escola;
    alvoComStatus?: StatusId;
    alvoVidaAbaixo?: number;
    alvoVidaAcima?: number;
    fonte?: 'ataque' | 'habilidade' | 'suprema';
  };
  danoMult?: number;
  critChanceExtra?: number;
}

// ---------------------------------------------------------------------------
// Classes, especializações e inimigos
// ---------------------------------------------------------------------------

export type ClassId =
  | 'guerreiro'
  | 'mago'
  | 'ladino'
  | 'sacerdote'
  | 'paladino'
  | 'cacador'
  | 'xama'
  | 'bruxo'
  | 'druida'
  | 'cavaleiroDaMorte';

export type FactionId =
  | 'kirinTor'
  | 'cruzadaArgentea'
  | 'laminaDeEbano'
  | 'filhosDeHodir'
  | 'aliancaCinerea'
  | 'oraculos';

export type Raridade = 'comum' | 'incomum' | 'rara' | 'epica' | 'lendaria';

export type Tag =
  | 'arcano'
  | 'critico'
  | 'escudo'
  | 'cura'
  | 'defesa'
  | 'sagrado'
  | 'drenar'
  | 'doenca'
  | 'sombra'
  | 'gelo'
  | 'lentidao'
  | 'congelamento'
  | 'sangramento'
  | 'fogo'
  | 'veneno';

export interface SpecDef {
  id: string;
  nome: string;
  descricao: string;
  habilidades: AbilityDef[];
  suprema: UltimateDef;
  /** Facções que aparecem com mais frequência nas recompensas. */
  faccoesFavoritas: FactionId[];
  /** Modificadores extras da especialização sobre a base da classe. */
  modificadores?: Modifier[];
  /** Escola do ataque automático, se diferente da classe (ex.: Mago de Gelo). */
  ataqueEscola?: Escola;
}

export interface ClassDef {
  id: ClassId;
  nome: string;
  /** Cor clássica da classe (hex). */
  cor: string;
  descricao: string;
  recurso: ResourceDef;
  base: Stats;
  ataqueEscola: Escola;
  specs: SpecDef[];
}

export type EnemyTier = 'normal' | 'elite' | 'miniChefe' | 'chefe';

/**
 * Cardápio de mecânicas de chefe, configuráveis só por dados.
 * Cada chefe/elite pode combinar várias. `nome` e `texto` aparecem no registro e na tela.
 */
export type BossMechanic = { nome: string; texto: string } & (
  | { tipo: 'enrage'; aposSegundos: number; danoMult: number; apsMult: number }
  | { tipo: 'fase'; abaixoDeVida: number; modificadores: Modifier[]; efeitos?: Effect[] }
  | { tipo: 'invocar'; intervalo: number; inimigoId: string; quantidade: number; max: number; primeiraEm?: number }
  | { tipo: 'escudoRapido'; aCada: number; valor: Escala; duracao: number; punicao: Effect[]; primeiraEm?: number }
  | { tipo: 'autocura'; aCada: number; fracaoVida: number; primeiraEm?: number }
  | { tipo: 'golpeForte'; aCada: number; aviso: number; efeitos: Effect[]; primeiraEm?: number }
);

export interface EnemyDef {
  id: string;
  nome: string;
  tier: EnemyTier;
  descricao: string;
  /** Atributos no nível de referência (linha 0 da masmorra, Normal). */
  base: Pick<Stats, 'vidaMax' | 'dano' | 'aps' | 'armadura'> & Partial<Stats>;
  ataqueEscola: Escola;
  habilidades?: AbilityDef[];
  gatilhos?: TriggeredEffect[];
  mecanicas?: BossMechanic[];
  /** Cor provisória da forma desenhada. */
  cor: string;
}

export interface DungeonDef {
  id: string;
  nome: string;
  descricao: string;
  linhas: number;
  inimigos: {
    normais: string[];
    elites: string[];
    miniChefes: string[];
    chefes: string[];
  };
  /** Modificador global da corrida (masmorras futuras). */
  modificador?: { id: string; nome: string; descricao: string };
}

// ---------------------------------------------------------------------------
// Combate
// ---------------------------------------------------------------------------

export type Side = 'heroi' | 'inimigo';

/** Tudo o que a engine precisa para montar um combatente. */
export interface CombatantInit {
  uid: string;
  defId: string;
  nome: string;
  side: Side;
  tier?: EnemyTier;
  stats: Stats;
  /** Vida inicial (a vida do herói persiste entre combates). */
  vida?: number;
  recurso: ResourceDef | null;
  ataqueEscola: Escola;
  habilidades: AbilityDef[];
  suprema: UltimateDef | null;
  gatilhos: TriggeredEffect[];
  condMods: CondMod[];
  mecanicas?: BossMechanic[];
}

export interface Combatant extends CombatantInit {
  /** Multiplicadores do enrage (1 = nenhum). */
  enrage: { dano: number; aps: number };
  /** Estado de cada mecânica, pelo índice em `mecanicas`. */
  mecanicaEstado: { proxima: number; disparada: boolean; avisoAte: number | null; escudoAte: number | null }[];
  /** uid de quem invocou (para o limite de invocações). */
  invocadoPor?: string;
  vida: number;
  recursoAtual: number;
  cargaSuprema: number;
  ataqueTimer: number;
  gcd: number;
  recargas: Record<string, number>;
  statuses: ActiveStatus[];
  vivo: boolean;
  /** Estado interno de gatilhos: recargas, intervalos, limiares já disparados. */
  gatilhoEstado: Record<string, { recarga: number; acumulado: number; disparado: boolean }>;
  /** Tempo (s) até poder ser congelado de novo (elites e chefes). */
  imuneCongelarAte: number;
}

export type OrigemDano =
  | { tipo: 'ataque' }
  | { tipo: 'habilidade'; id: string }
  | { tipo: 'suprema'; id: string }
  | { tipo: 'status'; id: StatusId }
  | { tipo: 'gatilho'; id: string };

export type CombatEvent =
  | { t: number; tipo: 'inicio'; combatentes: { uid: string; nome: string; side: Side; vida: number; vidaMax: number }[] }
  | {
      t: number;
      tipo: 'dano';
      de: string;
      para: string;
      valor: number;
      absorvido: number;
      critico: boolean;
      escola: Escola;
      origem: OrigemDano;
    }
  | { t: number; tipo: 'cura'; de: string; para: string; valor: number }
  | { t: number; tipo: 'statusAplicado'; de: string; para: string; status: StatusId; pilhas: number; duracao: number }
  | { t: number; tipo: 'statusExpirou'; para: string; status: StatusId }
  | { t: number; tipo: 'habilidade'; de: string; id: string; nome: string; suprema: boolean }
  | { t: number; tipo: 'morte'; uid: string; por: string | null }
  | { t: number; tipo: 'mecanica'; de: string; nome: string; texto: string; aviso: boolean }
  | { t: number; tipo: 'invocacao'; de: string; uid: string; defId: string; nome: string; vida: number; vidaMax: number }
  | { t: number; tipo: 'fim'; vencedor: Side; motivo: 'eliminacao' | 'tempo' };

export interface CombatResult {
  vencedor: Side;
  motivo: 'eliminacao' | 'tempo';
  duracao: number;
  vidaFinalHeroi: number;
  inimigosMortos: string[];
}
