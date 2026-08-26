import assert from 'node:assert/strict';

import {
  BoundedResearchScheduler,
  isTrustedResearchSchedule,
  ResearchSchedule
} from '../src/research-scheduler.mjs';

const scheduler = new BoundedResearchScheduler();
const validEntry = {
  actionNumber: 1,
  taskId: 'research-boundary-task',
  policyMode: 'research',
  reason: 'HIGH_SURPRISE',
  evidence: 'PROVEN',
  surpriseBand: 'HIGH',
  researchRequested: true,
  researchRequired: true,
  action: {
    strategyKey: 'graph-algorithms',
    predictionError: true,
    surpriseNats: 2,
    evidence: 'PROVEN',
    environmentHash: 'sha256:boundary'
  }
};

assert.throws(
  () => scheduler.schedule({ pendingResearch: null }),
  /queue array/
);
assert.throws(
  () => scheduler.schedule({ pendingResearch: [validEntry], maxItems: 0 }),
  /positive integer/
);
assert.throws(
  () => scheduler.schedule({
    pendingResearch: [{ ...validEntry, reason: 'NONE' }]
  }),
  /not schedulable/
);
assert.throws(
  () => scheduler.schedule({
    pendingResearch: [validEntry, { ...validEntry, taskId: 'duplicate-task' }]
  }),
  /unique action numbers/
);
assert.throws(
  () => scheduler.schedule({
    pendingResearch: [{
      ...validEntry,
      action: { ...validEntry.action, predictionError: 'forged' }
    }]
  }),
  /predictionError must be boolean/
);
const accessorEntry = { ...validEntry };
Object.defineProperty(accessorEntry, 'taskId', {
  enumerable: true,
  get: () => 'accessor-task'
});
assert.throws(
  () => scheduler.schedule({ pendingResearch: [accessorEntry] }),
  /only enumerable data properties/
);

const schedule = scheduler.schedule({ pendingResearch: [validEntry] });
assert.equal(isTrustedResearchSchedule(schedule), true);
assert.equal(Object.isFrozen(schedule), true);
assert.equal(Object.isFrozen(schedule.entries), true);
assert.equal(Object.isFrozen(schedule.entries[0]), true);
assert.equal(Object.hasOwn(schedule.entries[0], 'actionReport'), false);
assert.throws(
  () => {
    schedule.entries[0].priority = 99;
  },
  TypeError
);

const forgedSchedule = new ResearchSchedule({
  entries: [],
  requestedItems: 1,
  sourceCount: 0
});
assert.equal(isTrustedResearchSchedule(forgedSchedule), false);

console.log(
  `FLUID_RESEARCH_SCHEDULER_BOUNDARY_OK malformedRejected=true `
  + `duplicateRejected=true accessorRejected=true immutable=${Object.isFrozen(schedule.entries[0])} `
  + `authoritySuppressed=${!Object.hasOwn(schedule.entries[0], 'actionReport')} `
  + `forgedRejected=${isTrustedResearchSchedule(forgedSchedule) === false}`
);
