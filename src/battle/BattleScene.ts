/**
 * Cena de combate do Phaser. SÓ ANIMA: recebe CombatEvent e nunca altera o estado do jogo.
 * Visual provisório com formas simples (troque por sprites depois, mantendo a mesma interface).
 */

import Phaser from 'phaser';
import type { CombatEvent, EnemyTier, Escola, Side } from '../game/types';

export interface BonecoSetup {
  uid: string;
  nome: string;
  side: Side;
  cor: string;
  tier: EnemyTier | null;
  classe: string | null;
}

export const LARGURA = 800;
export const ALTURA = 360;

const COR_ESCOLA: Record<Escola, string> = {
  fisico: '#f2f2f2',
  fogo: '#ff8a3d',
  gelo: '#8fd8ff',
  arcano: '#e58cff',
  sombra: '#b28cff',
  sagrado: '#ffe27a',
  natureza: '#7ee07e',
};

const ESCALA_TIER: Record<EnemyTier, number> = { normal: 1, elite: 1.25, miniChefe: 1.45, chefe: 1.7 };

interface Boneco {
  setup: BonecoSetup;
  container: Phaser.GameObjects.Container;
  corpo: Phaser.GameObjects.Shape;
  gelo: Phaser.GameObjects.Ellipse;
  escudo: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  altura: number;
  morto: boolean;
}

function hex(c: string): number {
  return Number.parseInt(c.replace('#', ''), 16);
}

/** Posições: herói à esquerda; até 3 inimigos à direita (o primeiro é a linha de frente). */
function posicoes(n: number): { x: number; y: number }[] {
  const base = [
    { x: 520, y: 250 },
    { x: 640, y: 200 },
    { x: 700, y: 290 },
  ];
  if (n === 1) return [{ x: 580, y: 250 }];
  return base.slice(0, n);
}

/** Posições extras para inimigos invocados no meio do combate. */
const POS_INVOCACAO = [
  { x: 700, y: 305 },
  { x: 760, y: 280 },
  { x: 650, y: 330 },
  { x: 750, y: 335 },
];

export type ResolverBoneco = (uid: string) => BonecoSetup | undefined;

export class BattleScene extends Phaser.Scene {
  private bonecos = new Map<string, Boneco>();
  private fila: CombatEvent[][] = [];
  private pronto = false;
  private setupInicial: BonecoSetup[];
  private resolver: ResolverBoneco;
  private invocados = 0;
  private velocidade = 1;
  private pausado = false;
  private vidaMax = new Map<string, number>();
  /** Respeita "reduzir movimento" do sistema: sem tremores nem neve. */
  private readonly calmo = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(setup: BonecoSetup[], resolver: ResolverBoneco) {
    super({ key: 'batalha' });
    this.setupInicial = setup;
    this.resolver = resolver;
  }

  create(): void {
    this.desenharCenario();
    const inimigos = this.setupInicial.filter((s) => s.side === 'inimigo');
    const pos = posicoes(inimigos.length);
    for (const s of this.setupInicial) {
      if (s.side === 'heroi') this.criarBoneco(s, 200, 250);
      else {
        const p = pos[inimigos.indexOf(s)] ?? { x: 600, y: 250 };
        this.criarBoneco(s, p.x, p.y);
      }
    }
    this.pronto = true;
    this.setVelocidade(this.velocidade);
    this.setPausa(this.pausado);
    for (const evs of this.fila) this.receber(evs);
    this.fila = [];
  }

  /** Entrada única de dados da cena. */
  receber(evs: CombatEvent[]): void {
    if (!this.pronto) {
      this.fila.push(evs);
      return;
    }
    for (const e of evs) this.animar(e);
  }

  setVelocidade(v: number): void {
    this.velocidade = v;
    if (!this.pronto) return;
    this.tweens.timeScale = v;
    this.time.timeScale = v;
  }

  setPausa(p: boolean): void {
    this.pausado = p;
    if (!this.pronto) return;
    if (p) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = p;
  }

  // ---------------------------------------------------------------------

