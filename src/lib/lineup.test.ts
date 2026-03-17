import { describe, expect, it } from 'vitest';
import {
  applyDragItemToQuarterPlan,
  calculateFieldPlayCounts,
  generateMatchPlan,
  getQuarterSubstitutionViews,
  getSubstitutionSlotIds,
  recalculateMatchPlan,
  sortPlayersByFieldPlayCounts
} from './lineup';
import type { MatchPlan, QuarterPlan, TeamRoster } from '../types/domain';

const rosterWithPrimaryGk: TeamRoster = {
  id: 'roster-1',
  name: 'Test Roster',
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
      title: 'Match',
      roster: rosterWithPrimaryGk,
      formation: '4-2-3-1',
      gkCandidates: []
    });

    expect(result.matchPlan.quarterPlans).toHaveLength(4);
    expect(result.matchPlan.quarterPlans.every((quarterPlan) => quarterPlan.assignments.length === 11)).toBe(true);
  });

  it('excludes temporary goalkeeper quarters from field counts', () => {
    const result = generateMatchPlan({
      title: 'Temporary GK',
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
      title: 'Primary GK',
      roster: rosterWithPrimaryGk,
      formation: '4-2-3-1',
      gkCandidates: []
    });

    const stats = calculateFieldPlayCounts(rosterWithPrimaryGk, result.matchPlan);
    expect(stats['gk-1'].fieldPlayQuarters).toBe(4);
    expect(stats['gk-1'].temporaryGkQuarters).toBe(0);
  });

  it('counts substitution participation by unique quarters for both in and out players', () => {
    const plan: MatchPlan = {
      id: 'plan-sub',
      title: 'Sub Match',
      rosterId: rosterWithPrimaryGk.id,
      formation: '4-2-3-1',
      quarterDurationMinutes: 25,
      quarterCount: 4,
      gkCandidates: [],
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
      quarterPlans: [
        { quarterIndex: 1, lockedSlotIds: [], assignments: [] },
        { quarterIndex: 2, lockedSlotIds: [], assignments: [] },
        { quarterIndex: 3, lockedSlotIds: [], assignments: [] },
        { quarterIndex: 4, lockedSlotIds: [], assignments: [] }
      ],
      midGameSubstitutions: [
        { id: 'sub-1', quarterIndex: 1, minuteOffset: 5, outPlayerId: 'lw-1', inPlayerId: 'cm-1' },
        { id: 'sub-2', quarterIndex: 1, minuteOffset: 14, outPlayerId: 'cm-1', inPlayerId: 'dm-1' },
        { id: 'sub-3', quarterIndex: 2, minuteOffset: 8, outPlayerId: 'lw-1', inPlayerId: 'cm-1' }
      ]
    };

    const stats = calculateFieldPlayCounts(rosterWithPrimaryGk, plan);

    expect(stats['lw-1'].substitutionQuarters).toBe(2);
    expect(stats['cm-1'].substitutionQuarters).toBe(2);
    expect(stats['dm-1'].substitutionQuarters).toBe(1);
  });

  it('keeps locked slots during recalculation', () => {
    const result = generateMatchPlan({
      title: 'Locked Slot',
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
      alpha: { playerId: 'alpha', fieldPlayQuarters: 2, temporaryGkQuarters: 0, substitutionQuarters: 0, primaryGk: false },
      bravo: { playerId: 'bravo', fieldPlayQuarters: 4, temporaryGkQuarters: 0, substitutionQuarters: 1, primaryGk: false },
      charlie: { playerId: 'charlie', fieldPlayQuarters: 2, temporaryGkQuarters: 1, substitutionQuarters: 0, primaryGk: false }
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

  it('swaps field players when dragging between slots', () => {
    const quarterPlan: QuarterPlan = {
      quarterIndex: 1,
      lockedSlotIds: [],
      assignments: [
        { slotId: 'LW-1', playerId: 'lw-1' },
        { slotId: 'ST-1', playerId: 'st-1' },
        { slotId: 'RW-1', playerId: 'rw-1' }
      ]
    };

    const nextQuarterPlan = applyDragItemToQuarterPlan(
      quarterPlan,
      { type: 'slot', slotId: 'LW-1', playerId: 'lw-1', playerName: 'LW1' },
      'RW-1'
    );

    expect(nextQuarterPlan.assignments).toEqual([
      { slotId: 'LW-1', playerId: 'rw-1' },
      { slotId: 'ST-1', playerId: 'st-1' },
      { slotId: 'RW-1', playerId: 'lw-1' }
    ]);
  });

  it('assigns a bench player into a field slot when dropped on the board', () => {
    const quarterPlan: QuarterPlan = {
      quarterIndex: 1,
      lockedSlotIds: ['ST-1'],
      assignments: [
        { slotId: 'LW-1', playerId: 'lw-1' },
        { slotId: 'ST-1', playerId: 'st-1' },
        { slotId: 'RW-1', playerId: 'rw-1' }
      ]
    };

    const nextQuarterPlan = applyDragItemToQuarterPlan(
      quarterPlan,
      { type: 'bench', playerId: 'cm-1', playerName: 'CM1' },
      'ST-1'
    );

    expect(nextQuarterPlan.lockedSlotIds).toEqual(['ST-1']);
    expect(nextQuarterPlan.assignments).toEqual([
      { slotId: 'LW-1', playerId: 'lw-1' },
      { slotId: 'ST-1', playerId: 'cm-1' },
      { slotId: 'RW-1', playerId: 'rw-1' }
    ]);
  });

  it('creates sorted substitution views and slot badges for the active quarter', () => {
    const plan: MatchPlan = {
      id: 'plan-1',
      title: 'Match',
      rosterId: rosterWithPrimaryGk.id,
      formation: '4-2-3-1',
      quarterDurationMinutes: 25,
      quarterCount: 4,
      gkCandidates: [],
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
      quarterPlans: [],
      midGameSubstitutions: [
        {
          id: 'sub-2',
          quarterIndex: 1,
          minuteOffset: 10,
          outPlayerId: 'st-1',
          inPlayerId: 'cm-1',
          slotId: 'ST-1'
        },
        {
          id: 'sub-1',
          quarterIndex: 1,
          minuteOffset: 5,
          outPlayerId: 'lw-1',
          inPlayerId: 'dm-1',
          slotId: 'LW-1'
        },
        {
          id: 'sub-3',
          quarterIndex: 2,
          minuteOffset: 7,
          outPlayerId: 'rw-1',
          inPlayerId: 'am-1',
          slotId: 'RW-1'
        }
      ]
    };

    const substitutionViews = getQuarterSubstitutionViews(rosterWithPrimaryGk, plan, 1);
    const substitutionSlotIds = getSubstitutionSlotIds(plan, 1);

    expect(substitutionViews.map((item) => item.minuteOffset)).toEqual([5, 10]);
    expect(substitutionViews.map((item) => item.slotLabel)).toEqual(['LW', 'ST']);
    expect(substitutionViews[0].outPlayerName).toBe('LW1');
    expect(substitutionViews[1].inPlayerName).toBe('CM1');
    expect(substitutionSlotIds).toEqual(['ST-1', 'LW-1']);
  });
});
