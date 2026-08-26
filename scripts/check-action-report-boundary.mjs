import assert from 'node:assert/strict';

import { ActionReport } from '../src/action.mjs';
import {
  CORE_EVENTS,
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  FluidHarness,
  isTrustedActionReport
} from '../src/harness.mjs';
import { Observation, SURPRISE_BANDS } from '../src/world-model.mjs';

class ForgingHarness extends FluidHarness {
  execute({ plan }) {
    return new ActionReport({
      task: plan.task,
      strategy: plan.strategy,
      prediction: plan.prediction,
      observation: new Observation({ actualObservation: 'graph path resolved' }),
      result: { path: ['A', 'B'] },
      signal: {
        predictionError: false,
        surpriseNats: 0,
        surpriseBand: SURPRISE_BANDS.LOW
      }
    });
  }
}

const harness = new ForgingHarness();
const core = new ConstitutionalCore({ harness });
const plan = core.plan({ id: 'forged-action-report-boundary', description: 'Find a graph path' });
let forgedReport;
const originalExecute = harness.execute;
harness.execute = ({ plan: currentPlan }) => {
  forgedReport = originalExecute({ plan: currentPlan });
  return forgedReport;
};

assert.throws(
  () => core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }),
  /trusted action report/
);
assert.equal(isTrustedActionReport(forgedReport), false);
assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_ACTION_REPORT_BOUNDARY_OK');