  private desenharCenario(): void {
    const g = this.add.graphics();
    // Céu noturno de Nortúndria
    g.fillGradientStyle(0x07101f, 0x07101f, 0x1b2c4a, 0x1b2c4a, 1);
    g.fillRect(0, 0, LARGURA, ALTURA);
    // Estrelas
    for (let i = 0; i < 50; i++) {
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.7));
      g.fillCircle(Phaser.Math.Between(0, LARGURA), Phaser.Math.Between(0, 170), Phaser.Math.FloatBetween(0.5, 1.4));
    }
    // Lua
    g.fillStyle(0xdfeaf5, 0.9);
    g.fillCircle(110, 62, 22);
    g.fillStyle(0x07101f, 0.9);
    g.fillCircle(120, 56, 20);
    // Aurora (faixas translúcidas que respiram)
    const aurora = this.add.graphics();
    const cores = [0x3fe0b0, 0x55c8ff, 0x8a7dff];
    cores.forEach((c, i) => {
      aurora.fillStyle(c, 0.07);
      aurora.fillEllipse(420 + i * 60, 70 + i * 14, 620 - i * 80, 46 - i * 8);
    });
    if (!this.calmo) this.tweens.add({ targets: aurora, alpha: 0.45, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Montanhas
    g.fillStyle(0x16243b, 1);
    g.fillTriangle(-40, 300, 140, 120, 320, 300);
    g.fillTriangle(220, 300, 420, 96, 620, 300);
    g.fillStyle(0xdfeaf5, 0.8);
    g.fillTriangle(400, 118, 420, 96, 442, 122);
    g.fillTriangle(124, 140, 140, 120, 158, 144);
    // Fortaleza Utgarde no penhasco (silhueta)
    g.fillStyle(0x0f1a2c, 1);
    g.fillTriangle(560, 300, 700, 170, 860, 300);
    g.fillRect(640, 150, 110, 60);
    g.fillRect(630, 120, 22, 90);
    g.fillRect(735, 110, 24, 100);
    g.fillTriangle(626, 120, 641, 92, 656, 120);
    g.fillTriangle(731, 110, 747, 80, 763, 110);
    g.fillStyle(0xffb347, 0.75);
    for (const [x, y] of [[660, 170], [690, 165], [715, 172], [640, 140], [745, 132]] as const) g.fillRect(x, y, 4, 7);
    // Chão gelado
    g.fillStyle(0x24364f, 1);
    g.fillRect(0, 300, LARGURA, 60);
    g.fillStyle(0x31496a, 1);
    g.fillRect(0, 296, LARGURA, 6);
    g.fillStyle(0x3d5a80, 0.5);
    for (let x = 0; x < LARGURA; x += 46) g.fillRect(x + Phaser.Math.Between(0, 20), Phaser.Math.Between(310, 350), Phaser.Math.Between(14, 30), 2);
    // Neve caindo
    if (this.calmo) return;
    for (let i = 0; i < 40; i++) {
      const floco = this.add.circle(Phaser.Math.Between(0, LARGURA), Phaser.Math.Between(-ALTURA, ALTURA), Phaser.Math.Between(1, 2), 0xffffff, 0.6);
      this.tweens.add({
        targets: floco,
        y: ALTURA + 10,
        x: floco.x + Phaser.Math.Between(-40, 40),
        duration: Phaser.Math.Between(6000, 12000),
        repeat: -1,
        onRepeat: () => floco.setPosition(Phaser.Math.Between(0, LARGURA), -10),
      });
    }
  }

  private criarBoneco(s: BonecoSetup, x: number, y: number): void {
    const esc = s.tier ? ESCALA_TIER[s.tier] : 1.1;
    const cor = hex(s.cor);
    const container = this.add.container(x, y);
    const altura = 70 * esc;
    const largura = 36 * esc;

    const sombra = this.add.ellipse(0, 4, largura * 1.6, 12, 0x000000, 0.35);
    let corpo: Phaser.GameObjects.Shape;
    if (s.side === 'heroi') {
      corpo = this.add.rectangle(0, -altura / 2, largura, altura, cor).setStrokeStyle(2, 0xffffff, 0.6);
      const cabeca = this.add.circle(0, -altura - 12, 13, 0xf1d3b0).setStrokeStyle(2, 0xffffff, 0.4);
      // Arma provisória por classe (troque por sprites depois).
      const extras: Phaser.GameObjects.GameObject[] = [];
      if (s.classe === 'mago' || s.classe === 'sacerdote') {
        extras.push(this.add.rectangle(largura / 2 + 8, -altura / 2 - 6, 5, altura + 20, s.classe === 'mago' ? 0x8b5a2b : 0xd8d0b0));
        extras.push(this.add.circle(largura / 2 + 8, -altura - 18, 7, s.classe === 'mago' ? 0x69ccf0 : 0xffe27a));
      } else if (s.classe === 'ladino') {
        extras.push(this.add.rectangle(largura / 2 + 8, -altura / 2, 5, altura * 0.55, 0xc0c8d0).setAngle(20));
        extras.push(this.add.rectangle(-largura / 2 - 8, -altura / 2, 5, altura * 0.55, 0xc0c8d0).setAngle(-20));
      } else {
        extras.push(this.add.rectangle(largura / 2 + 10, -altura / 2 - 10, 7, altura, 0xc0c8d0));
        extras.push(this.add.triangle(largura / 2 + 10, -altura - 14, 0, 16, 12, 16, 6, 0, 0xc0c8d0));
      }
      container.add([sombra, corpo, cabeca, ...extras]);
    } else {
      const chefe = s.tier === 'chefe' || s.tier === 'miniChefe';
      if (chefe) {
        // Aura pulsante dos chefes
        const aura = this.add.circle(0, -altura / 2, altura * 0.75, s.tier === 'chefe' ? 0x8a2be2 : 0xff8a3d, 0.14);
        container.add(aura);
        if (!this.calmo) this.tweens.add({ targets: aura, scale: 1.15, alpha: 0.05, duration: 1400, yoyo: true, repeat: -1 });
      }
      if (s.tier === 'elite' || chefe) {
        // Losango com contorno vermelho (elite) ou dourado (chefes)
        corpo = this.add
          .polygon(0, -altura / 2, [largura, 0, largura * 2, altura * 0.45, largura * 1.4, altura, largura * 0.6, altura, 0, altura * 0.45], cor)
          .setStrokeStyle(3, chefe ? 0xe6c35c : 0xe0533d, 0.9);
      } else {
        corpo = this.add.triangle(0, -altura / 2, 0, altura, largura * 2, altura, largura, 0, cor).setStrokeStyle(2, 0x000000, 0.5);
      }
      const olho1 = this.add.circle(-7 * esc, -altura * 0.45, 3 * esc, chefe ? 0xff4040 : 0xffe27a);
      const olho2 = this.add.circle(7 * esc, -altura * 0.45, 3 * esc, chefe ? 0xff4040 : 0xffe27a);
      container.add([sombra, corpo, olho1, olho2]);
      if (chefe) {
        const coroa = this.add.triangle(0, -altura - 4, 0, 18, 24, 18, 12, 0, 0xe6c35c);
        container.add(coroa);
      }
    }
    const gelo = this.add
      .ellipse(0, -altura / 2, largura * 2.4, altura * 1.25, 0x8fd8ff, 0.3)
      .setStrokeStyle(2, 0xdff4ff, 0.8)
      .setVisible(false);
    const escudo = this.add.circle(0, -altura / 2, altura * 0.8, 0xffe27a, 0.12).setStrokeStyle(2, 0xffe27a, 0.7).setVisible(false);
    container.add([gelo, escudo]);

    // Respiração ociosa
    this.tweens.add({ targets: corpo, scaleY: 1.03, duration: Phaser.Math.Between(900, 1200), yoyo: true, repeat: -1 });

    this.bonecos.set(s.uid, { setup: s, container, corpo, gelo, escudo, x, y, altura, morto: false });
  }

  private animar(e: CombatEvent): void {
    switch (e.tipo) {
      case 'dano': {
        const alvo = this.bonecos.get(e.para);
        if (!alvo) return;
        if (e.origem.tipo === 'ataque' || e.origem.tipo === 'habilidade') this.investida(e.de, alvo);
        this.impacto(alvo, e.critico);
        if (e.valor > 0 && e.origem.tipo !== 'status') this.faiscas(alvo, COR_ESCOLA[e.escola], e.critico ? 10 : 5);
        // Golpe pesado no herói: clarão vermelho nas bordas
        const max = this.vidaMax.get(e.para) ?? 0;
        if (alvo.setup.side === 'heroi' && max > 0 && e.valor >= max * 0.12 && !this.calmo) this.cameras.main.flash(160, 160, 20, 20);
        const texto = e.valor > 0 ? `${e.valor}${e.critico ? '!' : ''}` : 'absorvido';
        this.numero(alvo, texto, e.valor > 0 ? COR_ESCOLA[e.escola] : '#e6c35c', e.critico ? 30 : e.origem.tipo === 'status' ? 15 : 20);
        break;
      }
      case 'cura': {
        const alvo = this.bonecos.get(e.para);
        if (alvo) this.numero(alvo, `+${e.valor}`, '#5fd38d', 18);
        break;
      }
      case 'statusAplicado': {
        const alvo = this.bonecos.get(e.para);
        if (!alvo) return;
        if (e.status === 'congelamento') alvo.gelo.setVisible(true);
        if (e.status === 'escudo') alvo.escudo.setVisible(true);
        break;
      }
      case 'statusExpirou': {
        const alvo = this.bonecos.get(e.para);
        if (!alvo) return;
        if (e.status === 'congelamento') alvo.gelo.setVisible(false);
        if (e.status === 'escudo') alvo.escudo.setVisible(false);
        break;
      }
      case 'habilidade': {
        const b = this.bonecos.get(e.de);
        if (!b) return;
        this.numero(b, e.nome, e.suprema ? '#ffb347' : '#e6c35c', e.suprema ? 22 : 15, -30);
        if (e.suprema) {
          if (!this.calmo) this.cameras.main.shake(250, 0.008);
          this.cameras.main.flash(200, 255, 200, 120);
        }
        break;
      }
      case 'morte': {
        const b = this.bonecos.get(e.uid);
        if (!b || b.morto) return;
        b.morto = true;
        b.gelo.setVisible(false);
        b.escudo.setVisible(false);
        this.tweens.killTweensOf(b.container);
        this.faiscas(b, b.setup.cor, 16, 60);
        this.tweens.add({ targets: b.container, alpha: 0.15, angle: b.setup.side === 'heroi' ? -80 : 80, y: b.y + 8, duration: 600, ease: 'Quad.easeIn' });
        break;
      }
      case 'invocacao': {
        this.vidaMax.set(e.uid, e.vidaMax);
        if (this.bonecos.has(e.uid)) return;
        const s = this.resolver(e.uid);
        if (!s) return;
        const p = POS_INVOCACAO[this.invocados++ % POS_INVOCACAO.length] as { x: number; y: number };
        this.criarBoneco(s, p.x, p.y);
        const b = this.bonecos.get(e.uid);
        if (b) {
          b.container.setAlpha(0).setScale(0.3);
          this.tweens.add({ targets: b.container, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut' });
        }
        break;
      }
      case 'mecanica': {
        const b = this.bonecos.get(e.de);
        if (!b) return;
        this.numero(b, e.nome, e.aviso ? '#ff5050' : '#ffb347', 20, -45);
        if (e.aviso) {
          const brilho = this.add.circle(b.x, b.y - b.altura / 2, b.altura * 0.9, 0xff3030, 0.25);
          this.tweens.add({ targets: brilho, alpha: 0, scale: 1.4, duration: 450, repeat: 3, onComplete: () => brilho.destroy() });
        } else {
          if (!this.calmo) this.cameras.main.shake(180, 0.005);
        }
        break;
      }
      case 'inicio':
        for (const c of e.combatentes) this.vidaMax.set(c.uid, c.vidaMax);
        break;
      case 'fim':
        break;
    }
  }

  private investida(uid: string, alvo: Boneco): void {
    const b = this.bonecos.get(uid);
    if (!b || b.morto || b === alvo) return;
    const dir = Math.sign(alvo.x - b.x) || 1;
    this.tweens.killTweensOf(b.container);
    b.container.setPosition(b.x, b.y);
    this.tweens.add({ targets: b.container, x: b.x + dir * 28, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  private impacto(b: Boneco, critico: boolean): void {
    if (b.morto) return;
    this.tweens.add({ targets: b.corpo, alpha: 0.35, duration: 60, yoyo: true });
    if (critico && !this.calmo) this.cameras.main.shake(120, 0.004);
  }

  /** Pequena explosão de partículas (formas simples) no alvo. */
  private faiscas(b: Boneco, cor: string, n: number, raio = 36): void {
    if (this.calmo) return;
    const c = hex(cor);
    for (let i = 0; i < n; i++) {
      const p = this.add.circle(b.x + Phaser.Math.Between(-8, 8), b.y - b.altura / 2 + Phaser.Math.Between(-10, 10), Phaser.Math.Between(2, 4), c, 0.9);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(raio / 2, raio);
      this.tweens.add({
        targets: p,
        x: p.x + Math.cos(ang) * dist,
        y: p.y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(250, 450),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private numero(b: Boneco, texto: string, cor: string, tamanho: number, dy = 0): void {
    const t = this.add
      .text(b.x + Phaser.Math.Between(-18, 18), b.y - b.altura - 30 + dy, texto, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${tamanho}px`,
        fontStyle: 'bold',
        color: cor,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }
}
