# DESIGN: Masmorras de Nortúndria

Documento vivo com as regras e fórmulas **atuais**. As constantes estão em `src/game/formulas.ts`, e os números de classes e inimigos em `src/game/data/`.

**Estado: fase 5 (MVP completo).** Dificuldade calibrada pela simulação até bater as metas (seção 8) e acabamento visual.

---

## 1. Arquitetura

| Pasta | Papel | Regra |
|---|---|---|
| `src/game/` | Lógica pura (estado, regras, combate, corrida) | Não importa Svelte nem Phaser e não usa o gerador global. Há teste que verifica. |
| `src/game/data/` | Conteúdo declarativo | Conteúdo novo entra aqui, sem mexer na engine. |
| `src/game/formulas.ts` | Fórmulas e constantes de balanceamento | Ponto único de calibração. |
| `src/battle/` | Cena Phaser | Só escuta `CombatEvent`; nunca altera o estado. Carregada sob demanda. |
| `src/ui/` | Componentes Svelte | Toda a interface é HTML/DOM; o canvas tem só animação. |
| `src/ui/game.svelte.ts` | Ponte reativa | Guarda o `RunState` em `$state` e roda o laço do combate. |
| `scripts/sim.ts` | Simulação headless (`npm run sim`) | |

### Determinismo
- `Rng` (sfc32 + hash cyrb128) com semente em texto. Todo sorteio recebe um `Rng` explícito.
- A corrida não guarda um RNG "corrente": cada sorteio usa um **fluxo derivado** de `semente + rótulos fixos`:
  - mapa (tipos, inimigos, eventos): `Rng.from(semente, 'mapa')`
  - combate do nó: `Rng.from(semente, 'combate', idDoNó)`
  - oferta de bênçãos: `Rng.from(semente, 'oferta', idDoNó, origem, nºDoRelançamento)`
  - resultado de evento: `Rng.from(semente, 'evento', idDoNó, escolha)`
  - estoque do vendedor: `Rng.from(semente, 'loja', idDoNó)`
- Por isso, mesma semente + mesmas escolhas = mesma corrida, e um save retomado no nó atual repete o mesmo combate. Fechar o jogo no meio de um combate e voltar não muda o resultado.

---

## 2. Atributos

| Atributo | Significado |
|---|---|
| `vidaMax` | Vida máxima (inteira) |
| `recursoMax` | Máximo de Fúria, Energia ou Mana |
| `dano` | Dano base por golpe; as habilidades escalam sobre ele |
| `aps` | Ataques automáticos por segundo |
| `critChance` | 0..1 |
| `critDano` | Multiplicador do crítico (1,5 = +50%) |
| `armadura` | Redução percentual de dano direto |

**Modificadores:** `final = (base + Σadd) × (1 + Σmult)`, depois os tetos:

| Teto | Valor |
|---|---|
| armadura | ≤ 75% |
| crítico | ≤ 100% |
| aps | entre 0,2 e 5 |
| lentidão | ≤ 70% |

---

## 3. Combate

- O combate roda em **ticks fixos de 0,05 s** de jogo. A velocidade 1x/2x/3x só muda quantos ticks rodam por quadro, então o resultado é idêntico em qualquer velocidade.
- A cada tick, cada combatente vivo segue esta ordem (herói primeiro, depois os inimigos na ordem):
  1. Status: DoTs causam dano a cada 1 s; durações diminuem; o que expira é removido.
  2. Regeneração de recurso.
  3. Gatilhos de `intervalo` e `vidaAbaixo`.
  4. **Congelado:** nada mais avança neste tick (ataque, recargas, suprema).
  5. A suprema carrega por tempo e dispara sozinha quando cheia.
  6. Recarga global (GCD) de 1 s: tenta as habilidades em ordem de prioridade (custo, recarga e condição); usa no máximo 1.
  7. O ataque automático acontece a cada `1/aps` s. A lentidão faz o timer andar `(1 − lentidão)` mais devagar.
- **Alvo:** o primeiro inimigo vivo (a "linha de frente"). Também existem `todosInimigos`, `inimigoAleatorio`, `self` e `atacante`.
- **Primeiro ataque:** acontece entre 30% e 80% do intervalo (sorteado), para dessincronizar os combatentes.
- **Fim do combate:** o herói morre (derrota), todos os inimigos morrem (vitória, incluindo os invocados) ou o combate passa de **120 s** (derrota por exaustão). Se o herói e o último inimigo morrem no mesmo tick, conta como derrota.
- **Relógio:** é uma contagem inteira de ticks (`t = ticks × 0,05`), para não acumular erro de ponto flutuante.

