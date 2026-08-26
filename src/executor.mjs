import { REPRESENTATIONS } from './representation.mjs';
import {
  absNumber,
  arrayCreate,
  arrayIsArray,
  arrayEvery,
  arrayFind,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayJoin,
  arrayMap,
  arrayPush,
  arrayReduce,
  arrayReverse,
  arraySlice,
  arraySort,
  arraySome,
  isFiniteNumber,
  isFrozenObject,
  isPlainObject,
  isSafeInteger,
  jsonStringify,
  mapFromEntries,
  mapGet,
  mapHas,
  mapSet,
  setSize,
  maxNumber,
  minNumbers,
  objectEntries,
  objectFromEntries,
  objectFreeze,
  objectKeys,
  objectValues,
  objectDefineProperty,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectHasOwn,
  positiveInfinity,
  reflectOwnKeys,
  setAdd,
  setDelete,
  setFromArray,
  setHas,
  stringLocaleCompare,
  stringToLowerCase,
  stringTrim,
  weakMapCreate,
  weakMapGet,
  weakMapHas,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_EXECUTIONS = weakSetCreate();
const TRUSTED_EXECUTION_PRODUCERS = weakMapCreate();
const TRUSTED_EXECUTION_REGISTRIES = weakMapCreate();
const MAX_DATABASE_QUERY_ROWS = 64;
const MAX_DATABASE_QUERY_FIELDS = 32;
const MAX_THEOREM_VARIABLES = 8;
const MAX_THEOREM_ASSUMPTIONS = 16;
const MAX_THEOREM_FORMULA_DEPTH = 8;
const MAX_THEOREM_FORMULA_NODES = 64;
const MAX_BAYESIAN_HYPOTHESES = 32;
const MAX_BAYESIAN_EVENTS = 32;
const BAYESIAN_TOLERANCE = 1e-12;
const MAX_SIMULATION_STATES = 32;
const MAX_SIMULATION_TRANSITIONS = 64;
const MAX_SIMULATION_EVENTS = 64;
const MAX_OPTIMIZATION_CANDIDATES = 64;
const MAX_SEARCH_TREE_NODES = 64;
const MAX_SEARCH_TREE_EDGES = 63;
const MAX_SEARCH_TREE_DEPTH = 64;
const MAX_PROGRAM_VARIABLES = 4;
const MAX_PROGRAM_CONSTANTS = 8;
const MAX_PROGRAM_OPERATORS = 3;
const MAX_PROGRAM_EXAMPLES = 16;
const MAX_PROGRAM_DEPTH = 4;
const MAX_PROGRAM_CANDIDATES = 2048;

function requireString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }

  return stringTrim(value);
}

function requireDenseArray(value, field) {
  for (let index = 0; index < value.length; index += 1) {
    if (!objectHasOwn(value, index)) {
      throw new TypeError(`${field} must not contain holes`);
    }
  }
  return value;
}

function requirePlainObject(value, field) {
  if (!value || typeof value !== 'object' || !isPlainObject(value)) {
    throw new TypeError(`${field} must be a plain object`);
  }
  return value;
}

function copyAndFreeze(value, seen = weakMapCreate()) {
  if (typeof value === 'function') {
    throw new TypeError('Executor values must not contain functions');
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (weakMapHas(seen, value)) {
    return weakMapGet(seen, value);
  }

  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Executor values must use plain objects and arrays');
  }

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError('Executor values must contain only enumerable data properties');
    }
  });

  const copy = arrayIsArray(value) ? arrayCreate(value.length) : {};
  weakMapSet(seen, value, copy);
  arrayForEach(objectEntries(value), (entry) => {
    const key = entry[0];
    const nestedValue = entry[1];
    objectDefineProperty(copy, key, {
      value: copyAndFreeze(nestedValue, seen),
      enumerable: true,
      writable: true,
      configurable: true
    });
  });
  return objectFreeze(copy);
}

function stableSerialize(value) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return jsonStringify(value);
  }
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) {
      throw new TypeError('Execution input must contain finite numbers');
    }
    return jsonStringify(value);
  }
  if (arrayIsArray(value)) {
    return `[${arrayJoin(arrayMap(value, (entry) => stableSerialize(entry)), ',')}]`;
  }
  if (typeof value === 'object') {
    return `{${arrayJoin(arrayMap(arraySort(objectKeys(value)), (key) => (
      `${jsonStringify(key)}:${stableSerialize(value[key])}`
    )), ',')}}`;
  }
  throw new TypeError('Execution input must contain JSON-compatible values');
}

export function sameInput(left, right) {
  try {
    return stableSerialize(left) === stableSerialize(right);
  } catch {
    return false;
  }
}

function normalizeGraphInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.nodes) || !arrayIsArray(input.edges)) {
    throw new TypeError('Graph input requires nodes and edges arrays');
  }

  const nodes = arrayMap(
    requireDenseArray(input.nodes, 'Graph nodes'),
    (node) => requireString(node, 'Graph node')
  );
  if (setSize(setFromArray(nodes)) !== nodes.length) {
    throw new TypeError('Graph nodes must be unique');
  }

  const nodeSet = setFromArray(nodes);
  const edges = arrayMap(requireDenseArray(input.edges, 'Graph edges'), (edge) => {
    const from = arrayIsArray(edge) ? edge[0] : edge?.from;
    const to = arrayIsArray(edge) ? edge[1] : edge?.to;
    const normalizedFrom = requireString(from, 'Edge source');
    const normalizedTo = requireString(to, 'Edge destination');

    if (!setHas(nodeSet, normalizedFrom) || !setHas(nodeSet, normalizedTo)) {
      throw new TypeError('Graph edges must reference declared nodes');
    }

    return objectFreeze({ from: normalizedFrom, to: normalizedTo });
  });

  const start = requireString(input.start, 'Graph start');
  const goal = requireString(input.goal, 'Graph goal');
  if (!setHas(nodeSet, start) || !setHas(nodeSet, goal)) {
    throw new TypeError('Graph start and goal must reference declared nodes');
  }

  return objectFreeze({
    nodes: objectFreeze(nodes),
    edges: objectFreeze(edges),
    start,
    goal
  });
}

function shortestPath(graph, { maxExpansions = positiveInfinity() } = {}) {
  const adjacency = mapFromEntries(arrayMap(graph.nodes, (node) => [node, []]));
  arrayForEach(graph.edges, (edge) => {
    arrayPush(mapGet(adjacency, edge.from), edge.to);
  });

  const queue = [graph.start];
  const previous = mapFromEntries([[graph.start, null]]);
  let expansions = 0;
  for (let index = 0; index < queue.length; index += 1) {
    if (expansions >= maxExpansions) {
      return { path: null, complete: false, expansions };
    }

    const current = queue[index];
    expansions += 1;
    if (current === graph.goal) {
      break;
    }

    arrayForEach(mapGet(adjacency, current), (neighbor) => {
      if (!mapHas(previous, neighbor)) {
        mapSet(previous, neighbor, current);
        arrayPush(queue, neighbor);
      }
    });
  }

  if (!mapHas(previous, graph.goal)) {
    return { path: null, complete: true, expansions };
  }

  const path = [];
  for (let current = graph.goal; current !== null; current = mapGet(previous, current)) {
    arrayPush(path, current);
  }
  return { path: arrayReverse(path), complete: true, expansions };
}

function requireInteger(value, field, { positive = false } = {}) {
  if (!isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    throw new TypeError(
      `${field} must be a ${positive ? 'positive' : 'non-negative'} integer (safe integer required)`
    );
  }

  return value;
}

function normalizeGraphExecutionOptions(options) {
  if (options === undefined) {
    return objectFreeze({ maxExpansions: positiveInfinity() });
  }
  if (!options || typeof options !== 'object' || arrayIsArray(options)) {
    throw new TypeError('Graph execution options must be an object');
  }

  const maxExpansions = options.maxExpansions === undefined
    ? positiveInfinity()
    : requireInteger(options.maxExpansions, 'Graph maxExpansions', { positive: true });
  return objectFreeze({ maxExpansions });
}

