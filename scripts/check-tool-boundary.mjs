import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { isTrustedActionReport } from '../src/harness.mjs';
import {
  ProcessIsolatedRunner
} from '../src/process-boundary.mjs';
import {
  TOOL_INVOCATION_STATUSES,
  ToolDefinition,
  ToolRegistry,
  isTrustedToolInvocationReport,
  isTrustedToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const registry = new ToolRegistry({
  tools: [new ToolDefinition({
    id: 'echo-tool',
    description: 'Returns a data-only echo from an isolated process',
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolEcho',
      timeoutMs: 2000
    })
  })]
});

const report = registry.invoke({
  toolId: 'echo-tool',
  callId: 'echo-call-1',
  input: { answer: 42 }
});

assert.equal(isTrustedToolRegistry(registry), true);
assert.equal(isTrustedToolInvocationReport(report, registry), true);
assert.equal(report.status, TOOL_INVOCATION_STATUSES.COMPLETED);
assert.deepEqual(report.output.input, { answer: 42 });
assert.notEqual(report.output.childPid, process.pid);
assert.equal(report.output.parentPid, -1);
assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(report.verified, false);
assert.equal(report.isolated, true);
assert.equal(isTrustedActionReport(report), false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.input), true);
assert.equal(Object.isFrozen(report.output), true);
assert.throws(() => {
  report.output.tool = 'forged';
}, TypeError);

console.log(
  `FLUID_TOOL_BOUNDARY_OK status=${report.status} evidence=${report.evidence} `
  + `isolated=${report.isolated} proof=${report.verified} actionTrusted=${isTrustedActionReport(report)}`
);
