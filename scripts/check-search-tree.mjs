import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  EXECUTION_SUBSTRATES,
  REASONING_ENGINES,
  REPRESENTATIONS
} from '../src/representation.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'search-tree-check',
  description: 'Explore a finite search tree of candidate branches'
});
const report = harness.execute({
  plan,
  input: {
    root: 'root',
    objective: 'maximize',
    nodes: [
      { id: 'root', terminal: false },
      { id: 'left', terminal: true, value: 4 },
      { id: 'right', terminal: false },
      { id: 'deep', terminal: true, value: 7 },
      { id: 'other', terminal: true, value: 6 }
    ],
    edges: [
      { from: 'root', to: 'left' },
      { from: 'root', to: 'right' },
      { from: 'right', to: 'deep' },
      { from: 'right', to: 'other' }
    ]
  },
  reproduction: 'node scripts/check-search-tree.mjs'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.SEARCH_TREE);
assert.equal(plan.strategy.reasoningEngine, REASONING_ENGINES.MONTE_CARLO_SEARCH);
assert.equal(plan.strategy.executionSubstrate, EXECUTION_SUBSTRATES.RESEARCH_WORKER);
assert.equal(report.result.selectedId, 'deep');
assert.equal(report.result.selectedValue, 7);
assert.deepEqual(report.result.path, ['root', 'right', 'deep']);
assert.equal(report.result.searchComplete, true);
assert.equal(report.result.terminalNodesEvaluated, 3);
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.verification.verifierId, 'finite-search-tree-verifier/v1');
assert.equal(report.verification.passed, true);

console.log(
  `FLUID_SEARCH_TREE_OK representation=${plan.strategy.representation} `
  + `engine=${plan.strategy.reasoningEngine} substrate=${plan.strategy.executionSubstrate} `
  + `selected=${report.result.selectedId} evidence=${report.evidence} `
  + `verifier=${report.verification.verifierId}`
);
