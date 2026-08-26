import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCandidate,
  AgentArchitectureSearchRunner
} from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const evaluationCase = new AgentPlannerCase({
  id: 'architecture-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: { taskId: 'architecture-boundary-task', description: 'Find a graph path' },
  task: { id: 'architecture-boundary-task', description: 'Find a graph path' },
  adversarial: true,
  expected: (report) => report?.completed === true
});

function planner(id, exportName = 'planGraphDirect') {
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

function architecture(id, plannerCandidate, policyFactory, components = { mode: 'bounded' }) {
  return new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory,
    components
  });
}

const runner = new AgentArchitectureSearchRunner();
const valid = architecture(
  'architecture-boundary-valid',
  planner('architecture-boundary-valid'),
  () => new AgentPolicy({ maxEpisodes: 2 })
);
const validReport = runner.evaluate({
  candidates: [valid],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(validReport.promoted, null);
assert.equal(validReport.results[0].plannerReport.promoted, null);
assert.equal(validReport.results[0].plannerReport.results[0].production.results[0].proven, true);
assert.equal('promoted' in validReport.results[0], false);

const sharedPolicy = new AgentPolicy({ maxEpisodes: 2 });
const sharedPolicyReport = runner.evaluate({
  candidates: [architecture(
    'architecture-boundary-shared-policy',
    planner('architecture-boundary-shared-policy'),
    () => sharedPolicy
  )],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(sharedPolicyReport.results[0].complete, false);
assert.match(
  sharedPolicyReport.results[0].plannerReport.results[0].research.results[0].error,
  /AgentPolicy|policy/
);

let sharedPlanner;
const sharedPlannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-boundary-shared-planner-candidate',
  plannerFactory: () => {
    sharedPlanner ??= new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: 'architecture-boundary-shared-planner'
    });
    return sharedPlanner;
  }
});
const sharedPlannerReport = runner.evaluate({
  candidates: [architecture(
    'architecture-boundary-shared-planner',
    sharedPlannerCandidate,
    () => new AgentPolicy({ maxEpisodes: 2 })
  )],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(sharedPlannerReport.results[0].complete, false);
assert.match(
  sharedPlannerReport.results[0].plannerReport.results[0].research.results[0].error,
  /planner/
);

assert.throws(
  () => new AgentArchitectureCandidate({
    id: 'architecture-boundary-function-components',
    plannerCandidate: planner('architecture-boundary-function-components'),
    policyFactory: () => new AgentPolicy(),
    components: { unsafe: () => 'not data' }
  }),
  /JSON-compatible/
);
assert.throws(
  () => runner.evaluate({
    candidates: [Object.create(Object.getPrototypeOf(valid))],
    cases: [evaluationCase]
  }),
  /trusted instances/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(runner)).evaluate({
    candidates: [valid],
    cases: [evaluationCase]
  }),
  /exact trusted runner/
);

assert.equal(new BoundedAgentRunner().policy.maxEpisodes > 0, true);
console.log(
  `FLUID_AGENT_ARCHITECTURE_BOUNDARY_OK sharedPolicyRejected=true `
  + `sharedPlannerRejected=true malformedComponentsRejected=true forgedRejected=true proofBoundary=true`
);
