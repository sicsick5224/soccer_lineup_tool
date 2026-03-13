import { describe, expect, it } from 'vitest';
import { calculateFieldPlayCounts, generateMatchPlan, recalculateMatchPlan, sortPlayersByFieldPlayCounts } from './lineup';
import type { MatchPlan, TeamRoster } from '../types/domain';

const rosterWithPrimaryGk: TeamRoster = {
  id: 'roster-1',
  name: '테스트',
  createdAt: '2026-03-13T00:00:00.000Z',
  updatedAt: '2026-03-13T00:00:00.000Z',
  players: [
    { id: 'gk-1', name: 'GK1', primaryPosition: 'GK', secondaryPositions: [] },
    { id: 'cb-1', name: 'CB1', primaryPosition: 'CB', secondaryPositions: [] },
    { id: 'cb-2', name: 'CB2', primaryPosition: 'CB', secondaryPositions: [] },
    { id: 'lb-1', name: 'LB1', primaryPosition: 'LB', secondaryPositions: [] },
    { id: 'rb-1', name: 'RB1', primaryPosition: 'RB', secondaryPositions: [] },
    { id: 'dm-1', name: 'DM1', primaryPosition: 'DM', secondaryPositions: [] },
    { id: 'dm-2', name: 'DM2', primaryPosition: 'DM', secondaryPositions: [] },
    { id: 'lw-1', name: 'LW1', primaryPosition: 'LW', secondaryPositions: [] },
    { id: 'am-1', name: 'AM1', primaryPosition: 'AM', secondaryPositions: [] },
    { id: 'rw-1', name: 'RW1', primaryPosition: 'RW', secondaryPositions: [] },
    { id: 'st-1', name: 'ST1', primaryPosition: 'ST', secondaryPositions: [] },
    { id: 'cm-1', name: 'CM1', primaryPosition: 'CM', secondaryPositions: [] }
  ]
};

const rosterWithoutPrimaryGk: TeamRoster = {
  ...rosterWithPrimaryGk,
  id: 'roster-2',
  players: rosterWithPrimaryGk.players.map((player) =>
    player.id === 'gk-1' ? { ...player, primaryPosition: 'ST', name: 'ST-GK' } : player
  )
};

describe('lineup engine', () => {
  it('creates four quarter lineups', () => {
    const result = generateMatchPlan({
      title: '테스트 경기',
      roster: rosterWithPrimaryGk,
      formation: '4-2-3-1',
      gkCandidates: []
    });

    expect(result.matchPlan.quarterPlans).toHaveLength(4);
    expect(result.matchPlan.quarterPlans.every((quarterPlan) => quarterPlan.assignments.length === 11)).toBe(true);
  });

  it('excludes temporary goalkeeper quarters from field counts', () => {
    const result = generateMatchPlan({
      title: '임시 GK 테스트',
      roster: rosterWithoutPrimaryGk,
      formation: '4-2-3-1',
      gkCandidates: ['st-1']
    });

    const stats = calculateFieldPlayCounts(rosterWithoutPrimaryGk, result.matchPlan);
    expect(stats['st-1'].temporaryGkQuarters).toBeGreaterThan(0);
    expect(stats['st-1'].fieldPlayQuarters).toBeLessThan(4);
  });

  it('counts primary goalkeeper quarters as normal participation', () => {
    const result = generateMatchPlan({
      title: '주 GK 테스트',
      roster: rosterWithPrimaryGk,
      formation: '4-2-3-1',
      gkCandidates: []
    });

    const stats = calculateFieldPlayCounts(rosterWithPrimaryGk, result.matchPlan);
    expect(stats['gk-1'].fieldPlayQuarters).toBe(4);
    expect(stats['gk-1'].temporaryGkQuarters).toBe(0);
  });

  it('keeps locked slots during recalculation', () => {
    const result = generateMatchPlan({
      title: '잠금 테스트',
      roster: rosterWithPrimaryGk,
      formation: '4-2-3-1',
      gkCandidates: []
    });

    const plan: MatchPlan = {
      ...result.matchPlan,
      quarterPlans: result.matchPlan.quarterPlans.map((quarterPlan) =>
        quarterPlan.quarterIndex === 1
          ? {
              ...quarterPlan,
              lockedSlotIds: ['ST-1']
            }
          : quarterPlan
      )
    };

    const beforeAssignment = plan.quarterPlans[0].assignments.find((assignment) => assignment.slotId === 'ST-1');
    const recalculated = recalculateMatchPlan(rosterWithPrimaryGk, plan);
    const afterAssignment = recalculated.matchPlan.quarterPlans[0].assignments.find(
      (assignment) => assignment.slotId === 'ST-1'
    );

    expect(afterAssignment?.playerId).toBe(beforeAssignment?.playerId);
  });

  it('sorts player status rows by field play count with stable name tiebreaker', () => {
    const stats = {
      alpha: { playerId: 'alpha', fieldPlayQuarters: 2, temporaryGkQuarters: 0, primaryGk: false },
      bravo: { playerId: 'bravo', fieldPlayQuarters: 4, temporaryGkQuarters: 0, primaryGk: false },
      charlie: { playerId: 'charlie', fieldPlayQuarters: 2, temporaryGkQuarters: 1, primaryGk: false }
    };
    const players = [
      { id: 'charlie', name: 'Charlie', primaryPosition: 'CM' as const, secondaryPositions: [] },
      { id: 'bravo', name: 'Bravo', primaryPosition: 'CM' as const, secondaryPositions: [] },
      { id: 'alpha', name: 'Alpha', primaryPosition: 'CM' as const, secondaryPositions: [] }
    ];

    const ascending = sortPlayersByFieldPlayCounts(players, stats, 'field-asc');
    const descending = sortPlayersByFieldPlayCounts(players, stats, 'field-desc');

    expect(ascending.map((player) => player.name)).toEqual(['Alpha', 'Charlie', 'Bravo']);
    expect(descending.map((player) => player.name)).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });
});
