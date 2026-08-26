import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness, isTrustedActionReport } from '../src/harness.mjs';
import {
  ProcessBackedSelector,
  ProcessIsolatedRunner
} from '../src/process-boundary.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';

const candidatePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const runner = new ProcessIsolatedRunner({
  modulePath: candidatePath,
  exportName: 'selectGraph',
  timeoutMs: 2000
});
const candidate = new RepresentationCandidate({
  id: 'process-isolated-graph-selector',
  selectorFactory: () => new ProcessBackedSelector({ runner })
});
const evaluationCase = new EvaluationCase({
  id: 'process-isolated-selector-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'process-isolated-selector-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});
const budget = new EvaluationBudget({ maxCases: 1 });
const report = new RepresentationSearchRunner().evaluate({
  candidates: [candidate],
  cases: [evaluationCase],
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});

assert.equal(report.complete, true);
assert.equal(report.promoted?.candidateId, candidate.id);
const adopted = selectorFromPromotedSearch(report);
const harness = new FluidHarness({ selector: adopted });
const plan = harness.plan({ id: 'process-isolated-selector-adopted', description: 'Find a graph path' });
const action = harness.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

assert.equal(isTrustedActionReport(action, harness), true);
assert.equal(action.evidence, EVIDENCE_LEVELS.PROVEN);
console.log(
  `FLUID_PROCESS_SELECTOR_ADOPTION_OK promoted=${report.promoted.candidateId} `
  + `adopted=${action.strategy.representation} evidence=${action.evidence} audits=${report.allAuditsValid}`
);