### Dano direto (ataques, habilidades, gatilhos)
```
v = valor × U(0,9 ; 1,1)                       # variância ±10%
v ×= Π(1 + danoMult dos CondMods aplicáveis) × (1 + Enfurecido) × enrage.dano
crítico se rng < critChance + Σ critChanceExtra   →  v ×= critDano
v ×= 1 − armadura            (físico)
v ×= 1 − armadura × 0,5      (mágico)
dano = max(1, arredondar(v));  o escudo absorve primeiro
```
**Dano periódico (DoT):** o valor é fixado na aplicação (`potência × pilhas` por tique). Não tem variância, não crita, ignora armadura e bônus. O escudo absorve.

### Status
| Status | Efeito | Reaplicar |
|---|---|---|
| Queimadura (fogo) | DoT | renova (maior potência) |
| Sangramento (físico) | DoT | acumula até 5 pilhas |
| Veneno (natureza) | DoT | acumula até 5 pilhas |
| Doença (sombra) | DoT; cura recebida −50% | renova |
| Lentidão | −potência% na velocidade de ataque (até 70%) | renova |
| Congelamento | Sem ataques, habilidades nem mecânicas temporizadas. Em elite, mini-chefe e chefe: dura **metade** e, ao acabar, deixa o alvo **imune por 4 s** | renova |
| Escudo | Absorve dano até esgotar | renova (maior valor) |
| Enfurecido | +potência% de dano | renova |

### Recursos
| Recurso | Máximo | Início | Ganho |
|---|---|---|---|
| Fúria (Guerreiro) | 100 | 0 | +12 por ataque automático; +80 × (dano recebido / vida máxima) |
| Energia (Ladino) | 100 | cheio | 12/s |
| Mana (Mago, Sacerdote) | 300 | cheio | 5/s |
| Runas (Cavaleiro da Morte) | 6 | cheio | 0,6/s (provisório; mecânica própria depois) |

### Suprema
Carga de 0 a 100. Ganha carga por segundo, por acerto (ataque ou habilidade) e por dano recebido (proporcional à vida máxima). Ao encher, dispara e volta a 0.

### Efeitos declarativos
Habilidades, supremas, gatilhos, bênçãos, itens e mecânicas de chefe são **dados**. O efeito é `dano | cura | escudo | status | recurso | cargaSuprema | perderVida | invocar`, e o valor é calculado pela `Escala`:
```
valor = base + dano×Dano + vidaMax×VidaMax + danoCausado×(dano do evento)
```
Exemplo: roubo de vida de 10% = `{ danoCausado: 0.1 }` num gatilho `aoAtacar`.

- `perderVida` tira uma fração da vida máxima direto: sem armadura, escudo ou gatilhos, e pode matar. É o custo das maldições.
- `invocar` cria inimigos no meio do combate, até um máximo de invocações vivas.

### Gatilhos
`inicioCombate`, `aoAtacar`, `aoCritar`, `aoReceberDano`, `aoMatar`, `aoUsarHabilidade`, `aoUsarSuprema`, `intervalo` (a cada N s) e `vidaAbaixo` (uma vez por combate). Aceitam `chance`, `recargaInterna` e `condicao`. **Sem cascata:** efeitos disparados por um gatilho não disparam outros gatilhos.

### Bônus condicionais (`CondMod`)
`danoMult` e/ou `critChanceExtra` quando o alvo tem um status, está abaixo ou acima de X% de vida ou o dano é de uma escola ou fonte específica. Exemplo, o "Estilhaçar": `{ quando: { alvoComStatus: 'congelamento' }, critChanceExtra: 1 }`.

---

## 4. Classes

Desbloqueio: Guerreiro e Mago desde o início; Ladino com a conquista "Diante do Capitão" (chegar ao mini-chefe); Sacerdote com "Caçador de Elites" (vencer uma elite).

Tabela gerada a partir de `data/classes.ts` (valores calibrados na fase 5):

| Classe | Vida | Dano | APS | Crít | Armad. | Recurso |
|---|---|---|---|---|---|---|
| Guerreiro | 170 | 12 | 0,8 | 5% (×1,5) | 15% | Fúria |
| Mago | 135 | 12 | 0,7 | 8% (×1,5) | 8% | Mana |
| Ladino | 150 | 8 | 1,15 | 10% (×1,6) | 10% | Energia |
| Sacerdote | 140 | 10 | 0,7 | 6% (×1,5) | 5% | Mana |

