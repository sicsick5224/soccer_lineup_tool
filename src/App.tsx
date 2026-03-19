import { useEffect, useState } from 'react';
import { PlanBuilder } from './components/PlanBuilder';
import { PlanResults } from './components/PlanResults';
import { RosterManager } from './components/RosterManager';
import { createEmptyPlan } from './lib/lineup';
import { deleteMatchPlan, deleteRoster, loadMatchPlans, loadRosters, saveMatchPlan, saveRoster } from './lib/storage';
import { nowIso } from './lib/utils';
import type { MatchPlan, QuarterIndex, TeamRoster } from './types/domain';

type ViewKey = 'rosters' | 'builder' | 'results';

export default function App() {
  const [rosters, setRosters] = useState<TeamRoster[]>([]);
  const [savedPlans, setSavedPlans] = useState<MatchPlan[]>([]);
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<MatchPlan | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterIndex>(1);
  const [activeView, setActiveView] = useState<ViewKey>('rosters');
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([]);

  useEffect(() => {
    const nextRosters = loadRosters();
    const nextPlans = loadMatchPlans();
    setRosters(nextRosters);
    setSavedPlans(nextPlans);
    if (nextRosters[0]) {
      setActiveRosterId(nextRosters[0].id);
      setCurrentPlan(createEmptyPlan(nextRosters[0].id));
    }
  }, []);

  const activeRoster = rosters.find((roster) => roster.id === activeRosterId) ?? null;

  const handleSaveRoster = (roster: TeamRoster) => {
    const nextRosters = saveRoster(roster);
    setRosters(nextRosters);
    setActiveRosterId(roster.id);

    if (!currentPlan || currentPlan.rosterId !== roster.id) {
      setCurrentPlan(createEmptyPlan(roster.id));
    }
  };

  const handleDeleteRoster = (rosterId: string) => {
    const nextRosters = deleteRoster(rosterId);
    setRosters(nextRosters);

    if (activeRosterId === rosterId) {
      const nextRosterId = nextRosters[0]?.id ?? null;
      setActiveRosterId(nextRosterId);
      setCurrentPlan(nextRosterId ? createEmptyPlan(nextRosterId) : null);
    }
  };

  const handleSelectRoster = (rosterId: string) => {
    const nextRosterId = rosterId || null;
    setActiveRosterId(nextRosterId);
    setGenerationWarnings([]);
    if (nextRosterId) {
      setCurrentPlan((existingPlan) =>
        existingPlan && existingPlan.rosterId === nextRosterId ? existingPlan : createEmptyPlan(nextRosterId)
      );
    } else {
      setCurrentPlan(null);
    }
  };

  const handleSavePlan = (plan: MatchPlan) => {
    const timestamp = nowIso();
    const nextPlan = {
      ...plan,
      createdAt: plan.createdAt || timestamp,
      updatedAt: timestamp
    };
    const nextPlans = saveMatchPlan(nextPlan);
    setSavedPlans(nextPlans);
    setCurrentPlan(nextPlan);
  };

  const handleDeletePlan = (planId: string) => {
    const nextPlans = deleteMatchPlan(planId);
    setSavedPlans(nextPlans);
    if (currentPlan?.id === planId) {
      setCurrentPlan(activeRosterId ? createEmptyPlan(activeRosterId) : null);
    }
  };

  const handleChangePlan = (plan: MatchPlan, warnings: string[]) => {
    setCurrentPlan({ ...plan, updatedAt: nowIso() });
    setGenerationWarnings(warnings);
  };

  const planForActiveRoster =
    currentPlan && activeRoster && currentPlan.rosterId === activeRoster.id ? currentPlan : null;

  return (
    <div className="app-shell">
      <nav className="tab-row main-tabs">
        <button type="button" className={`tab-button ${activeView === 'rosters' ? 'tab-active' : ''}`} onClick={() => setActiveView('rosters')}>
          팀 명단
        </button>
        <button type="button" className={`tab-button ${activeView === 'builder' ? 'tab-active' : ''}`} onClick={() => setActiveView('builder')}>
          계획 생성
        </button>
        <button type="button" className={`tab-button ${activeView === 'results' ? 'tab-active' : ''}`} onClick={() => setActiveView('results')}>
          편성 결과
        </button>
      </nav>

      <main className="content-stack">
        {activeView === 'rosters' ? (
          <RosterManager
            rosters={rosters}
            activeRosterId={activeRosterId}
            onSelectRoster={handleSelectRoster}
            onSaveRoster={handleSaveRoster}
            onDeleteRoster={handleDeleteRoster}
          />
        ) : null}

        {activeView === 'builder' ? (
          <PlanBuilder
            rosters={rosters}
            savedPlans={savedPlans}
            activeRosterId={activeRosterId}
            currentPlan={currentPlan}
            onSetCurrentPlan={setCurrentPlan}
            onSavePlan={handleSavePlan}
            onDeletePlan={handleDeletePlan}
            onSelectRoster={handleSelectRoster}
            generationWarnings={generationWarnings}
            onSetGenerationWarnings={setGenerationWarnings}
          />
        ) : null}

        {activeView === 'results' ? (
          <PlanResults
            roster={activeRoster}
            plan={planForActiveRoster}
            selectedQuarter={selectedQuarter}
            onSelectQuarter={setSelectedQuarter}
            onSavePlan={handleSavePlan}
            onChangePlan={handleChangePlan}
          />
        ) : null}
      </main>
    </div>
  );
}
