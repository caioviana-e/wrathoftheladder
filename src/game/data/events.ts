/**
 * Eventos (dados declarativos). Cada escolha tem resultados sorteados por peso;
 * cada resultado é uma lista de operações (EventOp) aplicadas por src/game/events.ts.
 */

import type { FactionId, Modifier, Raridade } from '../types';

export type EventOp =
  /** Cura (+) ou dano (−) como fração da vida máxima. Nunca deixa abaixo de 1. */
  | { op: 'vida'; fracao: number }
  /** Modificador permanente de vida máxima (mult). */
  | { op: 'vidaMax'; fracao: number }
  | { op: 'ouro'; valor: number }
  /** Abre uma escolha de bênção (opcionalmente de uma facção / raridade mínima). */
  | { op: 'ofertaBencao'; faccao?: FactionId; raridadeMin?: Raridade }
  /** Dá uma bênção aleatória direto. */
  | { op: 'bencaoAleatoria'; raridade: Raridade }
  | { op: 'itemAmaldicoado' }
  | { op: 'consumivel'; id?: string }
  | { op: 'modificador'; mod: Modifier }
  | { op: 'relancamentos'; valor: number }
  | { op: 'revelarMapa' }
  | { op: 'perderProximaRecompensa' }
  /** Emboscada: combate imediato; vencer dá a recompensa normal de combate. */
  | { op: 'combate'; inimigos: string[] };

export interface EventOutcome {
  peso: number;
  texto: string;
  ops: EventOp[];
}

export interface EventChoice {
  texto: string;
  /** Dica curta do custo/risco, mostrada na interface. */
  dica?: string;
  requisito?: { ouro?: number };
  resultados: EventOutcome[];
}

export interface EventDef {
  id: string;
  nome: string;
  icone: string;
  texto: string;
  escolhas: EventChoice[];
}

const nada = (texto: string): EventOutcome => ({ peso: 1, texto, ops: [] });

