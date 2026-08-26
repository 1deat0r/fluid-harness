import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  arrayMap,
  arrayForEach,
  arraySort,
  arraySlice,
  arraySome,
  arrayIsArray,
  isFiniteNumber,
  isFrozenObject,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectHasOwn,
  objectValues,
  reflectOwnKeys,
  setFromArray,
  setHas,
  setSize,
  stringLocaleCompare,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';
import { POLICY_MODES } from './evaluation.mjs';
import { QUESTION_REASONS } from './curiosity.mjs';
import { SURPRISE_BANDS } from './world-model.mjs';

export const RESEARCH_PRIORITY = objectFreeze({
  [QUESTION_REASONS.HIGH_SURPRISE]: 3,
  [QUESTION_REASONS.INSUFFICIENT_EVIDENCE]: 2,
  [QUESTION_REASONS.EXPLICIT_RESEARCH]: 1
});

const MAX_RESEARCH_SCHEDULE_ITEMS = 32;
const TRUSTED_RESEARCH_SCHEDULES = weakSetCreate();
const VALID_EVIDENCE = setFromArray(objectValues(EVIDENCE_LEVELS));
const VALID_MODES = setFromArray(objectValues(POLICY_MODES));
const VALID_REASONS = setFromArray(objectValues(QUESTION_REASONS));
const VALID_SURPRISE_BANDS = setFromArray(objectValues(SURPRISE_BANDS));

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireDataObject(value, field) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${field} must be a plain object`);
  }
  arrayForEach(reflectOwnKeys(value), (key) => {
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function normalizePendingResearch(entry, index) {
  requireDataObject(entry, `Research queue entry ${index}`);
  if (!isSafeInteger(entry.actionNumber) || entry.actionNumber <= 0) {
    throw new TypeError(`Research queue entry ${index} actionNumber must be positive`);
  }
  const taskId = requireNonEmptyString(entry.taskId, `Research queue entry ${index} taskId`);
  if (!setHas(VALID_MODES, entry.policyMode)) {
    throw new TypeError(`Research queue entry ${index} policyMode is invalid`);
  }
  if (!setHas(VALID_REASONS, entry.reason) || entry.reason === QUESTION_REASONS.NONE) {
    throw new TypeError(`Research queue entry ${index} reason is not schedulable`);
  }
  if (!setHas(VALID_EVIDENCE, entry.evidence)) {
    throw new TypeError(`Research queue entry ${index} evidence is invalid`);
  }
  if (!setHas(VALID_SURPRISE_BANDS, entry.surpriseBand)) {
    throw new TypeError(`Research queue entry ${index} surpriseBand is invalid`);
  }
  if (typeof entry.researchRequested !== 'boolean' || entry.researchRequired !== true) {
    throw new TypeError(`Research queue entry ${index} must require research`);
  }
  requireDataObject(entry.action, `Research queue entry ${index} action`);
  const strategyKey = requireNonEmptyString(
    entry.action.strategyKey,
    `Research queue entry ${index} strategyKey`
  );
  if (typeof entry.action.predictionError !== 'boolean') {
    throw new TypeError(`Research queue entry ${index} predictionError must be boolean`);
  }
  if (!isFiniteNumber(entry.action.surpriseNats) || entry.action.surpriseNats < 0) {
    throw new TypeError(`Research queue entry ${index} surpriseNats must be non-negative`);
  }
  if (!setHas(VALID_EVIDENCE, entry.action.evidence)) {
    throw new TypeError(`Research queue entry ${index} action evidence is invalid`);
  }
  if (typeof entry.action.environmentHash !== 'string' || stringTrim(entry.action.environmentHash) === '') {
    throw new TypeError(`Research queue entry ${index} environmentHash must be non-empty`);
  }

  return objectFreeze({
    actionNumber: entry.actionNumber,
    taskId,
    policyMode: entry.policyMode,
    reason: entry.reason,
    evidence: entry.evidence,
    surpriseBand: entry.surpriseBand,
    researchRequested: true,
    researchRequired: true,
    action: objectFreeze({
      strategyKey,
      predictionError: entry.action.predictionError,
      surpriseNats: entry.action.surpriseNats,
      evidence: entry.action.evidence,
      environmentHash: stringTrim(entry.action.environmentHash)
    })
  });
}

function scheduleOrder(left, right) {
  return right.priority - left.priority
    || right.surpriseNats - left.surpriseNats
    || left.actionNumber - right.actionNumber
    || stringLocaleCompare(left.taskId, right.taskId);
}

export class ResearchSchedule {
  constructor({ entries, requestedItems, sourceCount }) {
    if (!arrayIsArray(entries) || !isSafeInteger(requestedItems) || requestedItems <= 0) {
      throw new TypeError('ResearchSchedule requires entries and a positive request size');
    }
    if (!isSafeInteger(sourceCount) || sourceCount < entries.length) {
      throw new TypeError('ResearchSchedule source count is invalid');
    }
    this.entries = objectFreeze(arraySlice(entries));
    this.requestedItems = requestedItems;
    this.sourceCount = sourceCount;
    this.scheduledCount = entries.length;
    this.complete = entries.length === sourceCount;
    this.dataOnly = true;
    objectFreeze(this);
  }
}

export function isTrustedResearchSchedule(schedule) {
  return typeof schedule === 'object'
    && schedule !== null
    && isFrozenObject(schedule)
    && weakSetHas(TRUSTED_RESEARCH_SCHEDULES, schedule)
    && objectGetPrototypeOf(schedule) === ResearchSchedule.prototype;
}

export class BoundedResearchScheduler {
  schedule({ pendingResearch, maxItems = MAX_RESEARCH_SCHEDULE_ITEMS } = {}) {
    if (!arrayIsArray(pendingResearch)) {
      throw new TypeError('BoundedResearchScheduler requires a research queue array');
    }
    if (!isSafeInteger(maxItems) || maxItems <= 0 || maxItems > MAX_RESEARCH_SCHEDULE_ITEMS) {
      throw new RangeError(
        `BoundedResearchScheduler maxItems must be a positive integer no greater than ${MAX_RESEARCH_SCHEDULE_ITEMS}`
      );
    }

    for (let index = 0; index < pendingResearch.length; index += 1) {
      if (!objectHasOwn(pendingResearch, index)) {
        throw new TypeError('BoundedResearchScheduler requires a dense research queue array');
      }
    }
    const normalized = arrayMap(pendingResearch, normalizePendingResearch);
    const actionNumbers = setFromArray(arrayMap(normalized, ({ actionNumber }) => actionNumber));
    if (setSize(actionNumbers) !== normalized.length) {
      throw new TypeError('BoundedResearchScheduler requires unique action numbers');
    }
    const ranked = arraySort(
      arrayMap(normalized, (entry) => ({
        actionNumber: entry.actionNumber,
        taskId: entry.taskId,
        policyMode: entry.policyMode,
        reason: entry.reason,
        evidence: entry.evidence,
        surpriseBand: entry.surpriseBand,
        strategyKey: entry.action.strategyKey,
        surpriseNats: entry.action.surpriseNats,
        priority: RESEARCH_PRIORITY[entry.reason]
      })),
      scheduleOrder
    );
    const selected = arraySlice(ranked, 0, maxItems);
    const entries = arrayMap(selected, (entry, index) => objectFreeze({
      ...entry,
      rank: index + 1
    }));
    const schedule = new ResearchSchedule({
      entries,
      requestedItems: maxItems,
      sourceCount: normalized.length
    });
    weakSetAdd(TRUSTED_RESEARCH_SCHEDULES, schedule);
    return schedule;
  }
}

objectFreeze(ResearchSchedule.prototype);
objectFreeze(BoundedResearchScheduler.prototype);

export const MAX_RESEARCH_SCHEDULE_SIZE = MAX_RESEARCH_SCHEDULE_ITEMS;
