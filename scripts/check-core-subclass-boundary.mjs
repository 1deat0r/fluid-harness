import assert from 'node:assert/strict';

import {
  ConstitutionalCore,
  isTrustedConstitutionalCore
} from '../src/constitution.mjs';
import {
  CognitiveCycleReport,
  CognitiveCycleRunner
} from '../src/cycle.mjs';
import { questionFor } from '../src/curiosity.mjs';

const delegate = new ConstitutionalCore();
const plan = delegate.plan({
  id: 'core-subclass-boundary-task',
  description: 'Find a graph path'
});
const actionReport = delegate.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
const questionDecision = questionFor({ actionReport });
delegate.recordQuestion({
  taskId: actionReport.taskId,
  actionReport,
  question: questionDecision
});

class ForgedCore extends ConstitutionalCore {
  plan(task) {
    return delegate.plan(task);
  }

  execute(argumentsObject) {
    return delegate.execute(argumentsObject);
  }

  canAppendAudit() {
    return true;
  }

  recordQuestion() {}

  ownsPlan() {
    return true;
  }

  ownsActionReport() {
    return true;
  }

  ownsQuestionDecision() {
    return true;
  }

  verifyAudit() {
    return true;
  }
}

const forged = new ForgedCore();
assert.equal(forged instanceof ConstitutionalCore, true);
assert.equal(isTrustedConstitutionalCore(delegate), true);
assert.equal(isTrustedConstitutionalCore(forged), false);
assert.throws(
  () => new CognitiveCycleRunner({ core: forged }),
  /trusted ConstitutionalCore/
);
assert.throws(
  () => new CognitiveCycleReport({
    plan,
    actionReport,
    core: forged,
    questionDecision
  }),
  /plan, action report, and core/
);

const proxied = new Proxy(delegate, {
  get(target, property, receiver) {
    if (property === 'ownsPlan' || property === 'ownsActionReport' || property === 'ownsQuestionDecision') {
      return () => true;
    }
    return Reflect.get(target, property, receiver);
  }
});
assert.equal(isTrustedConstitutionalCore(proxied), false);
assert.throws(
  () => new CognitiveCycleRunner({ core: proxied }),
  /trusted ConstitutionalCore/
);
assert.throws(
  () => new CognitiveCycleReport({
    plan,
    actionReport,
    core: proxied,
    questionDecision
  }),
  /plan, action report, and core/
);

console.log('FLUID_CORE_SUBCLASS_BOUNDARY_OK');