export const EVENTS: EventDef[] = [
  {
    id: 'cultistaFerido',
    nome: 'Cultista ferido',
    icone: '🩸',
    texto: 'Um cultista sangra na neve e implora por ajuda. Ele diz conhecer segredos da Cruzada Argêntea.',
    escolhas: [
      {
        texto: 'Ajudar',
        dica: '−10% de vida; risco de emboscada',
        resultados: [
          { peso: 7, texto: 'Grato, ele compartilha o que sabe sobre a Cruzada.', ops: [{ op: 'vida', fracao: -0.1 }, { op: 'ofertaBencao', faccao: 'cruzadaArgentea' }] },
          { peso: 3, texto: 'Era uma armadilha! Ritualistas saem das sombras.', ops: [{ op: 'vida', fracao: -0.1 }, { op: 'combate', inimigos: ['ritualistaVrykul', 'ritualistaVrykul'] }] },
        ],
      },
      { texto: 'Ignorar', resultados: [nada('Você segue em frente sem olhar para trás.')] },
      {
        texto: 'Executar',
        dica: '+30 de ouro; risco de maldição',
        resultados: [
          { peso: 13, texto: 'Você encontra uma bolsa de ouro com ele.', ops: [{ op: 'ouro', valor: 30 }] },
          { peso: 7, texto: 'O sangue amaldiçoado queima sua pele.', ops: [{ op: 'ouro', valor: 30 }, { op: 'vida', fracao: -0.12 }] },
        ],
      },
    ],
  },
  {
    id: 'altarDeSaronita',
    nome: 'Altar de Saronita',
    icone: '🗿',
    texto: 'Um altar de saronita pulsa com sussurros sombrios, prometendo poder em troca de um pedaço da sua vida.',
    escolhas: [
      {
        texto: 'Tocar o altar',
        dica: '−12% de vida máxima; ganha item amaldiçoado',
        resultados: [{ peso: 1, texto: 'A saronita se molda à sua vontade.', ops: [{ op: 'vidaMax', fracao: -0.12 }, { op: 'itemAmaldicoado' }] }],
      },
      {
        texto: 'Quebrar o altar',
        dica: '−15% de vida; +40 de ouro',
        resultados: [{ peso: 1, texto: 'Estilhaços cortam você, mas há ouro entre os destroços.', ops: [{ op: 'vida', fracao: -0.15 }, { op: 'ouro', valor: 40 }] }],
      },
      { texto: 'Ir embora', resultados: [nada('Os sussurros se calam enquanto você se afasta.')] },
    ],
  },
  {
    id: 'brann',
    nome: 'Brann Barbabronze',
    icone: '🧭',
    texto: 'O explorador anão Brann Barbabronze oferece um mapa detalhado da fortaleza, por um preço.',
    escolhas: [
      {
        texto: 'Aceitar o mapa',
        dica: 'Revela inimigos e eventos; perde a próxima recompensa',
        resultados: [{ peso: 1, texto: 'Agora você conhece cada canto da fortaleza. Brann ficará com sua próxima recompensa.', ops: [{ op: 'revelarMapa' }, { op: 'perderProximaRecompensa' }] }],
      },
      {
        texto: 'Trocar histórias',
        dica: 'Cura 15%',
        resultados: [{ peso: 1, texto: 'Uma boa caneca e boas histórias aquecem o corpo.', ops: [{ op: 'vida', fracao: 0.15 }] }],
      },
      { texto: 'Recusar', resultados: [nada('"Como quiser, rapaz!", diz Brann, e some num túnel.')] },
    ],
  },
  {
    id: 'mercadorSuspeito',
    nome: 'Mercador goblin suspeito',
    icone: '🎩',
    texto: 'Um goblin oferece um "artefato lendário" por uma pechincha. Parece bom demais para ser verdade.',
    escolhas: [
      {
        texto: 'Comprar (60 de ouro)',
        dica: '65% de chance de ser verdadeiro',
        requisito: { ouro: 60 },
        resultados: [
          { peso: 65, texto: 'É verdadeiro! O artefato brilha em laranja.', ops: [{ op: 'ouro', valor: -60 }, { op: 'bencaoAleatoria', raridade: 'lendaria' }] },
          { peso: 35, texto: 'Era vidro pintado. O goblin já sumiu.', ops: [{ op: 'ouro', valor: -60 }] },
        ],
      },
      {
        texto: 'Pechinchar',
        resultados: [
          { peso: 1, texto: 'Ele cede e joga um frasco no negócio.', ops: [{ op: 'consumivel' }] },
          { peso: 1, texto: 'O goblin se ofende e vai embora.', ops: [] },
        ],
      },
      { texto: 'Recusar', resultados: [nada('Melhor não arriscar.')] },
    ],
  },
  {
    id: 'fonteDoFiorde',
    nome: 'Fonte do Fiorde',
    icone: '⛲',
    texto: 'Uma fonte de água cristalina brota do gelo. Algo nela parece vivo.',
    escolhas: [
      {
        texto: 'Beber',
        dica: '50%: +10% de vida máxima; 50%: −15% de vida',
        resultados: [
          { peso: 1, texto: 'A água revigora até os ossos.', ops: [{ op: 'vidaMax', fracao: 0.1 }, { op: 'vida', fracao: 0.1 }] },
          { peso: 1, texto: 'A água estava contaminada.', ops: [{ op: 'vida', fracao: -0.15 }] },
        ],
      },
      {
        texto: 'Encher um frasco',
        dica: 'Ganha uma Poção de Cura',
        resultados: [{ peso: 1, texto: 'Você guarda a água para depois.', ops: [{ op: 'consumivel', id: 'pocaoDeCura' }] }],
      },
      { texto: 'Seguir', resultados: [nada('Você segue viagem.')] },
    ],
  },
  {
    id: 'arsenalAbandonado',
    nome: 'Arsenal abandonado',
    icone: '🗡️',
    texto: 'Um arsenal vrykul abandonado, ainda cheio de armas e armaduras.',
    escolhas: [
      {
        texto: 'Vasculhar tudo',
        dica: 'Bênção; risco de emboscada',
        resultados: [
          { peso: 13, texto: 'Entre as armas, algo abençoado.', ops: [{ op: 'ofertaBencao' }] },
          { peso: 7, texto: 'Lobos guardam o arsenal!', ops: [{ op: 'combate', inimigos: ['loboDeUtgarde', 'loboDeUtgarde'] }] },
        ],
      },
      {
        texto: 'Pegar só o ouro',
        dica: '+25 de ouro',
        resultados: [{ peso: 1, texto: 'Moedas esquecidas num baú.', ops: [{ op: 'ouro', valor: 25 }] }],
      },
    ],
  },
  {
    id: 'protodracoPreso',
    nome: 'Protodraco preso',
    icone: '🐉',
    texto: 'Um protodraco jovem está preso numa armadilha vrykul, debatendo-se.',
    escolhas: [
      {
        texto: 'Libertá-lo',
        dica: '−8% de vida; +6% de ataques por segundo',
        resultados: [
          {
            peso: 1,
            texto: 'Ele te morde ao sair, mas a coragem te inspira.',
            ops: [{ op: 'vida', fracao: -0.08 }, { op: 'modificador', mod: { stat: 'aps', op: 'mult', value: 0.06, source: 'evento' } }],
          },
        ],
      },
      {
        texto: 'Abatê-lo',
        dica: '+45 de ouro',
        resultados: [{ peso: 1, texto: 'Escamas de protodraco valem bem.', ops: [{ op: 'ouro', valor: 45 }] }],
      },
      { texto: 'Ignorar', resultados: [nada('O rugido ecoa atrás de você.')] },
    ],
  },
  {
    id: 'santuarioDeHodir',
    nome: 'Santuário de Hodir',
    icone: '🧊',
    texto: 'Um santuário de gelo erguido pelos gigantes de Hodir.',
    escolhas: [
      {
        texto: 'Orar',
        dica: 'Bênção dos Filhos de Hodir',
        resultados: [{ peso: 1, texto: 'O frio responde à sua prece.', ops: [{ op: 'ofertaBencao', faccao: 'filhosDeHodir' }] }],
      },
      {
        texto: 'Oferenda (50 de ouro)',
        dica: 'Bênção rara ou melhor',
        requisito: { ouro: 50 },
        resultados: [{ peso: 1, texto: 'Os gigantes aceitam sua oferenda.', ops: [{ op: 'ouro', valor: -50 }, { op: 'ofertaBencao', raridadeMin: 'rara' }] }],
      },
      { texto: 'Seguir', resultados: [nada('Você segue em frente.')] },
    ],
  },
  {
    id: 'tomoArcano',
    nome: 'Tomo do Kirin Tor',
    icone: '📘',
    texto: 'Um tomo do Kirin Tor caído entre os escombros, ainda brilhando com runas.',
    escolhas: [
      {
        texto: 'Estudar',
        dica: '−10% de vida; bênção do Kirin Tor (incomum ou melhor)',
        resultados: [{ peso: 1, texto: 'As runas queimam sua mente, mas você aprende.', ops: [{ op: 'vida', fracao: -0.1 }, { op: 'ofertaBencao', faccao: 'kirinTor', raridadeMin: 'incomum' }] }],
      },
      {
        texto: 'Vender depois',
        dica: '+35 de ouro',
        resultados: [{ peso: 1, texto: 'Algum colecionador vai pagar bem.', ops: [{ op: 'ouro', valor: 35 }] }],
      },
      { texto: 'Deixar', resultados: [nada('Conhecimento demais pode ser perigoso.')] },
    ],
  },
  {
    id: 'pactoDeEbano',
    nome: 'Pacto de Ébano',
    icone: '⚔️',
    texto: 'Um cavaleiro da Lâmina de Ébano oferece um pacto de sangue.',
    escolhas: [
      {
        texto: 'Aceitar o pacto',
        dica: '−8% de vida máxima; bênção da Lâmina de Ébano (rara ou melhor)',
        resultados: [{ peso: 1, texto: 'O pacto está selado.', ops: [{ op: 'vidaMax', fracao: -0.08 }, { op: 'ofertaBencao', faccao: 'laminaDeEbano', raridadeMin: 'rara' }] }],
      },
      {
        texto: 'Pedir conselhos',
        dica: '+1 relançamento',
        resultados: [{ peso: 1, texto: '"Escolha bem suas batalhas."', ops: [{ op: 'relancamentos', valor: 1 }] }],
      },
      { texto: 'Recusar', resultados: [nada('Ele dá de ombros e desaparece.')] },
    ],
  },
];

export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function getEvent(id: string): EventDef {
  const e = EVENTS_BY_ID[id];
  if (!e) throw new Error(`Evento desconhecido: ${id}`);
  return e;
}
