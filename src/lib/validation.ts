import type { MidGameSubstitution, TeamRoster } from '../types/domain';

export function validateRoster(rosterName: string, playerNames: string[]): string | null {
  if (!rosterName.trim()) {
    return '팀 명단 이름을 입력해주세요.';
  }

  const normalizedNames = playerNames.map((name) => name.trim()).filter(Boolean);
  const duplicatedName = normalizedNames.find((name, index) => normalizedNames.indexOf(name) !== index);

  if (duplicatedName) {
    return '동일한 선수 이름은 허용되지 않습니다.';
  }

  return null;
}

export function validateRosterForGeneration(roster: TeamRoster, gkCandidates: string[]): string | null {
  if (roster.players.length < 11) {
    return '11명 미만이므로 자동 편성을 할 수 없습니다.';
  }

  const hasPrimaryGk = roster.players.some((player) => player.primaryPosition === 'GK');
  if (!hasPrimaryGk && gkCandidates.length === 0) {
    return '주 포지션 GK가 없으므로 GK 후보를 지정해주세요.';
  }

  return null;
}

export function validatePlanTitle(title: string): string | null {
  return title.trim() ? null : '경기 계획 이름을 입력해주세요.';
}

export function validateSubstitution(
  substitution: Pick<MidGameSubstitution, 'outPlayerId' | 'inPlayerId'>,
  roster: TeamRoster
): string | null {
  if (!substitution.outPlayerId || !substitution.inPlayerId) {
    return '교체 대상 선수와 투입 선수를 모두 선택해주세요.';
  }

  if (substitution.outPlayerId === substitution.inPlayerId) {
    return '교체 대상 선수와 투입 선수는 같을 수 없습니다.';
  }

  const rosterPlayerIds = new Set(roster.players.map((player) => player.id));
  if (!rosterPlayerIds.has(substitution.outPlayerId) || !rosterPlayerIds.has(substitution.inPlayerId)) {
    return '존재하지 않는 선수를 교체 정보에 사용할 수 없습니다.';
  }

  return null;
}