function normalizeConstraintInput(input) {
  if (
    !input
    || !isPlainObject(input)
    || !isPlainObject(input.resources)
    || !arrayIsArray(input.jobs)
  ) {
    throw new TypeError('Constraint input requires resources and jobs');
  }

  const normalizedResourceEntries = arrayMap(objectEntries(input.resources), (entry) => {
    const name = entry[0];
    const capacity = entry[1];
    return [
      requireString(name, 'Resource name'),
      requireInteger(capacity, `Capacity for ${name}`, { positive: true })
    ];
  });
  const resourceKeys = setFromArray([]);
  arrayForEach(normalizedResourceEntries, (entry) => setAdd(resourceKeys, entry[0]));
  if (setSize(resourceKeys) !== normalizedResourceEntries.length) {
    throw new TypeError('Constraint resource names must be unique after normalization');
  }
  const resources = objectFromEntries(normalizedResourceEntries);
  const resourceNames = setFromArray(objectKeys(resources));
  if (setSize(resourceNames) === 0) {
    throw new TypeError('Constraint input requires at least one resource');
  }

  const seenJobs = setFromArray([]);
  const jobs = arrayMap(requireDenseArray(input.jobs, 'Constraint jobs'), (job) => {
    requirePlainObject(job, 'Each constraint job');

    const id = requireString(job.id, 'Job id');
    if (setHas(seenJobs, id)) {
      throw new TypeError(`Duplicate job id: ${id}`);
    }
    setAdd(seenJobs, id);

    const prerequisites = job.prerequisites ?? [];
    if (!arrayIsArray(prerequisites)) {
      throw new TypeError(`Prerequisites for ${id} must be an array`);
    }
    requireDenseArray(prerequisites, `Prerequisites for ${id}`);

    const demandInput = job.demand ?? {};
    requirePlainObject(demandInput, `Demand for ${id}`);
    const normalizedDemandEntries = arrayMap(objectEntries(demandInput), (entry) => {
      const resource = entry[0];
      const amount = entry[1];
      const normalizedResource = requireString(resource, `Resource for ${id}`);
      if (!setHas(resourceNames, normalizedResource)) {
        throw new TypeError(`Job ${id} uses undeclared resource: ${resource}`);
      }
      const normalizedAmount = requireInteger(
        amount,
        `Demand for ${id}/${normalizedResource}`
      );
      if (normalizedAmount > resources[normalizedResource]) {
        throw new TypeError(`Demand for ${id}/${normalizedResource} exceeds capacity`);
      }
      return [normalizedResource, normalizedAmount];
    });
    const demandKeys = setFromArray([]);
    arrayForEach(normalizedDemandEntries, (entry) => setAdd(demandKeys, entry[0]));
    if (setSize(demandKeys) !== normalizedDemandEntries.length) {
      throw new TypeError(`Demand resource names for ${id} must be unique after normalization`);
    }
    const demand = objectFromEntries(normalizedDemandEntries);

    return objectFreeze({
      id,
      duration: requireInteger(job.duration, `Duration for ${id}`, { positive: true }),
      prerequisites: objectFreeze(arrayMap(
        prerequisites,
        (prerequisite) => requireString(prerequisite, `Prerequisite for ${id}`)
      )),
      demand: objectFreeze(demand)
    });
  });

  const jobsById = mapFromEntries(arrayMap(jobs, (job) => [job.id, job]));
  arrayForEach(jobs, (job) => {
    if (arrayIncludes(job.prerequisites, job.id)) {
      throw new TypeError(`Job ${job.id} cannot depend on itself`);
    }
    arrayForEach(job.prerequisites, (prerequisite) => {
      if (!mapHas(jobsById, prerequisite)) {
        throw new TypeError(`Job ${job.id} depends on unknown job: ${prerequisite}`);
      }
    });
  });

  const visitState = mapFromEntries([]);
  function hasCycle(jobId) {
    const state = mapGet(visitState, jobId) ?? 0;
    if (state === 1) {
      return true;
    }
    if (state === 2) {
      return false;
    }

    mapSet(visitState, jobId, 1);
    let dependencyCycle = false;
    arrayForEach(mapGet(jobsById, jobId).prerequisites, (prerequisite) => {
      if (hasCycle(prerequisite)) {
        dependencyCycle = true;
      }
    });
    if (dependencyCycle) {
      return true;
    }
    mapSet(visitState, jobId, 2);
    return false;
  }

  if (arraySome(jobs, (job) => hasCycle(job.id))) {
    throw new TypeError('Constraint jobs must not contain dependency cycles');
  }

  return objectFreeze({
    resources: objectFreeze(resources),
    jobs: objectFreeze(jobs)
  });
}

function requireFiniteNumber(value, field) {
  if (typeof value !== 'number' || !isFiniteNumber(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  return value;
}

function normalizeArrayInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.left) || !arrayIsArray(input.right)) {
    throw new TypeError('Array input requires left and right arrays');
  }

  const operation = stringToLowerCase(requireString(input.operation, 'Array operation'));
  if (!arrayIncludes(['add', 'dot'], operation)) {
    throw new TypeError(`Unsupported array operation: ${operation}`);
  }
  if (input.left.length !== input.right.length) {
    throw new TypeError('Array operands must have equal length');
  }

  const left = arrayMap(
    requireDenseArray(input.left, 'Array left'),
    (value, index) => requireFiniteNumber(value, `Array left[${index}]`)
  );
  const right = arrayMap(
    requireDenseArray(input.right, 'Array right'),
    (value, index) => requireFiniteNumber(value, `Array right[${index}]`)
  );
  return objectFreeze({
    left: objectFreeze(left),
    right: objectFreeze(right),
    operation
  });
}

function normalizeDatabaseScalar(value, field) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && isFiniteNumber(value)) {
    return value;
  }
  throw new TypeError(`${field} must be a JSON-compatible scalar`);
}

function requireDatabaseFieldName(value, field) {
  const normalized = requireString(value, field);
  if (normalized !== value) {
    throw new TypeError(`${field} must not contain surrounding whitespace`);
  }
  return normalized;
}

function normalizeDatabaseQueryInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.rows) || !arrayIsArray(input.select)) {
    throw new TypeError('Database query input requires rows and select arrays');
  }
  if (input.rows.length === 0 || input.rows.length > MAX_DATABASE_QUERY_ROWS) {
    throw new TypeError(`Database query rows must contain 1-${MAX_DATABASE_QUERY_ROWS} rows`);
  }
  if (input.select.length === 0 || input.select.length > MAX_DATABASE_QUERY_FIELDS) {
    throw new TypeError(`Database query select must contain 1-${MAX_DATABASE_QUERY_FIELDS} fields`);
  }

  const rowsInput = requireDenseArray(input.rows, 'Database query rows');
  const firstRow = rowsInput[0];
  requirePlainObject(firstRow, 'Database query row');
  const fields = arraySort(
    arrayMap(objectKeys(firstRow), (field) => requireDatabaseFieldName(field, 'Database field')),
    stringLocaleCompare
  );
  if (fields.length === 0 || fields.length > MAX_DATABASE_QUERY_FIELDS) {
    throw new TypeError(`Database query rows must contain 1-${MAX_DATABASE_QUERY_FIELDS} fields`);
  }
  const fieldSet = setFromArray(fields);
  const rows = arrayMap(rowsInput, (row, rowIndex) => {
    requirePlainObject(row, `Database query row ${rowIndex}`);
    const rowFields = objectKeys(row);
    if (
      rowFields.length !== fields.length
      || arraySome(rowFields, (field) => !setHas(fieldSet, field))
    ) {
      throw new TypeError('Database query rows must share one field schema');
    }
    return objectFreeze(objectFromEntries(arrayMap(
      fields,
      (field) => [field, normalizeDatabaseScalar(row[field], `Database query ${field}`)]
    )));
  });

  const selectedFields = arrayMap(
    requireDenseArray(input.select, 'Database query select'),
    (field) => requireDatabaseFieldName(field, 'Database selected field')
  );
  const selectedSet = setFromArray(selectedFields);
  if (setSize(selectedSet) !== selectedFields.length) {
    throw new TypeError('Database query select fields must be unique');
  }
  if (arraySome(selectedFields, (field) => !setHas(fieldSet, field))) {
    throw new TypeError('Database query select fields must exist in every row');
  }

  let filter = null;
  if (input.filter !== undefined && input.filter !== null) {
    requirePlainObject(input.filter, 'Database query filter');
    const field = requireDatabaseFieldName(input.filter.field, 'Database filter field');
    if (!setHas(fieldSet, field)) {
      throw new TypeError('Database filter field must exist in every row');
    }
    filter = objectFreeze({
      field,
      equals: normalizeDatabaseScalar(input.filter.equals, 'Database filter value')
    });
  }

  let sort = null;
  if (input.sort !== undefined && input.sort !== null) {
    requirePlainObject(input.sort, 'Database query sort');
    const field = requireDatabaseFieldName(input.sort.field, 'Database sort field');
    if (!setHas(fieldSet, field)) {
      throw new TypeError('Database sort field must exist in every row');
    }
    const direction = stringToLowerCase(requireString(input.sort.direction, 'Database sort direction'));
    if (!arrayIncludes(['asc', 'desc'], direction)) {
      throw new TypeError('Database sort direction must be asc or desc');
    }
    const firstValue = rows[0][field];
    if (typeof firstValue !== 'number' && typeof firstValue !== 'string') {
      throw new TypeError('Database sort fields must contain only numbers or strings');
    }
    if (arraySome(rows, (row) => (
      typeof row[field] !== typeof firstValue
      || (typeof firstValue === 'number' && !isFiniteNumber(row[field]))
    ))) {
      throw new TypeError('Database sort fields must have one scalar type');
    }
    sort = objectFreeze({ field, direction });
  }

  const limit = input.limit === undefined || input.limit === null
    ? rows.length
    : requireInteger(input.limit, 'Database query limit');
  if (limit > MAX_DATABASE_QUERY_ROWS) {
    throw new TypeError(`Database query limit must not exceed ${MAX_DATABASE_QUERY_ROWS}`);
  }

  return objectFreeze({
    rows: objectFreeze(rows),
    select: objectFreeze(selectedFields),
    filter,
    sort,
    limit
  });
}

function normalizeTheoremFormula(formula, variables, state, depth = 0) {
  if (depth > MAX_THEOREM_FORMULA_DEPTH) {
    throw new TypeError(`Theorem formula depth must not exceed ${MAX_THEOREM_FORMULA_DEPTH}`);
  }
  requirePlainObject(formula, 'Theorem formula');
  state.nodes += 1;
  if (state.nodes > MAX_THEOREM_FORMULA_NODES) {
    throw new TypeError(`Theorem formula must not exceed ${MAX_THEOREM_FORMULA_NODES} nodes`);
  }

  const operation = stringToLowerCase(requireString(formula.op, 'Theorem formula operation'));
  switch (operation) {
    case 'true':
    case 'false':
      return objectFreeze({ op: operation });
    case 'var': {
      const name = requireString(formula.name, 'Theorem variable');
      if (!setHas(variables, name)) {
        throw new TypeError(`Theorem formula references undeclared variable: ${name}`);
      }
      return objectFreeze({ op: operation, name });
    }
    case 'not':
      return objectFreeze({
        op: operation,
        arg: normalizeTheoremFormula(formula.arg, variables, state, depth + 1)
      });
    case 'and':
    case 'or': {
      if (!arrayIsArray(formula.args)) {
        throw new TypeError(`Theorem ${operation} requires an args array`);
      }
      if (formula.args.length < 2 || formula.args.length > MAX_THEOREM_ASSUMPTIONS) {
        throw new TypeError(`Theorem ${operation} requires 2-${MAX_THEOREM_ASSUMPTIONS} arguments`);
      }
      return objectFreeze({
        op: operation,
        args: objectFreeze(arrayMap(
          requireDenseArray(formula.args, `Theorem ${operation} args`),
          (argument) => normalizeTheoremFormula(argument, variables, state, depth + 1)
        ))
      });
    }
    case 'implies':
    case 'iff':
      return objectFreeze({
        op: operation,
        left: normalizeTheoremFormula(formula.left, variables, state, depth + 1),
        right: normalizeTheoremFormula(formula.right, variables, state, depth + 1)
      });
    default:
      throw new TypeError(`Unsupported theorem formula operation: ${operation}`);
  }
}

function normalizeTheoremInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.variables) || !arrayIsArray(input.assumptions)) {
    throw new TypeError('Theorem input requires variables and assumptions arrays');
  }
  if (input.variables.length === 0 || input.variables.length > MAX_THEOREM_VARIABLES) {
    throw new TypeError(`Theorem variables must contain 1-${MAX_THEOREM_VARIABLES} names`);
  }
  if (input.assumptions.length > MAX_THEOREM_ASSUMPTIONS) {
    throw new TypeError(`Theorem assumptions must not exceed ${MAX_THEOREM_ASSUMPTIONS}`);
  }
  const variables = arrayMap(
    requireDenseArray(input.variables, 'Theorem variables'),
    (name) => requireString(name, 'Theorem variable name')
  );
  const variableSet = setFromArray(variables);
  if (setSize(variableSet) !== variables.length) {
    throw new TypeError('Theorem variable names must be unique');
  }

  const state = { nodes: 0 };
  const assumptions = arrayMap(
    requireDenseArray(input.assumptions, 'Theorem assumptions'),
    (formula) => normalizeTheoremFormula(formula, variableSet, state)
  );
  const conclusion = normalizeTheoremFormula(input.conclusion, variableSet, state);
  return objectFreeze({
    variables: objectFreeze(variables),
    assumptions: objectFreeze(assumptions),
    conclusion
  });
}

function requireProbability(value, field) {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    throw new TypeError(`${field} must be a probability between 0 and 1`);
  }
  return value;
}

function requireBayesianName(value, field) {
  const normalized = requireString(value, field);
  if (normalized !== value) {
    throw new TypeError(`${field} must not contain surrounding whitespace`);
  }
  return normalized;
}

function normalizeBayesianInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.hypotheses)) {
    throw new TypeError('Bayesian input requires a hypotheses array');
  }
  if (input.hypotheses.length === 0 || input.hypotheses.length > MAX_BAYESIAN_HYPOTHESES) {
    throw new TypeError(`Bayesian hypotheses must contain 1-${MAX_BAYESIAN_HYPOTHESES} entries`);
  }
  const observation = requireBayesianName(input.observation, 'Bayesian observation');
  const seen = setFromArray([]);
  const hypotheses = arrayMap(
    requireDenseArray(input.hypotheses, 'Bayesian hypotheses'),
    (hypothesis, index) => {
      requirePlainObject(hypothesis, `Bayesian hypothesis ${index}`);
      const id = requireBayesianName(hypothesis.id, `Bayesian hypothesis ${index} id`);
      if (setHas(seen, id)) {
        throw new TypeError(`Duplicate Bayesian hypothesis id: ${id}`);
      }
      setAdd(seen, id);
      requirePlainObject(hypothesis.likelihoods, `Bayesian likelihoods for ${id}`);
      const eventNames = arraySort(
        arrayMap(objectKeys(hypothesis.likelihoods), (event) => requireBayesianName(
          event,
          `Bayesian event for ${id}`
        )),
        stringLocaleCompare
      );
      if (eventNames.length === 0 || eventNames.length > MAX_BAYESIAN_EVENTS) {
        throw new TypeError(`Bayesian likelihoods for ${id} must contain 1-${MAX_BAYESIAN_EVENTS} events`);
      }
      if (!objectHasOwn(hypothesis.likelihoods, observation)) {
        throw new TypeError(`Bayesian likelihoods for ${id} must include the observation`);
      }
      const likelihoods = objectFreeze(objectFromEntries(arrayMap(
        eventNames,
        (event) => [
          event,
          requireProbability(
            hypothesis.likelihoods[event],
            `Bayesian likelihood for ${id}/${event}`
          )
        ]
      )));
      const likelihoodSum = arrayReduce(
        eventNames,
        (total, event) => total + likelihoods[event],
        0
      );
      if (!isFiniteNumber(likelihoodSum) || absNumber(likelihoodSum - 1) > BAYESIAN_TOLERANCE) {
        throw new TypeError(`Bayesian likelihoods for ${id} must sum to 1`);
      }
      return objectFreeze({
        id,
        prior: requireProbability(hypothesis.prior, `Bayesian prior for ${id}`),
        likelihoods
      });
    }
  );
  const priorSum = arrayReduce(hypotheses, (total, hypothesis) => total + hypothesis.prior, 0);
  if (!isFiniteNumber(priorSum) || absNumber(priorSum - 1) > BAYESIAN_TOLERANCE) {
    throw new TypeError('Bayesian priors must sum to 1');
  }
  const observationProbability = arrayReduce(
    hypotheses,
    (total, hypothesis) => total + hypothesis.prior * hypothesis.likelihoods[observation],
    0
  );
  if (!isFiniteNumber(observationProbability) || observationProbability <= 0) {
    throw new TypeError('Bayesian observation must have non-zero probability');
  }
  return objectFreeze({
    observation,
    hypotheses: objectFreeze(hypotheses)
  });
}

