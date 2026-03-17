import { FORMATIONS, QUARTER_DURATION_MINUTES, QUARTERS, getFormationSlots } from '../constants/formations';
import { compareText, createId, nowIso } from './utils';
import type {
  Assignment,
  BoardDragItem,
  FormationSlot,
  FormationType,
  GenerationWarning,
  MatchPlan,
  Player,
  PlayerStats,
  QuarterIndex,
  QuarterPlan,
  QuarterSubstitutionView,
  QuarterView,
  TeamRoster
} from '../types/domain';

type FitScore = 'primary' | 'secondary' | 'temporary';
export type PlayerStatsSortDirection = 'field-desc' | 'field-asc';

interface GenerationOptions {
  title: string;
  roster: TeamRoster;
  formation: FormationType;
  gkCandidates: string[];
}

const FIT_PRIORITY: Record<FitScore, number> = {
  primary: 0,
  secondary: 1,
  temporary: 2
};

function getSlotPosition(slotId: string): string {
  return slotId.split('-')[0];
}

function getFit(player: Player, slot: FormationSlot): FitScore {
  if (slot.position === 'GK') {
    return player.primaryPosition === 'GK' ? 'primary' : 'temporary';
  }

  if (player.primaryPosition === slot.position) {
    return 'primary';
  }

  if (player.secondaryPositions.includes(slot.position)) {
    return 'secondary';
  }

  return 'temporary';
}

export function calculateFieldPlayCounts(roster: TeamRoster, matchPlan: MatchPlan): Record<string, PlayerStats> {
  const stats = Object.fromEntries(
    roster.players.map((player) => [
      player.id,
      {
        playerId: player.id,
        fieldPlayQuarters: 0,
        temporaryGkQuarters: 0,
        substitutionQuarters: 0,
        primaryGk: player.primaryPosition === 'GK'
      } satisfies PlayerStats
    ])
  );

  for (const quarterPlan of matchPlan.quarterPlans) {
    for (const assignment of quarterPlan.assignments) {
      const player = roster.players.find((item) => item.id === assignment.playerId);
      if (!player) {
        continue;
      }

      const isTemporaryGk = getSlotPosition(assignment.slotId) === 'GK' && player.primaryPosition !== 'GK';
      if (isTemporaryGk) {
        stats[player.id].temporaryGkQuarters += 1;
      } else {
        stats[player.id].fieldPlayQuarters += 1;
      }
    }
  }

  const substitutionQuarterSets = new Map<string, Set<QuarterIndex>>();
  for (const substitution of matchPlan.midGameSubstitutions) {
    for (const playerId of [substitution.outPlayerId, substitution.inPlayerId]) {
      if (!stats[playerId]) {
        continue;
      }

      const quarterSet = substitutionQuarterSets.get(playerId) ?? new Set<QuarterIndex>();
      quarterSet.add(substitution.quarterIndex);
      substitutionQuarterSets.set(playerId, quarterSet);
    }
  }

  for (const [playerId, quarterSet] of substitutionQuarterSets.entries()) {
    stats[playerId].substitutionQuarters = quarterSet.size;
  }

  return stats;
}

export function getBenchPlayers(roster: TeamRoster, quarterPlan: QuarterPlan): Player[] {
  const assignedIds = new Set(quarterPlan.assignments.map((assignment) => assignment.playerId));
  return roster.players.filter((player) => !assignedIds.has(player.id)).sort((a, b) => compareText(a.name, b.name));
}

function sortPlayersForSlot(slot: FormationSlot, players: Player[], stats: Record<string, PlayerStats>): Player[] {
  return [...players].sort((left, right) => {
    const countDiff = stats[left.id].fieldPlayQuarters - stats[right.id].fieldPlayQuarters;
    if (countDiff !== 0) {
      return countDiff;
    }

    const fitDiff = FIT_PRIORITY[getFit(left, slot)] - FIT_PRIORITY[getFit(right, slot)];
    if (fitDiff !== 0) {
      return fitDiff;
    }

    return compareText(left.name, right.name);
  });
}

