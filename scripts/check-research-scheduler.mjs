import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { POLICY_MODES } from '../src/evaluation.mjs';
import { questionFor } from '../src/curiosity.mjs';
import {
  BoundedResearchScheduler,
  isTrustedResearchSchedule
} from '../src/research-scheduler.mjs';

const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 8, maxAuditEntries: 64 })
});
for (const suffix of ['first', 'second']) {
  const task = {
    id: `research-scheduler-${suffix}`,
    description: 'Find the shortest path through a dependency graph'
  };
  const plan = core.plan(task);
  const report = core.execute({
    plan,
    policyMode: POLICY_MODES.RESEARCH,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'C'
    }
  });
  core.recordQuestion({
    taskId: task.id,
    policyMode: POLICY_MODES.RESEARCH,
    question: questionFor({ actionReport: report }),
    actionReport: report
  });
}

const schedule = new BoundedResearchScheduler().schedule({
  pendingResearch: core.researchQueue,
  maxItems: 1
});

assert.equal(isTrustedResearchSchedule(schedule), true);
assert.equal(schedule.complete, false);
assert.equal(schedule.dataOnly, true);
assert.equal(schedule.sourceCount, 2);
assert.equal(schedule.entries[0].actionNumber, 1);
assert.equal(schedule.entries[0].reason, 'HIGH_SURPRISE');
assert.equal(schedule.entries[0].evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(Object.hasOwn(schedule.entries[0], 'actionReport'), false);
assert.equal(core.researchQueue.length, 2);

console.log(
  `FLUID_RESEARCH_SCHEDULER_OK source=${schedule.sourceCount} scheduled=${schedule.scheduledCount} `
  + `first=${schedule.entries[0].taskId} priority=${schedule.entries[0].priority} `
  + `dataOnly=${schedule.dataOnly} pending=${core.researchQueue.length}`
);
