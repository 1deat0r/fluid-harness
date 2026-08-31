import { buildDistributionShiftFixture } from './distribution-shift.mjs';
import { buildHarnessFactoryFixture } from './harness-factory.mjs';

export function buildHarnessFactorySelfDesignFixture({
  prefix = 'harness-factory-self-design',
  includeResearchEvidence = true
} = {}) {
  const fixture = buildHarnessFactoryFixture({
    prefix,
    includeResearch: false,
    proposalExportName: 'proposeSelfDesignedArchitecture',
    includeFailingPlanner: true
  });
  let researchArchive = null;
  if (includeResearchEvidence) {
    const { report } = buildDistributionShiftFixture({
      prefix: `${prefix}-research`
    });
    researchArchive = fixture.ledger.appendDistributionShift(report);
  }
  const selfDesignOptions = (overrides = {}) => ({
    goal: 'research and build an evidence-selected bounded graph harness',
    plannerCandidates: [fixture.failingPlannerCandidate, fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    holdoutCases: [fixture.holdoutCase],
    holdoutProductionBudget: fixture.budgets.productionBudget,
    holdoutResearchBudget: fixture.budgets.researchBudget,
    holdoutSkepticBudget: fixture.budgets.skepticBudget,
    agentGoal: 'graph',
    agentContext: {
      taskId: `${prefix}-agent-task`,
      description: 'Find a graph path'
    },
    agentReproduction: `${prefix}-agent-proof`,
    ...overrides
  });
  return {
    ...fixture,
    researchArchive,
    selfDesignOptions
  };
}
