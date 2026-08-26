import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  ToolDefinition,
  ToolRegistry,
  isTrustedToolInvocationReport,
  isTrustedToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function definition(id) {
  return new ToolDefinition({
    id,
    description: `fixture ${id}`,
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolEcho',
      timeoutMs: 2000
    })
  });
}

const first = definition('registry-tool-a');
const second = definition('registry-tool-b');
assert.throws(
  () => new ToolRegistry({ tools: [first, definition('registry-tool-a')] }),
  /unique tool ids/
);
assert.throws(
  () => new ToolRegistry({ tools: [Object.create(Object.getPrototypeOf(first))] }),
  /trusted ToolDefinition/
);

const primary = new ToolRegistry({ tools: [first, second] });
const foreign = new ToolRegistry({ tools: [definition('foreign-tool')] });
assert.equal(isTrustedToolRegistry(primary), true);
const report = primary.invoke({
  toolId: first.id,
  callId: 'registry-call-1',
  input: { source: 'primary' }
});
assert.equal(isTrustedToolInvocationReport(report, primary), true);
assert.equal(isTrustedToolInvocationReport(report, foreign), false);

assert.throws(
  () => primary.invoke({
    toolId: second.id,
    callId: 'registry-call-1',
    input: { source: 'replay' }
  }),
  /already been consumed/
);
assert.throws(
  () => primary.invoke({
    toolId: 'missing-tool',
    callId: 'registry-call-2',
    input: null
  }),
  /not registered/
);

console.log(
  `FLUID_TOOL_REGISTRY_BOUNDARY_OK primary=${isTrustedToolRegistry(primary)} `
  + `foreignReport=${isTrustedToolInvocationReport(report, foreign)} replayRejected=true duplicateRejected=true`
);
