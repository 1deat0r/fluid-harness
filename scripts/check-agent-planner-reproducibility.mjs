import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentPlannerCandidate,
  AgentPlannerCase,
  AgentPlannerPromotionAuthority,
  AgentPlannerSearchRunner,
  isTrustedAgentPlannerReproducibilityReport
} from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

const candidate = new AgentPlannerCandidate({
  id: 'planner-reproducible-direct',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'planner-reproducible-direct-planner'
  })
});

function expectedProof(report) {
  return report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === 'PROVEN';
}

const cases = [
  new AgentPlannerCase({
    id: 'planner-reproducible-graph',
    domain: 'graph',
    goal: 'graph',
    context: { taskId: 'planner-reproducible-graph-task', description: 'Find a graph path' },
    task: { id: 'planner-reproducible-graph-task', description: 'Find a graph path' },
    expected: expectedProof
  }),
  new AgentPlannerCase({
    id: 'planner-reproducible-skeptic',
    domain: 'robustness',
    goal: 'graph-skeptic',
    context: { taskId: 'planner-reproducible-skeptic-task', description: 'Find a graph path' },
    task: { id: 'planner-reproducible-skeptic-task', description: 'Find a graph path' },
    productionEligible: false,
    adversarial: true,
    expected: expectedProof
  })
];

const budgets = {
  production: new EvaluationBudget({ maxCases: 1 }),
  research: new EvaluationBudget({ maxCases: 2 }),
  skeptic: new EvaluationBudget({ maxCases: 1 })
};

function evaluate() {
  return new AgentPlannerSearchRunner().evaluate({
    candidates: [candidate],
    cases,
    productionBudget: budgets.production,
    researchBudget: budgets.research,
    skepticBudget: budgets.skeptic
  });
}

const primary = evaluate();
const reproduction = evaluate();
const authority = new AgentPlannerPromotionAuthority();
const reproducibility = authority.reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: candidate.id
});

assert.equal(isTrustedAgentPlannerReproducibilityReport(reproducibility), true);
assert.equal(reproducibility.reproducible, true);
assert.deepEqual(reproducibility.reasons, []);
assert.equal(typeof reproducibility.definitionFingerprint, 'string');
assert.equal(primary.complete, true);
assert.equal(reproduction.complete, true);
assert.equal(primary.results[0].definitionFingerprint, reproduction.results[0].definitionFingerprint);
assert.equal(primary.results[0].research.results.length, reproduction.results[0].research.results.length);
assert.equal(primary.results[0].research.results[0].success, true);
assert.equal(primary.results[0].skeptic.results[0].proven, true);

console.log(
  `FLUID_AGENT_PLANNER_REPRODUCIBILITY_OK candidate=${candidate.id} `
  + `reproducible=${reproducibility.reproducible} definitionBound=${reproducibility.definitionFingerprint !== null} `
  + `primaryModes=${primary.results[0].production.mode},${primary.results[0].research.mode},${primary.results[0].skeptic.mode}`
);
