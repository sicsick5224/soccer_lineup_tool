import { useEffect, useState } from 'react';
import { OUTFIELD_POSITIONS, POSITIONS } from '../constants/formations';
import { createId, nowIso } from '../lib/utils';
import { validateRoster } from '../lib/validation';
import type { OutfieldPosition, Player, TeamRoster } from '../types/domain';

interface RosterManagerProps {
  rosters: TeamRoster[];
  activeRosterId: string | null;
  onSelectRoster: (rosterId: string) => void;
  onSaveRoster: (roster: TeamRoster) => void;
  onDeleteRoster: (rosterId: string) => void;
}

type PlayerDraft = {
  id?: string;
  name: string;
  primaryPosition: Player['primaryPosition'];
  secondaryPositions: OutfieldPosition[];
};

const EMPTY_PLAYER_DRAFT: PlayerDraft = {
  name: '',
  primaryPosition: 'CB',
  secondaryPositions: []
};

function createEmptyRoster(): TeamRoster {
  const timestamp = nowIso();
  return {
    id: createId('roster'),
    name: '',
    players: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function RosterManager({ rosters, activeRosterId, onSelectRoster, onSaveRoster, onDeleteRoster }: RosterManagerProps) {
  const [draftRoster, setDraftRoster] = useState<TeamRoster>(createEmptyRoster());
  const [playerDraft, setPlayerDraft] = useState<PlayerDraft>(EMPTY_PLAYER_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const activeRoster = rosters.find((roster) => roster.id === activeRosterId);
    setDraftRoster(activeRoster ?? createEmptyRoster());
    setPlayerDraft(EMPTY_PLAYER_DRAFT);
    setError(null);
  }, [activeRosterId, rosters]);

  const handleCreateNew = () => {
    onSelectRoster('');
    setDraftRoster(createEmptyRoster());
    setPlayerDraft(EMPTY_PLAYER_DRAFT);
    setError(null);
  };

  const handleAddOrUpdatePlayer = () => {
    if (!playerDraft.name.trim()) {
      setError('선수 이름을 입력해주세요.');
      return;
    }

    const nextPlayer: Player = {
      id: playerDraft.id ?? createId('player'),
      name: playerDraft.name.trim(),
      primaryPosition: playerDraft.primaryPosition,
      secondaryPositions: playerDraft.secondaryPositions.filter((position) => position !== playerDraft.primaryPosition)
    };

    const nextPlayers = playerDraft.id
      ? draftRoster.players.map((player) => (player.id === playerDraft.id ? nextPlayer : player))
      : [...draftRoster.players, nextPlayer];

    setDraftRoster({ ...draftRoster, players: nextPlayers });
    setPlayerDraft(EMPTY_PLAYER_DRAFT);
    setError(null);
  };

  const handleEditPlayer = (player: Player) => {
    setPlayerDraft({
      id: player.id,
      name: player.name,
      primaryPosition: player.primaryPosition,
      secondaryPositions: player.secondaryPositions
    });
    setError(null);
  };

  const handleDeletePlayer = (playerId: string) => {
    setDraftRoster({
      ...draftRoster,
      players: draftRoster.players.filter((player) => player.id !== playerId)
    });
  };

  const handleToggleSecondaryPosition = (position: OutfieldPosition) => {
    setPlayerDraft((currentDraft) => ({
      ...currentDraft,
      secondaryPositions: currentDraft.secondaryPositions.includes(position)
        ? currentDraft.secondaryPositions.filter((item) => item !== position)
        : [...currentDraft.secondaryPositions, position]
    }));
  };

  const handleSaveRoster = () => {
    const validationError = validateRoster(
      draftRoster.name,
      draftRoster.players.map((player) => player.name)
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    const timestamp = nowIso();
    const nextRoster = {
      ...draftRoster,
      updatedAt: timestamp,
      createdAt: draftRoster.createdAt || timestamp
    };

    onSaveRoster(nextRoster);
    onSelectRoster(nextRoster.id);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>팀 명단 관리</h2>
          <p className="muted">저장된 명단을 선택하거나 새 명단을 작성하세요.</p>
        </div>
        <button type="button" className="secondary-button" onClick={handleCreateNew}>
          새 명단
        </button>
      </div>

      <label className="field">
        <span>저장된 팀 명단</span>
        <select value={activeRosterId ?? ''} onChange={(event) => onSelectRoster(event.target.value)}>
          <option value="">새 명단 작성</option>
          {rosters.map((roster) => (
            <option key={roster.id} value={roster.id}>
              {roster.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>팀 명단 이름</span>
        <input
          value={draftRoster.name}
          onChange={(event) => setDraftRoster({ ...draftRoster, name: event.target.value })}
          placeholder="예: 일요일 아침 팀"
        />
      </label>

      <div className="subsection">
        <h3>선수 입력</h3>
        <div className="grid-two">
          <label className="field">
            <span>이름</span>
            <input
              value={playerDraft.name}
              onChange={(event) => setPlayerDraft({ ...playerDraft, name: event.target.value })}
              placeholder="홍길동"
            />
          </label>

          <label className="field">
            <span>주 포지션</span>
            <select
              value={playerDraft.primaryPosition}
              onChange={(event) =>
                setPlayerDraft({
                  ...playerDraft,
                  primaryPosition: event.target.value as Player['primaryPosition'],
                  secondaryPositions: playerDraft.secondaryPositions.filter(
                    (position) => position !== event.target.value
                  )
                })
              }
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span>서브 포지션</span>
          <div className="chips">
            {OUTFIELD_POSITIONS.map((position) => (
              <label
                key={position}
                className={`chip ${playerDraft.secondaryPositions.includes(position) ? 'chip-active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={playerDraft.secondaryPositions.includes(position)}
                  onChange={() => handleToggleSecondaryPosition(position)}
                  disabled={playerDraft.primaryPosition === position}
                />
                <span>{position}</span>
              </label>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleAddOrUpdatePlayer}>
          {playerDraft.id ? '선수 수정 완료' : '선수 추가'}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="subsection">
        <div className="panel-header">
          <h3>선수 목록</h3>
          <span className="badge">{draftRoster.players.length}명</span>
        </div>
        <div className="stack">
          {draftRoster.players.map((player) => (
            <article key={player.id} className="list-card">
              <div>
                <strong>{player.name}</strong>
                <p className="muted">
                  주 포지션 {player.primaryPosition}
                  {player.secondaryPositions.length > 0 ? ` / 서브 ${player.secondaryPositions.join(', ')}` : ''}
                </p>
              </div>
              <div className="button-row">
                <button type="button" className="secondary-button" onClick={() => handleEditPlayer(player)}>
                  수정
                </button>
                <button type="button" className="danger-button" onClick={() => handleDeletePlayer(player.id)}>
                  삭제
                </button>
              </div>
            </article>
          ))}
          {draftRoster.players.length === 0 ? <p className="muted">선수를 추가해 명단을 구성하세요.</p> : null}
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={handleSaveRoster}>
          팀 명단 저장
        </button>
        {activeRosterId ? (
          <button type="button" className="danger-button" onClick={() => onDeleteRoster(activeRosterId)}>
            현재 명단 삭제
          </button>
        ) : null}
      </div>
    </section>
  );
}
