import { createHash } from 'node:crypto';

import { isTrustedExecution } from './executor.mjs';
import {
  absNumber,
  arrayAt,
  arrayEvery,
  arrayFind,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arrayReduce,
  arrayReverse,
  arraySlice,
  arraySome,
  arraySort,
  isFiniteNumber,
  isFrozenObject,
  isInteger,
  isPlainObject,
  isSafeInteger,
  jsonStringify,
  mapFromEntries,
  mapGet,
  mapHas,
  mapSet,
  maxNumber,
  objectFreeze,
  objectFromEntries,
  objectHasOwn,
  objectKeys,
  positiveInfinity,
  runtimeEnvironment,
  setAdd,
  setFromArray,
  setHas,
  setSize,
  stringLocaleCompare,
  stringTrim,
  toBoolean,
  weakMapCreate,
  weakMapGet,
  weakMapSet
} from './intrinsics.mjs';
import { REPRESENTATIONS } from './representation.mjs';

const TRUSTED_VERIFICATIONS = weakMapCreate();
const VERIFIER_ID = 'graph-path-verifier/v1';
const ARRAY_VERIFIER_ID = 'array-computation-verifier/v1';
const DATABASE_QUERY_VERIFIER_ID = 'database-query-verifier/v1';
const THEOREM_VERIFIER_ID = 'theorem-prover-verifier/v1';
const BAYESIAN_VERIFIER_ID = 'bayesian-inference-verifier/v1';
const MAX_BAYESIAN_HYPOTHESES = 32;
const BAYESIAN_TOLERANCE = 1e-12;
const SIMULATION_VERIFIER_ID = 'finite-state-simulation-verifier/v1';
const MAX_SIMULATION_STATES = 32;
const MAX_SIMULATION_TRANSITIONS = 64;
const MAX_SIMULATION_EVENTS = 64;
const OPTIMIZATION_VERIFIER_ID = 'finite-optimizer-verifier/v1';
const MAX_OPTIMIZATION_CANDIDATES = 64;
const SEARCH_TREE_VERIFIER_ID = 'finite-search-tree-verifier/v1';
const MAX_SEARCH_TREE_NODES = 64;
const MAX_SEARCH_TREE_EDGES = 63;
const MAX_SEARCH_TREE_DEPTH = 64;
const PROGRAM_VERIFIER_ID = 'finite-program-synthesis-verifier/v1';
const MAX_PROGRAM_VARIABLES = 4;
const MAX_PROGRAM_CONSTANTS = 8;
const MAX_PROGRAM_OPERATORS = 3;
const MAX_PROGRAM_EXAMPLES = 16;
const MAX_PROGRAM_DEPTH = 4;
const MAX_PROGRAM_CANDIDATES = 2048;
const MODEL_VERIFIER_ID = 'model-response-observer/v1';
const MODEL_PROVIDER_SOURCE = 'PROCESS_ISOLATED';

function samePath(left, right) {
  if (left === null && right === null) {
    return true;
  }

  return arrayIsArray(left) && arrayIsArray(right)
    && left.length === right.length
    && arrayEvery(left, (node, index) => node === right[index]);
}