function chooseGoalkeeper(
  availablePlayers: Player[],
  stats: Record<string, PlayerStats>,
  gkCandidates: string[],
  quarterIndex: QuarterIndex
): Player {
  const primaryGoalkeepers = availablePlayers.filter((player) => player.primaryPosition === 'GK');
  if (primaryGoalkeepers.length > 0) {
    return sortPlayersForSlot({ slotId: 'GK-1', position: 'GK', label: 'GK' }, primaryGoalkeepers, stats)[0];
  }

  const rotatedCandidates = gkCandidates.map((playerId, index) => ({
    playerId,
    order: (index - (quarterIndex - 1) + gkCandidates.length) % gkCandidates.length
  }));

  const selectedCandidate = rotatedCandidates
    .sort((left, right) => left.order - right.order)
    .map((item) => availablePlayers.find((player) => player.id === item.playerId))
    .find(Boolean);

  if (selectedCandidate) {
    return selectedCandidate;
  }

  return sortPlayersForSlot({ slotId: 'GK-1', position: 'GK', label: 'GK' }, availablePlayers, stats)[0];
}

function sortSlotsByScarcity(slots: FormationSlot[], availablePlayers: Player[]): FormationSlot[] {
  return [...slots].sort((left, right) => {
    const leftFitCount = availablePlayers.filter((player) => getFit(player, left) !== 'temporary').length;
    const rightFitCount = availablePlayers.filter((player) => getFit(player, right) !== 'temporary').length;
    if (leftFitCount !== rightFitCount) {
      return leftFitCount - rightFitCount;
    }

    return compareText(left.label, right.label);
  });
}

function buildQuarterAssignments(
  roster: TeamRoster,
  formationSlots: FormationSlot[],
  stats: Record<string, PlayerStats>,
  gkCandidates: string[],
  quarterIndex: QuarterIndex,
  lockedAssignments: Assignment[] = [],
  lockedSlotIds: string[] = []
): { quarterPlan: QuarterPlan; warnings: GenerationWarning[] } {
  const assignments: Assignment[] = [...lockedAssignments];
  const warnings: GenerationWarning[] = [];
  const usedPlayerIds = new Set(lockedAssignments.map((assignment) => assignment.playerId));
  const lockedSlotSet = new Set(lockedSlotIds);

  const gkSlot = formationSlots.find((slot) => slot.position === 'GK')!;
  if (!lockedSlotSet.has(gkSlot.slotId)) {
    const availablePlayers = roster.players.filter((player) => !usedPlayerIds.has(player.id));
    const goalkeeper = chooseGoalkeeper(availablePlayers, stats, gkCandidates, quarterIndex);
    assignments.push({ slotId: gkSlot.slotId, playerId: goalkeeper.id });
    usedPlayerIds.add(goalkeeper.id);
  }

  const openFieldSlots = sortSlotsByScarcity(
    formationSlots.filter((slot) => slot.position !== 'GK' && !lockedSlotSet.has(slot.slotId)),
    roster.players.filter((player) => !usedPlayerIds.has(player.id))
  );

  for (const slot of openFieldSlots) {
    const availablePlayers = roster.players.filter((player) => !usedPlayerIds.has(player.id));
    const selectedPlayer = sortPlayersForSlot(slot, availablePlayers, stats)[0];
    assignments.push({ slotId: slot.slotId, playerId: selectedPlayer.id });
    usedPlayerIds.add(selectedPlayer.id);

    if (getFit(selectedPlayer, slot) === 'temporary') {
      warnings.push({
        quarterIndex,
        slotId: slot.slotId,
        message: `${slot.label} 포지션에 적합 선수가 부족하여 임시 배치가 적용되었습니다.`,
        type: 'temporary-placement'
      });
    }
  }

  return {
    quarterPlan: {
      quarterIndex,
      assignments: formationSlots
        .map((slot) => assignments.find((assignment) => assignment.slotId === slot.slotId))
        .filter((assignment): assignment is Assignment => Boolean(assignment)),
      lockedSlotIds: [...lockedSlotIds]
    },
    warnings
  };
}

export function generateMatchPlan(options: GenerationOptions): { matchPlan: MatchPlan; warnings: GenerationWarning[] } {
  const formationSlots = getFormationSlots(options.formation);
  const createdAt = nowIso();
  const warnings: GenerationWarning[] = [];
  const quarterPlans: QuarterPlan[] = [];

  const draftPlan: MatchPlan = {
    id: createId('plan'),
    title: options.title.trim(),
    rosterId: options.roster.id,
    formation: options.formation,
    quarterDurationMinutes: QUARTER_DURATION_MINUTES,
    quarterCount: 4,
    gkCandidates: options.gkCandidates,
    quarterPlans: [],
    midGameSubstitutions: [],
    createdAt,
    updatedAt: createdAt
  };

  for (const quarterIndex of QUARTERS) {
    const currentStats = calculateFieldPlayCounts(options.roster, { ...draftPlan, quarterPlans });
    const result = buildQuarterAssignments(
      options.roster,
      formationSlots,
      currentStats,
      options.gkCandidates,
      quarterIndex
    );
    quarterPlans.push(result.quarterPlan);
    warnings.push(...result.warnings);
  }

  return {
    matchPlan: {
      ...draftPlan,
      quarterPlans
    },
    warnings
  };
}