function requireSimulationName(value, field) {
  const normalized = requireString(value, field);
  if (normalized !== value) {
    throw new TypeError(`${field} must not contain surrounding whitespace`);
  }
  return normalized;
}

function normalizeSimulationInput(input) {
  if (
    !input
    || !isPlainObject(input)
    || !arrayIsArray(input.states)
    || !arrayIsArray(input.transitions)
    || !arrayIsArray(input.events)
  ) {
    throw new TypeError('Simulation input requires states, transitions, and events arrays');
  }
  if (input.states.length === 0 || input.states.length > MAX_SIMULATION_STATES) {
    throw new TypeError(`Simulation states must contain 1-${MAX_SIMULATION_STATES} entries`);
  }
  if (input.transitions.length === 0 || input.transitions.length > MAX_SIMULATION_TRANSITIONS) {
    throw new TypeError(`Simulation transitions must contain 1-${MAX_SIMULATION_TRANSITIONS} entries`);
  }
  if (input.events.length === 0 || input.events.length > MAX_SIMULATION_EVENTS) {
    throw new TypeError(`Simulation events must contain 1-${MAX_SIMULATION_EVENTS} entries`);
  }

  const states = arrayMap(
    requireDenseArray(input.states, 'Simulation states'),
    (state) => requireSimulationName(state, 'Simulation state')
  );
  const stateSet = setFromArray(states);
  if (setSize(stateSet) !== states.length) {
    throw new TypeError('Simulation states must be unique');
  }
  const initialState = requireSimulationName(input.initialState, 'Simulation initial state');
  if (!setHas(stateSet, initialState)) {
    throw new TypeError(`Simulation initial state is undeclared: ${initialState}`);
  }

  const transitionKeys = setFromArray([]);
  const transitions = arrayMap(
    requireDenseArray(input.transitions, 'Simulation transitions'),
    (transition, index) => {
      requirePlainObject(transition, `Simulation transition ${index}`);
      const from = requireSimulationName(transition.from, `Simulation transition ${index} source`);
      const event = requireSimulationName(transition.event, `Simulation transition ${index} event`);
      const to = requireSimulationName(transition.to, `Simulation transition ${index} target`);
      if (!setHas(stateSet, from) || !setHas(stateSet, to)) {
        throw new TypeError(`Simulation transition ${index} references an undeclared state`);
      }
      const key = jsonStringify([from, event]);
      if (setHas(transitionKeys, key)) {
        throw new TypeError(`Duplicate simulation transition for ${from}/${event}`);
      }
      setAdd(transitionKeys, key);
      return objectFreeze({ from, event, to });
    }
  );
  const events = arrayMap(
    requireDenseArray(input.events, 'Simulation events'),
    (event) => requireSimulationName(event, 'Simulation event')
  );

  return objectFreeze({
    states: objectFreeze(states),
    transitions: objectFreeze(transitions),
    initialState,
    events: objectFreeze(events)
  });
}

function requireOptimizationName(value, field) {
  const normalized = requireString(value, field);
  if (normalized !== value) {
    throw new TypeError(`${field} must not contain surrounding whitespace`);
  }
  return normalized;
}

function normalizeOptimizationInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.candidates)) {
    throw new TypeError('Optimization input requires a candidates array');
  }
  if (
    input.candidates.length === 0
    || input.candidates.length > MAX_OPTIMIZATION_CANDIDATES
  ) {
    throw new TypeError(`Optimization candidates must contain 1-${MAX_OPTIMIZATION_CANDIDATES} entries`);
  }
  const objective = requireOptimizationName(input.objective, 'Optimization objective');
  if (objective !== 'minimize' && objective !== 'maximize') {
    throw new TypeError('Optimization objective must be minimize or maximize');
  }

  const seen = setFromArray([]);
  const candidates = arrayMap(
    requireDenseArray(input.candidates, 'Optimization candidates'),
    (candidate, index) => {
      requirePlainObject(candidate, `Optimization candidate ${index}`);
      const id = requireOptimizationName(candidate.id, `Optimization candidate ${index} id`);
      if (setHas(seen, id)) {
        throw new TypeError(`Duplicate optimization candidate id: ${id}`);
      }
      setAdd(seen, id);
      if (!isFiniteNumber(candidate.value)) {
        throw new TypeError(`Optimization value for ${id} must be finite`);
      }
      return objectFreeze({ id, value: candidate.value });
    }
  );
  return objectFreeze({
    objective,
    candidates: objectFreeze(candidates)
  });
}

function requireSearchTreeName(value, field) {
  const normalized = requireString(value, field);
  if (normalized !== value) {
    throw new TypeError(`${field} must not contain surrounding whitespace`);
  }
  return normalized;
}