function independentlyFindShortestPath(graph) {
  if (
    !graph
    || !arrayIsArray(graph.nodes)
    || !arrayIsArray(graph.edges)
  ) {
    return null;
  }

  const nodeSet = setFromArray(graph.nodes);
  if (!setHas(nodeSet, graph.start) || !setHas(nodeSet, graph.goal)) {
    return null;
  }

  const adjacency = mapFromEntries(arrayMap(graph.nodes, (node) => [node, []]));
  let validEdges = true;
  arrayForEach(graph.edges, (edge) => {
    if (!edge || !setHas(nodeSet, edge.from) || !setHas(nodeSet, edge.to)) {
      validEdges = false;
      return;
    }
    arrayPush(mapGet(adjacency, edge.from), edge.to);
  });
  if (!validEdges) {
    return null;
  }

  const queue = [graph.start];
  const previous = mapFromEntries([[graph.start, null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    arrayForEach(mapGet(adjacency, current), (neighbor) => {
      if (!mapHas(previous, neighbor)) {
        mapSet(previous, neighbor, current);
        arrayPush(queue, neighbor);
      }
    });
  }

  if (!mapHas(previous, graph.goal)) {
    return null;
  }

  const path = [];
  for (let current = graph.goal; current !== null; current = mapGet(previous, current)) {
    arrayPush(path, current);
  }
  return arrayReverse(path);
}

function check(id, passed, details) {
  return objectFreeze({ id, passed: toBoolean(passed), details });
}

function environmentHash(execution, verifierId = VERIFIER_ID) {
  const environment = jsonStringify({
    ...runtimeEnvironment(),
    reasoningEngine: execution.reasoningEngine,
    verifier: verifierId
  });
  return `sha256:${createHash('sha256').update(environment).digest('hex')}`;
}

export function isTrustedVerification(verification, execution = null) {
  const source = typeof verification === 'object' && verification !== null
    ? weakMapGet(TRUSTED_VERIFICATIONS, verification)
    : undefined;
  return typeof verification === 'object'
    && verification !== null
    && isFrozenObject(verification)
    && source !== undefined
    && (execution === null || source === execution);
}

export function verifyGraphExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.GRAPH) {
    throw new TypeError('Graph verification requires a graph execution');
  }

  const expectedPath = independentlyFindShortestPath(execution.input);
  const actualPath = execution.result.path;
  const expectedFound = expectedPath !== null;
  const searchComplete = execution.result.searchComplete === true;
  const expectedStatus = searchComplete
    ? expectedFound ? 'success' : 'failure'
    : 'resource-limit';
  const expectedObservation = searchComplete
    ? expectedFound ? 'graph path resolved' : 'graph path not found'
    : 'graph search budget exhausted';
  const edgeSet = setFromArray(arrayMap(
    execution.input.edges,
    (edge) => `${edge.from}\u0000${edge.to}`
  ));
  const pathEdgesValid = actualPath === null || (
    actualPath.length > 0
    && actualPath[0] === execution.input.start
    && arrayAt(actualPath, -1) === execution.input.goal
    && arrayEvery(actualPath, (node) => arrayIncludes(execution.input.nodes, node))
    && arrayEvery(arraySlice(actualPath, 1), (node, index) =>
      setHas(edgeSet, `${actualPath[index]}\u0000${node}`)
    )
  );
  const searchStateValid = execution.status === 'resource-limit'
    ? !searchComplete
    : searchComplete;
  const searchBudget = execution.result.expansionBudget;
  const budgetValid = searchBudget === null || (
    isInteger(searchBudget)
    && searchBudget > 0
    && isInteger(execution.result.expansions)
    && execution.result.expansions >= 0
    && execution.result.expansions <= searchBudget
  );

  const checks = [
    check('execution-status', execution.status === expectedStatus, 'status matches graph reachability or resource limits'),
    check('observation-status', execution.observation === expectedObservation, 'observation matches status'),
    check('search-state', searchStateValid, 'search completion state matches status'),
    check('search-budget', budgetValid, 'search expansions stay within the declared budget'),
    check('path-existence', execution.result.found === (searchComplete && expectedFound), 'found flag matches independently computed path when search is complete'),
    check('path-edges', pathEdgesValid, 'path starts, ends, and follows declared edges'),
    check('shortest-path', samePath(actualPath, searchComplete ? expectedPath : null), 'path matches independent breadth-first verification'),
    check('distance', execution.result.distance === (searchComplete && expectedPath ? expectedPath.length - 1 : null), 'distance matches path length')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && searchComplete && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );

  const verification = objectFreeze({
    verifierId: VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function sameArray(left, right) {
  return arrayIsArray(left)
    && arrayIsArray(right)
    && left.length === right.length
    && arrayEvery(left, (value, index) => value === right[index]);
}

function sameDemand(left, right, resources) {
  return arrayEvery(
    resources,
    (resource) => (left?.[resource] ?? 0) === (right?.[resource] ?? 0)
  );
}

function capacityWithinLimit(schedule, resource, capacity) {
  const events = mapFromEntries([]);
  const eventTimes = [];
  arrayForEach(schedule, (job) => {
    const amount = job.demand[resource] ?? 0;
    if (amount === 0) {
      return;
    }
    if (!mapHas(events, job.start)) {
      arrayPush(eventTimes, job.start);
    }
    mapSet(events, job.start, (mapGet(events, job.start) ?? 0) + amount);
    if (!mapHas(events, job.end)) {
      arrayPush(eventTimes, job.end);
    }
    mapSet(events, job.end, (mapGet(events, job.end) ?? 0) - amount);
  });

  let used = 0;
  let valid = true;
  arrayForEach(arraySort(arraySlice(eventTimes), (left, right) => left - right), (time) => {
    if (!valid) {
      return;
    }
    used += mapGet(events, time);
    if (used > capacity) {
      valid = false;
    }
  });
  return valid && used === 0;
}

export function verifyConstraintExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.CONSTRAINT_SYSTEM) {
    throw new TypeError('Constraint verification requires a constraint execution');
  }

  const inputJobs = arrayIsArray(execution.input.jobs) ? execution.input.jobs : [];
  const schedule = arrayIsArray(execution.result.schedule) ? execution.result.schedule : [];
  const jobsById = mapFromEntries(arrayMap(inputJobs, (job) => [job.id, job]));
  const resourceNames = objectKeys(execution.input.resources ?? {});
  const uniqueScheduledIds = setFromArray(arrayMap(schedule, (job) => job.id));
  const completeCoverage = schedule.length === inputJobs.length
    && setSize(uniqueScheduledIds) === inputJobs.length
    && arrayEvery(inputJobs, (job) => setHas(uniqueScheduledIds, job.id));
  const entriesValid = completeCoverage && arrayEvery(schedule, (entry) => {
      const job = mapGet(jobsById, entry.id);
      return toBoolean(job)
      && isSafeInteger(entry.start)
      && entry.start >= 0
      && isSafeInteger(entry.end)
      && entry.end > entry.start
      && entry.duration === job.duration
      && entry.end - entry.start === entry.duration
      && sameArray(entry.prerequisites, job.prerequisites)
      && sameDemand(entry.demand, job.demand, resourceNames);
  });
  const byId = mapFromEntries(arrayMap(schedule, (job) => [job.id, job]));
  const prerequisitesValid = entriesValid && arrayEvery(schedule, (job) =>
    arrayEvery(job.prerequisites, (prerequisite) => mapGet(byId, prerequisite)?.end <= job.start)
  );
  const maxEnd = entriesValid
    ? arrayReduce(schedule, (latest, job) => maxNumber(latest, job.end), 0)
    : null;
  const capacityValid = entriesValid && arrayEvery(resourceNames, (resource) => {
    return capacityWithinLimit(schedule, resource, execution.input.resources[resource]);
  });
  const makespanValid = maxEnd !== null
    && isSafeInteger(execution.result.makespan)
    && execution.result.makespan === maxEnd;
  const checks = [
    check('execution-status', execution.status === 'success', 'constraint executor completed successfully'),
    check('observation-status', execution.observation === 'constraint solution resolved', 'observation identifies a constraint solution'),
    check('job-coverage', completeCoverage, 'every declared job appears exactly once'),
    check('job-entries', entriesValid, 'durations, demands, and prerequisites match declarations'),
    check('prerequisites', prerequisitesValid, 'prerequisites finish before dependent jobs start'),
    check('capacity', capacityValid, 'resource capacity is respected at every time unit'),
    check('makespan', makespanValid, 'reported makespan matches the schedule')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );

  const verification = objectFreeze({
    verifierId: 'constraint-schedule-verifier/v1',
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, 'constraint-schedule-verifier/v1'),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function independentlyComputeArray(input) {
  if (!input || !arrayIsArray(input.left) || !arrayIsArray(input.right)) {
    return null;
  }
  if (!arrayIncludes(['add', 'dot'], input.operation) || input.left.length !== input.right.length) {
    return null;
  }
  if (arraySome(input.left, (value) => typeof value !== 'number' || !isFiniteNumber(value))) {
    return null;
  }
  if (arraySome(input.right, (value) => typeof value !== 'number' || !isFiniteNumber(value))) {
    return null;
  }

  if (input.operation === 'add') {
    const values = arrayMap(input.left, (value, index) => value + input.right[index]);
    if (arraySome(values, (value) => !isFiniteNumber(value))) {
      return null;
    }
    return {
      operation: 'add',
      length: input.left.length,
      values
    };
  }

  const value = arrayReduce(input.left, (total, current, index) => (
    total + current * input.right[index]
  ), 0);
  if (!isFiniteNumber(value)) {
    return null;
  }
  return {
    operation: 'dot',
    length: input.left.length,
    value
  };
}

function sameNumberArray(left, right) {
  return arrayIsArray(left)
    && arrayIsArray(right)
    && left.length === right.length
    && arrayEvery(left, (value, index) => value === right[index]);
}

function isDatabaseScalar(value) {
  return value === null
    || typeof value === 'boolean'
    || typeof value === 'string'
    || (typeof value === 'number' && isFiniteNumber(value));
}

function sameDatabaseRows(left, right, fields) {
  return arrayIsArray(left)
    && arrayIsArray(right)
    && left.length === right.length
    && arrayEvery(left, (row, index) => {
      const expected = right[index];
      if (
        !row
        || typeof row !== 'object'
        || !expected
        || typeof expected !== 'object'
        || objectKeys(row).length !== fields.length
        || objectKeys(expected).length !== fields.length
      ) {
        return false;
      }
      return arrayEvery(fields, (field) => (
        objectHasOwn(row, field)
        && objectHasOwn(expected, field)
        && row[field] === expected[field]
      ));
    });
}

function sameDatabaseFilter(left, right) {
  if (left === null || right === null) {
    return left === right;
  }
  return left?.field === right?.field && left?.equals === right?.equals;
}

function sameDatabaseSort(left, right) {
  if (left === null || right === null) {
    return left === right;
  }
  return left?.field === right?.field && left?.direction === right?.direction;
}

function compareDatabaseValues(left, right) {
  if (left === right) {
    return 0;
  }
  if (typeof left === 'string') {
    return stringLocaleCompare(left, right);
  }
  return left < right ? -1 : 1;
}

function independentlyComputeDatabaseQuery(input) {
  if (
    !input
    || typeof input !== 'object'
    || !arrayIsArray(input.rows)
    || !arrayIsArray(input.select)
    || input.rows.length === 0
    || input.rows.length > 64
    || input.select.length === 0
    || input.select.length > 32
  ) {
    return null;
  }

  const firstRow = input.rows[0];
  if (!firstRow || typeof firstRow !== 'object' || arrayIsArray(firstRow)) {
    return null;
  }
  const fields = objectKeys(firstRow);
  const fieldSet = setFromArray(fields);
  if (fields.length === 0 || fields.length > 32) {
    return null;
  }
  if (arraySome(input.rows, (row) => (
    !row
    || typeof row !== 'object'
    || arrayIsArray(row)
    || objectKeys(row).length !== fields.length
    || arraySome(objectKeys(row), (field) => !setHas(fieldSet, field))
    || arraySome(fields, (field) => !isDatabaseScalar(row[field]))
  ))) {
    return null;
  }

  const selectedFields = input.select;
  const selectedSet = setFromArray(selectedFields);
  if (
    setSize(selectedSet) !== selectedFields.length
    || arraySome(selectedFields, (field) => (
      typeof field !== 'string' || stringTrim(field) !== field || field === '' || !setHas(fieldSet, field)
    ))
  ) {
    return null;
  }

  const filter = input.filter;
  if (
    filter !== null
    && (
      !filter
      || typeof filter !== 'object'
      || arrayIsArray(filter)
      || typeof filter.field !== 'string'
      || stringTrim(filter.field) !== filter.field
      || filter.field === ''
      || !setHas(fieldSet, filter.field)
      || !isDatabaseScalar(filter.equals)
    )
  ) {
    return null;
  }

  const sort = input.sort;
  if (
    sort !== null
    && (
      !sort
      || typeof sort !== 'object'
      || arrayIsArray(sort)
      || typeof sort.field !== 'string'
      || stringTrim(sort.field) !== sort.field
      || sort.field === ''
      || !setHas(fieldSet, sort.field)
      || !arrayIncludes(['asc', 'desc'], sort.direction)
    )
  ) {
    return null;
  }
  if (sort !== null) {
    const firstValue = firstRow[sort.field];
    if (typeof firstValue !== 'number' && typeof firstValue !== 'string') {
      return null;
    }
    if (arraySome(input.rows, (row) => (
      typeof row[sort.field] !== typeof firstValue
      || (typeof firstValue === 'number' && !isFiniteNumber(row[sort.field]))
    ))) {
      return null;
    }
  }

  if (!isSafeInteger(input.limit) || input.limit < 0 || input.limit > 64) {
    return null;
  }

  const matching = arrayFilter(input.rows, (row) => (
    filter === null || row[filter.field] === filter.equals
  ));
  const ordered = arrayMap(matching, (row, index) => ({ row, index }));
  if (sort !== null) {
    arraySort(ordered, (left, right) => {
      const valueOrder = compareDatabaseValues(
        left.row[sort.field],
        right.row[sort.field]
      );
      const directedOrder = sort.direction === 'asc' ? valueOrder : -valueOrder;
      return directedOrder || left.index - right.index;
    });
  }
  const rows = arrayMap(
    arraySlice(ordered, 0, input.limit),
    ({ row }) => objectFromEntries(arrayMap(
      selectedFields,
      (field) => [field, row[field]]
    ))
  );
  return {
    rows,
    matchedRows: matching.length,
    returnedRows: rows.length,
    selectedFields: arraySlice(selectedFields),
    filter,
    sort,
    limit: input.limit
  };
}

export function verifyDatabaseQueryExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.DATABASE_QUERY) {
    throw new TypeError('Database verification requires a database query execution');
  }

  const expected = independentlyComputeDatabaseQuery(execution.input);
  const actual = execution.result ?? {};
  const fields = expected?.selectedFields ?? [];
  const checks = [
    check('execution-status', execution.status === 'success', 'database query executor completed successfully'),
    check('observation-status', execution.observation === 'database query completed', 'observation identifies a database query'),
    check('matched-rows', expected !== null && actual.matchedRows === expected.matchedRows, 'matched row count is independently reproduced'),
    check('returned-rows', expected !== null && actual.returnedRows === expected.returnedRows, 'returned row count is independently reproduced'),
    check('projection', expected !== null && sameDatabaseRows(actual.rows, expected.rows, fields), 'projected rows match independent query evaluation'),
    check('metadata', expected !== null
      && arrayEvery(actual.selectedFields ?? [], (field, index) => field === expected.selectedFields[index])
      && actual.selectedFields?.length === expected.selectedFields.length
      && sameDatabaseFilter(actual.filter, expected.filter)
      && sameDatabaseSort(actual.sort, expected.sort)
      && actual.limit === expected.limit,
    'query projection and execution metadata match the normalized input')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: DATABASE_QUERY_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, DATABASE_QUERY_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function evaluateTheoremFormula(formula, assignment) {
  switch (formula.op) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'var':
      return mapGet(assignment, formula.name) === true;
    case 'not':
      return !evaluateTheoremFormula(formula.arg, assignment);
    case 'and':
      return arrayEvery(formula.args, (argument) => evaluateTheoremFormula(argument, assignment));
    case 'or':
      return arraySome(formula.args, (argument) => evaluateTheoremFormula(argument, assignment));
    case 'implies':
      return !evaluateTheoremFormula(formula.left, assignment)
        || evaluateTheoremFormula(formula.right, assignment);
    case 'iff':
      return evaluateTheoremFormula(formula.left, assignment)
        === evaluateTheoremFormula(formula.right, assignment);
    default:
      throw new TypeError(`Unsupported theorem operation: ${formula.op}`);
  }
}

function independentlyComputeTheorem(input) {
  if (
    !input
    || typeof input !== 'object'
    || !arrayIsArray(input.variables)
    || input.variables.length === 0
    || input.variables.length > 8
    || !arrayIsArray(input.assumptions)
    || input.assumptions.length > 16
    || !input.conclusion
    || typeof input.conclusion !== 'object'
  ) {
    return null;
  }

  try {
    const assignmentsChecked = 2 ** input.variables.length;
    let assumptionsSatisfied = 0;
    let counterexample = null;
    for (let mask = 0; mask < assignmentsChecked; mask += 1) {
      const assignment = mapFromEntries(arrayMap(
        input.variables,
        (name, index) => [name, (mask & (2 ** index)) !== 0]
      ));
      if (!arrayEvery(
        input.assumptions,
        (assumption) => evaluateTheoremFormula(assumption, assignment)
      )) {
        continue;
      }
      assumptionsSatisfied += 1;
      if (!evaluateTheoremFormula(input.conclusion, assignment) && counterexample === null) {
        counterexample = objectFromEntries(arrayMap(
          input.variables,
          (name) => [name, mapGet(assignment, name)]
        ));
      }
    }
    return {
      proved: counterexample === null,
      counterexample,
      assignmentsChecked,
      assumptionsSatisfied
    };
  } catch {
    return null;
  }
}

function sameTheoremAssignment(left, right, variables) {
  if (left === null || right === null) {
    return left === right;
  }
  return typeof left === 'object'
    && typeof right === 'object'
    && objectKeys(left).length === variables.length
    && objectKeys(right).length === variables.length
    && arrayEvery(variables, (name) => left[name] === right[name]);
}

export function verifyTheoremExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.THEOREM) {
    throw new TypeError('Theorem verification requires a theorem execution');
  }

  const expected = independentlyComputeTheorem(execution.input);
  const actual = execution.result ?? {};
  const variables = arrayIsArray(execution.input?.variables) ? execution.input.variables : [];
  const checks = [
    check('execution-status', execution.status === 'success', 'theorem executor completed successfully'),
    check('observation-status', expected !== null && execution.observation === (
      expected.proved ? 'theorem proved' : 'theorem refuted'
    ), 'observation identifies the independently evaluated theorem result'),
    check('proof-result', expected !== null && actual.proved === expected.proved, 'reported theorem result matches exhaustive evaluation'),
    check('counterexample', expected !== null && sameTheoremAssignment(actual.counterexample, expected.counterexample, variables), 'counterexample matches independent truth-table evaluation'),
    check('assignment-count', expected !== null && actual.assignmentsChecked === expected.assignmentsChecked, 'all bounded truth-table assignments are accounted for'),
    check('assumptions-satisfied', expected !== null && actual.assumptionsSatisfied === expected.assumptionsSatisfied, 'assumption-satisfying assignments are independently counted')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: THEOREM_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, THEOREM_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function approximatelyEqual(left, right) {
  return isFiniteNumber(left)
    && isFiniteNumber(right)
    && absNumber(left - right) <= BAYESIAN_TOLERANCE;
}

function independentlyComputeBayesian(input) {
  if (
    !input
    || typeof input !== 'object'
    || arrayIsArray(input)
    || typeof input.observation !== 'string'
    || stringTrim(input.observation) !== input.observation
    || input.observation === ''
    || !arrayIsArray(input.hypotheses)
    || input.hypotheses.length === 0
    || input.hypotheses.length > MAX_BAYESIAN_HYPOTHESES
  ) {
    return null;
  }

  try {
    const seen = setFromArray([]);
    const entries = arrayMap(input.hypotheses, (hypothesis, index) => {
      if (
        !hypothesis
        || typeof hypothesis !== 'object'
        || arrayIsArray(hypothesis)
        || typeof hypothesis.id !== 'string'
        || stringTrim(hypothesis.id) !== hypothesis.id
        || hypothesis.id === ''
        || setHas(seen, hypothesis.id)
        || !hypothesis.likelihoods
        || typeof hypothesis.likelihoods !== 'object'
        || arrayIsArray(hypothesis.likelihoods)
        || !isFiniteNumber(hypothesis.prior)
        || hypothesis.prior < 0
        || hypothesis.prior > 1
      ) {
        throw new TypeError(`Invalid Bayesian hypothesis at index ${index}`);
      }
      const eventNames = objectKeys(hypothesis.likelihoods);
      if (
        eventNames.length === 0
        || eventNames.length > 32
        || !objectHasOwn(hypothesis.likelihoods, input.observation)
        || arraySome(eventNames, (event) => (
          event === ''
          || stringTrim(event) !== event
          || !isFiniteNumber(hypothesis.likelihoods[event])
          || hypothesis.likelihoods[event] < 0
          || hypothesis.likelihoods[event] > 1
        ))
      ) {
        throw new TypeError(`Invalid Bayesian likelihood table at index ${index}`);
      }
      const likelihoodSum = arrayReduce(
        eventNames,
        (total, event) => total + hypothesis.likelihoods[event],
        0
      );
      if (!isFiniteNumber(likelihoodSum) || absNumber(likelihoodSum - 1) > BAYESIAN_TOLERANCE) {
        throw new TypeError(`Bayesian likelihood table at index ${index} must sum to 1`);
      }
      setAdd(seen, hypothesis.id);
      return {
        hypothesis: hypothesis.id,
        prior: hypothesis.prior,
        likelihood: hypothesis.likelihoods[input.observation],
        weight: hypothesis.prior * hypothesis.likelihoods[input.observation]
      };
    });
    const priorSum = arrayReduce(entries, (total, entry) => total + entry.prior, 0);
    if (!isFiniteNumber(priorSum) || absNumber(priorSum - 1) > BAYESIAN_TOLERANCE) {
      return null;
    }
    const observationProbability = arrayReduce(
      entries,
      (total, entry) => total + entry.weight,
      0
    );
    if (!isFiniteNumber(observationProbability) || observationProbability <= 0) {
      return null;
    }
    const posterior = arrayMap(entries, (entry) => ({
      hypothesis: entry.hypothesis,
      probability: entry.weight / observationProbability
    }));
    let mostLikelyIndex = 0;
    arrayForEach(arraySlice(posterior, 1), (entry, index) => {
      if (entry.probability > posterior[mostLikelyIndex].probability) {
        mostLikelyIndex = index + 1;
      }
    });
    return {
      observation: input.observation,
      observationProbability,
      posterior,
      posteriorSum: arrayReduce(posterior, (total, entry) => total + entry.probability, 0),
      mostLikely: posterior[mostLikelyIndex].hypothesis,
      hypothesisCount: entries.length
    };
  } catch {
    return null;
  }
}

function sameBayesianPosterior(left, right) {
  return arrayIsArray(left)
    && arrayIsArray(right)
    && left.length === right.length
    && arrayEvery(left, (entry, index) => (
      entry
      && right[index]
      && entry.hypothesis === right[index].hypothesis
      && approximatelyEqual(entry.probability, right[index].probability)
    ));
}

export function verifyBayesianExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.PROBABILISTIC_INFERENCE) {
    throw new TypeError('Bayesian verification requires a probabilistic inference execution');
  }

  const expected = independentlyComputeBayesian(execution.input);
  const actual = execution.result ?? {};
  const checks = [
    check('execution-status', execution.status === 'success', 'Bayesian executor completed successfully'),
    check('observation-status', execution.observation === 'bayesian posterior computed', 'observation identifies a Bayesian posterior computation'),
    check('observation', expected !== null && actual.observation === expected.observation, 'reported observation matches normalized input'),
    check('observation-probability', expected !== null && approximatelyEqual(actual.observationProbability, expected.observationProbability), 'evidence probability matches independent calculation'),
    check('posterior', expected !== null && sameBayesianPosterior(actual.posterior, expected.posterior), 'posterior probabilities match independent calculation'),
    check('posterior-sum', expected !== null && approximatelyEqual(actual.posteriorSum, expected.posteriorSum), 'posterior probabilities sum to the independently calculated total'),
    check('most-likely', expected !== null && actual.mostLikely === expected.mostLikely, 'most likely hypothesis matches independent calculation'),
    check('hypothesis-count', expected !== null && actual.hypothesisCount === expected.hypothesisCount, 'hypothesis count matches normalized input')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: BAYESIAN_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, BAYESIAN_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function independentlySimulateStateMachine(input) {
  if (
    !input
    || typeof input !== 'object'
    || arrayIsArray(input)
    || !arrayIsArray(input.states)
    || !arrayIsArray(input.transitions)
    || !arrayIsArray(input.events)
    || input.states.length === 0
    || input.states.length > MAX_SIMULATION_STATES
    || input.transitions.length === 0
    || input.transitions.length > MAX_SIMULATION_TRANSITIONS
    || input.events.length === 0
    || input.events.length > MAX_SIMULATION_EVENTS
  ) {
    return null;
  }

  try {
    const stateSet = setFromArray(input.states);
    if (
      setSize(stateSet) !== input.states.length
      || arraySome(input.states, (state, index) => (
        !objectHasOwn(input.states, index)
        || typeof state !== 'string'
        || state === ''
        || stringTrim(state) !== state
      ))
      || typeof input.initialState !== 'string'
      || input.initialState === ''
      || stringTrim(input.initialState) !== input.initialState
      || !setHas(stateSet, input.initialState)
    ) {
      return null;
    }

    const transitionKeys = setFromArray([]);
    const transitions = arrayMap(input.transitions, (transition, index) => {
      if (
        !objectHasOwn(input.transitions, index)
        || !transition
        || typeof transition !== 'object'
        || arrayIsArray(transition)
        || typeof transition.from !== 'string'
        || typeof transition.event !== 'string'
        || typeof transition.to !== 'string'
        || transition.from === ''
        || transition.event === ''
        || transition.to === ''
        || stringTrim(transition.from) !== transition.from
        || stringTrim(transition.event) !== transition.event
        || stringTrim(transition.to) !== transition.to
        || !setHas(stateSet, transition.from)
        || !setHas(stateSet, transition.to)
      ) {
        throw new TypeError(`Invalid simulation transition at index ${index}`);
      }
      const key = jsonStringify([transition.from, transition.event]);
      if (setHas(transitionKeys, key)) {
        throw new TypeError(`Duplicate simulation transition at index ${index}`);
      }
      setAdd(transitionKeys, key);
      return transition;
    });
    if (arraySome(input.events, (event, index) => (
      !objectHasOwn(input.events, index)
      || typeof event !== 'string'
      || event === ''
      || stringTrim(event) !== event
    ))) {
      return null;
    }

    const transitionMap = mapFromEntries(arrayMap(
      transitions,
      (transition) => [jsonStringify([transition.from, transition.event]), transition]
    ));
    const trace = [input.initialState];
    const transitionsApplied = [];
    let currentState = input.initialState;
    let blockedAtStep = null;
    arrayForEach(input.events, (event, index) => {
      if (blockedAtStep !== null) {
        return;
      }
      const transition = mapGet(transitionMap, jsonStringify([currentState, event]));
      if (!transition) {
        blockedAtStep = index;
        return;
      }
      arrayPush(transitionsApplied, {
        step: index,
        event,
        from: currentState,
        to: transition.to
      });
      currentState = transition.to;
      arrayPush(trace, currentState);
    });
    return {
      initialState: input.initialState,
      events: arraySlice(input.events),
      trace,
      transitionsApplied,
      finalState: currentState,
      completed: blockedAtStep === null,
      blockedAtStep
    };
  } catch {
    return null;
  }
}

function sameSimulationTransitions(left, right) {
  return arrayIsArray(left)
    && arrayIsArray(right)
    && left.length === right.length
    && arrayEvery(left, (entry, index) => (
      entry
      && right[index]
      && entry.step === right[index].step
      && entry.event === right[index].event
      && entry.from === right[index].from
      && entry.to === right[index].to
    ));
}

export function verifySimulationExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.SIMULATION) {
    throw new TypeError('Simulation verification requires a simulation execution');
  }

  const expected = independentlySimulateStateMachine(execution.input);
  const actual = execution.result ?? {};
  const checks = [
    check('execution-status', execution.status === 'success', 'simulation executor completed successfully'),
    check('observation-status', execution.observation === 'simulation completed', 'observation identifies a finite simulation'),
    check('input-events', expected !== null && samePath(actual.events, expected.events), 'simulated event sequence matches normalized input'),
    check('completion', expected !== null && actual.completed === expected.completed, 'completion status matches independent replay'),
    check('blocked-step', expected !== null && actual.blockedAtStep === expected.blockedAtStep, 'blocked step matches independent replay'),
    check('trace', expected !== null && samePath(actual.trace, expected.trace), 'state trace matches independent replay'),
    check('transitions', expected !== null && sameSimulationTransitions(actual.transitionsApplied, expected.transitionsApplied), 'applied transitions match independent replay'),
    check('final-state', expected !== null && actual.finalState === expected.finalState, 'final state matches independent replay')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: SIMULATION_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, SIMULATION_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function independentlyOptimizeCandidates(input) {
  if (
    !input
    || typeof input !== 'object'
    || arrayIsArray(input)
    || !arrayIsArray(input.candidates)
    || input.candidates.length === 0
    || input.candidates.length > MAX_OPTIMIZATION_CANDIDATES
    || (input.objective !== 'minimize' && input.objective !== 'maximize')
  ) {
    return null;
  }

  try {
    const seen = setFromArray([]);
    const candidates = arrayMap(input.candidates, (candidate, index) => {
      if (
        !objectHasOwn(input.candidates, index)
        || !candidate
        || typeof candidate !== 'object'
        || arrayIsArray(candidate)
        || typeof candidate.id !== 'string'
        || candidate.id === ''
        || stringTrim(candidate.id) !== candidate.id
        || setHas(seen, candidate.id)
        || !isFiniteNumber(candidate.value)
      ) {
        throw new TypeError(`Invalid optimization candidate at index ${index}`);
      }
      setAdd(seen, candidate.id);
      return { id: candidate.id, value: candidate.value };
    });
    let bestIndex = 0;
    arrayForEach(arraySlice(candidates, 1), (candidate, index) => {
      const currentIndex = index + 1;
      const best = candidates[bestIndex];
      const valueImproves = input.objective === 'minimize'
        ? candidate.value < best.value
        : candidate.value > best.value;
      const valueTies = candidate.value === best.value;
      const idWinsTie = valueTies && stringLocaleCompare(candidate.id, best.id) < 0;
      if (valueImproves || idWinsTie) {
        bestIndex = currentIndex;
      }
    });
    const selected = candidates[bestIndex];
    return {
      objective: input.objective,
      selectedId: selected.id,
      selectedValue: selected.value,
      candidatesEvaluated: candidates.length,
      tieBreak: 'lexicographic-id'
    };
  } catch {
    return null;
  }
}

export function verifyOptimizationExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.OPTIMIZATION) {
    throw new TypeError('Optimization verification requires an optimization execution');
  }

  const expected = independentlyOptimizeCandidates(execution.input);
  const actual = execution.result ?? {};
  const checks = [
    check('execution-status', execution.status === 'success', 'optimization executor completed successfully'),
    check('observation-status', execution.observation === 'optimization completed', 'observation identifies a finite optimization'),
    check('objective', expected !== null && actual.objective === expected.objective, 'objective matches normalized input'),
    check('selected-id', expected !== null && actual.selectedId === expected.selectedId, 'selected candidate matches independent optimization'),
    check('selected-value', expected !== null && actual.selectedValue === expected.selectedValue, 'selected value matches independent optimization'),
    check('candidate-count', expected !== null && actual.candidatesEvaluated === expected.candidatesEvaluated, 'all bounded candidates are evaluated'),
    check('tie-break', expected !== null && actual.tieBreak === expected.tieBreak, 'deterministic tie-break policy is preserved')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: OPTIMIZATION_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, OPTIMIZATION_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function independentProgramExpressionKey(expression) {
  return jsonStringify(expression);
}

function independentlyBuildProgramExpressions(problem) {
  const byDepth = [];
  const seen = setFromArray([]);
  const base = [];
  arrayForEach(problem.variables, (name) => {
    const expression = { op: 'var', name };
    const key = independentProgramExpressionKey(expression);
    if (!setHas(seen, key)) {
      setAdd(seen, key);
      arrayPush(base, expression);
    }
  });
  arrayForEach(problem.constants, (value) => {
    const expression = { op: 'const', value };
    const key = independentProgramExpressionKey(expression);
    if (!setHas(seen, key)) {
      setAdd(seen, key);
      arrayPush(base, expression);
    }
  });
  arraySort(base, (left, right) => stringLocaleCompare(
    independentProgramExpressionKey(left),
    independentProgramExpressionKey(right)
  ));
  byDepth[0] = base;

  for (let depth = 1; depth <= problem.maxDepth; depth += 1) {
    const expressions = [];
    for (let leftDepth = 0; leftDepth < depth; leftDepth += 1) {
      for (let rightDepth = 0; rightDepth < depth; rightDepth += 1) {
        if (maxNumber(leftDepth, rightDepth) + 1 !== depth) {
          continue;
        }
        arrayForEach(byDepth[leftDepth], (left) => {
          arrayForEach(byDepth[rightDepth], (right) => {
            arrayForEach(problem.operators, (operator) => {
              const expression = { op: operator, left, right };
              const key = independentProgramExpressionKey(expression);
              if (setHas(seen, key)) {
                return;
              }
              setAdd(seen, key);
              arrayPush(expressions, expression);
            });
          });
        });
      }
    }
    arraySort(expressions, (left, right) => stringLocaleCompare(
      independentProgramExpressionKey(left),
      independentProgramExpressionKey(right)
    ));
    byDepth[depth] = expressions;
  }
  return byDepth;
}

function independentlyEvaluateProgramExpression(expression, inputs) {
  if (expression.op === 'var') {
    return inputs[expression.name];
  }
  if (expression.op === 'const') {
    return expression.value;
  }
  const left = independentlyEvaluateProgramExpression(expression.left, inputs);
  const right = independentlyEvaluateProgramExpression(expression.right, inputs);
  const value = expression.op === 'add'
    ? left + right
    : expression.op === 'subtract'
      ? left - right
      : left * right;
  return isFiniteNumber(value) ? value : null;
}

function independentlySynthesizeProgram(input, maxCandidates) {
  if (
    !input
    || typeof input !== 'object'
    || arrayIsArray(input)
    || !arrayIsArray(input.variables)
    || !arrayIsArray(input.constants)
    || !arrayIsArray(input.operators)
    || !arrayIsArray(input.examples)
    || input.variables.length === 0
    || input.variables.length > MAX_PROGRAM_VARIABLES
    || input.constants.length === 0
    || input.constants.length > MAX_PROGRAM_CONSTANTS
    || input.operators.length === 0
    || input.operators.length > MAX_PROGRAM_OPERATORS
    || input.examples.length === 0
    || input.examples.length > MAX_PROGRAM_EXAMPLES
    || !isInteger(input.maxDepth)
    || input.maxDepth < 0
    || input.maxDepth > MAX_PROGRAM_DEPTH
    || !isInteger(maxCandidates)
    || maxCandidates <= 0
    || maxCandidates > MAX_PROGRAM_CANDIDATES
  ) {
    return null;
  }

  try {
    const variables = arraySort(arraySlice(input.variables), stringLocaleCompare);
    if (
      arraySome(variables, (name) => (
        typeof name !== 'string' || name === '' || stringTrim(name) !== name
      ))
      || setSize(setFromArray(variables)) !== variables.length
    ) {
      return null;
    }
    const variableSet = setFromArray(variables);
    const constants = arraySort(arraySlice(input.constants), (left, right) => left - right);
    if (
      arraySome(constants, (value) => !isFiniteNumber(value))
      || setSize(setFromArray(arrayMap(constants, (value) => jsonStringify(value)))) !== constants.length
    ) {
      return null;
    }
    const operators = arraySort(arraySlice(input.operators), stringLocaleCompare);
    if (
      arraySome(operators, (operator) => (
        typeof operator !== 'string'
        || operator === ''
        || stringTrim(operator) !== operator
        || !arrayIncludes(['add', 'subtract', 'multiply'], operator)
      ))
      || setSize(setFromArray(operators)) !== operators.length
    ) {
      return null;
    }

    const examples = arrayMap(input.examples, (example, index) => {
      if (
        !objectHasOwn(input.examples, index)
        || !example
        || typeof example !== 'object'
        || arrayIsArray(example)
        || !example.inputs
        || typeof example.inputs !== 'object'
        || arrayIsArray(example.inputs)
        || !isFiniteNumber(example.output)
      ) {
        throw new TypeError('Invalid program-synthesis example');
      }
      const inputNames = objectKeys(example.inputs);
      if (
        inputNames.length !== variables.length
        || arraySome(inputNames, (name) => !setHas(variableSet, name))
        || arraySome(variables, (name) => !objectHasOwn(example.inputs, name))
        || arraySome(variables, (name) => !isFiniteNumber(example.inputs[name]))
      ) {
        throw new TypeError(`Invalid program-synthesis inputs at ${index}`);
      }
      return {
        inputs: objectFromEntries(arrayMap(variables, (name) => [name, example.inputs[name]])),
        output: example.output
      };
    });

    const problem = { variables, constants, operators, examples, maxDepth: input.maxDepth };
    const byDepth = independentlyBuildProgramExpressions(problem);
    let candidatesEvaluated = 0;
    let complete = true;
    let best = null;
    for (let depth = 0; depth <= problem.maxDepth; depth += 1) {
      const expressions = byDepth[depth];
      for (let index = 0; index < expressions.length; index += 1) {
        if (candidatesEvaluated >= maxCandidates) {
          complete = false;
          break;
        }
        const expression = expressions[index];
        candidatesEvaluated += 1;
        const matches = arrayEvery(
          problem.examples,
          (example) => independentlyEvaluateProgramExpression(expression, example.inputs) === example.output
        );
        if (matches && (
          best === null
          || depth < best.depth
          || (depth === best.depth && stringLocaleCompare(
            independentProgramExpressionKey(expression),
            best.expressionKey
          ) < 0)
        )) {
          best = {
            expression,
            expressionKey: independentProgramExpressionKey(expression),
            depth
          };
        }
      }
      if (!complete) {
        break;
      }
    }
    return {
      expression: best?.expression ?? null,
      expressionKey: best?.expressionKey ?? null,
      depth: best?.depth ?? null,
      examplesChecked: examples.length,
      candidatesEvaluated,
      synthesisComplete: complete,
      candidateBudget: maxCandidates
    };
  } catch {
    return null;
  }
}

export function verifyProgramSynthesisExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.PROGRAM_SYNTHESIS) {
    throw new TypeError('Program-synthesis verification requires a program-synthesis execution');
  }

  const actual = execution.result ?? {};
  const expected = independentlySynthesizeProgram(execution.input, actual.candidateBudget);
  const actualExpressionKey = actual.expression === null
    ? null
    : (() => {
      try {
        return jsonStringify(actual.expression);
      } catch {
        return null;
      }
    })();
  const checks = [
    check('execution-status', execution.status === (
      expected?.synthesisComplete
        ? expected.expression === null ? 'failure' : 'success'
        : 'resource-limit'
    ), 'status matches synthesis completion or resource limits'),
    check('observation-status', execution.observation === (
      expected?.synthesisComplete ? 'program synthesized' : 'program synthesis budget exhausted'
    ), 'observation matches synthesis completion state'),
    check('expression', expected !== null && actualExpressionKey === expected.expressionKey, 'expression matches independent synthesis'),
    check('expression-key', expected !== null && actual.expressionKey === expected.expressionKey, 'expression key matches independent synthesis'),
    check('depth', expected !== null && actual.depth === expected.depth, 'expression depth matches independent synthesis'),
    check('examples', expected !== null && actual.examplesChecked === expected.examplesChecked, 'example count matches normalized input'),
    check('candidate-count', expected !== null && actual.candidatesEvaluated === expected.candidatesEvaluated, 'candidate count matches independent enumeration'),
    check('completion', expected !== null && actual.synthesisComplete === expected.synthesisComplete, 'completion state matches independent enumeration'),
    check('complete-synthesis', expected !== null && expected.synthesisComplete, 'complete bounded grammar was enumerated before proof'),
    check('candidate-budget', expected !== null && actual.candidateBudget === expected.candidateBudget, 'candidate budget is preserved')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && expected.synthesisComplete && expected.expression !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: PROGRAM_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, PROGRAM_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

function independentlySearchTree(input, maxExpansions = positiveInfinity()) {
  if (
    !input
    || typeof input !== 'object'
    || arrayIsArray(input)
    || !arrayIsArray(input.nodes)
    || !arrayIsArray(input.edges)
    || input.nodes.length === 0
    || input.nodes.length > MAX_SEARCH_TREE_NODES
    || input.edges.length > MAX_SEARCH_TREE_EDGES
    || (input.objective !== 'minimize' && input.objective !== 'maximize')
    || typeof input.root !== 'string'
    || input.root === ''
    || stringTrim(input.root) !== input.root
    || (!isFiniteNumber(maxExpansions) && maxExpansions !== positiveInfinity())
    || (isFiniteNumber(maxExpansions) && (!isInteger(maxExpansions) || maxExpansions <= 0))
  ) {
    return null;
  }

  try {
    const seenNodes = setFromArray([]);
    const nodes = arrayMap(input.nodes, (node, index) => {
      if (
        !objectHasOwn(input.nodes, index)
        || !node
        || typeof node !== 'object'
        || arrayIsArray(node)
        || typeof node.id !== 'string'
        || node.id === ''
        || stringTrim(node.id) !== node.id
        || setHas(seenNodes, node.id)
        || typeof node.terminal !== 'boolean'
        || (node.terminal && !isFiniteNumber(node.value))
        || (!node.terminal && node.value !== null)
      ) {
        throw new TypeError('Invalid search-tree node');
      }
      setAdd(seenNodes, node.id);
      return {
        id: node.id,
        terminal: node.terminal,
        value: node.terminal ? node.value : null
      };
    });
    if (!setHas(seenNodes, input.root)) {
      throw new TypeError('Search-tree root is undeclared');
    }

    const nodesById = mapFromEntries(arrayMap(nodes, (node) => [node.id, node]));
    const adjacency = mapFromEntries(arrayMap(nodes, (node) => [node.id, []]));
    const parentCounts = mapFromEntries(arrayMap(nodes, (node) => [node.id, 0]));
    const edgeKeys = setFromArray([]);
    arrayForEach(input.edges, (edge, index) => {
      if (
        !objectHasOwn(input.edges, index)
        || !edge
        || typeof edge !== 'object'
        || arrayIsArray(edge)
        || typeof edge.from !== 'string'
        || edge.from === ''
        || stringTrim(edge.from) !== edge.from
        || typeof edge.to !== 'string'
        || edge.to === ''
        || stringTrim(edge.to) !== edge.to
        || !mapHas(nodesById, edge.from)
        || !mapHas(nodesById, edge.to)
        || edge.from === edge.to
        || setHas(edgeKeys, jsonStringify([edge.from, edge.to]))
        || mapGet(nodesById, edge.from).terminal
      ) {
        throw new TypeError('Invalid search-tree edge');
      }
      setAdd(edgeKeys, jsonStringify([edge.from, edge.to]));
      arrayPush(mapGet(adjacency, edge.from), edge.to);
      mapSet(parentCounts, edge.to, mapGet(parentCounts, edge.to) + 1);
      if (mapGet(parentCounts, edge.to) > 1) {
        throw new TypeError('Search-tree node has multiple parents');
      }
    });

    arrayForEach(nodes, (node) => {
      const parentCount = mapGet(parentCounts, node.id);
      const childCount = mapGet(adjacency, node.id).length;
      if (
        (node.id === input.root && parentCount !== 0)
        || (node.id !== input.root && parentCount !== 1)
        || (node.terminal && childCount !== 0)
        || (!node.terminal && childCount === 0)
      ) {
        throw new TypeError('Invalid search-tree parent/child structure');
      }
    });

    const reachable = setFromArray([]);
    const structureQueue = [{ id: input.root, depth: 0 }];
    for (let index = 0; index < structureQueue.length; index += 1) {
      const current = structureQueue[index];
      if (setHas(reachable, current.id) || current.depth > MAX_SEARCH_TREE_DEPTH) {
        throw new TypeError('Invalid search-tree reachability');
      }
      setAdd(reachable, current.id);
      arrayForEach(mapGet(adjacency, current.id), (child) => {
        arrayPush(structureQueue, { id: child, depth: current.depth + 1 });
      });
    }
    if (setSize(reachable) !== nodes.length || !arraySome(nodes, (node) => node.terminal)) {
      throw new TypeError('Invalid search-tree reachability');
    }

    const queue = [{ id: input.root, path: [input.root] }];
    const visited = [];
    let expansions = 0;
    let terminalNodesEvaluated = 0;
    let best = null;
    for (let index = 0; index < queue.length; index += 1) {
      if (expansions >= maxExpansions) {
        break;
      }
      const current = queue[index];
      const node = mapGet(nodesById, current.id);
      expansions += 1;
      arrayPush(visited, current.id);
      if (node.terminal) {
        terminalNodesEvaluated += 1;
        const improves = best === null
          || (input.objective === 'minimize' ? node.value < best.value : node.value > best.value)
          || (node.value === best.value && stringLocaleCompare(node.id, best.id) < 0);
        if (improves) {
          best = {
            id: node.id,
            value: node.value,
            path: arraySlice(current.path)
          };
        }
        continue;
      }
      arrayForEach(mapGet(adjacency, current.id), (child) => {
        const path = arraySlice(current.path);
        arrayPush(path, child);
        arrayPush(queue, { id: child, path });
      });
    }

    return {
      objective: input.objective,
      selectedId: best?.id ?? null,
      selectedValue: best?.value ?? null,
      path: best?.path ?? null,
      nodesVisited: visited,
      terminalNodesEvaluated,
      expansions,
      searchComplete: queue.length === visited.length,
      expansionBudget: isFiniteNumber(maxExpansions) ? maxExpansions : null,
      tieBreak: 'lexicographic-id'
    };
  } catch {
    return null;
  }
}

export function verifySearchTreeExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.SEARCH_TREE) {
    throw new TypeError('Search-tree verification requires a search-tree execution');
  }

  const actual = execution.result ?? {};
  const expansionBudget = actual.expansionBudget === null
    ? positiveInfinity()
    : actual.expansionBudget;
  const expected = independentlySearchTree(execution.input, expansionBudget);
  const checks = [
    check('execution-status', execution.status === (
      expected?.searchComplete
        ? expected.selectedId === null ? 'failure' : 'success'
        : 'resource-limit'
    ), 'status matches complete search or resource limits'),
    check('observation-status', execution.observation === (
      expected?.searchComplete ? 'search completed' : 'search budget exhausted'
    ), 'observation matches search completion state'),
    check('objective', expected !== null && actual.objective === expected.objective, 'objective matches normalized input'),
    check('selected-id', expected !== null && actual.selectedId === expected.selectedId, 'selected terminal matches independent search'),
    check('selected-value', expected !== null && actual.selectedValue === expected.selectedValue, 'selected value matches independent search'),
    check('path', expected !== null && samePath(actual.path, expected.path), 'selected path matches independent search'),
    check('visited-nodes', expected !== null && samePath(actual.nodesVisited, expected.nodesVisited), 'visited node order matches independent search'),
    check('terminal-count', expected !== null && actual.terminalNodesEvaluated === expected.terminalNodesEvaluated, 'terminal evaluation count matches independent search'),
    check('expansions', expected !== null && actual.expansions === expected.expansions, 'expansion count matches independent search'),
    check('completion', expected !== null && actual.searchComplete === expected.searchComplete, 'completion state matches independent search'),
    check('complete-search', expected !== null && expected.searchComplete, 'global terminal search completed before proof'),
    check('expansion-budget', expected !== null && actual.expansionBudget === expected.expansionBudget, 'expansion budget is preserved'),
    check('tie-break', expected !== null && actual.tieBreak === expected.tieBreak, 'deterministic tie-break policy is preserved')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && expected.searchComplete && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: SEARCH_TREE_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, SEARCH_TREE_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

export function verifyModelExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.NATURAL_LANGUAGE) {
    throw new TypeError('Model verification requires a natural-language execution');
  }

  const actual = execution.result ?? {};
  const responseShape = isPlainObject(actual);
  const checks = [
    check('execution-status', execution.status === 'success', 'model provider completed successfully'),
    check('observation-status', execution.observation === 'model response completed', 'observation identifies a model response'),
    check('response-shape', responseShape, 'model response is a plain data object'),
    check('text', responseShape && typeof actual.text === 'string' && stringTrim(actual.text) !== '', 'model response contains non-empty text'),
    check('provider-source', responseShape && actual.source === MODEL_PROVIDER_SOURCE, 'model response identifies its process-isolated source'),
    check('provider-id', responseShape && typeof actual.providerId === 'string' && stringTrim(actual.providerId) !== '', 'model response identifies a provider'),
    check('model-id', responseShape && typeof actual.modelId === 'string' && stringTrim(actual.modelId) !== '', 'model response identifies a model'),
    check('semantic-proof', false, 'model output is not independently proven by the deterministic kernel')
  ];
  const deterministic = false;
  const verification = objectFreeze({
    verifierId: MODEL_VERIFIER_ID,
    passed: false,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, MODEL_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

const BUILTIN_VERIFIER_FUNCTIONS = setFromArray([
  verifyGraphExecution,
  verifyConstraintExecution,
  verifyArrayExecution,
  verifyDatabaseQueryExecution,
  verifyTheoremExecution,
  verifyBayesianExecution,
  verifySimulationExecution,
  verifyOptimizationExecution,
  verifySearchTreeExecution,
  verifyProgramSynthesisExecution,
  verifyModelExecution
]);

export function verifyArrayExecution(execution, { reproduction = 'FluidHarness.execute' } = {}) {
  if (!isTrustedExecution(execution)) {
    throw new TypeError('Verification requires an execution produced by a registered executor');
  }

  if (execution.representation !== REPRESENTATIONS.ARRAY_COMPUTATION) {
    throw new TypeError('Array verification requires an array computation execution');
  }

  const expected = independentlyComputeArray(execution.input);
  const actual = execution.result ?? {};
  const operationValid = expected !== null && actual.operation === expected.operation;
  const lengthValid = expected !== null && actual.length === expected.length;
  const valueValid = expected?.operation === 'add'
    ? sameNumberArray(actual.values, expected.values)
    : expected?.operation === 'dot' && actual.value === expected.value;
  const checks = [
    check('execution-status', execution.status === 'success', 'array executor completed successfully'),
    check('observation-status', execution.observation === 'array computation completed', 'observation identifies an array computation'),
    check('operation', operationValid, 'reported operation matches normalized input'),
    check('length', lengthValid, 'reported length matches both operands'),
    check('result', valueValid, 'result matches an independent array calculation')
  ];
  const deterministic = execution.deterministic === true;
  const passed = deterministic && expected !== null && arrayEvery(
    checks,
    ({ passed: checkPassed }) => checkPassed
  );
  const verification = objectFreeze({
    verifierId: ARRAY_VERIFIER_ID,
    passed,
    deterministic,
    checks: objectFreeze(checks),
    environmentHash: environmentHash(execution, ARRAY_VERIFIER_ID),
    reproduction: typeof reproduction === 'string' && stringTrim(reproduction) !== ''
      ? stringTrim(reproduction)
      : 'FluidHarness.execute'
  });
  weakMapSet(TRUSTED_VERIFICATIONS, verification, execution);
  return verification;
}

export class VerifierRegistry {
  constructor({
    verifiers = [
      { representation: REPRESENTATIONS.GRAPH, verify: verifyGraphExecution },
      { representation: REPRESENTATIONS.CONSTRAINT_SYSTEM, verify: verifyConstraintExecution },
      { representation: REPRESENTATIONS.ARRAY_COMPUTATION, verify: verifyArrayExecution },
      { representation: REPRESENTATIONS.DATABASE_QUERY, verify: verifyDatabaseQueryExecution },
      { representation: REPRESENTATIONS.THEOREM, verify: verifyTheoremExecution },
      { representation: REPRESENTATIONS.PROBABILISTIC_INFERENCE, verify: verifyBayesianExecution },
      { representation: REPRESENTATIONS.SIMULATION, verify: verifySimulationExecution },
      { representation: REPRESENTATIONS.OPTIMIZATION, verify: verifyOptimizationExecution },
      { representation: REPRESENTATIONS.SEARCH_TREE, verify: verifySearchTreeExecution },
      { representation: REPRESENTATIONS.PROGRAM_SYNTHESIS, verify: verifyProgramSynthesisExecution },
      { representation: REPRESENTATIONS.NATURAL_LANGUAGE, verify: verifyModelExecution }
    ]
  } = {}) {
    if (!arrayIsArray(verifiers) || verifiers.length === 0) {
      throw new TypeError('VerifierRegistry requires at least one verifier');
    }
    if (arraySome(verifiers, ({ representation, verify }) => !representation || typeof verify !== 'function')) {
      throw new TypeError('Each verifier must declare a representation and verify function');
    }

    this.verifiers = objectFreeze(arrayMap(verifiers, (verifier) => {
      const verify = setHas(BUILTIN_VERIFIER_FUNCTIONS, verifier.verify)
        ? verifier.verify.bind(null)
        : verifier.verify;
      return objectFreeze({ ...verifier, verify });
    }));
    objectFreeze(this);
  }

  resolve(execution) {
    const verifier = arrayFind(
      this.verifiers,
      ({ representation }) => representation === execution?.representation
    );
    if (!verifier) {
      throw new TypeError(`No verifier is registered for ${execution?.representation ?? 'unknown representation'}`);
    }
    return verifier;
  }

  verify(execution, options = {}) {
    return this.resolve(execution).verify(execution, options);
  }
}

objectFreeze(VerifierRegistry.prototype);

const defaultVerifierRegistry = new VerifierRegistry();

export function verifyExecution(execution, options = {}) {
  return defaultVerifierRegistry.verify(execution, options);
}
