import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCandidate,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureSearchReport,
  isTrustedAgentArchitectureSearchResult
} from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function plannerCandidate(id, exportName) {
  return new AgentPlannerCandidate({
    id: `${id}-planner-candidate`,
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

function architectureCandidate(id, exportName, components) {
  return new AgentArchitectureCandidate({
    id,
    description: `Bounded architecture ${id}`,
    plannerCandidate: plannerCandidate(id, exportName),
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components
  });
}

const cases = [
  new AgentPlannerCase({
    id: 'architecture-search-production',
    domain: 'graph',
    goal: 'graph',
    context: { taskId: 'architecture-search-production-task', description: 'Find a graph path' },
    task: { id: 'architecture-search-production-task', description: 'Find a graph path' },
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new AgentPlannerCase({
    id: 'architecture-search-skeptic',
    domain: 'robustness',
    goal: 'graph-skeptic',
    context: { taskId: 'architecture-search-skeptic-task', description: 'Find a graph path' },
    task: { id: 'architecture-search-skeptic-task', description: 'Find a graph path' },
    productionEligible: false,
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
  })
];

const report = new AgentArchitectureSearchRunner().evaluate({
  candidates: [
    architectureCandidate(
      'architecture-search-direct',
      'planGraphDirect',
      { planner: 'direct-graph', policy: 'bounded-v1', verifier: 'parent-core' }
    ),
    architectureCandidate(
      'architecture-search-zeta',
      'planGraphDirect',
      { planner: 'direct-variant', policy: 'bounded-v2', verifier: 'parent-core' }
    )
  ],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(isTrustedAgentArchitectureSearchReport(report), true);
assert.equal(report.complete, true);
assert.equal(report.promoted, null);
assert.equal(report.winner.architectureId, 'architecture-search-direct');
assert.equal(report.results.length, 2);
const direct = report.results.find((result) => result.architectureId === 'architecture-search-direct');
const variant = report.results.find((result) => result.architectureId === 'architecture-search-zeta');
assert.equal(isTrustedAgentArchitectureSearchResult(direct), true);
assert.equal(direct.complete, true);
assert.equal(direct.fitness.productionSuccessRate, 1);
assert.equal(direct.fitness.researchSuccessRate, 1);
assert.equal(direct.fitness.skepticSuccessRate, 1);
assert.equal(typeof direct.policyDefinitionFingerprint, 'string');
assert.equal(typeof direct.architectureFingerprint, 'string');
assert.equal(Object.isFrozen(direct.candidate.components), true);
assert.equal(direct.plannerReport.promoted, null);
assert.equal(direct.plannerReport.results[0].production.results[0].proven, true);
assert.equal(variant.complete, true);
assert.equal(variant.fitness.productionSuccessRate, 1);
assert.equal(variant.fitness.researchSuccessRate, 1);
assert.equal(variant.fitness.skepticSuccessRate, 1);

console.log(
  `FLUID_AGENT_ARCHITECTURE_SEARCH_OK winner=${report.winner.architectureId} `
  + `directProduction=${direct.fitness.productionSuccessRate} `
  + `directPolicy=${direct.policyDefinitionFingerprint !== null} `
  + `promoted=${report.promoted ?? 'none'} complete=${report.complete}`
);