function normalizeSearchTreeInput(input) {
  if (!input || !isPlainObject(input) || !arrayIsArray(input.nodes) || !arrayIsArray(input.edges)) {
    throw new TypeError('Search-tree input requires nodes and edges arrays');
  }
  if (input.nodes.length === 0 || input.nodes.length > MAX_SEARCH_TREE_NODES) {
    throw new TypeError(`Search-tree nodes must contain 1-${MAX_SEARCH_TREE_NODES} entries`);
  }
  if (input.edges.length > MAX_SEARCH_TREE_EDGES) {
    throw new TypeError(`Search-tree edges must contain at most ${MAX_SEARCH_TREE_EDGES} entries`);
  }

  const root = requireSearchTreeName(input.root, 'Search-tree root');
  const objective = requireSearchTreeName(input.objective, 'Search-tree objective');
  if (objective !== 'minimize' && objective !== 'maximize') {
    throw new TypeError('Search-tree objective must be minimize or maximize');
  }

  const seenNodes = setFromArray([]);
  const nodes = arrayMap(
    requireDenseArray(input.nodes, 'Search-tree nodes'),
    (node, index) => {
      requirePlainObject(node, `Search-tree node ${index}`);
      const id = requireSearchTreeName(node.id, `Search-tree node ${index} id`);
      if (setHas(seenNodes, id)) {
        throw new TypeError(`Duplicate search-tree node id: ${id}`);
      }
      setAdd(seenNodes, id);
      if (typeof node.terminal !== 'boolean') {
        throw new TypeError(`Search-tree node ${id} terminal flag must be boolean`);
      }
      if (node.terminal && !isFiniteNumber(node.value)) {
        throw new TypeError(`Search-tree terminal value for ${id} must be finite`);
      }
      if (!node.terminal && node.value !== undefined) {
        throw new TypeError(`Search-tree branch node ${id} must not contain a value`);
      }
      return objectFreeze({
        id,
        terminal: node.terminal,
        value: node.terminal ? node.value : null
      });
    }
  );

  if (!setHas(seenNodes, root)) {
    throw new TypeError(`Search-tree root is undeclared: ${root}`);
  }

  const adjacency = mapFromEntries(arrayMap(nodes, (node) => [node.id, []]));
  const parentCounts = mapFromEntries(arrayMap(nodes, (node) => [node.id, 0]));
  const edgeKeys = setFromArray([]);
  const edges = arrayMap(
    requireDenseArray(input.edges, 'Search-tree edges'),
    (edge, index) => {
      requirePlainObject(edge, `Search-tree edge ${index}`);
      const from = requireSearchTreeName(edge.from, `Search-tree edge ${index} source`);
      const to = requireSearchTreeName(edge.to, `Search-tree edge ${index} target`);
      if (!setHas(seenNodes, from) || !setHas(seenNodes, to)) {
        throw new TypeError(`Search-tree edge ${index} references an undeclared node`);
      }
      if (from === to) {
        throw new TypeError(`Search-tree edge ${index} must not be a self-loop`);
      }
      if (setHas(edgeKeys, jsonStringify([from, to]))) {
        throw new TypeError(`Duplicate search-tree edge: ${from}/${to}`);
      }
      const sourceNode = arrayFind(nodes, (node) => node.id === from);
      if (sourceNode.terminal) {
        throw new TypeError(`Search-tree terminal node cannot have children: ${from}`);
      }
      setAdd(edgeKeys, jsonStringify([from, to]));
      arrayPush(mapGet(adjacency, from), to);
      mapSet(parentCounts, to, mapGet(parentCounts, to) + 1);
      if (mapGet(parentCounts, to) > 1) {
        throw new TypeError(`Search-tree node must have one parent: ${to}`);
      }
      return objectFreeze({ from, to });
    }
  );

  arrayForEach(nodes, (node) => {
    const parentCount = mapGet(parentCounts, node.id);
    const childCount = mapGet(adjacency, node.id).length;
    if (node.id === root && parentCount !== 0) {
      throw new TypeError('Search-tree root must not have a parent');
    }
    if (node.id !== root && parentCount !== 1) {
      throw new TypeError(`Search-tree node must have exactly one parent: ${node.id}`);
    }
    if (node.terminal && childCount !== 0) {
      throw new TypeError(`Search-tree terminal node cannot have children: ${node.id}`);
    }
    if (!node.terminal && childCount === 0) {
      throw new TypeError(`Search-tree branch node must have a child: ${node.id}`);
    }
  });

  const visited = setFromArray([]);
  const queue = [{ id: root, depth: 0 }];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (setHas(visited, current.id)) {
      throw new TypeError('Search-tree must not contain cycles');
    }
    setAdd(visited, current.id);
    if (current.depth > MAX_SEARCH_TREE_DEPTH) {
      throw new TypeError(`Search-tree depth must not exceed ${MAX_SEARCH_TREE_DEPTH}`);
    }
    arrayForEach(mapGet(adjacency, current.id), (child) => {
      arrayPush(queue, { id: child, depth: current.depth + 1 });
    });
  }
  if (setSize(visited) !== nodes.length) {
    throw new TypeError('Search-tree nodes must all be reachable from the root');
  }
  if (!arraySome(nodes, (node) => node.terminal)) {
    throw new TypeError('Search-tree requires at least one terminal node');
  }

  return objectFreeze({
    root,
    objective,
    nodes: objectFreeze(nodes),
    edges: objectFreeze(edges)
  });
}

function normalizeSearchTreeExecutionOptions(options) {
  if (options === undefined) {
    return objectFreeze({ maxExpansions: positiveInfinity() });
  }
  if (!options || typeof options !== 'object' || arrayIsArray(options)) {
    throw new TypeError('Search-tree execution options must be an object');
  }

  const maxExpansions = options.maxExpansions === undefined
    ? positiveInfinity()
    : requireInteger(options.maxExpansions, 'Search-tree maxExpansions', { positive: true });
  return objectFreeze({ maxExpansions });
}

function requireProgramName(value, field) {
  const normalized = requireString(value, field);
  if (normalized !== value) {
    throw new TypeError(`${field} must not contain surrounding whitespace`);
  }
  return normalized;
}

function normalizeProgramSynthesisInput(input) {
  if (
    !input
    || !isPlainObject(input)
    || !arrayIsArray(input.variables)
    || !arrayIsArray(input.constants)
    || !arrayIsArray(input.operators)
    || !arrayIsArray(input.examples)
  ) {
    throw new TypeError('Program-synthesis input requires variables, constants, operators, and examples arrays');
  }
  if (input.variables.length === 0 || input.variables.length > MAX_PROGRAM_VARIABLES) {
    throw new TypeError(`Program-synthesis variables must contain 1-${MAX_PROGRAM_VARIABLES} entries`);
  }
  if (input.constants.length === 0 || input.constants.length > MAX_PROGRAM_CONSTANTS) {
    throw new TypeError(`Program-synthesis constants must contain 1-${MAX_PROGRAM_CONSTANTS} entries`);
  }
  if (input.operators.length === 0 || input.operators.length > MAX_PROGRAM_OPERATORS) {
    throw new TypeError(`Program-synthesis operators must contain 1-${MAX_PROGRAM_OPERATORS} entries`);
  }
  if (input.examples.length === 0 || input.examples.length > MAX_PROGRAM_EXAMPLES) {
    throw new TypeError(`Program-synthesis examples must contain 1-${MAX_PROGRAM_EXAMPLES} entries`);
  }

  const variables = arraySort(
    arrayMap(requireDenseArray(input.variables, 'Program-synthesis variables'), (name) => (
      requireProgramName(name, 'Program-synthesis variable')
    )),
    stringLocaleCompare
  );
  if (setSize(setFromArray(variables)) !== variables.length) {
    throw new TypeError('Program-synthesis variables must be unique');
  }

  const constants = arraySort(
    arrayMap(requireDenseArray(input.constants, 'Program-synthesis constants'), (value) => {
      if (!isFiniteNumber(value)) {
        throw new TypeError('Program-synthesis constants must be finite');
      }
      return value;
    }),
    (left, right) => left - right
  );
  if (setSize(setFromArray(arrayMap(constants, (value) => jsonStringify(value)))) !== constants.length) {
    throw new TypeError('Program-synthesis constants must be unique');
  }

  const operators = arraySort(
    arrayMap(requireDenseArray(input.operators, 'Program-synthesis operators'), (operator) => (
      requireProgramName(operator, 'Program-synthesis operator')
    )),
    stringLocaleCompare
  );
  if (setSize(setFromArray(operators)) !== operators.length) {
    throw new TypeError('Program-synthesis operators must be unique');
  }
  if (arraySome(operators, (operator) => !arrayIncludes(['add', 'subtract', 'multiply'], operator))) {
    throw new TypeError('Program-synthesis operators must be add, subtract, or multiply');
  }

  const maxDepth = input.maxDepth === undefined
    ? 2
    : requireInteger(input.maxDepth, 'Program-synthesis maxDepth');
  if (maxDepth > MAX_PROGRAM_DEPTH) {
    throw new TypeError(`Program-synthesis maxDepth must not exceed ${MAX_PROGRAM_DEPTH}`);
  }

  const variableSet = setFromArray(variables);
  const examples = arrayMap(
    requireDenseArray(input.examples, 'Program-synthesis examples'),
    (example, index) => {
      requirePlainObject(example, `Program-synthesis example ${index}`);
      requirePlainObject(example.inputs, `Program-synthesis example ${index} inputs`);
      const inputNames = objectKeys(example.inputs);
      if (
        inputNames.length !== variables.length
        || arraySome(inputNames, (name) => !setHas(variableSet, name))
        || arraySome(variables, (name) => !objectHasOwn(example.inputs, name))
      ) {
        throw new TypeError(`Program-synthesis example ${index} inputs must match variables`);
      }
      const inputs = objectFromEntries(arrayMap(variables, (name) => {
        if (!isFiniteNumber(example.inputs[name])) {
          throw new TypeError(`Program-synthesis input ${name} must be finite`);
        }
        return [name, example.inputs[name]];
      }));
      if (!isFiniteNumber(example.output)) {
        throw new TypeError(`Program-synthesis example ${index} output must be finite`);
      }
      return objectFreeze({ inputs: objectFreeze(inputs), output: example.output });
    }
  );

  return objectFreeze({
    variables: objectFreeze(variables),
    constants: objectFreeze(constants),
    operators: objectFreeze(operators),
    examples: objectFreeze(examples),
    maxDepth
  });
}