| Especialização | Modificadores | Habilidades (em ordem de prioridade) | Suprema |
|---|---|---|---|
| Guerreiro / Armas | — | **Executar** (25 fúria, 0 s): Golpe brutal em alvos com menos de 20% de vida.<br>**Golpe Mortal** (30 fúria, 6 s): Golpe poderoso que causa 260% do dano.<br>**Dilacerar** (10 fúria, 3 s): Aplica Sangramento (30% do dano por segundo, 9 s). | **Tempestade de Lâminas**: Gira com a arma e atinge todos os inimigos com 250% do dano. |
| Guerreiro / Proteção | vidaMax +5%, armadura +3%, dano -24% | **Golpe de Escudo** (20 fúria, 8 s): Causa 160% do dano e ganha um escudo de 5% da vida máxima.<br>**Revanche** (5 fúria, 4 s): Contra-ataque rápido: 130% do dano.<br>**Trovoada** (15 fúria, 10 s): Atinge todos com 70% do dano e aplica Lentidão de 15% por 5 s. | **Muralha de Escudos**: Escudo de 20% da vida máxima e 150% do dano em todos os inimigos. |
| Mago / Fogo | vidaMax +8% | **Ignição Pirolítica** (80 mana, 12 s): Grande bola de fogo: 340% do dano e Queimadura (40% do dano por segundo, 6 s).<br>**Brasa Viva** (25 mana, 0 s): Aplica Queimadura (50% do dano por segundo, 8 s) em alvos sem queimadura.<br>**Impacto Flamejante** (35 mana, 6 s): Rajada instantânea: 220% do dano. | **Chuva de Chamas**: Atinge todos os inimigos com 220% do dano e os incendeia. |
| Mago / Gelo | ataque de gelo, dano -16% | **Lança Gélida** (30 mana, 0 s): Em alvos congelados: 240% do dano como gelo.<br>**Nova Congelante** (60 mana, 18 s): Congela todos os inimigos por 2,5 s e causa 60% do dano.<br>**Seta de Gelo** (25 mana, 2,5 s): 160% do dano como gelo e Lentidão de 15% por 4 s. | **Nevasca Glacial**: 160% do dano como gelo em todos os inimigos e os congela por 1,5 s. |
| Ladino / Assassinato | vidaMax +15% | **Envenenamento** (35 energia, 6 s): Em alvos envenenados: 260% do dano como natureza.<br>**Mutilar** (40 energia, 0 s): 170% do dano e 1 pilha de Veneno (30% do dano por segundo, 8 s).<br>**Veneno Mortal** (25 energia, 6 s): Aplica 2 pilhas de Veneno (30% do dano por segundo, 8 s). | **Vendeta**: Aplica 5 pilhas de Veneno e causa 200% do dano. |
| Ladino / Combate | aps +10%, vidaMax +12% | **Eviscerar** (35 energia, 6 s): Finalizador: 280% do dano.<br>**Fatiar e Picar** (25 energia, 14 s): Fica enfurecido por 10 s (+25% de dano).<br>**Golpe Sinistro** (40 energia, 0 s): 170% do dano. | **Fúria das Lâminas**: 120% do dano em todos os inimigos e +50% de dano por 8 s. |
| Sacerdote / Sombra | ataque de sombra, vidaMax +10% | **Palavra Sombria: Dor** (30 mana, 0 s): Aplica Doença (55% do dano por segundo, 12 s).<br>**Toque Vampírico** (45 mana, 8 s): 120% do dano como sombra e cura 9% da vida máxima.<br>**Açoite Mental** (40 mana, 4 s): 230% do dano como sombra. | **Explosão Mental Sombria**: 250% do dano como sombra em todos os inimigos e cura 10% da vida máxima. |
| Sacerdote / Disciplina | vidaMax +10% | **Palavra de Poder: Escudo** (50 mana, 18 s): Escudo de 15% da vida máxima por 10 s.<br>**Penitência** (35 mana, 6 s): 210% do dano como sagrado e cura 3% da vida máxima.<br>**Castigo** (20 mana, 2 s): 150% do dano como sagrado. | **Barreira Divina**: Escudo de 25% da vida máxima e cura 10%. |

---

## 5. Inimigos e escala

```
vida = base.vida × (1 + 0,10 × linha) × tier × dificuldade × segundaMetade
dano = base.dano × (1 + 0,045 × linha) × tier × dificuldade × segundaMetade
segundaMetade: depois do mini-chefe, comuns e elites têm vida ×1,08 e dano ×1,12
Heroico: vida ×1,5, dano ×1,35
```
O degrau da segunda metade existe para que a morte típica aconteça entre o mini-chefe e a linha anterior ao chefe, e não só no chefe.
Quantidade de inimigos em combates normais:

| Linhas | Inimigos |
|---|---|
| 0–1 | 1 |
| 2–4 | 1–2 |
| 5+ | 1–3 (mais comum: 2) |

Os inimigos da Fortaleza Utgarde (provisórios) estão em `data/enemies.ts`.

### Cardápio de mecânicas de chefe (`BossMechanic`)
Cada chefe ou elite combina mecânicas só por dados. Toda mecânica tem `nome` e `texto`, que aparecem no registro e na cena.

