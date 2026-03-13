import type { FormationBoardPosition, FormationSlot, FormationType, Position } from '../types/domain';

export const POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
export const OUTFIELD_POSITIONS = POSITIONS.filter((position) => position !== 'GK');
export const QUARTERS = [1, 2, 3, 4] as const;
export const QUARTER_DURATION_MINUTES = 25 as const;

const FORMATION_POSITION_MAP: Record<FormationType, Position[]> = {
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LW', 'CM', 'CM', 'RW', 'ST', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'DM', 'DM', 'LW', 'CM', 'RW', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LW', 'CM', 'CM', 'RW', 'ST', 'ST', 'ST']
};

export function getFormationSlots(formation: FormationType): FormationSlot[] {
  const counters = new Map<Position, number>();

  return FORMATION_POSITION_MAP[formation].map((position) => {
    const nextCount = (counters.get(position) ?? 0) + 1;
    counters.set(position, nextCount);

    return {
      slotId: `${position}-${nextCount}`,
      position,
      label: nextCount > 1 ? `${position} ${nextCount}` : position
    };
  });
}

export const FORMATIONS = Object.keys(FORMATION_POSITION_MAP) as FormationType[];

const FORMATION_BOARD_POSITION_MAP: Record<FormationType, Record<string, { x: number; y: number }>> = {
  '4-2-3-1': {
    'ST-1': { x: 50, y: 14 },
    'LW-1': { x: 20, y: 26 },
    'AM-1': { x: 50, y: 30 },
    'RW-1': { x: 80, y: 26 },
    'DM-1': { x: 38, y: 44 },
    'DM-2': { x: 62, y: 44 },
    'LB-1': { x: 14, y: 64 },
    'CB-1': { x: 38, y: 70 },
    'CB-2': { x: 62, y: 70 },
    'RB-1': { x: 86, y: 64 },
    'GK-1': { x: 50, y: 88 }
  },
  '4-4-2': {
    'ST-1': { x: 40, y: 14 },
    'ST-2': { x: 60, y: 14 },
    'LW-1': { x: 18, y: 31 },
    'CM-1': { x: 40, y: 34 },
    'CM-2': { x: 60, y: 34 },
    'RW-1': { x: 82, y: 31 },
    'LB-1': { x: 14, y: 64 },
    'CB-1': { x: 38, y: 70 },
    'CB-2': { x: 62, y: 70 },
    'RB-1': { x: 86, y: 64 },
    'GK-1': { x: 50, y: 88 }
  },
  '4-3-3': {
    'LW-1': { x: 20, y: 18 },
    'ST-1': { x: 50, y: 14 },
    'RW-1': { x: 80, y: 18 },
    'CM-1': { x: 30, y: 38 },
    'CM-2': { x: 50, y: 33 },
    'CM-3': { x: 70, y: 38 },
    'LB-1': { x: 14, y: 64 },
    'CB-1': { x: 38, y: 70 },
    'CB-2': { x: 62, y: 70 },
    'RB-1': { x: 86, y: 64 },
    'GK-1': { x: 50, y: 88 }
  },
  '3-5-2': {
    'ST-1': { x: 40, y: 14 },
    'ST-2': { x: 60, y: 14 },
    'LW-1': { x: 18, y: 34 },
    'CM-1': { x: 50, y: 38 },
    'RW-1': { x: 82, y: 34 },
    'DM-1': { x: 38, y: 50 },
    'DM-2': { x: 62, y: 50 },
    'CB-1': { x: 26, y: 70 },
    'CB-2': { x: 50, y: 74 },
    'CB-3': { x: 74, y: 70 },
    'GK-1': { x: 50, y: 88 }
  },
  '3-4-3': {
    'ST-1': { x: 30, y: 16 },
    'ST-2': { x: 50, y: 12 },
    'ST-3': { x: 70, y: 16 },
    'LW-1': { x: 18, y: 38 },
    'CM-1': { x: 40, y: 42 },
    'CM-2': { x: 60, y: 42 },
    'RW-1': { x: 82, y: 38 },
    'CB-1': { x: 26, y: 70 },
    'CB-2': { x: 50, y: 74 },
    'CB-3': { x: 74, y: 70 },
    'GK-1': { x: 50, y: 88 }
  }
};

export function getFormationBoardPositions(formation: FormationType): FormationBoardPosition[] {
  const positions = FORMATION_BOARD_POSITION_MAP[formation];

  return getFormationSlots(formation).map((slot) => ({
    slotId: slot.slotId,
    x: positions[slot.slotId].x,
    y: positions[slot.slotId].y
  }));
}
