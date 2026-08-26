import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentPlannerCandidate,
  AgentPlannerCase,
  AgentPlannerPromotion,
  AgentPlannerPromotionAuthority,
  AgentPlannerReproducibilityReport,
  AgentPlannerSearchRunner,
  isTrustedAgentPlannerPromotion,
  isTrustedAgentPlannerPromotionAuthority
} from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function candidate(id, exportName = 'planGraphDirect') {
  return new AgentPlannerCandidate({
    id,
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

const direct = candidate('planner-promotion-direct');
const malformed = candidate('planner-promotion-malformed', 'planMissingDescription');
const cases = [
  new AgentPlannerCase({
    id: 'planner-promotion-production',
    domain: 'graph',
    goal: 'graph',
    context: { taskId: 'planner-promotion-production-task', description: 'Find a graph path' },
    task: { id: 'planner-promotion-production-task', description: 'Find a graph path' },
    expected: (report) => report?.completed === true
  }),
  new AgentPlannerCase({
    id: 'planner-promotion-skeptic',
    domain: 'robustness',
    goal: 'graph-skeptic',
    context: { taskId: 'planner-promotion-skeptic-task', description: 'Find a graph path' },
    task: { id: 'planner-promotion-skeptic-task', description: 'Find a graph path' },
    adversarial: true,
    expected: (report) => report?.completed === true
  })
];

function evaluate(searchRunner, selectedCandidate, overrides = {}) {
  return searchRunner.evaluate({
    candidates: [selectedCandidate],
    cases,
    productionBudget: overrides.productionBudget
      ?? new EvaluationBudget({ maxCases: 2 }),
    researchBudget: overrides.researchBudget
      ?? new EvaluationBudget({ maxCases: 2 }),
    skepticBudget: overrides.skepticBudget
      ?? new EvaluationBudget({ maxCases: 1 })
  });
}

const primary = evaluate(new AgentPlannerSearchRunner(), direct);
const reproduction = evaluate(new AgentPlannerSearchRunner(), direct);
const authority = new AgentPlannerPromotionAuthority();
assert.equal(isTrustedAgentPlannerPromotionAuthority(authority), true);
const validEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: direct.id
});
const validDecision = authority.promote(validEvidence);
assert.equal(validEvidence.reproducible, true);
assert.equal(validDecision.promoted, true);
assert.equal(isTrustedAgentPlannerPromotion(validDecision.promotion, authority), true);

const sameRunner = new AgentPlannerSearchRunner();
const sameRunnerPrimary = evaluate(sameRunner, direct);
const sameRunnerReplay = evaluate(sameRunner, direct);
const sameRunnerEvidence = authority.reproduce({
  searchReport: sameRunnerPrimary,
  reproductionReport: sameRunnerReplay,
  candidateId: direct.id
});
assert.equal(sameRunnerEvidence.reproducible, false);
assert.match(sameRunnerEvidence.reasons.join(';'), /independent search report|contract/);

const alteredBudget = evaluate(new AgentPlannerSearchRunner(), direct, {
  productionBudget: new EvaluationBudget({ maxCases: 1 })
});
const alteredBudgetEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: alteredBudget,
  candidateId: direct.id
});
assert.equal(alteredBudgetEvidence.reproducible, false);
assert.match(alteredBudgetEvidence.reasons.join(';'), /budget/);

const alteredCandidate = evaluate(new AgentPlannerSearchRunner(), malformed);
const alteredCandidateEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: alteredCandidate,
  candidateId: direct.id
});
assert.equal(alteredCandidateEvidence.reproducible, false);
assert.match(alteredCandidateEvidence.reasons.join(';'), /candidate|definition|evidence/);
const alteredCandidateDecision = authority.promote(alteredCandidateEvidence);
assert.equal(alteredCandidateDecision.promoted, false);
assert.equal(alteredCandidateDecision.promotion, null);

const incomplete = evaluate(new AgentPlannerSearchRunner(), direct, {
  productionBudget: new EvaluationBudget({ maxCases: 1 })
});
const incompleteEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: incomplete,
  candidateId: direct.id
});
const incompleteDecision = authority.promote(incompleteEvidence);
assert.equal(incompleteDecision.promoted, false);
assert.equal(incompleteDecision.promotion, null);
assert.match(incompleteDecision.reasons.join(';'), /reproducibility|budget|complete/);

assert.equal(authority.reproduce({
  searchReport: primary,
  reproductionReport: primary,
  candidateId: direct.id
}).reproducible, false);
assert.throws(
  () => authority.reproduce({
    searchReport: Object.create(Object.getPrototypeOf(primary)),
    reproductionReport: reproduction,
    candidateId: direct.id
  }),
  /trusted search reports/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(authority)).promote(validEvidence),
  /exact trusted authority/
);
assert.throws(
  () => new AgentPlannerReproducibilityReport({
    candidateId: direct.id,
    primary,
    reproduction,
    reproducible: true,
    reasons: []
  }),
  /trusted authority path/
);
assert.throws(
  () => new AgentPlannerPromotion({
    authority,
    reproducibility: validEvidence
  }),
  /reproducible evidence/
);

console.log(
  `FLUID_AGENT_PLANNER_PROMOTION_BOUNDARY_OK promoted=${validDecision.promoted} `
  + `sameRunnerRejected=${!sameRunnerEvidence.reproducible} budgetRejected=${!alteredBudgetEvidence.reproducible} `
  + `definitionRejected=${!alteredCandidateEvidence.reproducible} incompleteRejected=${!incompleteDecision.promoted}`
);