| Mecânica | Parâmetros | Comportamento |
|---|---|---|
| `enrage` | `aposSegundos`, `danoMult`, `apsMult` | A partir do tempo, multiplica dano e velocidade de ataque. |
| `fase` | `abaixoDeVida`, `modificadores`, `efeitos?` | Uma vez ao cruzar o limiar: aplica os modificadores (mantém a fração da vida) e os efeitos. |
| `invocar` | `intervalo`, `inimigoId`, `quantidade`, `max` | A cada intervalo, invoca adds (respeitando o máximo vivo). |
| `escudoRapido` | `aCada`, `valor`, `duracao`, `punicao` | Ganha um escudo; se ainda houver escudo ao fim da duração, aplica a punição. |
| `autocura` | `aCada`, `fracaoVida` | Cura uma fração da vida máxima. |
| `golpeForte` | `aCada`, `aviso`, `efeitos` | Avisa (evento `aviso`) e, `aviso` segundos depois, aplica os efeitos. |

- Todas as mecânicas aceitam `primeiraEm` para definir o primeiro disparo.
- As temporizadas pausam enquanto o chefe está congelado. `enrage` e `fase` não pausam.

| Chefe (provisório) | Mecânicas |
|---|---|
| Capitão da Guarda Ymirjar (mini-chefe; vida base 290, dano 7,5) | Golpe Devastador (220% a cada 11 s, aviso de 2 s, primeiro aos 7 s); Segundo Fôlego (autocura de 6% a cada 14 s) |
| Senhor da Guerra de Utgarde (chefe; vida base 285, dano 6,5) | Golpe Sombrio (190% a cada 12 s, aviso de 2 s); Barreira Profana (escudo de 10% da vida a cada 18 s; se não for quebrado em 5 s, 250% de dano); Fúria de Utgarde (abaixo de 50% da vida: +25% de dano e invoca 2 Escravos); Ira Implacável (enrage aos 75 s: dano ×1,6, velocidade ×1,4) |

---

## 6. Corrida e mapa

### Geração do mapa (`src/game/map.ts`, constantes em `formulas.MAPA`)
- A Fortaleza Utgarde tem 15 linhas, numeradas de 0 a 14 e desenhadas de baixo para cima.
- O jogador vê o mapa inteiro.

| Linha | Conteúdo |
|---|---|
| 0 | 2–3 combates |
| 7 (meio) | **Mini-chefe**, nó único |
| 13 (penúltima) | Só fogueiras, então todo caminho passa por uma antes do chefe |
| 14 (última) | **Chefe**, nó único |
| demais | 2–3 nós com tipo sorteado por peso |

- **Pesos dos tipos de nó:**

| Tipo | Peso |
|---|---|
| combate | 46 |
| evento | 20 |
| elite | 11 |
| fogueira | 8 |
| vendedor | 8 |
| tesouro | 7 |

- **Restrições:**
  - Nada de elites nas 3 primeiras linhas.
  - Nada de fogueira nas linhas 0–2 nem na linha logo antes da fileira de fogueiras.
  - Um vendedor nunca está ligado direto a outro vendedor.
  - O mapa tem **pelo menos 2 elites**. Se faltar, combates elegíveis viram elite.
- **Ligações:**
  - Cada nó liga ao nó mais próximo (por posição) da linha seguinte.
  - Um nó da linha seguinte que fique sem entrada recebe uma ligação do nó mais próximo.
  - Cada nó tem 35% de chance de ganhar uma ligação extra para o vizinho.
  - **As ligações nunca se cruzam.** Todo nó tem entrada e saída.
- Os inimigos de cada nó de combate são sorteados na geração. O mapa é o "plano" da corrida.

- Nós de evento recebem um evento sorteado na geração, sem repetir enquanto houver eventos novos.
- Inimigos e eventos só aparecem na dica do nó com o **mapa revelado** (Brann). Mini-chefe e chefe são sempre visíveis.

### Fluxo da corrida
`mapa → (combate | nó) → (recompensa) → mapa → … → fim`

| Nó | Resolução |
|---|---|
| Combate / Elite / Mini-chefe | Combate; ao vencer, oferta de 3 bênçãos (elite e mini-chefe: rara ou melhor) |
| Chefe | Combate; vencer encerra a corrida com vitória |
| Fogueira | **Descansar** (cura 30%) **ou aprimorar** uma bênção (+1 nível) |
| Tesouro | Oferta de 3 bênçãos, incomum ou melhor |
| Evento | Texto com 2–3 escolhas → resultado sorteado → (oferta ou emboscada) |
| Vendedor | Compra com ouro; sai quando quiser |

- **A vida persiste entre combates.** Cada vitória cura **12%** da vida máxima (mais o bônus da árvore).
- **Ouro por vitória:** normal 15, elite 35, mini-chefe 60.
- **Ganho de vida máxima também cura o mesmo valor.** Perda de vida máxima apenas limita a vida atual.

---

## 6a. Bênçãos de facção

**Dados:** `data/blessings.ts`. **Regras:** `src/game/blessings.ts`.

| Facção | Estilo |
|---|---|
| Kirin Tor | Arcano, crítico |
| Cruzada Argêntea | Defesa, escudos, cura |
| Cavaleiros da Lâmina de Ébano | Drenar vida, doença |
| Filhos de Hodir | Gelo, lentidão, congelamento |

