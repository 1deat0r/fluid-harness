import { DistributionShiftRunner } from '../../src/distribution-shift.mjs';
import { EvaluationCase } from '../../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../../src/evidence.mjs';

export function buildDistributionShiftFixture({
  prefix = 'distribution-shift-fixture',
  includeWeakness = true
} = {}) {
  const task = {
    id: `${prefix}-task`,
    description: 'Find a graph path'
  };
  const baselineCase = new EvaluationCase({
    id: `${prefix}-baseline`,
    domain: 'graph',
    task,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.result?.found === true
      && report?.evidence === EVIDENCE_LEVELS.PROVEN
  });
  const stableShift = new EvaluationCase({
    id: `${prefix}-irrelevant-node`,
    domain: 'graph',
    adversarial: true,
    task,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['C', 'C']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.result?.found === true
      && report?.evidence === EVIDENCE_LEVELS.PROVEN
  });
  const weaknessShift = new EvaluationCase({
    id: `${prefix}-missing-edge`,
    domain: 'graph',
    adversarial: true,
    task,
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.result?.found === true
      && report?.evidence === EVIDENCE_LEVELS.PROVEN
  });
  const shiftCases = includeWeakness
    ? [stableShift, weaknessShift]
    : [stableShift];
  const report = new DistributionShiftRunner({
    suiteId: `${prefix}-suite`,
    maxShifts: shiftCases.length
  }).run({
    candidateId: `${prefix}-candidate`,
    baselineCase,
    shiftCases
  });
  return { baselineCase, shiftCases, report };
}
