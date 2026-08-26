import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentPlannerCandidate,
  AgentPlannerCase,
  AgentPlannerPromotionAuthority,
  AgentPlannerSearchRunner,
  plannerFromPromotedSearch
} from '../src/agent-search.mjs';
import { BoundedAgentRunner, isTrustedAgentRunReport } from '../src/agent.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { isTrustedAgentPlanner, ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const candidate = new AgentPlannerCandidate({
  id: 'planner-adoption-direct',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'planner-adoption-direct-planner'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'planner-adoption-case',
  domain: 'graph',
  goal: 'graph',
  context: { taskId: 'planner-adoption-task', description: 'Find a graph path' },
  task: { id: 'planner-adoption-task', description: 'Find a graph path' },
  adversarial: true,
  expected: (report) => report?.completed === true
});

function evaluate() {
  return new AgentPlannerSearchRunner().evaluate({
    candidates: [candidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
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
const decision = authority.promote(reproducibility);
assert.equal(decision.promoted, true);

const adoptedPlanner = plannerFromPromotedSearch(decision.promotion);
assert.equal(isTrustedAgentPlanner(adoptedPlanner), true);
assert.notEqual(adoptedPlanner, primary.results[0].candidate);
const plan = adoptedPlanner.plan({
  goal: evaluationCase.goal,
  context: evaluationCase.context
});
const parentRunner = new BoundedAgentRunner();
const runReport = parentRunner.runPlan({
  plan,
  reproduction: 'agent-planner-adoption'
});
assert.equal(isTrustedAgentRunReport(runReport), true);
assert.equal(runReport.completed, true);
assert.equal(runReport.cycles.length, 1);
assert.equal(runReport.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(runReport.plannerId, 'planner-adoption-direct-planner');
assert.equal(runReport.auditValid, true);

const sharedPlanner = adoptedPlanner;
const sharedCandidate = new AgentPlannerCandidate({
  id: 'planner-adoption-shared',
  plannerFactory: () => sharedPlanner
});
const sharedReport = new AgentPlannerSearchRunner().evaluate({
  candidates: [sharedCandidate],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(sharedReport.results[0].production.successRate, 0);

console.log(
  `FLUID_AGENT_PLANNER_ADOPTION_OK promoted=${decision.promoted} fresh=true `
  + `plannerProof=${runReport.cycles[0].action.evidence} audit=${runReport.auditValid} sharedRejected=true`
);
