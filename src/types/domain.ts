export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST';
export type OutfieldPosition = Exclude<Position, 'GK'>;
export type FormationType = '4-2-3-1' | '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3';
export type QuarterIndex = 1 | 2 | 3 | 4;

export interface Player {
  id: string;
  name: string;
  primaryPosition: Position;
  secondaryPositions: OutfieldPosition[];
}

export interface TeamRoster {
  id: string;
  name: string;
  players: Player[];
  createdAt: string;
  updatedAt: string;
}

export interface FormationSlot {
  slotId: string;
  position: Position;
  label: string;
}

export interface FormationBoardPosition {
  slotId: string;
  x: number;
  y: number;
}

export interface Assignment {
  slotId: string;
  playerId: string;
}

export interface QuarterPlan {
  quarterIndex: QuarterIndex;
  assignments: Assignment[];
  lockedSlotIds: string[];
}

export interface MidGameSubstitution {
  id: string;
  quarterIndex: QuarterIndex;
  minuteOffset: number;
  outPlayerId: string;
  inPlayerId: string;
  slotId?: string;
  note?: string;
}

export interface MatchPlan {
  id: string;
  title: string;
  rosterId: string;
  formation: FormationType;
  quarterDurationMinutes: number;
  quarterCount: 4;
  gkCandidates: string[];
  quarterPlans: QuarterPlan[];
  midGameSubstitutions: MidGameSubstitution[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerationWarning {
  quarterIndex: QuarterIndex;
  slotId: string;
  message: string;
  type: 'temporary-placement' | 'position-shortage';
}

export interface PlayerStats {
  playerId: string;
  fieldPlayQuarters: number;
  temporaryGkQuarters: number;
  primaryGk: boolean;
}

export interface QuarterView {
  quarterIndex: QuarterIndex;
  lineup: Array<
    FormationSlot & { player?: Player; isLocked: boolean; fit: 'primary' | 'secondary' | 'temporary' }
  >;
  bench: Player[];
  warnings: GenerationWarning[];
}