- Cada facção ativa tem **8 bênçãos**. A Aliança Cinérea e os Oráculos já estão previstos, mas inativos.
- **Bênção = dado:** id, facção, tags, descrição com `{chave}` / `{chave%}`, `valores` na raridade comum e nível 1, `fixos` (valores que não escalam, como chances) e `efeito(valores)`. O efeito devolve modificadores, gatilhos e bônus condicionais.
  - A build é a soma de tudo. A engine não conhece nenhuma bênção específica.
  - Gatilhos e bônus recebem ids únicos (`idDaBênção#n`).
- **Escala:** `valor = base × potência(raridade) × (1 + 0,4 × (nível − 1))`.

| Raridade | Potência | Cor | Peso na oferta |
|---|---|---|---|
| Comum | 1,0 | branco | 60 |
| Incomum | 1,25 | verde | 26 |
| Rara | 1,5 | azul | 10 |
| Épica | 1,8 | roxo | 3,5 |
| Lendária | 2,2 | laranja | 0,5 |

- **Repetida:** pegar uma bênção que já tem dá +1 nível (máximo 5) e fica com a maior raridade.
- **Ofertas:**
  - 3 bênçãos distintas, sorteadas com estes pesos:

| Situação | Peso |
|---|---|
| base | 1 |
| facção favorita da especialização | ×1,6 |
| já possuída | ×0,8 |
| dupla liberada | ×1,5 |

  - Bênçãos no nível máximo não aparecem.
  - **Raridade mínima:** elite e mini-chefe = rara; tesouro = incomum; eventos podem pedir mínimo ou facção.
- **Relançamentos:** 1 por corrida (eventos podem dar mais). Trocam as 3 opções.
- **Duplas** (sempre épicas): aparecem nas ofertas quando o jogador tem ao menos 1 bênção de cada facção do par.

| Dupla | Facções | Efeito |
|---|---|---|
| **Estilhaçar** | Kirin Tor + Filhos de Hodir | Crítico garantido em congelados; críticos têm chance de congelar |
| **Sangue Consagrado** | Cruzada Argêntea + Lâmina de Ébano | Ao matar: escudo + cura |
| **Runa Profana** | Kirin Tor + Lâmina de Ébano | Críticos aplicam Doença; +dano crítico |
| **Bastião Gélido** | Cruzada Argêntea + Filhos de Hodir | Ao apanhar, chance de congelar o atacante; +armadura |

- A carta indica "Libera dupla: …" quando pegá-la completa um par.
- **Tags de sinergia:** Arcano, Crítico, Escudo, Cura, Defesa, Sagrado, Drenar, Doença, Sombra, Gelo, Lentidão, Congelamento… O painel da build mostra a contagem de cada tag.

## 6c. Itens de Saronita (amaldiçoados)

| Item | Bônus | Maldição |
|---|---|---|
| Lâmina | +50% de dano | perde 1% da vida máx./s em combate |
| Couraça | +20% de armadura | −20% de velocidade de ataque |
| Olho | +15% de crítico, +50% de dano crítico | −20% de vida máx. |
| Coração | +40% de vida máx. | −25% de dano |

Vêm do Altar de Saronita. **Purificar** no vendedor (50 de ouro) remove a maldição e mantém o bônus.

## 6d. Consumíveis

- A bolsa guarda até **3**. Os consumíveis são usados **no mapa**, antes de escolher o próximo nó.

| Consumível | Efeito | Preço |
|---|---|---|
| Poção de Cura | Cura 40% na hora | 30 |
| Frasco de Poder Implacável | +25% de dano no próximo combate | 35 |
| Frasco da Rocha | Escudo de 30% da vida no início do próximo combate | 30 |
| Elixir da Precisão | +15% de crítico no próximo combate | 30 |
| Poção de Furor | Começa o próximo combate com recurso cheio e suprema em 50% | 25 |

- Os efeitos "próximo combate" ficam ativos até o fim do próximo combate (inclusive emboscadas).

## 6e. Eventos

- São 10, em `data/events.ts`.
- **Estrutura:** escolhas com dica de risco/custo, requisito de ouro opcional e resultados sorteados por peso.
- **Operações disponíveis:** `vida`, `vidaMax`, `ouro`, `ofertaBencao`, `bencaoAleatoria`, `itemAmaldicoado`, `consumivel`, `modificador`, `relancamentos`, `revelarMapa`, `perderProximaRecompensa` e `combate` (emboscada).
- **Ordem de aplicação:** ofertas e emboscadas acontecem depois que o jogador lê o resultado. As demais operações valem na hora.
- **Lista:** Cultista ferido, Altar de Saronita, Brann Barbabronze, Mercador goblin suspeito, Fonte do Fiorde, Arsenal abandonado, Protodraco preso, Santuário de Hodir, Tomo do Kirin Tor e Pacto de Ébano.

## 6f. Vendedor goblin

