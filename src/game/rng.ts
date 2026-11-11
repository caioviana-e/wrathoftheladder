/**
 * RNG determinístico (sfc32) com semente em texto.
 * Nunca use o gerador global do JavaScript na lógica do jogo: passe sempre um Rng explicitamente.
 */

export type RngState = [number, number, number, number];

/** Hash de texto → 4 inteiros de 32 bits (cyrb128). */
export function hashSeed(text: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
    // Aquecimento: descarta os primeiros valores, que são pouco misturados.
    for (let i = 0; i < 12; i++) this.nextUint32();
  }

  /** Cria um Rng a partir de uma semente e rótulos (ex.: semente, 'combate', 3). */
  static from(seed: string, ...labels: (string | number)[]): Rng {
    return new Rng(hashSeed([seed, ...labels].join('|')));
  }

  /** Restaura um Rng exatamente no estado salvo (sem aquecimento). */
  static restore(state: RngState): Rng {
    const r = Object.create(Rng.prototype) as Rng;
    [r.a, r.b, r.c, r.d] = state;
    return r;
  }

  state(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Número em [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Inteiro em [min, max] (inclusivo). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Real em [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: lista vazia');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weight(it));
      if (roll < 0) return it;
    }
    return items[items.length - 1] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Amostra n itens distintos. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, n);
  }

  /** Novo fluxo independente, derivado do estado atual + rótulo (avança este Rng). */
  fork(label: string): Rng {
    return new Rng(hashSeed(`${this.nextUint32()}:${this.nextUint32()}:${label}`));
  }
}
