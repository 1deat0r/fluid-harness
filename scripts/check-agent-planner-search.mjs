import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentPlannerCandidate,
  AgentPlannerCase,
  AgentPlannerSearchRunner,
  isTrustedAgentPlannerEvaluationReport,
  isTrustedAgentPlannerSearchReport
} from '../src/agent-search.mjs';
import {
  EvaluationBudget,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  ProcessBackedAgentPlanner
} from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function plannerCandidate(id, exportName) {
  return new AgentPlannerCandidate({
    id,
    description: `Process planner ${id}`,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName,
        timeoutMs: 2000
      }),
      plannerId: `${id}-planner`
    })
  });
}

function expectedProof(report) {
  return report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN;
}

const cases = [
  new AgentPlannerCase({
    id: 'planner-search-production',
    domain: 'graph',
    goal: 'graph',
    context: { taskId: 'planner-search-production-task', description: 'Find a graph path' },
    task: { id: 'planner-search-production-task', description: 'Find a graph path' },
    expected: expectedProof
  }),
  new AgentPlannerCase({
    id: 'planner-search-adversarial',
    domain: 'robustness',
    goal: 'graph-adversarial',
    context: { taskId: 'planner-search-adversarial-task', description: 'Find a graph path' },
    task: { id: 'planner-search-adversarial-task', description: 'Find a graph path' },
    productionEligible: false,
    adversarial: true,
    expected: expectedProof
  })
];
const runner = new AgentPlannerSearchRunner();
const report = runner.evaluate({
  candidates: [
    plannerCandidate('planner-search-direct', 'planGraphDirect'),
    plannerCandidate('planner-search-malformed', 'planMissingDescription')
  ],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(isTrustedAgentPlannerSearchReport(report), true);
assert.equal(report.complete, true);
assert.equal(report.promoted, null);
assert.equal(report.winner.candidateId, 'planner-search-direct');
assert.equal(report.results.length, 2);
const direct = report.results.find((result) => result.candidateId === 'planner-search-direct');
const malformed = report.results.find((result) => result.candidateId === 'planner-search-malformed');
assert.equal(direct.complete, true);
assert.equal(direct.production.successRate, 1);
assert.equal(direct.research.successRate, 1);
assert.equal(direct.skeptic.successRate, 1);
assert.equal(direct.production.results[0].plannerId, 'planner-search-direct-planner');
assert.equal(isTrustedAgentPlannerEvaluationReport(direct.research), true);
assert.equal(malformed.complete, true);
assert.equal(malformed.production.successRate, 0);
assert.equal(malformed.research.successRate, 0);
assert.equal(malformed.skeptic.successRate, 0);
assert.equal(malformed.research.results[0].proven, false);
assert.equal(malformed.research.results[0].stopReason, null);
assert.equal(Object.isFrozen(report.results), true);

console.log(
  `FLUID_AGENT_PLANNER_SEARCH_OK winner=${report.winner.candidateId} `
  + `directProduction=${direct.production.successRate} directResearch=${direct.research.successRate} `
  + `directSkeptic=${direct.skeptic.successRate} malformedProof=${malformed.research.results[0].proven} `
  + `promoted=${report.promoted ?? 'none'} modes=${POLICY_MODES.PRODUCTION},${POLICY_MODES.RESEARCH},${POLICY_MODES.SKEPTIC}`
);