export function recalculateMatchPlan(roster: TeamRoster, matchPlan: MatchPlan): { matchPlan: MatchPlan; warnings: GenerationWarning[] } {
  const formationSlots = getFormationSlots(matchPlan.formation);
  const warnings: GenerationWarning[] = [];
  const nextQuarterPlans: QuarterPlan[] = [];

  for (const quarterIndex of QUARTERS) {
    const existingQuarterPlan = matchPlan.quarterPlans.find((quarterPlan) => quarterPlan.quarterIndex === quarterIndex);
    const lockedSlotIds = existingQuarterPlan?.lockedSlotIds ?? [];
    const lockedAssignments =
      existingQuarterPlan?.assignments.filter((assignment) => lockedSlotIds.includes(assignment.slotId)) ?? [];

    const currentStats = calculateFieldPlayCounts(roster, { ...matchPlan, quarterPlans: nextQuarterPlans });
    const result = buildQuarterAssignments(
      roster,
      formationSlots,
      currentStats,
      matchPlan.gkCandidates,
      quarterIndex,
      lockedAssignments,
      lockedSlotIds
    );

    nextQuarterPlans.push(result.quarterPlan);
    warnings.push(...result.warnings);
  }

  return {
    matchPlan: {
      ...matchPlan,
      quarterPlans: nextQuarterPlans,
      updatedAt: nowIso()
    },
    warnings
  };
}

export function getQuarterViews(roster: TeamRoster, matchPlan: MatchPlan): QuarterView[] {
  const formationSlots = getFormationSlots(matchPlan.formation);

  return QUARTERS.map((quarterIndex) => {
    const quarterPlan = matchPlan.quarterPlans.find((item) => item.quarterIndex === quarterIndex)!;
    const warnings: GenerationWarning[] = [];

    const lineup = formationSlots.map((slot) => {
      const assignment = quarterPlan.assignments.find((item) => item.slotId === slot.slotId);
      const player = roster.players.find((item) => item.id === assignment?.playerId);
      const fit = player ? getFit(player, slot) : 'temporary';

      if (player && fit === 'temporary' && slot.position !== 'GK') {
        warnings.push({
          quarterIndex,
          slotId: slot.slotId,
          message: `${slot.label} 포지션에 적합 선수가 부족하여 임시 배치가 적용되었습니다.`,
          type: 'temporary-placement'
        });
      }

      return {
        ...slot,
        player,
        fit,
        isLocked: quarterPlan.lockedSlotIds.includes(slot.slotId)
      };
    });

    return {
      quarterIndex,
      lineup,
      bench: getBenchPlayers(roster, quarterPlan),
      warnings
    };
  });
}

export function hasTemporaryPlacementWarnings(roster: TeamRoster, matchPlan: MatchPlan): boolean {
  return getQuarterViews(roster, matchPlan).some((quarterView) => quarterView.warnings.length > 0);
}

