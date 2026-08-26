import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureCandidate,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner,
  architectureFromAdoptedSearch,
  isTrustedAgentArchitectureAdoption,
  isTrustedAgentArchitectureAdoptionAuthority,
  isTrustedAgentArchitectureCandidate
} from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-adoption-direct-planner-candidate',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-adoption-direct-planner'
  })
});

const candidate = new AgentArchitectureCandidate({
  id: 'architecture-adoption-direct',
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
  id: 'architecture-adoption-graph',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'architecture-adoption-graph-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'architecture-adoption-graph-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});

function evaluate(selectedCandidate) {
  return new AgentArchitectureSearchRunner().evaluate({
    candidates: [selectedCandidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}

const primary = evaluate(candidate);
const reproduction = evaluate(candidate);
const reproducibility = new AgentArchitectureReproducibilityAuthority().reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: candidate.id
});
assert.equal(reproducibility.reproducible, true);

const adoptionAuthority = new AgentArchitectureAdoptionAuthority();
assert.equal(isTrustedAgentArchitectureAdoptionAuthority(adoptionAuthority), true);
const decision = adoptionAuthority.adopt(reproducibility);
assert.equal(decision.adopted, true);
assert.deepEqual(decision.reasons, []);
assert.equal(isTrustedAgentArchitectureAdoption(decision.adoption, adoptionAuthority), true);
assert.equal(decision.adoption.deployed, false);
assert.equal(decision.adoption.dataOnly, false);

const adoptedCandidate = architectureFromAdoptedSearch(decision.adoption);
assert.equal(isTrustedAgentArchitectureCandidate(adoptedCandidate), true);
assert.notEqual(adoptedCandidate, candidate);
assert.notEqual(adoptedCandidate.plannerCandidate, candidate.plannerCandidate);
assert.equal(Object.isFrozen(adoptedCandidate.components), true);

const adoptedReport = evaluate(adoptedCandidate);
assert.equal(adoptedReport.complete, true);
assert.equal(adoptedReport.promoted, null);
assert.equal(adoptedReport.winner.architectureId, candidate.id);
assert.equal(adoptedReport.winner.plannerReport.results[0].production.results[0].proven, true);
assert.equal(adoptedReport.winner.architectureFingerprint, primary.winner.architectureFingerprint);

console.log(
  `FLUID_AGENT_ARCHITECTURE_ADOPTION_OK candidate=${candidate.id} `
  + `adopted=${decision.adopted} fresh=true revalidated=true `
  + `proof=${adoptedReport.winner.plannerReport.results[0].production.results[0].proven ? 'PROVEN' : 'NONE'} `
  + `deployed=${decision.adoption.deployed}`
);
