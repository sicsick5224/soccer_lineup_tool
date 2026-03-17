import { useEffect, useMemo, useState } from 'react';
import {
  applyDragItemToQuarterPlan,
  assignPlayerToSlot,
  calculateFieldPlayCounts,
  getQuarterSubstitutionViews,
  getQuarterViews,
  hasTemporaryPlacementWarnings,
  getSubstitutionSlotIds,
  recalculateMatchPlan,
  sortPlayersByFieldPlayCounts,
  type PlayerStatsSortDirection
} from '../lib/lineup';
import { compareText, createId, nowIso } from '../lib/utils';
import { validateSubstitution } from '../lib/validation';
import { LineupBoard } from './LineupBoard';
import type {
  BoardDragItem,
  BoardDragState,
  MatchPlan,
  MidGameSubstitution,
  QuarterIndex,
  QuarterPlan,
  TeamRoster
} from '../types/domain';

interface PlanResultsProps {
  roster: TeamRoster | null;
  plan: MatchPlan | null;
  selectedQuarter: QuarterIndex;
  onSelectQuarter: (quarterIndex: QuarterIndex) => void;
  onSavePlan: (plan: MatchPlan) => void;
  onChangePlan: (plan: MatchPlan, warnings: string[]) => void;
}

type SubstitutionDraft = {
  id: string;
  quarterIndex: QuarterIndex;
  minuteOffset: number;
  outPlayerId: string;
  inPlayerId: string;
  slotId: string;
  note: string;
};

function createSubstitutionDraft(quarterIndex: QuarterIndex): SubstitutionDraft {
  return {
    id: '',
    quarterIndex,
    minuteOffset: 0,
    outPlayerId: '',
    inPlayerId: '',
    slotId: '',
    note: ''
  };
}

function getTemporaryPlacementNoticeKey(planId: string): string {
  return `soccer-lineup-tool:dismissed-temp-placement:${planId}`;
}

