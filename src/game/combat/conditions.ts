import type { ActiveStatus, Combatant, CondMod, Condicao, Escala, Escola, OrigemDano, StatusId } from '../types';

export function findStatus(c: Combatant, id: StatusId): ActiveStatus | undefined {
  for (const s of c.statuses) if (s.id === id) return s;
  return undefined;
}

export function hasStatus(c: Combatant, id: StatusId): boolean {
  return findStatus(c, id) !== undefined;
}

export function fracaoVida(c: Combatant): number {
  return c.stats.vidaMax > 0 ? c.vida / c.stats.vidaMax : 0;
}

export function checarCondicao(cond: Condicao, self: Combatant, alvo: Combatant | null): boolean {
  if (cond.selfVidaAbaixo !== undefined && !(fracaoVida(self) < cond.selfVidaAbaixo)) return false;
  if (cond.selfSemStatus !== undefined && hasStatus(self, cond.selfSemStatus)) return false;
  const precisaAlvo =
    cond.alvoVidaAbaixo !== undefined ||
    cond.alvoVidaAcima !== undefined ||
    cond.alvoComStatus !== undefined ||
    cond.alvoSemStatus !== undefined;
  if (!precisaAlvo) return true;
  if (!alvo) return false;
  if (cond.alvoVidaAbaixo !== undefined && !(fracaoVida(alvo) < cond.alvoVidaAbaixo)) return false;
  if (cond.alvoVidaAcima !== undefined && !(fracaoVida(alvo) > cond.alvoVidaAcima)) return false;
  if (cond.alvoComStatus !== undefined && !hasStatus(alvo, cond.alvoComStatus)) return false;
  if (cond.alvoSemStatus !== undefined && hasStatus(alvo, cond.alvoSemStatus)) return false;
  return true;
}

export function condModAplica(m: CondMod, alvo: Combatant, escola: Escola, origem: OrigemDano): boolean {
  const q = m.quando;
  if (q.escola !== undefined && q.escola !== escola) return false;
  if (q.alvoComStatus !== undefined && !hasStatus(alvo, q.alvoComStatus)) return false;
  if (q.alvoVidaAbaixo !== undefined && !(fracaoVida(alvo) < q.alvoVidaAbaixo)) return false;
  if (q.alvoVidaAcima !== undefined && !(fracaoVida(alvo) > q.alvoVidaAcima)) return false;
  if (q.fonte !== undefined && q.fonte !== origem.tipo) return false;
  return true;
}

export function avaliarEscala(e: Escala, fonte: Combatant, danoCausado = 0): number {
  return (
    (e.base ?? 0) +
    (e.dano ?? 0) * fonte.stats.dano +
    (e.vidaMax ?? 0) * fonte.stats.vidaMax +
    (e.danoCausado ?? 0) * danoCausado
  );
}
