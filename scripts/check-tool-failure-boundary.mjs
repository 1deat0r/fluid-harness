import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  ProcessBoundaryError,
  PROCESS_BOUNDARY_CODES,
  ProcessIsolatedRunner
} from '../src/process-boundary.mjs';
import {
  TOOL_INVOCATION_STATUSES,
  ToolDefinition,
  ToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function tool(id, exportName, options = {}) {
  return new ToolDefinition({
    id,
    description: `fixture ${id}`,
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName,
      timeoutMs: options.timeoutMs ?? 2000,
      maxInputBytes: options.maxInputBytes ?? 64 * 1024,
      maxOutputBytes: options.maxOutputBytes ?? 64 * 1024
    })
  });
}

const registry = new ToolRegistry({
  tools: [
    tool('capabilities-tool', 'capabilityReport'),
    tool('failure-tool', 'toolFail'),
    tool('timeout-tool', 'hang', { timeoutMs: 100 }),
    tool('output-limit-tool', 'toolHuge', { maxOutputBytes: 1024 }),
    tool('input-limit-tool', 'toolEcho', { maxInputBytes: 64 })
  ]
});

const capabilities = registry.invoke({
  toolId: 'capabilities-tool',
  callId: 'capability-call',
  input: null
});
assert.equal(capabilities.status, TOOL_INVOCATION_STATUSES.COMPLETED);
assert.notEqual(capabilities.output.filesystem, 'allowed');
assert.notEqual(capabilities.output.childProcess, 'allowed');
assert.notEqual(capabilities.output.network, 'allowed');

const failed = registry.invoke({
  toolId: 'failure-tool',
  callId: 'failure-call',
  input: null
});
assert.equal(failed.status, TOOL_INVOCATION_STATUSES.FAILED);
assert.equal(failed.error.code, PROCESS_BOUNDARY_CODES.CHILD_ERROR);
assert.match(failed.error.message, /tool fixture failed/);

const timedOut = registry.invoke({
  toolId: 'timeout-tool',
  callId: 'timeout-call',
  input: null
});
assert.equal(timedOut.status, TOOL_INVOCATION_STATUSES.FAILED);
assert.equal(timedOut.error.code, PROCESS_BOUNDARY_CODES.TIMEOUT);

const tooLarge = registry.invoke({
  toolId: 'output-limit-tool',
  callId: 'output-limit-call',
  input: null
});
assert.equal(tooLarge.status, TOOL_INVOCATION_STATUSES.FAILED);
assert.equal(tooLarge.error.code, PROCESS_BOUNDARY_CODES.OUTPUT_LIMIT);

const tooMuchInput = registry.invoke({
  toolId: 'input-limit-tool',
  callId: 'input-limit-call',
  input: { text: 'x'.repeat(1024) }
});
assert.equal(tooMuchInput.status, TOOL_INVOCATION_STATUSES.FAILED);
assert.equal(tooMuchInput.error.code, PROCESS_BOUNDARY_CODES.INPUT_LIMIT);

assert.equal(capabilities.verified, false);
assert.equal(failed.verified, false);
assert.equal(timedOut.verified, false);
assert.equal(tooLarge.verified, false);
assert.equal(tooMuchInput.verified, false);

console.log(
  `FLUID_TOOL_FAILURE_BOUNDARY_OK capabilities=${capabilities.status} `
  + `failure=${failed.error.code} timeout=${timedOut.error.code} `
  + `output=${tooLarge.error.code} input=${tooMuchInput.error.code}`
);
