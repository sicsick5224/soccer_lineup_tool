import { FORMATIONS } from '../constants/formations';
import { createEmptyPlan, generateMatchPlan } from '../lib/lineup';
import { validatePlanTitle, validateRosterForGeneration } from '../lib/validation';
import type { FormationType, MatchPlan, TeamRoster } from '../types/domain';

interface PlanBuilderProps {
  rosters: TeamRoster[];
  savedPlans: MatchPlan[];
  activeRosterId: string | null;
  currentPlan: MatchPlan | null;
  onSetCurrentPlan: (plan: MatchPlan) => void;
  onSavePlan: (plan: MatchPlan) => void;
  onDeletePlan: (planId: string) => void;
  onSelectRoster: (rosterId: string) => void;
  generationWarnings: string[];
  onSetGenerationWarnings: (warnings: string[]) => void;
}

export function PlanBuilder({
  rosters,
  savedPlans,
  activeRosterId,
  currentPlan,
  onSetCurrentPlan,
  onSavePlan,
  onDeletePlan,
  onSelectRoster,
  generationWarnings,
  onSetGenerationWarnings
}: PlanBuilderProps) {
  const activeRoster = rosters.find((roster) => roster.id === activeRosterId) ?? null;
  const draftPlan = currentPlan ?? createEmptyPlan(activeRoster?.id ?? '');
  const hasPrimaryGk = activeRoster?.players.some((player) => player.primaryPosition === 'GK') ?? false;

  const updatePlan = (nextPlan: MatchPlan) => {
    onSetCurrentPlan({
      ...nextPlan,
      rosterId: activeRosterId ?? nextPlan.rosterId
    });
  };

  const handleGeneratePlan = () => {
    if (!activeRoster) {
      onSetGenerationWarnings(['팀 명단을 먼저 선택해주세요.']);
      return;
    }

    const titleError = validatePlanTitle(draftPlan.title);
    const rosterError = validateRosterForGeneration(activeRoster, draftPlan.gkCandidates);

    if (titleError || rosterError) {
      onSetGenerationWarnings([titleError, rosterError].filter(Boolean) as string[]);
      return;
    }

    const result = generateMatchPlan({
      title: draftPlan.title,
      roster: activeRoster,
      formation: draftPlan.formation,
      gkCandidates: draftPlan.gkCandidates
    });

    onSetCurrentPlan(result.matchPlan);
    onSetGenerationWarnings(result.warnings.map((warning) => warning.message));
  };

  const handleLoadPlan = (planId: string) => {
    const plan = savedPlans.find((item) => item.id === planId);
    if (!plan) {
      return;
    }

    onSetCurrentPlan(plan);
    onSelectRoster(plan.rosterId);
    onSetGenerationWarnings([]);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>경기 계획 생성</h2>
          <p className="muted">명단과 포메이션을 선택하고 4쿼터 기본 편성을 생성합니다.</p>
        </div>
      </div>

      <div className="grid-two">
        <label className="field">
          <span>팀 명단 선택</span>
          <select value={activeRosterId ?? ''} onChange={(event) => onSelectRoster(event.target.value)}>
            <option value="">명단 선택</option>
            {rosters.map((roster) => (
              <option key={roster.id} value={roster.id}>
                {roster.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>경기 계획 이름</span>
          <input
            value={draftPlan.title}
            onChange={(event) => updatePlan({ ...draftPlan, title: event.target.value })}
            placeholder="예: 3월 둘째 주 경기"
          />
        </label>
      </div>

      <label className="field">
        <span>포메이션</span>
        <select
          value={draftPlan.formation}
          onChange={(event) => updatePlan({ ...draftPlan, formation: event.target.value as FormationType })}
        >
          {FORMATIONS.map((formation) => (
            <option key={formation} value={formation}>
              {formation}
            </option>
          ))}
        </select>
      </label>

      {activeRoster ? (
        <div className="notice">
          <strong>GK 감지 결과</strong>
          <p>{hasPrimaryGk ? '주 포지션 GK가 있어 자동 우선 배치됩니다.' : '주 포지션 GK가 없어 후보 지정이 필요합니다.'}</p>
        </div>
      ) : null}

      {!hasPrimaryGk && activeRoster ? (
        <div className="field">
          <span>GK 후보 선택</span>
          <div className="chips">
            {activeRoster.players.map((player) => (
              <label
                key={player.id}
                className={`chip ${draftPlan.gkCandidates.includes(player.id) ? 'chip-active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={draftPlan.gkCandidates.includes(player.id)}
                  onChange={() =>
                    updatePlan({
                      ...draftPlan,
                      gkCandidates: draftPlan.gkCandidates.includes(player.id)
                        ? draftPlan.gkCandidates.filter((id) => id !== player.id)
                        : [...draftPlan.gkCandidates, player.id]
                    })
                  }
                />
                <span>{player.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {generationWarnings.length > 0 ? (
        <div className="warning-list">
          {generationWarnings.map((warning, index) => (
            <p key={`${warning}-${index}`} className="warning-text">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <div className="button-row">
        <button type="button" onClick={handleGeneratePlan}>
          자동 편성 실행
        </button>
        {currentPlan ? (
          <button type="button" className="secondary-button" onClick={() => onSavePlan(currentPlan)}>
            경기 계획 저장
          </button>
        ) : null}
      </div>

      <div className="subsection">
        <div className="panel-header">
          <h3>저장된 경기 계획</h3>
          <span className="badge">{savedPlans.length}개</span>
        </div>
        <div className="stack">
          {savedPlans.map((plan) => (
            <article key={plan.id} className="list-card">
              <div>
                <strong>{plan.title}</strong>
                <p className="muted">
                  {plan.formation} / 저장 시각 {new Date(plan.updatedAt).toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="button-row">
                <button type="button" className="secondary-button" onClick={() => handleLoadPlan(plan.id)}>
                  불러오기
                </button>
                <button type="button" className="danger-button" onClick={() => onDeletePlan(plan.id)}>
                  삭제
                </button>
              </div>
            </article>
          ))}
          {savedPlans.length === 0 ? <p className="muted">저장된 경기 계획이 없습니다.</p> : null}
        </div>
      </div>
    </section>
  );
}