export function PlanResults({
  roster,
  plan,
  selectedQuarter,
  onSelectQuarter,
  onSavePlan,
  onChangePlan
}: PlanResultsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<PlayerStatsSortDirection>('field-desc');
  const [substitutionDraft, setSubstitutionDraft] = useState<SubstitutionDraft>(createSubstitutionDraft(selectedQuarter));
  const [error, setError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<BoardDragState | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isTemporaryPlacementNoticeDismissed, setIsTemporaryPlacementNoticeDismissed] = useState(false);
  const [hasLoadedTemporaryPlacementNoticePreference, setHasLoadedTemporaryPlacementNoticePreference] = useState(false);

  useEffect(() => {
    setSubstitutionDraft((currentDraft) =>
      currentDraft.id ? { ...currentDraft, quarterIndex: selectedQuarter } : createSubstitutionDraft(selectedQuarter)
    );
  }, [selectedQuarter]);

  useEffect(() => {
    if (!isEditing) {
      setSelectedSlotId(null);
      setError(null);
      setDragState(null);
      setSubstitutionDraft(createSubstitutionDraft(selectedQuarter));
    }
  }, [isEditing, selectedQuarter]);

  useEffect(() => {
    setHasUnsavedChanges(false);
    setDragState(null);
    setSelectedSlotId(null);
  }, [plan?.id]);

  const quarterViews = useMemo(() => (roster && plan ? getQuarterViews(roster, plan) : []), [plan, roster]);
  const activeQuarter = quarterViews.find((quarterView) => quarterView.quarterIndex === selectedQuarter) ?? quarterViews[0] ?? null;
  const activeQuarterPlan =
    plan && activeQuarter
      ? plan.quarterPlans.find((quarterPlan) => quarterPlan.quarterIndex === activeQuarter.quarterIndex) ?? null
      : null;
  const stats = useMemo(
    () => (roster && plan ? calculateFieldPlayCounts(roster, plan) : {}),
    [plan, roster]
  );
  const selectedSlot = activeQuarter?.lineup.find((slot) => slot.slotId === selectedSlotId) ?? null;
  const selectablePlayers = useMemo(
    () => (roster ? [...roster.players].sort((left, right) => compareText(left.name, right.name)) : []),
    [roster]
  );
  const benchPlayerIds = new Set(activeQuarter?.bench.map((player) => player.id) ?? []);
  const sortedPlayers = useMemo(
    () => (roster ? sortPlayersByFieldPlayCounts(roster.players, stats, sortDirection) : []),
    [roster, stats, sortDirection]
  );
  const quarterSubstitutions = useMemo(
    () => (roster && plan && activeQuarter ? getQuarterSubstitutionViews(roster, plan, activeQuarter.quarterIndex) : []),
    [activeQuarter, plan, roster]
  );
  const substitutionSlotIds = useMemo(
    () => (plan && activeQuarter ? getSubstitutionSlotIds(plan, activeQuarter.quarterIndex) : []),
    [activeQuarter, plan]
  );
  const sortedAllSubstitutions = useMemo(
    () =>
      [...(plan?.midGameSubstitutions ?? [])].sort((left, right) => {
        const quarterDiff = left.quarterIndex - right.quarterIndex;
        if (quarterDiff !== 0) {
          return quarterDiff;
        }

        const minuteDiff = left.minuteOffset - right.minuteOffset;
        if (minuteDiff !== 0) {
          return minuteDiff;
        }

        return compareText(left.id, right.id);
      }),
    [plan?.midGameSubstitutions]
  );
  const shouldShowTemporaryPlacementNotice = useMemo(
    () =>
      roster && plan
        ? hasLoadedTemporaryPlacementNoticePreference &&
          hasTemporaryPlacementWarnings(roster, plan) &&
          !isTemporaryPlacementNoticeDismissed
        : false,
    [hasLoadedTemporaryPlacementNoticePreference, isTemporaryPlacementNoticeDismissed, plan, roster]
  );

  useEffect(() => {
    if (!plan) {
      setIsTemporaryPlacementNoticeDismissed(false);
      setHasLoadedTemporaryPlacementNoticePreference(false);
      return;
    }

    const dismissed = window.localStorage.getItem(getTemporaryPlacementNoticeKey(plan.id)) === 'true';
    setIsTemporaryPlacementNoticeDismissed(dismissed);
    setHasLoadedTemporaryPlacementNoticePreference(true);
  }, [plan]);

  if (!roster || !plan || !activeQuarter) {
    return (
      <section className="panel">
        <h2>편성 결과</h2>
        <p className="muted">자동 편성을 실행하거나 저장된 경기 계획을 불러오면 결과가 표시됩니다.</p>
      </section>
    );
  }

  const commitPlanChange = (nextPlan: MatchPlan, warnings: string[] = []) => {
    setHasUnsavedChanges(true);
    onChangePlan(
      {
        ...nextPlan,
        updatedAt: nowIso()
      },
      warnings
    );
  };

  const updateActiveQuarterPlan = (transform: (quarterPlan: QuarterPlan) => QuarterPlan) => {
    if (!activeQuarterPlan) {
      return;
    }

    const nextQuarterPlan = transform(activeQuarterPlan);
    if (nextQuarterPlan === activeQuarterPlan) {
      return;
    }

    const nextQuarterPlans = plan.quarterPlans.map((quarterPlan) =>
      quarterPlan.quarterIndex === activeQuarter.quarterIndex ? nextQuarterPlan : quarterPlan
    );

    commitPlanChange({
      ...plan,
      quarterPlans: nextQuarterPlans
    });
  };

  const updateAssignment = (slotId: string, playerId: string) => {
    updateActiveQuarterPlan((quarterPlan) => assignPlayerToSlot(quarterPlan, slotId, playerId));
  };

  const toggleLock = (slotId: string) => {
    updateActiveQuarterPlan((quarterPlan) => {
      const isLocked = quarterPlan.lockedSlotIds.includes(slotId);
      return {
        ...quarterPlan,
        lockedSlotIds: isLocked
          ? quarterPlan.lockedSlotIds.filter((id) => id !== slotId)
          : [...quarterPlan.lockedSlotIds, slotId]
      };
    });
  };

  const handleRecalculate = () => {
    const result = recalculateMatchPlan(roster, plan);
    commitPlanChange(result.matchPlan, result.warnings.map((warning) => warning.message));
  };

  const handleSaveCurrentPlan = () => {
    onSavePlan(plan);
    setHasUnsavedChanges(false);
  };

  const handleSaveSubstitution = () => {
    const validationError = validateSubstitution(substitutionDraft, roster);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextSubstitution: MidGameSubstitution = {
      id: substitutionDraft.id || createId('sub'),
      quarterIndex: substitutionDraft.quarterIndex,
      minuteOffset: substitutionDraft.minuteOffset,
      outPlayerId: substitutionDraft.outPlayerId,
      inPlayerId: substitutionDraft.inPlayerId,
      slotId: substitutionDraft.slotId || undefined,
      note: substitutionDraft.note.trim() || undefined
    };

    const nextPlan = {
      ...plan,
      midGameSubstitutions: substitutionDraft.id
        ? plan.midGameSubstitutions.map((item) => (item.id === substitutionDraft.id ? nextSubstitution : item))
        : [...plan.midGameSubstitutions, nextSubstitution]
    };

    commitPlanChange(nextPlan);
    setSubstitutionDraft(createSubstitutionDraft(selectedQuarter));
    setError(null);
  };

  const handleEditSubstitution = (substitution: MidGameSubstitution) => {
    setSubstitutionDraft({
      id: substitution.id,
      quarterIndex: substitution.quarterIndex,
      minuteOffset: substitution.minuteOffset,
      outPlayerId: substitution.outPlayerId,
      inPlayerId: substitution.inPlayerId,
      slotId: substitution.slotId ?? '',
      note: substitution.note ?? ''
    });
    setError(null);
  };

  const handleDeleteSubstitution = (substitutionId: string) => {
    commitPlanChange({
      ...plan,
      midGameSubstitutions: plan.midGameSubstitutions.filter((item) => item.id !== substitutionId)
    });
  };

  const handleDragStart = (item: BoardDragItem, point: { x: number; y: number }) => {
    setDragState({
      item,
      x: point.x,
      y: point.y,
      overSlotId: item.type === 'slot' ? item.slotId : null
    });
  };

  const handleDragMove = (point: { x: number; y: number }, overSlotId: string | null) => {
    setDragState((current) =>
      current
        ? {
            ...current,
            x: point.x,
            y: point.y,
            overSlotId
          }
        : current
    );
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  const handleDropOnSlot = (targetSlotId: string | null) => {
    if (!dragState || !activeQuarterPlan || !targetSlotId) {
      setDragState(null);
      return;
    }

    const nextQuarterPlan = applyDragItemToQuarterPlan(activeQuarterPlan, dragState.item, targetSlotId);
    if (nextQuarterPlan !== activeQuarterPlan) {
      const nextQuarterPlans = plan.quarterPlans.map((quarterPlan) =>
        quarterPlan.quarterIndex === activeQuarter.quarterIndex ? nextQuarterPlan : quarterPlan
      );

      commitPlanChange({
        ...plan,
        quarterPlans: nextQuarterPlans
      });
      setSelectedSlotId(targetSlotId);
    }

    setDragState(null);
  };

  const handleDismissTemporaryPlacementNotice = () => {
    window.localStorage.setItem(getTemporaryPlacementNoticeKey(plan.id), 'true');
    setIsTemporaryPlacementNoticeDismissed(true);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>편성 결과</h2>
          <p className="muted">
            {plan.title} / {plan.formation}
          </p>
        </div>
        <div className="button-row">
          {hasUnsavedChanges ? <span className="status-pill status-pill--dirty">저장 전 변경 있음</span> : null}
          <button
            type="button"
            className={isEditing ? 'tab-button tab-active' : 'secondary-button'}
            onClick={() => setIsEditing((current) => !current)}
          >
            {isEditing ? '수정 종료' : '수정'}
          </button>
          <button type="button" className="secondary-button" onClick={handleSaveCurrentPlan}>
            저장
          </button>
        </div>
      </div>

      <div className="tab-row">
        {quarterViews.map((quarterView) => (
          <button
            key={quarterView.quarterIndex}
            type="button"
            className={`tab-button ${quarterView.quarterIndex === activeQuarter.quarterIndex ? 'tab-active' : ''}`}
            onClick={() => onSelectQuarter(quarterView.quarterIndex)}
          >
            {quarterView.quarterIndex}Q
          </button>
        ))}
      </div>

      {shouldShowTemporaryPlacementNotice ? (
        <div className="notice notice-warning notice-dismissible">
          <div>
            <strong>임시 배치 안내</strong>
            <p className="muted">일부 포지션은 적합 선수가 부족해 임시 배치로 편성되었습니다.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDismissTemporaryPlacementNotice}
          >
            닫기
          </button>
        </div>
      ) : null}

      <div className="substitution-summary">
        <div className="substitution-summary__header">
          <h3>현재 쿼터 교체</h3>
          <span>{activeQuarter.quarterIndex}Q 기준</span>
        </div>
        <div className="substitution-summary__chips">
          {quarterSubstitutions.length > 0 ? (
            quarterSubstitutions.map((substitution) => (
              <span key={substitution.id} className="substitution-chip">
                {substitution.minuteOffset}'
                {substitution.slotLabel ? ` ${substitution.slotLabel} ·` : ''}
                {' '}
                {substitution.outPlayerName} OUT / {substitution.inPlayerName} IN
              </span>
            ))
          ) : (
            <p className="muted">현재 쿼터에 등록된 교체가 없습니다.</p>
          )}
        </div>
      </div>

      <LineupBoard
        plan={plan}
        quarterView={activeQuarter}
        benchPlayers={activeQuarter.bench}
        substitutionSlotIds={substitutionSlotIds}
        isEditing={isEditing}
        selectedSlotId={selectedSlotId}
        dragState={dragState}
        onSelectSlot={setSelectedSlotId}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDropOnSlot={handleDropOnSlot}
        onDragEnd={handleDragEnd}
      />

      {isEditing ? (
        <div className="subsection">
          <div className="panel-header">
            <h3>수정 도구</h3>
            <button type="button" onClick={handleRecalculate}>
              고정 유지 재계산
            </button>
          </div>

          {selectedSlot ? (
            <article className="list-card">
              <div className="editor-row">
                <div>
                  <strong>{selectedSlot.label}</strong>
                  <p className="muted">현재 배치: {selectedSlot.player?.name ?? '미배치'}</p>
                </div>
                <label className="toggle-lock">
                  <input
                    type="checkbox"
                    checked={selectedSlot.isLocked}
                    onChange={() => toggleLock(selectedSlot.slotId)}
                  />
                  <span>고정</span>
                </label>
              </div>

              <label className="field">
                <span>선수 변경</span>
                <select
                  value={selectedSlot.player?.id ?? ''}
                  onChange={(event) => updateAssignment(selectedSlot.slotId, event.target.value)}
                >
                  {selectablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {benchPlayerIds.has(player.id) ? `${player.name} (벤치)` : player.name}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ) : (
            <p className="muted">수정할 포지션을 보드에서 선택하거나 드래그로 바로 교체하세요.</p>
          )}

          <div className="subsection">
            <h3>중간 교체 관리</h3>
            <div className="grid-two">
              <label className="field">
                <span>쿼터</span>
                <select
                  value={substitutionDraft.quarterIndex}
                  onChange={(event) =>
                    setSubstitutionDraft({
                      ...substitutionDraft,
                      quarterIndex: Number(event.target.value) as QuarterIndex
                    })
                  }
                >
                  {[1, 2, 3, 4].map((quarterIndex) => (
                    <option key={quarterIndex} value={quarterIndex}>
                      {quarterIndex}Q
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>분</span>
                <input
                  type="number"
                  min={0}
                  max={plan.quarterDurationMinutes}
                  value={substitutionDraft.minuteOffset}
                  onChange={(event) =>
                    setSubstitutionDraft({
                      ...substitutionDraft,
                      minuteOffset: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>

            <div className="grid-two">
              <label className="field">
                <span>필드 OUT</span>
                <select
                  value={substitutionDraft.outPlayerId}
                  onChange={(event) => setSubstitutionDraft({ ...substitutionDraft, outPlayerId: event.target.value })}
                >
                  <option value="">선수 선택</option>
                  {roster.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>벤치 IN</span>
                <select
                  value={substitutionDraft.inPlayerId}
                  onChange={(event) => setSubstitutionDraft({ ...substitutionDraft, inPlayerId: event.target.value })}
                >
                  <option value="">선수 선택</option>
                  {roster.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>관련 포지션</span>
              <select
                value={substitutionDraft.slotId}
                onChange={(event) => setSubstitutionDraft({ ...substitutionDraft, slotId: event.target.value })}
              >
                <option value="">선택 안 함</option>
                {activeQuarter.lineup.map((slot) => (
                  <option key={slot.slotId} value={slot.slotId}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>메모</span>
              <input
                value={substitutionDraft.note}
                onChange={(event) => setSubstitutionDraft({ ...substitutionDraft, note: event.target.value })}
                placeholder="예: 체력 안배"
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button type="button" onClick={handleSaveSubstitution}>
              {substitutionDraft.id ? '교체 수정 완료' : '중간 교체 추가'}
            </button>

            <div className="stack">
              {sortedAllSubstitutions.map((substitution) => (
                <article key={substitution.id} className="list-card">
                  <div>
                    <strong>
                      {substitution.quarterIndex}Q {substitution.minuteOffset}'
                    </strong>
                    <p className="muted">
                      {roster.players.find((player) => player.id === substitution.outPlayerId)?.name} OUT /{' '}
                      {roster.players.find((player) => player.id === substitution.inPlayerId)?.name} IN
                      {substitution.slotId ? ` / ${substitution.slotId}` : ''}
                    </p>
                    {substitution.note ? <p className="muted">{substitution.note}</p> : null}
                  </div>
                  <div className="button-row">
                    <button type="button" className="secondary-button" onClick={() => handleEditSubstitution(substitution)}>
                      수정
                    </button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteSubstitution(substitution.id)}>
                      삭제
                    </button>
                  </div>
                </article>
              ))}
              {sortedAllSubstitutions.length === 0 ? <p className="muted">등록된 중간 교체가 없습니다.</p> : null}
            </div>
          </div>
        </div>
        ) : null}

      <div className="subsection">
        <div className="panel-header">
          <h3>선수별 출전 현황</h3>
          <label className="inline-field">
            <span>정렬</span>
            <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as PlayerStatsSortDirection)}>
              <option value="field-desc">출전 쿼터 많은 순</option>
              <option value="field-asc">출전 쿼터 적은 순</option>
            </select>
          </label>
        </div>
        <div className="stack">
          {sortedPlayers.map((player) => {
            const playerStats = stats[player.id];
            return (
              <article key={player.id} className="list-card player-status-card">
                <div>
                  <strong className="player-status-card__name">{player.name}</strong>
                  <p className="muted player-status-card__meta">
                    {[
                      `필드 출전 ${playerStats.fieldPlayQuarters}쿼터`,
                      playerStats.temporaryGkQuarters > 0 ? `임시 GK ${playerStats.temporaryGkQuarters}쿼터` : null,
                      playerStats.substitutionQuarters > 0 ? `교체 ${playerStats.substitutionQuarters}쿼터` : null
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                </div>
                <span className="badge">{player.primaryPosition === 'GK' ? '주 GK' : '필드'}</span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
