# Masmorras de Nortúndria

Roguelite de masmorras com combate automático, ambientado em Nortúndria. É um projeto pessoal de fã, sem assets oficiais: os visuais são formas desenhadas em código.

Stack: Vite, TypeScript (strict), Svelte 5 (interface) e Phaser 4 (só a cena de combate).

## Requisitos
- Node 20+ (testado com Node 24)

## Comandos
```bash
npm install
npm run dev        # servidor de desenvolvimento (abra o endereço mostrado)
npm run build      # build de produção em dist/
npm run check      # svelte-check + tsc (scripts e testes)
npm test           # testes unitários (Vitest)
npm run sim        # simulação headless (campanha: várias corridas reinvestindo Emblemas)
npm run sim -- --jogadores=500 --corridas=10 --semente=abc --classe=mago
npm run diag       # diagnóstico por tipo de encontro (calibração)
npm run duelo      # DPS × sobrevivência de cada especialização
```

## Como jogar
0. No **acampamento** ficam a árvore de Emblemas, as relíquias, a coleção e as opções de save. Começam liberados o Guerreiro e o Mago; Ladino e Sacerdote são liberados por conquistas.
1. Escolha a classe e a especialização (e confira a relíquia equipada e a dificuldade) e clique em **Começar corrida**. A semente é opcional: a mesma semente gera o mesmo mapa e os mesmos combates.
2. No mapa, clique num dos nós que estão brilhando. Passe o mouse sobre um nó para ver o tipo. Inimigos e eventos só aparecem com o mapa revelado (mini-chefe e chefe sempre aparecem).
3. O combate é automático. Você pode pausar, mudar a velocidade (1x/2x/3x) ou resolver na hora com ⏭. Atalhos: **Espaço** pausa e **1/2/3** mudam a velocidade.
4. Depois de cada vitória, escolha 1 de 3 **bênçãos de facção**. A cor indica a raridade. Pegar uma repetida sobe o nível dela. Combinar duas facções específicas libera **bênçãos duplas**, e a carta avisa quando isso acontece. Use **⟳ Relançar** para trocar as opções (limitado).
5. Pelo caminho há **eventos** (escolhas com risco), **vendedor goblin** (gaste o ouro), **fogueira** (curar ou aprimorar uma bênção) e **tesouros**.
6. **Consumíveis** são usados no mapa, pelo painel da build, antes de escolher o próximo nó.
7. Vença o mini-chefe no meio e o chefe na última linha. Cuidado com as mecânicas deles.
8. Ganhando ou perdendo, você recebe **Emblemas** para a árvore permanente. Elites e chefes podem deixar **relíquias**. Vencer no Normal libera o **Heroico**.

## Save
O jogo salva sozinho no navegador (`localStorage`) a cada ação. Uma corrida em andamento continua do mesmo nó ao reabrir a página. Na aba **Opções** dá para exportar e importar o progresso como um código Base64, ou apagar tudo.

## Estrutura
```
src/game/          lógica pura (sem Svelte/Phaser, RNG com semente)
  rng.ts           gerador determinístico
  formulas.ts      todas as fórmulas e constantes de balanceamento
  types.ts         tipos centrais
  stats.ts         atributos + modificadores
  combat/          motor de combate em ticks fixos
  combatants.ts    monta herói e inimigos a partir dos dados
  map.ts           geração do mapa com caminhos
  meta.ts          progressão permanente (Emblemas, árvore, relíquias, conquistas)
  save.ts          save versionado, migração, Base64
  run.ts           estado da corrida e ações
  ai.ts            perfis de jogador da simulação
  simulate.ts      corrida headless completa
  blessings.ts     regras de bênçãos (escala, ofertas, duplas, tags)
  data/            classes, inimigos, masmorras, status, facções, bênçãos, itens, eventos
src/battle/        cena Phaser (só anima eventos; carregada sob demanda)
src/ui/            interface Svelte
  game.svelte.ts   ponte reativa ($state) + laço do combate
  screens/         telas (acampamento e abas, mapa, combate, recompensa, fogueira…)
  components/      barras, carta de bênção, painel da build
scripts/           sim.ts (campanha), diag.ts, duelo.ts
tests/             Vitest
```

As regras e fórmulas atuais estão em [DESIGN.md](DESIGN.md).

## Fases
1. ✅ Engine pura, combate, 2 classes, simulação
2. ✅ Mapa com caminhos + interface do mapa + tela de combate (Phaser)
3. ✅ Bênçãos de facção, duplas, eventos, fogueira, vendedor, consumíveis, chefes
4. ✅ Progressão permanente, desbloqueios, Heroico, save completo (+ Proteção, Gelo, Ladino e Sacerdote)
5. ✅ Calibração de dificuldade e acabamento visual (veja a seção 8 do DESIGN.md)
