import assert from 'node:assert/strict';

import {
  createExecutionResult,
  ExecutorRegistry,
  SearchTreeExecutor
} from '../src/executor.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  REASONING_ENGINES,
  REPRESENTATIONS
} from '../src/representation.mjs';
import { verifySearchTreeExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.SEARCH_TREE,
  reasoningEngine: REASONING_ENGINES.MONTE_CARLO_SEARCH
};
const task = { id: 'search-tree-boundary-task' };
const validInput = {
  root: 'root',
  objective: 'maximize',
  nodes: [
    { id: 'root', terminal: false },
    { id: 'left', terminal: true, value: 4 },
    { id: 'right', terminal: true, value: 7 }
  ],
  edges: [
    { from: 'root', to: 'left' },
    { from: 'root', to: 'right' }
  ]
};
const executor = new SearchTreeExecutor();

function execute(input, executionOptions = {}) {
  return executor.execute({ task, strategy, input, executionOptions });
}

assert.throws(
  () => execute({ ...validInput, objective: 'average' }),
  /must be minimize or maximize/
);
assert.throws(
  () => execute({ ...validInput, nodes: [] }),
  /1-64 entries/
);
assert.throws(
  () => execute({
    ...validInput,
    nodes: [
      { id: 'root', terminal: false },
      { id: 'leaf', terminal: true }
    ],
    edges: [{ from: 'root', to: 'leaf' }]
  }),
  /must be finite/
);
assert.throws(
  () => execute({
    ...validInput,
    nodes: [
      { id: 'root', terminal: false },
      { id: 'left', terminal: true, value: 4 },
      { id: 'right', terminal: true, value: 7 }
    ],
    edges: [
      { from: 'root', to: 'left' },
      { from: 'root', to: 'right' },
      { from: 'left', to: 'right' }
    ]
  }),
  /terminal node cannot have children/
);
assert.throws(
  () => execute({
    ...validInput,
    nodes: [
      { id: 'root', terminal: false },
      { id: 'left', terminal: true, value: 4 },
      { id: 'right', terminal: true, value: 7 },
      { id: 'orphan', terminal: true, value: 8 }
    ]
  }),
  /exactly one parent/
);
assert.throws(
  () => execute(validInput, { maxExpansions: 0 }),
  /positive.*integer/
);

const honest = execute(validInput);
assert.equal(verifySearchTreeExecution(honest).passed, true);
assert.throws(
  () => verifySearchTreeExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

const limitedHarness = new FluidHarness();
const limitedPlan = limitedHarness.plan({
  id: 'search-tree-resource-limit',
  description: 'Explore a finite search tree of candidate branches'
});
const limitedReport = limitedHarness.execute({
  plan: limitedPlan,
  input: validInput,
  executionOptions: { maxExpansions: 1 }
});
assert.equal(limitedReport.result.searchComplete, false);
assert.equal(limitedReport.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(limitedReport.verification.passed, false);

class ForgedSearchTreeExecutor extends SearchTreeExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      result: {
        ...honestExecution.result,
        selectedId: 'left',
        selectedValue: 4,
        path: ['root', 'left']
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [new ForgedSearchTreeExecutor()]
  })
});
const forgedPlan = forgedHarness.plan({
  id: 'search-tree-forged-result',
  description: 'Explore a finite search tree of candidate branches'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: validInput
});
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log(
  `FLUID_SEARCH_TREE_BOUNDARY_OK malformedRejected=true `
  + `resourceLimitObserved=${limitedReport.evidence === EVIDENCE_LEVELS.OBSERVED} `
  + `untrustedRejected=true forgedSelectionRejected=${forgedReport.verification.passed === false} `
  + `evidence=${forgedReport.evidence}`
);
