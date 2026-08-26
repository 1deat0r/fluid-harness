import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'search-tree-cycle',
    description: 'Explore a finite search tree of candidate branches'
  },
  input: {
    root: 'root',
    objective: 'maximize',
    nodes: [
      { id: 'root', terminal: false },
      { id: 'first', terminal: true, value: 1 },
      { id: 'second', terminal: false },
      { id: 'winner', terminal: true, value: 5 }
    ],
    edges: [
      { from: 'root', to: 'first' },
      { from: 'root', to: 'second' },
      { from: 'second', to: 'winner' }
    ]
  },
  reproduction: 'node scripts/check-search-tree-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'search-tree');
assert.equal(cycle.stages.represent.reasoningEngine, 'monte-carlo-search');
assert.equal(cycle.stages.represent.executionSubstrate, 'research-worker');
assert.equal(cycle.stages.act.result.selectedId, 'winner');
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'finite-search-tree-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_SEARCH_TREE_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `selected=${cycle.stages.act.result.selectedId} evidence=${cycle.stages.verify.evidence} `
  + `verifier=${cycle.stages.verify.verifierId} audit=${cycle.stages.preserve.coreAuditValid}`
);
