import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCandidate,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureReproducibilityReport
} from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-reproducible-direct-planner-candidate',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-reproducible-direct-planner'
  })
});

const candidate = new AgentArchitectureCandidate({
  id: 'architecture-reproducible-direct',
  description: 'A deterministic process-isolated graph architecture',
  plannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 2,
    maxToolCallsPerEpisode: 2
  }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-v1',
    verifier: 'parent-core'
  }
});

const evaluationCase = new AgentPlannerCase({
  id: 'architecture-reproducible-graph',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'architecture-reproducible-graph-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'architecture-reproducible-graph-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});

function evaluate() {
  return new AgentArchitectureSearchRunner().evaluate({
    candidates: [candidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}

const primary = evaluate();
const reproduction = evaluate();
const authority = new AgentArchitectureReproducibilityAuthority();
const reproducibility = authority.reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: candidate.id
});

assert.equal(isTrustedAgentArchitectureReproducibilityReport(reproducibility), true);
assert.equal(reproducibility.reproducible, true);
assert.deepEqual(reproducibility.reasons, []);
assert.equal(typeof reproducibility.architectureFingerprint, 'string');
assert.equal(primary.complete, true);
assert.equal(reproduction.complete, true);
assert.equal(primary.promoted, null);
assert.equal(reproduction.promoted, null);
assert.equal(primary.winner.architectureFingerprint, reproduction.winner.architectureFingerprint);
assert.equal(
  primary.winner.plannerReport.results[0].production.results[0].proven,
  true
);
assert.equal(
  reproduction.winner.plannerReport.results[0].production.results[0].proven,
  true
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_REPRODUCIBILITY_OK candidate=${candidate.id} `
  + `reproducible=${reproducibility.reproducible} `
  + `fingerprintBound=${reproducibility.architectureFingerprint !== null} `
  + `freshSearch=true promoted=none`
);
