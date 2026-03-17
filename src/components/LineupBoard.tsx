import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { getFormationBoardPositions } from '../constants/formations';
import uniformIcon from '../../uniform.svg';
import type { BoardDragItem, BoardDragState, MatchPlan, Player, QuarterView } from '../types/domain';

interface LineupBoardProps {
  plan: MatchPlan;
  quarterView: QuarterView;
  benchPlayers: Player[];
  substitutionSlotIds: string[];
  isEditing: boolean;
  selectedSlotId: string | null;
  dragState: BoardDragState | null;
  onSelectSlot: (slotId: string) => void;
  onDragStart: (item: BoardDragItem, point: { x: number; y: number }) => void;
  onDragMove: (point: { x: number; y: number }, overSlotId: string | null) => void;
  onDropOnSlot: (slotId: string | null) => void;
  onDragEnd: () => void;
}

const DRAG_THRESHOLD_PX = 6;

export function LineupBoard({
  plan,
  quarterView,
  benchPlayers,
  substitutionSlotIds,
  isEditing,
  selectedSlotId,
  dragState,
  onSelectSlot,
  onDragStart,
  onDragMove,
  onDropOnSlot,
  onDragEnd
}: LineupBoardProps) {
  const boardPositions = getFormationBoardPositions(plan.formation);
  const pendingDragRef = useRef<{
    item: BoardDragItem;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (!isEditing) {
      pendingDragRef.current = null;
      return;
    }

    const getSlotIdFromPoint = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY);
      return target?.closest<HTMLElement>('[data-slot-id]')?.dataset.slotId ?? null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const pendingDrag = pendingDragRef.current;

      if (pendingDrag) {
        if (event.pointerId !== pendingDrag.pointerId) {
          return;
        }

        const distance = Math.hypot(event.clientX - pendingDrag.startX, event.clientY - pendingDrag.startY);
        if (distance < DRAG_THRESHOLD_PX) {
          return;
        }

        onDragStart(pendingDrag.item, { x: event.clientX, y: event.clientY });
        pendingDragRef.current = null;
        onDragMove({ x: event.clientX, y: event.clientY }, getSlotIdFromPoint(event.clientX, event.clientY));
        return;
      }

      if (!dragState) {
        return;
      }

      onDragMove({ x: event.clientX, y: event.clientY }, getSlotIdFromPoint(event.clientX, event.clientY));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const pendingDrag = pendingDragRef.current;

      if (pendingDrag && event.pointerId === pendingDrag.pointerId) {
        if (pendingDrag.item.type === 'slot') {
          onSelectSlot(pendingDrag.item.slotId);
        }
        pendingDragRef.current = null;
        return;
      }

      if (!dragState) {
        return;
      }

      onDropOnSlot(getSlotIdFromPoint(event.clientX, event.clientY));
    };

    const handlePointerCancel = () => {
      pendingDragRef.current = null;
      if (dragState) {
        onDragEnd();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [dragState, isEditing, onDragEnd, onDragMove, onDragStart, onDropOnSlot, onSelectSlot]);

  const handlePointerDown = (event: ReactPointerEvent, item: BoardDragItem) => {
    if (!isEditing) {
      return;
    }

    pendingDragRef.current = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
  };

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

          const isSubstituted = substitutionSlotIds.includes(slot.slotId);
          const isDragged = dragState?.item.type === 'slot' && dragState.item.slotId === slot.slotId;

          const markerClassName = [
            'player-marker',
            slot.isLocked ? 'player-marker--locked' : '',
            selectedSlotId === slot.slotId ? 'player-marker--selected' : '',
            isDragged ? 'player-marker--dragging' : '',
            dragState?.overSlotId === slot.slotId ? 'player-marker--drop-target' : ''
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={slot.slotId} className={markerClassName} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
              <button
                type="button"
                data-slot-id={slot.slotId}
                className={`player-marker__hitbox ${isEditing ? 'player-marker__hitbox--editable' : ''}`}
                onClick={() => {
                  if (isEditing) {
                    onSelectSlot(slot.slotId);
                  }
                }}
                onPointerDown={(event) => {
                  if (slot.player) {
                    handlePointerDown(event, {
                      type: 'slot',
                      slotId: slot.slotId,
                      playerId: slot.player.id,
                      playerName: slot.player.name
                    });
                  }
                }}
              >
                {isSubstituted ? <span className="player-marker__substitution-dot" aria-hidden="true" /> : null}
                <img className="kit-icon" src={uniformIcon} alt="" aria-hidden="true" />
              </button>
              <div className="player-marker__label" aria-hidden="true">
                <span className="player-marker__name">{slot.player?.name ?? slot.label}</span>
                <span className="player-marker__meta">
                  {slot.position}
                  {slot.isLocked ? ' · 고정' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lineup-board__bench">
        <div className="lineup-board__bench-header">
          <strong>벤치</strong>
          <span>{benchPlayers.length}명</span>
        </div>

        <div className="lineup-board__bench-list">
          {benchPlayers.map((player) => {
            const isDragged = dragState?.item.type === 'bench' && dragState.item.playerId === player.id;

            return (
              <button
                key={player.id}
                type="button"
                className={`bench-marker ${isEditing ? 'bench-marker--editable' : ''} ${
                  isDragged ? 'bench-marker--dragging' : ''
                }`}
                onPointerDown={(event) =>
                  handlePointerDown(event, {
                    type: 'bench',
                    playerId: player.id,
                    playerName: player.name
                  })
                }
              >
                <span className="bench-marker__circle" aria-hidden="true" />
                <span className="bench-marker__name">{player.name}</span>
              </button>
            );
          })}
          {benchPlayers.length === 0 ? <p className="muted">현재 쿼터 벤치 선수가 없습니다.</p> : null}
        </div>
      </div>

      {dragState ? (
        <div
          className={`drag-ghost drag-ghost--${dragState.item.type}`}
          style={{ left: dragState.x, top: dragState.y }}
          aria-hidden="true"
        >
          {dragState.item.type === 'slot' ? (
            <img className="kit-icon" src={uniformIcon} alt="" />
          ) : (
            <span className="bench-marker__circle" />
          )}
          <span className="drag-ghost__label">{dragState.item.playerName}</span>
        </div>
      ) : null}
    </div>
  );
}