function normalizeProgramSynthesisExecutionOptions(options) {
  if (options === undefined) {
    return objectFreeze({ maxCandidates: MAX_PROGRAM_CANDIDATES });
  }
  if (!options || typeof options !== 'object' || arrayIsArray(options)) {
    throw new TypeError('Program-synthesis execution options must be an object');
  }
  const maxCandidates = options.maxCandidates === undefined
    ? MAX_PROGRAM_CANDIDATES
    : requireInteger(options.maxCandidates, 'Program-synthesis maxCandidates', { positive: true });
  if (maxCandidates > MAX_PROGRAM_CANDIDATES) {
    throw new TypeError(`Program-synthesis maxCandidates must not exceed ${MAX_PROGRAM_CANDIDATES}`);
  }
  return objectFreeze({ maxCandidates });
}

function programExpressionKey(expression) {
  return jsonStringify(expression);
}

function expressionOrder(left, right) {
  return stringLocaleCompare(programExpressionKey(left), programExpressionKey(right));
}

function buildProgramExpressions(problem) {
  const byDepth = [];
  const seen = setFromArray([]);
  const base = [];
  arrayForEach(problem.variables, (name) => {
    const expression = { op: 'var', name };
    const key = programExpressionKey(expression);
    if (!setHas(seen, key)) {
      setAdd(seen, key);
      arrayPush(base, expression);
    }
  });
  arrayForEach(problem.constants, (value) => {
    const expression = { op: 'const', value };
    const key = programExpressionKey(expression);
    if (!setHas(seen, key)) {
      setAdd(seen, key);
      arrayPush(base, expression);
    }
  });
  arraySort(base, expressionOrder);
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
              const key = programExpressionKey(expression);
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
    arraySort(expressions, expressionOrder);
    byDepth[depth] = expressions;
  }
  return byDepth;
}

function evaluateProgramExpression(expression, inputs) {
  if (expression.op === 'var') {
    return inputs[expression.name];
  }
  if (expression.op === 'const') {
    return expression.value;
  }

  const left = evaluateProgramExpression(expression.left, inputs);
  const right = evaluateProgramExpression(expression.right, inputs);
  const value = expression.op === 'add'
    ? left + right
    : expression.op === 'subtract'
      ? left - right
      : left * right;
  return isFiniteNumber(value) ? value : null;
}

function synthesizeFiniteProgram(problem, { maxCandidates = MAX_PROGRAM_CANDIDATES } = {}) {
  const byDepth = buildProgramExpressions(problem);
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
        (example) => evaluateProgramExpression(expression, example.inputs) === example.output
      );
      if (matches && (
        best === null
        || depth < best.depth
        || (depth === best.depth && expressionOrder(expression, best.expression) < 0)
      )) {
        best = {
          expression,
          expressionKey: programExpressionKey(expression),
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
    examplesChecked: problem.examples.length,
    candidatesEvaluated,
    synthesisComplete: complete,
    candidateBudget: maxCandidates
  };
}