export function createEmptyPlan(rosterId: string): MatchPlan {
  const timestamp = nowIso();
  return {
    id: createId('plan'),
    title: '',
    rosterId,
    formation: FORMATIONS[0],
    quarterDurationMinutes: QUARTER_DURATION_MINUTES,
    quarterCount: 4,
    gkCandidates: [],
    quarterPlans: QUARTERS.map((quarterIndex) => ({
      quarterIndex,
      assignments: [],
      lockedSlotIds: []
    })),
    midGameSubstitutions: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function getAllowedPlayersForSlot(
  roster: TeamRoster,
  quarterPlan: QuarterPlan,
  slotId: string
): Player[] {
  const usedByOtherSlots = new Set(
    quarterPlan.assignments.filter((assignment) => assignment.slotId !== slotId).map((assignment) => assignment.playerId)
  );

  return roster.players.filter((player) => !usedByOtherSlots.has(player.id)).sort((a, b) => compareText(a.name, b.name));
}

export function sortPlayersByFieldPlayCounts(
  players: Player[],
  stats: Record<string, PlayerStats>,
  direction: PlayerStatsSortDirection
): Player[] {
  return [...players].sort((left, right) => {
    const leftCount = stats[left.id]?.fieldPlayQuarters ?? 0;
    const rightCount = stats[right.id]?.fieldPlayQuarters ?? 0;
    const countDiff = direction === 'field-desc' ? rightCount - leftCount : leftCount - rightCount;

    if (countDiff !== 0) {
      return countDiff;
    }

    return compareText(left.name, right.name);
  });
}

export function assignPlayerToSlot(quarterPlan: QuarterPlan, slotId: string, playerId: string): QuarterPlan {
  const currentAssignment = quarterPlan.assignments.find((assignment) => assignment.slotId === slotId);
  const existingPlayerAssignment = quarterPlan.assignments.find((assignment) => assignment.playerId === playerId);

  if (!currentAssignment || currentAssignment.playerId === playerId) {
    return quarterPlan;
  }

  return {
    ...quarterPlan,
    assignments: quarterPlan.assignments.map((assignment) => {
      if (assignment.slotId === slotId) {
        return { ...assignment, playerId };
      }

      if (
        existingPlayerAssignment &&
        assignment.slotId === existingPlayerAssignment.slotId &&
        existingPlayerAssignment.slotId !== slotId
      ) {
        return { ...assignment, playerId: currentAssignment.playerId };
      }

      return assignment;
    })
  };
}

export function applyDragItemToQuarterPlan(
  quarterPlan: QuarterPlan,
  dragItem: BoardDragItem,
  targetSlotId: string
): QuarterPlan {
  const targetAssignment = quarterPlan.assignments.find((assignment) => assignment.slotId === targetSlotId);
  if (!targetAssignment) {
    return quarterPlan;
  }

  if (dragItem.type === 'bench') {
    return assignPlayerToSlot(quarterPlan, targetSlotId, dragItem.playerId);
  }

  if (dragItem.slotId === targetSlotId) {
    return quarterPlan;
  }

  const sourceAssignment = quarterPlan.assignments.find((assignment) => assignment.slotId === dragItem.slotId);
  if (!sourceAssignment) {
    return quarterPlan;
  }

  return {
    ...quarterPlan,
    assignments: quarterPlan.assignments.map((assignment) => {
      if (assignment.slotId === dragItem.slotId) {
        return { ...assignment, playerId: targetAssignment.playerId };
      }

      if (assignment.slotId === targetSlotId) {
        return { ...assignment, playerId: sourceAssignment.playerId };
      }

      return assignment;
    })
  };
}

export function getQuarterSubstitutionViews(
  roster: TeamRoster,
  matchPlan: MatchPlan,
  quarterIndex: QuarterIndex
): QuarterSubstitutionView[] {
  const slotLabelById = new Map(getFormationSlots(matchPlan.formation).map((slot) => [slot.slotId, slot.label]));
  const playerById = new Map(roster.players.map((player) => [player.id, player]));

  return matchPlan.midGameSubstitutions
    .filter((substitution) => substitution.quarterIndex === quarterIndex)
    .sort((left, right) => {
      const minuteDiff = left.minuteOffset - right.minuteOffset;
      if (minuteDiff !== 0) {
        return minuteDiff;
      }

      return compareText(left.id, right.id);
    })
    .map((substitution) => ({
      id: substitution.id,
      minuteOffset: substitution.minuteOffset,
      outPlayerId: substitution.outPlayerId,
      outPlayerName: playerById.get(substitution.outPlayerId)?.name ?? substitution.outPlayerId,
      inPlayerId: substitution.inPlayerId,
      inPlayerName: playerById.get(substitution.inPlayerId)?.name ?? substitution.inPlayerId,
      slotId: substitution.slotId,
      slotLabel: substitution.slotId ? slotLabelById.get(substitution.slotId) : undefined,
      note: substitution.note
    }));
}

export function getSubstitutionSlotIds(matchPlan: MatchPlan, quarterIndex: QuarterIndex): string[] {
  return Array.from(
    new Set(
      matchPlan.midGameSubstitutions
        .filter((substitution) => substitution.quarterIndex === quarterIndex && substitution.slotId)
        .map((substitution) => substitution.slotId as string)
    )
  );
}