| Item | Quantidade / preço |
|---|---|
| Bênçãos | 3 (comum 45, incomum 70, rara 100, épica 150, lendária 220) |
| Consumíveis | 2 |
| Bandagens | Cura 30% por 30 |
| Purificar Saronita | 50 |

---

## 6g. Progressão permanente

**Lógica:** `src/game/meta.ts`. **Dados:** `data/meta.ts`.

### Emblemas
Ganhos em **toda** corrida, inclusive nas derrotas:
```
Emblemas = 2 (participação) + 1,5/nó vencido (arredondado) + 3/elite + 5/mini-chefe + 12/chefe + 10 (vitória)
Heroico: ×1,5   ·   mínimo garantido: 5 (= o nó mais barato da árvore)
```

### Árvore permanente (bônus pequenos de propósito)

| Nó | Efeito por nível | Custos | Requisito |
|---|---|---|---|
| Vigor de Nortúndria | +5% de vida | 5 / 10 / 18 | — |
| Treino de Combate | +4% de dano | 5 / 10 / 18 | — |
| Olho Treinado | +2% de crítico | 10 / 18 | Treino 1 |
| Couraça Reforçada | +2% de armadura | 10 / 18 | Vigor 1 |
| Bolsa Goblin | +10% de ouro | 6 / 14 | — |
| Fôlego de Veterano | +3% de cura pós-combate | 10 / 20 | Vigor 2 |
| Segunda Opinião | +1 relançamento | 12 / 28 | — |
| Alforje do Aventureiro | +1 Poção de Cura inicial | 12 | Bolsa 1 |
| Favor das Facções | Começa escolhendo 1 de 3 bênçãos comuns | 20 | Segunda Opinião 1 |

Árvore cheia = 244 Emblemas. No total: +15% de vida, +12% de dano, +4% de crítico, +4% de armadura e os utilitários.

### Relíquias
- Caem de elites (30%), do mini-chefe (60%) e do chefe (100%), sempre uma ainda não conquistada daquela fonte.
- Ficam permanentemente na coleção, mesmo se o jogador morrer depois.
- Antes da corrida, o jogador equipa **1**. O efeito entra na build como uma bênção.

| Fonte | Relíquias |
|---|---|
| Elite | Presa de Protodraco (+8% de dano), Amuleto Vrykul (+8% de vida), Runa do Inverno (lentidão), Chifre de Guerra (enfurecido no início) |
| Mini-chefe | Insígnia do Capitão (+crítico), Elmo Ymirjar (escudo no início) |
| Chefe | Coroa do Senhor da Guerra (+8% de dano e vida), Lâmina de Utgarde (críticos causam sombra extra) |

### Conquistas e desbloqueios

| Conquista | Condição | Libera |
|---|---|---|
| Diante do Capitão | chegar ao mini-chefe | **Ladino** |
| Caçador de Elites | vencer uma elite | **Sacerdote** |
| Conquistador de Utgarde | vencer no Normal | **Heroico** (inimigos com vida ×1,5 e dano ×1,35; Emblemas ×1,5) |
| Herói de Utgarde | vencer no Heroico | — |
| Persistente | completar 5 corridas | — |

### Coleção
- **Bestiário:** inimigos derrotados, com contagem e mecânicas.
- **Catálogo de bênçãos:** obtidas, só vistas ou desconhecidas.
- **Outros:** conquistas, estatísticas e as 20 últimas corridas.

### Modos Difíceis (só estrutura)
- Os tipos e dados estão em `HARD_MODES` (`data/meta.ts`): cada modo tem pontos por nível e efeito por nível. Exemplos: Fortaleza Reforçada, Fúria Vrykul, Frio Cortante, Impaciência do Senhor.
- `RunState.modosDificeis` já existe, mas fica sempre vazio. **A engine ainda não aplica os modos e não há interface.**

### Fim de corrida
- `finalizarCorrida(meta, run)` é **idempotente**: grava `run.resumoFinal` e não reaplica.
- Ela credita Emblemas, estatísticas, bestiário, catálogo, relíquias, conquistas e histórico.

---

## 6h. Save

**Lógica:** `src/game/save.ts` (puro). Quem acessa o `localStorage` é a ponte.

- **Chave e formato:** `localStorage['nortundria.save']` = JSON de `SaveData { versao, meta, corrida, salvoEm }`.
- **Autosave:** depois de **toda** ação da interface (escolher nó, bênção, comprar, fim de combate…).
- **Retomada:** a corrida salva volta no mesmo nó.
  - Se o jogador fechou durante um combate, o combate recomeça do início do nó. Como a semente é a mesma, o resultado também é.
- **Migração do envelope:** `MIGRACOES[v]` leva a versão v para v+1. Já existe a v0→v1, para o formato de protótipo com a meta solta no topo.
- **Migração da meta:** é completada com valores padrão, então campos novos não quebram saves antigos.
- **Corrida de formato antigo** (`RunState.versao` ≠ atual): é descartada, mas a meta fica.
- **Save de versão mais nova:** é recusado.
- **Exportar/Importar:** Base64 seguro para UTF-8, na aba Opções. Também dá para apagar todo o progresso.