function searchFiniteTree(problem, { maxExpansions = positiveInfinity() } = {}) {
  const nodes = mapFromEntries(arrayMap(problem.nodes, (node) => [node.id, node]));
  const adjacency = mapFromEntries(arrayMap(problem.nodes, (node) => [node.id, []]));
  arrayForEach(problem.edges, (edge) => {
    arrayPush(mapGet(adjacency, edge.from), edge.to);
  });

  const queue = [{ id: problem.root, path: [problem.root] }];
  const visited = [];
  let expansions = 0;
  let terminalNodesEvaluated = 0;
  let best = null;

  for (let index = 0; index < queue.length; index += 1) {
    if (expansions >= maxExpansions) {
      break;
    }
    const current = queue[index];
    const node = mapGet(nodes, current.id);
    expansions += 1;
    arrayPush(visited, current.id);

    if (node.terminal) {
      terminalNodesEvaluated += 1;
      const improves = best === null
        || (problem.objective === 'minimize' ? node.value < best.value : node.value > best.value)
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

  const searchComplete = queue.length === visited.length;
  return {
    objective: problem.objective,
    selectedId: best?.id ?? null,
    selectedValue: best?.value ?? null,
    path: best?.path ?? null,
    nodesVisited: visited,
    terminalNodesEvaluated,
    expansions,
    searchComplete,
    expansionBudget: isFiniteNumber(maxExpansions) ? maxExpansions : null,
    tieBreak: 'lexicographic-id'
  };
}

export function normalizeInputForStrategy(strategy, input) {
  switch (strategy.representation) {
    case REPRESENTATIONS.GRAPH:
      return normalizeGraphInput(input);
    case REPRESENTATIONS.CONSTRAINT_SYSTEM:
      return normalizeConstraintInput(input);
    case REPRESENTATIONS.ARRAY_COMPUTATION:
      return normalizeArrayInput(input);
    case REPRESENTATIONS.DATABASE_QUERY:
      return normalizeDatabaseQueryInput(input);
    case REPRESENTATIONS.THEOREM:
      return normalizeTheoremInput(input);
    case REPRESENTATIONS.PROBABILISTIC_INFERENCE:
      return normalizeBayesianInput(input);
    case REPRESENTATIONS.SIMULATION:
      return normalizeSimulationInput(input);
    case REPRESENTATIONS.OPTIMIZATION:
      return normalizeOptimizationInput(input);
    case REPRESENTATIONS.SEARCH_TREE:
      return normalizeSearchTreeInput(input);
    case REPRESENTATIONS.PROGRAM_SYNTHESIS:
      return normalizeProgramSynthesisInput(input);
    default:
      return input;
  }
}

function computeArray(problem) {
  if (problem.operation === 'add') {
    const values = arrayMap(problem.left, (value, index) => value + problem.right[index]);
    if (arraySome(values, (value) => !isFiniteNumber(value))) {
      throw new RangeError('Array computation result must contain only finite numbers');
    }
    return {
      operation: problem.operation,
      length: problem.left.length,
      values
    };
  }

  const value = arrayReduce(problem.left, (total, current, index) => (
    total + current * problem.right[index]
  ), 0);
  if (!isFiniteNumber(value)) {
    throw new RangeError('Array computation result must contain only finite numbers');
  }
  return {
    operation: problem.operation,
    length: problem.left.length,
    value
  };
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

function executeDatabaseQuery(problem) {
  const matching = arrayFilter(problem.rows, (row) => (
    problem.filter === null || row[problem.filter.field] === problem.filter.equals
  ));
  const ordered = arrayMap(matching, (row, index) => ({ row, index }));
  if (problem.sort !== null) {
    arraySort(ordered, (left, right) => {
      const valueOrder = compareDatabaseValues(
        left.row[problem.sort.field],
        right.row[problem.sort.field]
      );
      const directedOrder = problem.sort.direction === 'asc' ? valueOrder : -valueOrder;
      return directedOrder || left.index - right.index;
    });
  }

  const returned = arrayMap(
    arraySlice(ordered, 0, problem.limit),
    ({ row }) => objectFromEntries(arrayMap(
      problem.select,
      (field) => [field, row[field]]
    ))
  );
  return {
    rows: returned,
    matchedRows: matching.length,
    returnedRows: returned.length,
    selectedFields: arraySlice(problem.select),
    filter: problem.filter,
    sort: problem.sort,
    limit: problem.limit
  };
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
      throw new TypeError(`Unsupported normalized theorem operation: ${formula.op}`);
  }
}

function theoremAssignment(problem, mask) {
  return mapFromEntries(arrayMap(
    problem.variables,
    (name, index) => [name, (mask & (2 ** index)) !== 0]
  ));
}

function proveTheorem(problem) {
  const assignmentsChecked = 2 ** problem.variables.length;
  let assumptionsSatisfied = 0;
  let counterexample = null;
  for (let mask = 0; mask < assignmentsChecked; mask += 1) {
    const assignment = theoremAssignment(problem, mask);
    const assumptionsHold = arrayEvery(
      problem.assumptions,
      (assumption) => evaluateTheoremFormula(assumption, assignment)
    );
    if (!assumptionsHold) {
      continue;
    }
    assumptionsSatisfied += 1;
    if (!evaluateTheoremFormula(problem.conclusion, assignment) && counterexample === null) {
      counterexample = objectFromEntries(arrayMap(
        problem.variables,
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
}

function computeBayesianPosterior(problem) {
  const observationProbability = arrayReduce(
    problem.hypotheses,
    (total, hypothesis) => total + hypothesis.prior * hypothesis.likelihoods[problem.observation],
    0
  );
  const posterior = arrayMap(problem.hypotheses, (hypothesis) => ({
    hypothesis: hypothesis.id,
    probability: hypothesis.prior * hypothesis.likelihoods[problem.observation]
      / observationProbability
  }));
  let mostLikelyIndex = 0;
  arrayForEach(arraySlice(posterior, 1), (candidate, index) => {
    if (candidate.probability > posterior[mostLikelyIndex].probability) {
      mostLikelyIndex = index + 1;
    }
  });
  return {
    observation: problem.observation,
    observationProbability,
    posterior,
    posteriorSum: arrayReduce(posterior, (total, entry) => total + entry.probability, 0),
    mostLikely: posterior[mostLikelyIndex].hypothesis,
    hypothesisCount: problem.hypotheses.length
  };
}

function simulateStateMachine(problem) {
  const transitions = mapFromEntries(arrayMap(
    problem.transitions,
    (transition) => [jsonStringify([transition.from, transition.event]), transition]
  ));
  const trace = [problem.initialState];
  const transitionsApplied = [];
  let currentState = problem.initialState;
  let blockedAtStep = null;

  arrayForEach(problem.events, (event, index) => {
    if (blockedAtStep !== null) {
      return;
    }
    const transition = mapGet(transitions, jsonStringify([currentState, event]));
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
    initialState: problem.initialState,
    events: arraySlice(problem.events),
    trace,
    transitionsApplied,
    finalState: currentState,
    completed: blockedAtStep === null,
    blockedAtStep
  };
}

function optimizeFiniteCandidates(problem) {
  let bestIndex = 0;
  arrayForEach(arraySlice(problem.candidates, 1), (candidate, index) => {
    const currentIndex = index + 1;
    const best = problem.candidates[bestIndex];
    const valueImproves = problem.objective === 'minimize'
      ? candidate.value < best.value
      : candidate.value > best.value;
    const valueTies = candidate.value === best.value;
    const idWinsTie = valueTies && stringLocaleCompare(candidate.id, best.id) < 0;
    if (valueImproves || idWinsTie) {
      bestIndex = currentIndex;
    }
  });
  const selected = problem.candidates[bestIndex];
  return {
    objective: problem.objective,
    selectedId: selected.id,
    selectedValue: selected.value,
    candidatesEvaluated: problem.candidates.length,
    tieBreak: 'lexicographic-id'
  };
}

function scheduleJobs(problem) {
  const unscheduled = setFromArray(arrayMap(problem.jobs, (job) => job.id));
  const scheduled = [];
  let running = [];
  let time = 0;

  while (setSize(unscheduled) > 0 || running.length > 0) {
    const completed = setFromArray(arrayMap(
      arrayFilter(scheduled, ({ end }) => end <= time),
      ({ id }) => id
    ));
    running = arrayFilter(running, ({ end }) => end > time);
    const available = { ...problem.resources };
    arrayForEach(running, ({ job }) => {
      arrayForEach(objectEntries(job.demand), (entry) => {
        const resource = entry[0];
        const amount = entry[1];
        available[resource] -= amount;
      });
    });

    const ready = arraySort(
      arrayFilter(
        arrayFilter(problem.jobs, (job) => setHas(unscheduled, job.id)),
        (job) => arrayEvery(job.prerequisites, (prerequisite) => setHas(completed, prerequisite))
      ),
      (left, right) => stringLocaleCompare(left.id, right.id)
    );

    arrayForEach(ready, (job) => {
      const fits = arrayEvery(
        objectEntries(job.demand),
        (entry) => available[entry[0]] >= entry[1]
      );
      if (!fits) {
        return;
      }

      const end = time + job.duration;
      if (!isSafeInteger(end)) {
        throw new RangeError('Constraint schedule time exceeds the safe integer range');
      }
      arrayPush(scheduled, {
        id: job.id,
        start: time,
        end,
        duration: job.duration,
        prerequisites: job.prerequisites,
        demand: job.demand,
        job
      });
      setDelete(unscheduled, job.id);
      arrayPush(running, { job, end });
      arrayForEach(objectEntries(job.demand), (entry) => {
        const resource = entry[0];
        const amount = entry[1];
        available[resource] -= amount;
      });
    });

    if (running.length === 0) {
      if (setSize(unscheduled) > 0) {
        throw new Error('Constraint scheduler could not make progress');
      }
      break;
    }

    time = minNumbers(arrayMap(running, ({ end }) => end));
  }

  const schedule = arrayMap(
    arraySort(
      scheduled,
      (left, right) => left.start - right.start || stringLocaleCompare(left.id, right.id)
    ),
    ({ id, start, end, duration, prerequisites, demand }) => ({
      id,
      start,
      end,
      duration,
      prerequisites: arraySlice(prerequisites),
      demand: { ...demand }
    })
  );

  return {
    schedule,
    makespan: arrayReduce(schedule, (latest, job) => maxNumber(latest, job.end), 0)
  };
}

function deepFreeze(value, seen = weakSetCreate()) {
  if (!value || typeof value !== 'object' || weakSetHas(seen, value)) {
    return value;
  }
  weakSetAdd(seen, value);
  arrayForEach(objectValues(value), (nestedValue) => {
    deepFreeze(nestedValue, seen);
  });
  return objectFreeze(value);
}

export function createExecutionResult(data, producer) {
  const execution = objectFreeze({
    ...data,
    input: deepFreeze({ ...data.input }),
    result: deepFreeze({ ...data.result })
  });
  weakSetAdd(TRUSTED_EXECUTIONS, execution);
  weakMapSet(TRUSTED_EXECUTION_PRODUCERS, execution, producer);
  return execution;
}

export function isTrustedExecution(execution, registry = null) {
  return typeof execution === 'object'
    && execution !== null
    && isFrozenObject(execution)
    && weakSetHas(TRUSTED_EXECUTIONS, execution)
    && (registry === null || weakMapGet(TRUSTED_EXECUTION_REGISTRIES, execution) === registry);
}

export class GraphPathExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.GRAPH;
  }

  execute({ task, strategy, input, executionOptions }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`GraphPathExecutor cannot execute ${strategy.representation} tasks`);
    }

    const graph = normalizeGraphInput(copyAndFreeze(input));
    const { maxExpansions } = normalizeGraphExecutionOptions(copyAndFreeze(executionOptions));
    const search = shortestPath(graph, { maxExpansions });
    const found = search.path !== null;
    const resourceLimited = !search.complete;

    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: resourceLimited ? 'resource-limit' : found ? 'success' : 'failure',
      observation: resourceLimited
        ? 'graph search budget exhausted'
        : found
          ? 'graph path resolved'
          : 'graph path not found',
      deterministic: true,
      input: graph,
      result: {
        found,
        path: search.path,
        distance: search.path ? search.path.length - 1 : null,
        searchComplete: search.complete,
        expansions: search.expansions,
        expansionBudget: isFiniteNumber(maxExpansions) ? maxExpansions : null
      }
    }, this);
  }
}

objectFreeze(GraphPathExecutor.prototype);

export class ConstraintScheduleExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.CONSTRAINT_SYSTEM;
  }

  execute({ task, strategy, input, executionOptions }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`ConstraintScheduleExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeConstraintInput(copyAndFreeze(input));
    const result = scheduleJobs(problem);
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'constraint solution resolved',
      deterministic: true,
      input: problem,
      result
    }, this);
  }
}

objectFreeze(ConstraintScheduleExecutor.prototype);

export class ArrayComputationExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.ARRAY_COMPUTATION;
  }

  execute({ task, strategy, input }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`ArrayComputationExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeArrayInput(copyAndFreeze(input));
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'array computation completed',
      deterministic: true,
      input: problem,
      result: computeArray(problem)
    }, this);
  }
}

