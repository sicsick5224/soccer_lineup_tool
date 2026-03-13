import { useEffect, useState } from 'react';
import { QUARTER_DURATION_MINUTES } from '../constants/formations';
import { getAllowedPlayersForSlot, getQuarterViews, recalculateMatchPlan } from '../lib/lineup';
import { createId, nowIso } from '../lib/utils';
import { validateSubstitution } from '../lib/validation';
import type { MatchPlan, MidGameSubstitution, QuarterIndex, TeamRoster } from '../types/domain';

interface PlanEditorProps {
  roster: TeamRoster | null;
  plan: MatchPlan | null;
  selectedQuarter: QuarterIndex;
  onSelectQuarter: (quarterIndex: QuarterIndex) => void;
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

export function PlanEditor({ roster, plan, selectedQuarter, onSelectQuarter, onChangePlan }: PlanEditorProps) {
  const [substitutionDraft, setSubstitutionDraft] = useState<SubstitutionDraft>(createSubstitutionDraft(selectedQuarter));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubstitutionDraft((currentDraft) => ({ ...currentDraft, quarterIndex: selectedQuarter }));
  }, [selectedQuarter]);

  if (!roster || !plan) {
    return (
      <section className="panel">
        <h2>수동 수정</h2>
        <p className="muted">편성 결과가 있어야 수동 수정과 중간 교체 관리가 가능합니다.</p>
      </section>
    );
  }

  const quarterViews = getQuarterViews(roster, plan);
  const activeQuarter = quarterViews.find((quarterView) => quarterView.quarterIndex === selectedQuarter) ?? quarterViews[0];
  const activeQuarterPlan = plan.quarterPlans.find((quarterPlan) => quarterPlan.quarterIndex === activeQuarter.quarterIndex)!;

  const updateAssignment = (slotId: string, playerId: string) => {
    const nextQuarterPlans = plan.quarterPlans.map((quarterPlan) =>
      quarterPlan.quarterIndex === activeQuarter.quarterIndex
        ? {
            ...quarterPlan,
            assignments: quarterPlan.assignments.map((assignment) =>
              assignment.slotId === slotId ? { ...assignment, playerId } : assignment
            )
          }
        : quarterPlan
    );

    onChangePlan(
      {
        ...plan,
        quarterPlans: nextQuarterPlans,
        updatedAt: nowIso()
      },
      []
    );
  };

  const toggleLock = (slotId: string) => {
    const nextQuarterPlans = plan.quarterPlans.map((quarterPlan) => {
      if (quarterPlan.quarterIndex !== activeQuarter.quarterIndex) {
        return quarterPlan;
      }

      const isLocked = quarterPlan.lockedSlotIds.includes(slotId);
      return {
        ...quarterPlan,
        lockedSlotIds: isLocked
          ? quarterPlan.lockedSlotIds.filter((id) => id !== slotId)
          : [...quarterPlan.lockedSlotIds, slotId]
      };
    });

    onChangePlan(
      {
        ...plan,
        quarterPlans: nextQuarterPlans,
        updatedAt: nowIso()
      },
      []
    );
  };

  const handleRecalculate = () => {
    const result = recalculateMatchPlan(roster, plan);
    onChangePlan(result.matchPlan, result.warnings.map((warning) => warning.message));
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
        : [...plan.midGameSubstitutions, nextSubstitution],
      updatedAt: nowIso()
    };

    onChangePlan(nextPlan, []);
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
    onChangePlan(
      {
        ...plan,
        midGameSubstitutions: plan.midGameSubstitutions.filter((item) => item.id !== substitutionId),
        updatedAt: nowIso()
      },
      []
    );
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>수동 수정</h2>
          <p className="muted">슬롯별 선수 변경, 고정, 재계산, 중간 교체 수동 관리를 지원합니다.</p>
        </div>
        <button type="button" onClick={handleRecalculate}>
          고정 유지 재계산
        </button>
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

      <div className="stack">
        {activeQuarter.lineup.map((slot) => {
          const allowedPlayers = getAllowedPlayersForSlot(roster, activeQuarterPlan, slot.slotId);

          return (
            <article key={slot.slotId} className="list-card">
              <div className="editor-row">
                <div>
                  <strong>{slot.label}</strong>
                  <p className="muted">현재 배치: {slot.player?.name ?? '미배정'}</p>
                </div>
                <label className="toggle-lock">
                  <input type="checkbox" checked={slot.isLocked} onChange={() => toggleLock(slot.slotId)} />
                  <span>고정</span>
                </label>
              </div>

              <label className="field">
                <span>선수 변경</span>
                <select value={slot.player?.id ?? ''} onChange={(event) => updateAssignment(slot.slotId, event.target.value)}>
                  {allowedPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.primaryPosition})
                    </option>
                  ))}
                </select>
              </label>
            </article>
          );
        })}
      </div>

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
              max={QUARTER_DURATION_MINUTES}
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
            <span>교체 아웃</span>
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
            <span>교체 인</span>
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
          <span>관련 슬롯</span>
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
          {plan.midGameSubstitutions.map((substitution) => (
            <article key={substitution.id} className="list-card">
              <div>
                <strong>
                  {substitution.quarterIndex}Q {substitution.minuteOffset}분
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
          {plan.midGameSubstitutions.length === 0 ? <p className="muted">등록된 중간 교체가 없습니다.</p> : null}
        </div>
      </div>
    </section>
  );
}