---

## 6b. Interface

- **Acampamento** (tela inicial), com 5 abas:
  - **Jogar:** classe (bloqueadas mostram a conquista necessária) → especialização → relíquia equipada, dificuldade e bônus permanentes → começar, com semente opcional.
  - **Árvore**, **Relíquias** (equipar) e **Coleção** (bestiário, bênçãos, conquistas, histórico).
  - **Opções:** exportar, importar e apagar.
- **Corrida:** mapa (botão Abandonar = derrota com Emblemas; selo Heroico), combate, recompensa (cartas de bênção), fogueira (descansar/aprimorar), tesouro, evento, vendedor.
- **Fim de corrida:** Emblemas detalhados, novas relíquias, conquistas e desbloqueios.
- **Carta de bênção:** cor da raridade, facção, tags, "Nova"/"Nível N", descrição com os números reais e aviso de dupla liberada.
- **Painel da build:** vida, ouro, relançamentos, consumíveis (clicáveis no mapa), sinergias (contagem de tags), bênçãos agrupadas por facção, itens de Saronita e atributos.
- **Tela de combate:**
  - A ponte roda `Combat.step()` em ticks de 0,05 s via `requestAnimationFrame`. A velocidade (1x/2x/3x) multiplica o tempo acumulado. Se a aba fica em segundo plano, cada quadro avança no máximo 0,1 s real.
  - Os eventos são repassados à cena Phaser e ao registro de combate.
  - O botão ⏭ resolve o combate na hora, sem animar.
  - O resultado só é aplicado à corrida quando o jogador clica em "Continuar".
- **Atalhos de teclado:** Espaço pausa ou continua (e "Continuar" no fim), e 1/2/3 mudam a velocidade.
- **A cena Phaser** (`src/battle/`) desenha formas simples, fáceis de trocar por sprites:
  - herói à esquerda (arma provisória por classe) e até 3 inimigos à direita (os invocados aparecem em posições extras);
  - nome das mecânicas sobre o chefe, com brilho vermelho nos avisos;
  - investida ao atacar e números flutuantes coloridos por escola;
  - camada de gelo no congelado e bolha no escudo;
  - tremor e clarão na suprema e queda ao morrer.
- **Layout:** responsivo, sem rolagem horizontal. Foi verificado em 1280×800 e 390×844.

---

## 7. Simulação

`npm run sim -- --jogadores=200 --corridas=10 --semente=abc --classe=mago`

Ferramentas de calibração:

| Comando | O que mostra |
|---|---|
| `npm run diag -- --n=300 --perfil=guloso` | Por especialização, sem progressão: taxa de vitória, vida ao entrar, duração e mortes por tempo, por tipo de encontro (combate, elite, mini-chefe, chefe). |
| `npm run duelo` | DPS de cada especialização contra um boneco e tempo de sobrevivência contra um agressor padrão. Serve para comparar a "potência" (DPS × sobrevivência) entre especializações. |

- **Modo campanha:** cada "jogador" faz `corridas` corridas seguidas com a engine pura.
  - Ao fim de cada uma: ganha Emblemas e relíquias, compra melhorias na árvore e equipa uma relíquia, segundo o seu perfil.
  - Todas as classes ficam liberadas na simulação.
- **Saída por especialização × perfil:**
  - taxa de vitória nas corridas C1, C2–3, C4–6 e C7–10;
  - Emblemas da 1ª corrida (mínimo e média);
  - histograma da linha de morte da 1ª corrida;
  - zonas de morte: antes do mini-chefe · do mini-chefe à penúltima linha · chefe.
  - No fim, confere se o menor ganho numa 1ª corrida paga o nó mais barato da árvore.
- **Perfis** (`src/game/ai.ts`):
  - **`aleatorio`:** qualquer nó, bênção, escolha de evento e opção de fogueira; compra itens aleatórios (50%); usa consumíveis ao acaso (25%).
  - **`guloso` (por sinergia):**
    - **Bênçãos:** pontua cada uma por potência da raridade, +0,3 por bênção que compartilha tag, +0,25 por bênção da mesma facção, +0,3 se for facção favorita, −0,3 se abrir uma 3ª facção, +1,2 se for dupla e +1,5 por dupla que ela libera. Relança se a melhor pontuação for menor que 1,3.
    - **Eventos:** valor esperado das operações.
    - **Fogueira:** descansa abaixo de 55% da vida; senão, aprimora a melhor bênção.
    - **Vendedor:** compra cura se estiver ferido, purifica, compra bênção boa e poção.
    - **Consumíveis:** poção abaixo de 45% de vida; frascos antes de elite, mini-chefe ou chefe.
    - **Mapa:** escolhe pelo valor heurístico do nó conforme a vida atual (`ai.valorDoNo`).
    - **Entre corridas:** compra a árvore numa ordem fixa (dano e vida primeiro) e equipa a relíquia de maior fonte (chefe > mini-chefe > elite).
  - **`aleatorio` entre corridas:** compra nós aleatórios que consegue pagar e equipa uma relíquia aleatória (70%).
