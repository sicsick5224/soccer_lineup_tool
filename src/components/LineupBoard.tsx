import { getFormationBoardPositions } from '../constants/formations';
import uniformIcon from '../../uniform.svg';
import type { MatchPlan, QuarterView } from '../types/domain';

interface LineupBoardProps {
  plan: MatchPlan;
  quarterView: QuarterView;
  isEditing: boolean;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}

export function LineupBoard({ plan, quarterView, isEditing, selectedSlotId, onSelectSlot }: LineupBoardProps) {
  const boardPositions = getFormationBoardPositions(plan.formation);

  return (
    <div className="lineup-board">
      <div className="lineup-board__pitch">
        <div className="pitch-mark pitch-mark--half" />
        <div className="pitch-mark pitch-mark--circle" />
        <div className="pitch-mark pitch-mark--box-top" />
        <div className="pitch-mark pitch-mark--box-bottom" />
        <div className="pitch-mark pitch-mark--goal-top" />
        <div className="pitch-mark pitch-mark--goal-bottom" />

        {quarterView.lineup.map((slot) => {
          const position = boardPositions.find((item) => item.slotId === slot.slotId);
          if (!position) {
            return null;
          }

          const markerClassName = [
            'player-marker',
            slot.isLocked ? 'player-marker--locked' : '',
            selectedSlotId === slot.slotId ? 'player-marker--selected' : '',
            isEditing ? 'player-marker--editable' : ''
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={slot.slotId}
              type="button"
              className={markerClassName}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              onClick={() => {
                if (isEditing) {
                  onSelectSlot(slot.slotId);
                }
              }}
            >
              <img className="kit-icon" src={uniformIcon} alt="" aria-hidden="true" />
              <span className="player-marker__name">{slot.player?.name ?? slot.label}</span>
              <span className="player-marker__meta">
                {slot.position}
                {slot.isLocked ? ' · 고정' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