objectFreeze(ArrayComputationExecutor.prototype);

export class DatabaseQueryExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.DATABASE_QUERY;
  }

  execute({ task, strategy, input }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`DatabaseQueryExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeDatabaseQueryInput(copyAndFreeze(input));
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'database query completed',
      deterministic: true,
      input: problem,
      result: executeDatabaseQuery(problem)
    }, this);
  }
}

objectFreeze(DatabaseQueryExecutor.prototype);

export class TheoremExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.THEOREM;
  }

  execute({ task, strategy, input }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`TheoremExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeTheoremInput(copyAndFreeze(input));
    const result = proveTheorem(problem);
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: result.proved ? 'theorem proved' : 'theorem refuted',
      deterministic: true,
      input: problem,
      result
    }, this);
  }
}

objectFreeze(TheoremExecutor.prototype);

export class BayesianInferenceExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.PROBABILISTIC_INFERENCE;
  }

  execute({ task, strategy, input }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`BayesianInferenceExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeBayesianInput(copyAndFreeze(input));
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'bayesian posterior computed',
      deterministic: true,
      input: problem,
      result: computeBayesianPosterior(problem)
    }, this);
  }
}

objectFreeze(BayesianInferenceExecutor.prototype);

export class SimulationExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.SIMULATION;
  }

  execute({ task, strategy, input }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`SimulationExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeSimulationInput(copyAndFreeze(input));
    const result = simulateStateMachine(problem);
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'simulation completed',
      deterministic: true,
      input: problem,
      result
    }, this);
  }
}

objectFreeze(SimulationExecutor.prototype);

export class OptimizationExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.OPTIMIZATION;
  }

  execute({ task, strategy, input }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`OptimizationExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeOptimizationInput(copyAndFreeze(input));
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'optimization completed',
      deterministic: true,
      input: problem,
      result: optimizeFiniteCandidates(problem)
    }, this);
  }
}

objectFreeze(OptimizationExecutor.prototype);

export class SearchTreeExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.SEARCH_TREE;
  }

  execute({ task, strategy, input, executionOptions }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`SearchTreeExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeSearchTreeInput(copyAndFreeze(input));
    const { maxExpansions } = normalizeSearchTreeExecutionOptions(copyAndFreeze(executionOptions));
    const result = searchFiniteTree(problem, { maxExpansions });
    const complete = result.searchComplete;
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: complete ? result.selectedId === null ? 'failure' : 'success' : 'resource-limit',
      observation: complete ? 'search completed' : 'search budget exhausted',
      deterministic: true,
      input: problem,
      result
    }, this);
  }
}

objectFreeze(SearchTreeExecutor.prototype);

export class ProgramSynthesisExecutor {
  canExecute(strategy) {
    return strategy.representation === REPRESENTATIONS.PROGRAM_SYNTHESIS;
  }

  execute({ task, strategy, input, executionOptions }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`ProgramSynthesisExecutor cannot execute ${strategy.representation} tasks`);
    }

    const problem = normalizeProgramSynthesisInput(copyAndFreeze(input));
    const { maxCandidates } = normalizeProgramSynthesisExecutionOptions(copyAndFreeze(executionOptions));
    const result = synthesizeFiniteProgram(problem, { maxCandidates });
    const complete = result.synthesisComplete;
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: complete ? result.expression === null ? 'failure' : 'success' : 'resource-limit',
      observation: complete ? 'program synthesized' : 'program synthesis budget exhausted',
      deterministic: true,
      input: problem,
      result
    }, this);
  }
}

objectFreeze(ProgramSynthesisExecutor.prototype);

export class ExecutorRegistry {
  constructor({
    executors = null,
    modelProviderExecutor = null
  } = {}) {
    const configuredExecutors = executors ?? [
      new GraphPathExecutor(),
      new ConstraintScheduleExecutor(),
      new ArrayComputationExecutor(),
      new DatabaseQueryExecutor(),
      new TheoremExecutor(),
      new BayesianInferenceExecutor(),
      new SimulationExecutor(),
      new OptimizationExecutor(),
      new SearchTreeExecutor(),
      new ProgramSynthesisExecutor()
    ];
    if (!arrayIsArray(configuredExecutors) || configuredExecutors.length === 0) {
      throw new TypeError('ExecutorRegistry requires at least one executor');
    }
    if (
      modelProviderExecutor !== null
      && (!modelProviderExecutor
        || typeof modelProviderExecutor.canExecute !== 'function'
        || typeof modelProviderExecutor.execute !== 'function')
    ) {
      throw new TypeError('ExecutorRegistry modelProviderExecutor must implement canExecute and execute');
    }

    const resolvedExecutors = arraySlice(configuredExecutors);
    if (modelProviderExecutor !== null) {
      arrayPush(resolvedExecutors, modelProviderExecutor);
    }
    this.executors = objectFreeze(resolvedExecutors);
    objectFreeze(this);
  }

  resolve(strategy) {
    const executor = arrayFind(this.executors, (candidate) => candidate.canExecute(strategy));
    if (!executor) {
      throw new Error(`No executor is registered for ${strategy.representation}`);
    }

    return executor;
  }

  execute({ task, strategy, input, executionOptions = {} }) {
    const isolatedTask = isFrozenObject(task) ? task : objectFreeze({ ...task });
    const isolatedStrategy = isFrozenObject(strategy)
      ? strategy
      : objectFreeze({ ...strategy });
    if (!isFrozenObject(isolatedTask) || !isFrozenObject(isolatedStrategy)) {
      throw new TypeError('Executor registry requires frozen task and strategy snapshots');
    }
    const isolatedInput = copyAndFreeze(input);
    const isolatedExecutionOptions = copyAndFreeze(executionOptions);
    const executor = this.resolve(isolatedStrategy);
    const execution = executor.execute({
      task: isolatedTask,
      strategy: isolatedStrategy,
      input: isolatedInput,
      executionOptions: isolatedExecutionOptions
    });
    if (!isTrustedExecution(execution) || weakMapGet(TRUSTED_EXECUTION_PRODUCERS, execution) !== executor) {
      throw new TypeError('Executor returned an untrusted or foreign execution');
    }
    if (
      execution.taskId !== isolatedTask.id
      || execution.representation !== isolatedStrategy.representation
      || execution.reasoningEngine !== isolatedStrategy.reasoningEngine
    ) {
      throw new TypeError('Executor returned an execution that does not match the requested task or strategy');
    }
    const normalizedInput = normalizeInputForStrategy(isolatedStrategy, isolatedInput);
    if (!sameInput(execution.input, normalizedInput)) {
      throw new TypeError('Executor returned an execution that does not match the requested input');
    }

    const owner = weakMapGet(TRUSTED_EXECUTION_REGISTRIES, execution);
    if (owner !== undefined) {
      throw new TypeError(owner === this
        ? 'Executor returned an execution already registered by this registry'
        : 'Executor returned an execution owned by another registry');
    }
    weakMapSet(TRUSTED_EXECUTION_REGISTRIES, execution, this);
    return execution;
  }
}

objectFreeze(ExecutorRegistry.prototype);