- **Calibração:** acontece na fase 5. As metas estão na seção 9 do briefing.

---

## 8. Calibração (fase 5)

### Metas (seção 9 do briefing) e resultado
Medido com `npm run sim -- --jogadores=300 --corridas=10`, perfil guloso, Normal.

| Meta | Resultado |
|---|---|
| 1ª corrida sem progressão: vitória ≤ 5% | ✅ 1,3%–4,7% em todas as 8 especializações |
| Após ~4–6 corridas de Emblemas: 30–50% jogando bem | ✅ 30–48% (C4–6) em todas |
| Build aleatória perde bem mais que build com sinergia | ✅ aleatório 3–13% (C4–6) contra 30–48% do guloso |
| Morte típica entre o mini-chefe e a linha anterior ao chefe | ⚠️ Na maioria das especializações, a maior parte das mortes da 1ª corrida fica nessa faixa (49–66%). Nas mais resistentes (Gelo, Disciplina), a maior parte ainda morre no chefe (50–59%). |
| 1ª corrida sempre paga ao menos 1 melhoria | ✅ mínimo de 8 Emblemas (nó mais barato: 5) |

### O que foi mudado e por quê
1. **Diagnóstico.**
   - Ofensivas (Armas, Fogo, Ladinos, Sombra) perdiam ~70% das lutas contra o mini-chefe em 9–16 s: o golpe forte matava heróis frágeis.
   - Defensivas (Proteção, Disciplina) eram praticamente imortais contra o agressor de referência: escudos e suprema recarregavam rápido demais.
2. **Mini-chefe:** menos burst (golpe 300% → 220%) e mais vida. A luta passa a medir dano e sustentação, não só vida.
3. **Desgaste:** cura pós-combate de 8% → 12%; mais vida base para Mago (120 → 135), Ladino (140 → 150) e Sacerdote (125 → 140).
4. **Defensivas:**
   - escudos menores, recargas maiores;
   - suprema carrega menos com dano recebido (90 → 40);
   - Trovoada com lentidão menor.
5. **Ofensivas:** mais dano nas habilidades principais (Golpe Mortal, Impacto Flamejante, Ignição, Eviscerar, Açoite Mental, venenos, Brasa Viva).
6. **Gelo:**
   - Lança Gélida 300% → 240%;
   - Nova Congelante com recarga maior;
   - Seta de Gelo com lentidão de 15%;
   - dano −16%.
   - **Regra geral nova:** elites e chefes ficam imunes a congelamento por 4 s depois de descongelar. Antes, builds de gelo travavam as mecânicas do chefe.
7. **Escala:**
   - inimigos ganham menos dano e um pouco mais de vida por linha;
   - degrau de dificuldade na segunda metade;
   - chefe com menos vida e dano base, golpe e punição menores.
8. **Progressão:** +1,5 Emblema por nó vencido (antes 1), para a árvore pesar entre a 4ª e a 6ª corrida sem aumentar a 1ª.

### Tabela final (300 jogadores × 10 corridas)
```
Classe/Spec           Perfil          C1    C2–3    C4–6   C7–10   Emb.C1 mín/méd   zonas de morte C1: <mini · mini–penúlt. · chefe
Guerreiro/Armas       Guloso        4.3%   22.0%   45.1%   73.7%          11/23.7   7% · 61% · 32%
Guerreiro/Proteção    Guloso        3.7%   24.3%   48.4%   75.4%          13/24.9   2% · 61% · 37%
Mago/Fogo             Guloso        3.7%   16.2%   31.8%   58.3%          10/23.6   2% · 65% · 33%
Mago/Gelo             Guloso        4.0%   15.8%   35.2%   57.1%          11/24.0   3% · 55% · 42%
Ladino/Assassinato    Guloso        2.7%   14.5%   30.1%   56.2%          13/25.3   3% · 53% · 44%
Ladino/Combate        Guloso        4.7%   16.7%   38.0%   65.3%           8/25.7   4% · 49% · 47%
Sacerdote/Sombra      Guloso        1.3%   15.3%   34.9%   56.6%          11/26.2   3% · 52% · 45%
Sacerdote/Disciplina  Guloso        3.7%   18.8%   41.4%   61.7%          13/28.2   1% · 40% · 59%
(perfil aleatório: C1 0–1%, C4–6 3–13%, C7–10 13–31%)
```
Há teste de regressão leve (`tests/calibracao.test.ts`): o guloso precisa ir mais longe que o aleatório em toda especialização, e a 1ª corrida não pode passar de 10% de vitória numa amostra pequena.
