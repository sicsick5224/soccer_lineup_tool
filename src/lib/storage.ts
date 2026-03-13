import type { MatchPlan, TeamRoster } from '../types/domain';

const STORAGE_KEYS = {
  rosters: 'soccer-lineup-tool:rosters',
  matchPlans: 'soccer-lineup-tool:match-plans'
} as const;

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? (parsedValue as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadRosters(): TeamRoster[] {
  return readJson<TeamRoster>(STORAGE_KEYS.rosters);
}

export function saveRoster(roster: TeamRoster): TeamRoster[] {
  const rosters = loadRosters();
  const nextRosters = [...rosters.filter((item) => item.id !== roster.id), roster].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );
  writeJson(STORAGE_KEYS.rosters, nextRosters);
  return nextRosters;
}

export function deleteRoster(rosterId: string): TeamRoster[] {
  const nextRosters = loadRosters().filter((item) => item.id !== rosterId);
  writeJson(STORAGE_KEYS.rosters, nextRosters);
  return nextRosters;
}

export function loadMatchPlans(): MatchPlan[] {
  return readJson<MatchPlan>(STORAGE_KEYS.matchPlans);
}

export function saveMatchPlan(matchPlan: MatchPlan): MatchPlan[] {
  const matchPlans = loadMatchPlans();
  const nextPlans = [...matchPlans.filter((item) => item.id !== matchPlan.id), matchPlan].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );
  writeJson(STORAGE_KEYS.matchPlans, nextPlans);
  return nextPlans;
}

export function deleteMatchPlan(matchPlanId: string): MatchPlan[] {
  const nextPlans = loadMatchPlans().filter((item) => item.id !== matchPlanId);
  writeJson(STORAGE_KEYS.matchPlans, nextPlans);
  return nextPlans;
}
