import type { RouteStep, RouteSummary } from './route';
import type { AgentSkillCategory, JogressPartner, StatKey } from './schema';

/**
 * Max/union fold over a route's forward-step requirements. Note: stat
 * thresholds are checked at each step, not simultaneously — maxStats is a
 * planning ceiling, not a point-in-time check (surfaced as UI copy).
 */
export function summarizeRoute(steps: RouteStep[]): RouteSummary {
  const summary: RouteSummary = {
    maxAgentRank: 1,
    maxStats: {},
    items: [],
    partners: [],
    agentSkills: [],
    counts: { digivolves: 0, dedigivolves: 0, jogressSteps: 0, itemSteps: 0 },
  };
  const partnerSlugs = new Set<string>();
  const skillMax = new Map<AgentSkillCategory, number>();

  for (const step of steps) {
    if (step.kind === 'dedigivolve') {
      summary.counts.dedigivolves += 1;
      continue;
    }
    summary.counts.digivolves += 1;
    if (step.class === 'jogress') summary.counts.jogressSteps += 1;
    if (step.class === 'item') summary.counts.itemSteps += 1;

    const req = step.requirement!;
    summary.maxAgentRank = Math.max(summary.maxAgentRank, req.agentRank);
    for (const [key, value] of Object.entries(req.stats)) {
      const stat = key as StatKey;
      summary.maxStats[stat] = Math.max(summary.maxStats[stat] ?? 0, value!);
    }
    if (req.talent !== undefined) {
      summary.maxTalent = Math.max(summary.maxTalent ?? 0, req.talent);
    }
    if (req.item && !summary.items.includes(req.item)) summary.items.push(req.item);
    for (const partner of req.partners ?? []) {
      if (!partnerSlugs.has(partner.slug)) {
        partnerSlugs.add(partner.slug);
        summary.partners.push(partner as JogressPartner);
      }
    }
    for (const skill of req.agentSkills ?? []) {
      skillMax.set(skill.category, Math.max(skillMax.get(skill.category) ?? 0, skill.value));
    }
  }

  summary.agentSkills = [...skillMax].map(([category, value]) => ({ category, value }));
  return summary;
}
