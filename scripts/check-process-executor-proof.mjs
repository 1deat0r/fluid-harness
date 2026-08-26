import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness, isTrustedActionReport } from '../src/harness.mjs';
import {
  ProcessBackedExecutor,
  ProcessBackedSelector,
  ProcessIsolatedRunner
} from '../src/process-boundary.mjs';

const candidatePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function graphInput() {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
}

function graphTask() {
  return { id: 'process-backed-executor-task', description: 'Find a graph path' };
}

const selector = new ProcessBackedSelector({
  runner: new ProcessIsolatedRunner({
    modulePath: candidatePath,
    exportName: 'selectGraph',
    timeoutMs: 2000
  })
});
const correctHarness = new FluidHarness({
  selector,
  executorRegistry: new ExecutorRegistry({
    executors: [new ProcessBackedExecutor({
      runner: new ProcessIsolatedRunner({
        modulePath: candidatePath,
        exportName: 'executeGraph',
        timeoutMs: 2000
      })
    })]
  })
});
const correctPlan = correctHarness.plan(graphTask());
const correctReport = correctHarness.execute({ plan: correctPlan, input: graphInput() });

assert.equal(isTrustedActionReport(correctReport, correctHarness), true);
assert.equal(correctReport.evidence, EVIDENCE_LEVELS.PROVEN);
assert.deepEqual(correctReport.result.path, ['A', 'B']);

const wrongHarness = new FluidHarness({
  selector: new ProcessBackedSelector({
    runner: new ProcessIsolatedRunner({
      modulePath: candidatePath,
      exportName: 'selectGraph',
      timeoutMs: 2000
    })
  }),
  executorRegistry: new ExecutorRegistry({
    executors: [new ProcessBackedExecutor({
      runner: new ProcessIsolatedRunner({
        modulePath: candidatePath,
        exportName: 'executeWrongGraph',
        timeoutMs: 2000
      })
    })]
  })
});
const wrongPlan = wrongHarness.plan(graphTask());
const wrongReport = wrongHarness.execute({ plan: wrongPlan, input: graphInput() });
assert.equal(isTrustedActionReport(wrongReport, wrongHarness), true);
assert.equal(wrongReport.evidence, EVIDENCE_LEVELS.OBSERVED);
const failureSignal = wrongHarness.worldModel.history.at(-1);
assert.equal(failureSignal.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(failureSignal.verified, false);

console.log(
  `FLUID_PROCESS_EXECUTOR_PROOF_OK correct=${correctReport.evidence} `
  + `wrong=${failureSignal.evidence} verified=${failureSignal.verified}`
);
