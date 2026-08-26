import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentPlannerCandidate, AgentPlannerCase, AgentPlannerSearchRunner } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const caseDefinition = new AgentPlannerCase({
  id: 'planner-search-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: { taskId: 'planner-search-boundary-task', description: 'Find a graph path' },
  task: { id: 'planner-search-boundary-task', description: 'Find a graph path' },
  adversarial: true,
  expected: (report) => report?.completed === true
});

function planner(id, exportName, maxEpisodes = 32) {
  return new AgentPlannerCandidate({
    id,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName,
        timeoutMs: 2000
      }),
      plannerId: `${id}-planner`,
      maxEpisodes
    })
  });
}

const boundaryRunner = new AgentPlannerSearchRunner();
const malformedReport = boundaryRunner.evaluate({
  candidates: [planner('planner-search-malformed-boundary', 'planMissingDescription')],
  cases: [caseDefinition],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(malformedReport.results[0].research.results[0].proven, false);
assert.equal(malformedReport.results[0].research.results[0].stopReason, null);
assert.match(malformedReport.results[0].research.results[0].error, /description/);

const oversizedReport = boundaryRunner.evaluate({
  candidates: [planner('planner-search-oversized-boundary', 'planMany', 2)],
  cases: [caseDefinition],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(oversizedReport.results[0].research.results[0].proven, false);
assert.match(oversizedReport.results[0].research.results[0].error, /maximum is 2/);

let sharedPlanner;
const sharedPlannerReport = boundaryRunner.evaluate({
  candidates: [new AgentPlannerCandidate({
    id: 'planner-search-shared-boundary',
    plannerFactory: () => {
      sharedPlanner ??= new ProcessBackedAgentPlanner({
        runner: new ProcessIsolatedRunner({
          modulePath: fixturePath,
          exportName: 'planGraphDirect',
          timeoutMs: 2000
        }),
        plannerId: 'planner-search-shared-planner'
      });
      return sharedPlanner;
    }
  })],
  cases: [caseDefinition],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(sharedPlannerReport.results[0].production.successRate, 1);
assert.equal(sharedPlannerReport.results[0].research.successRate, 0);
assert.equal(sharedPlannerReport.results[0].skeptic.successRate, 0);

assert.throws(
  () => boundaryRunner.evaluate({
    candidates: [planner('planner-search-forged-case', 'planGraphDirect')],
    cases: [Object.create(Object.getPrototypeOf(caseDefinition))],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  }),
  /trusted AgentPlannerCase/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(boundaryRunner)).evaluate({
    candidates: [planner('planner-search-forged-runner', 'planGraphDirect')],
    cases: [caseDefinition]
  }),
  /exact trusted runner/
);

console.log(
  `FLUID_AGENT_PLANNER_SEARCH_BOUNDARY_OK malformedRejected=true oversizedRejected=true `
  + `sharedPlannerRejected=true forgedCaseRejected=true proofBoundary=true`
);
