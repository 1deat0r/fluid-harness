import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  PROCESS_BOUNDARY_CODES,
  ProcessBoundaryError,
  ProcessIsolatedRunner
} from '../src/process-boundary.mjs';
import { isTrustedActionReport } from '../src/harness.mjs';

const candidatePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

const echoRunner = new ProcessIsolatedRunner({
  modulePath: candidatePath,
  exportName: 'echo',
  timeoutMs: 2000
});
const echo = echoRunner.run({ answer: 42 });
assert.equal(echo.status, 'completed');
assert.deepEqual(echo.value.input, { answer: 42 });
assert.notEqual(echo.value.childPid, process.pid);
assert.equal(echo.value.parentPid, -1);
assert.equal(isTrustedActionReport(echo.value), false);
assert.equal(Object.isFrozen(echo), true);
assert.equal(Object.isFrozen(echo.value), true);

const capabilities = new ProcessIsolatedRunner({
  modulePath: candidatePath,
  exportName: 'capabilityReport',
  timeoutMs: 2000
}).run(null).value;
assert.notEqual(capabilities.filesystem, 'allowed');
assert.notEqual(capabilities.childProcess, 'allowed');
assert.notEqual(capabilities.network, 'allowed');

assert.throws(
  () => new ProcessIsolatedRunner({
    modulePath: candidatePath,
    exportName: 'hang',
    timeoutMs: 100
  }).run(null),
  (error) => error instanceof ProcessBoundaryError
    && error.code === PROCESS_BOUNDARY_CODES.TIMEOUT
);

assert.throws(
  () => new ProcessIsolatedRunner({
    modulePath: candidatePath,
    exportName: 'crash',
    timeoutMs: 2000
  }).run(null),
  (error) => error instanceof ProcessBoundaryError
    && error.code === PROCESS_BOUNDARY_CODES.CHILD_EXIT
);

assert.throws(
  () => new ProcessIsolatedRunner({
    modulePath: candidatePath,
    exportName: 'huge',
    timeoutMs: 2000,
    maxOutputBytes: 1024
  }).run(null),
  (error) => error instanceof ProcessBoundaryError
    && error.code === PROCESS_BOUNDARY_CODES.OUTPUT_LIMIT
);

assert.throws(
  () => echoRunner.run({ text: 'x'.repeat(70 * 1024) }),
  (error) => error instanceof ProcessBoundaryError
    && error.code === PROCESS_BOUNDARY_CODES.INPUT_LIMIT
);

console.log(
  `FLUID_PROCESS_BOUNDARY_OK childIsolated=true fs=${capabilities.filesystem} `
  + `childProcess=${capabilities.childProcess} net=${capabilities.network} `
  + 'timeout=true crash=true limits=true proofUntrusted=true'
);
