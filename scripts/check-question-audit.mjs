import assert from 'node:assert/strict';

import { CognitiveCycleRunner } from '../src/cycle.mjs';
import { CORE_EVENTS } from '../src/constitution.mjs';
import { QUESTION_REASONS } from '../src/curiosity.mjs';

const runner = new CognitiveCycleRunner();
const cycle = runner.run({
  task: { id: 'question-audit-boundary', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  },
  reproduction: 'node scripts/check-question-audit.mjs'
});

const questions = runner.core.auditTrail.filter(({ event }) => event === CORE_EVENTS.QUESTION_DECIDED);
assert.equal(questions.length, 1);
assert.equal(questions[0].payload.reason, QUESTION_REASONS.HIGH_SURPRISE);
assert.equal(questions[0].payload.researchRequired, true);
assert.equal(cycle.stages.question.reason, QUESTION_REASONS.HIGH_SURPRISE);
assert.equal(runner.core.verifyAudit(), true);
console.log(`FLUID_QUESTION_AUDIT_OK questions=${questions.length} audit=${runner.core.auditTrail.length}`);
