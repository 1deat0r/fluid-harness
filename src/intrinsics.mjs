const APPLY = Reflect.apply;
const PROCESS_HRTIME = process.hrtime;
const PROCESS_HRTIME_BIGINT = PROCESS_HRTIME.bigint;
const PROCESS_VERSION = process.version;
const PROCESS_PLATFORM = process.platform;
const PROCESS_ARCHITECTURE = process.arch;
const JSON_PARSE = JSON.parse;
const JSON_STRINGIFY = JSON.stringify;
const MATH_ABS = Math.abs;
const MATH_LOG = Math.log;
const MATH_MAX = Math.max;
const MATH_MIN = Math.min;
const NUMBER_CONSTRUCTOR = Number;
const NUMBER_POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const NUMBER_IS_FINITE = Number.isFinite;
const NUMBER_IS_INTEGER = Number.isInteger;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const BOOLEAN_CONSTRUCTOR = Boolean;
const STRING_CONSTRUCTOR = String;
const STRING_TRIM = String.prototype.trim;
const STRING_TO_LOWER_CASE = String.prototype.toLowerCase;
const STRING_LOCALE_COMPARE = String.prototype.localeCompare;
const STRING_REPLACE = String.prototype.replace;
const REGEXP_CONSTRUCTOR = RegExp;
const REGEXP_TEST = RegExp.prototype.test;
const ARRAY_AT = Array.prototype.at;
const ARRAY_EVERY = Array.prototype.every;
const ARRAY_FOR_EACH = Array.prototype.forEach;
const ARRAY_FIND = Array.prototype.find;
const ARRAY_FILTER = Array.prototype.filter;
const ARRAY_INCLUDES = Array.prototype.includes;
const ARRAY_JOIN = Array.prototype.join;
const ARRAY_MAP = Array.prototype.map;
const ARRAY_PUSH = Array.prototype.push;
const ARRAY_REDUCE = Array.prototype.reduce;
const ARRAY_REVERSE = Array.prototype.reverse;
const ARRAY_SLICE = Array.prototype.slice;
const ARRAY_SORT = Array.prototype.sort;
const ARRAY_SOME = Array.prototype.some;
const ARRAY_CONSTRUCTOR = Array;
const ARRAY_IS_ARRAY = Array.isArray;
const WEAK_MAP_CONSTRUCTOR = WeakMap;
const WEAK_SET_CONSTRUCTOR = WeakSet;
const FUNCTION_TO_STRING = Function.prototype.toString;
const FUNCTION_HAS_INSTANCE = Function.prototype[Symbol.hasInstance];
const OBJECT_ENTRIES = Object.entries;
const OBJECT_DEFINE_PROPERTY = Object.defineProperty;
const OBJECT_DEFINE_PROPERTIES = Object.defineProperties;
const OBJECT_FREEZE = Object.freeze;
const OBJECT_PROTOTYPE = Object.prototype;
const OBJECT_FROM_ENTRIES = Object.fromEntries;
const OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_HAS_OWN = Object.hasOwn;
const OBJECT_IS = Object.is;
const OBJECT_IS_FROZEN = Object.isFrozen;
const OBJECT_KEYS = Object.keys;
const OBJECT_VALUES = Object.values;
const REFLECT_OWN_KEYS = Reflect.ownKeys;
const MAP_CONSTRUCTOR = Map;
const MAP_DELETE = Map.prototype.delete;
const MAP_GET = Map.prototype.get;
const MAP_HAS = Map.prototype.has;
const MAP_SET = Map.prototype.set;
const MAP_SIZE = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(Map.prototype, 'size').get;
const SET_CONSTRUCTOR = Set;
const SET_ADD = Set.prototype.add;
const SET_DELETE = Set.prototype.delete;
const SET_HAS = Set.prototype.has;
const SET_SIZE = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(Set.prototype, 'size').get;
const WEAK_MAP_GET = WeakMap.prototype.get;
const WEAK_MAP_HAS = WeakMap.prototype.has;
const WEAK_MAP_SET = WeakMap.prototype.set;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_DELETE = WeakSet.prototype.delete;
const WEAK_SET_HAS = WeakSet.prototype.has;

function isDeepFrozenValue(value, seen) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return true;
  }
  if (typeof value === 'function') {
    return true;
  }
  if (!OBJECT_IS_FROZEN(value)) {
    return false;
  }
  if (weakSetHas(seen, value)) {
    return true;
  }
  weakSetAdd(seen, value);
  return arrayEvery(REFLECT_OWN_KEYS(value), (key) => {
    const descriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || descriptor.get || descriptor.set) {
      return false;
    }
    if ('value' in descriptor && !isDeepFrozenValue(descriptor.value, seen)) {
      return false;
    }
    return true;
  });
}

export function objectEntries(value) {
  return OBJECT_ENTRIES(value);
}

export function functionToString(value) {
  return APPLY(FUNCTION_TO_STRING, value, []);
}

export function isInstanceOf(value, constructor) {
  return APPLY(FUNCTION_HAS_INSTANCE, constructor, [value]);
}

export function stringTrim(value) {
  return APPLY(STRING_TRIM, value, []);
}

export function stringToLowerCase(value) {
  return APPLY(STRING_TO_LOWER_CASE, value, []);
}

export function stringLocaleCompare(value, other, locales, options) {
  return APPLY(STRING_LOCALE_COMPARE, value, [other, locales, options]);
}

export function stringReplace(value, searchValue, replacement) {
  return APPLY(STRING_REPLACE, value, [searchValue, replacement]);
}

export function regexpCreate(pattern, flags) {
  return new REGEXP_CONSTRUCTOR(pattern, flags);
}

export function regexpTest(value, input) {
  return APPLY(REGEXP_TEST, value, [input]);
}

export function toNumber(value) {
  return NUMBER_CONSTRUCTOR(value);
}

export function positiveInfinity() {
  return NUMBER_POSITIVE_INFINITY;
}

export function stringFrom(value) {
  return STRING_CONSTRUCTOR(value);
}

export function highResolutionTime() {
  return APPLY(PROCESS_HRTIME_BIGINT, PROCESS_HRTIME, []);
}

export function runtimeEnvironment() {
  return {
    node: PROCESS_VERSION,
    platform: PROCESS_PLATFORM,
    architecture: PROCESS_ARCHITECTURE
  };
}

export function toBoolean(value) {
  return BOOLEAN_CONSTRUCTOR(value);
}

export function objectKeys(value) {
  return OBJECT_KEYS(value);
}

export function objectValues(value) {
  return OBJECT_VALUES(value);
}

export function mapDelete(value, key) {
  return APPLY(MAP_DELETE, value, [key]);
}

export function mapGet(value, key) {
  return APPLY(MAP_GET, value, [key]);
}

export function mapHas(value, key) {
  return APPLY(MAP_HAS, value, [key]);
}

export function mapSet(value, key, entry) {
  return APPLY(MAP_SET, value, [key, entry]);
}

export function mapSize(value) {
  return APPLY(MAP_SIZE, value, []);
}

export function mapFromEntries(entries) {
  const value = new MAP_CONSTRUCTOR();
  arrayForEach(entries, (entry) => {
    mapSet(value, entry[0], entry[1]);
  });
  return value;
}

export function weakMapCreate() {
  return new WEAK_MAP_CONSTRUCTOR();
}

export function setAdd(value, entry) {
  return APPLY(SET_ADD, value, [entry]);
}

export function setDelete(value, entry) {
  return APPLY(SET_DELETE, value, [entry]);
}

export function setHas(value, entry) {
  return APPLY(SET_HAS, value, [entry]);
}

export function setSize(value) {
  return APPLY(SET_SIZE, value, []);
}

export function setFromArray(entries) {
  const value = new SET_CONSTRUCTOR();
  arrayForEach(entries, (entry) => {
    setAdd(value, entry);
  });
  return value;
}

export function weakMapGet(value, key) {
  return APPLY(WEAK_MAP_GET, value, [key]);
}

export function weakSetCreate() {
  return new WEAK_SET_CONSTRUCTOR();
}

export function weakMapHas(value, key) {
  return APPLY(WEAK_MAP_HAS, value, [key]);
}

export function weakMapSet(value, key, entry) {
  return APPLY(WEAK_MAP_SET, value, [key, entry]);
}

export function weakSetAdd(value, entry) {
  return APPLY(WEAK_SET_ADD, value, [entry]);
}

export function weakSetDelete(value, entry) {
  return APPLY(WEAK_SET_DELETE, value, [entry]);
}

export function weakSetHas(value, entry) {
  return APPLY(WEAK_SET_HAS, value, [entry]);
}

export function arrayIsArray(value) {
  return ARRAY_IS_ARRAY(value);
}

export function objectDefineProperty(value, key, descriptor) {
  return OBJECT_DEFINE_PROPERTY(value, key, descriptor);
}

export function objectDefineProperties(value, descriptors) {
  return OBJECT_DEFINE_PROPERTIES(value, descriptors);
}

export function objectFreeze(value) {
  return OBJECT_FREEZE(value);
}

export function objectGetOwnPropertyDescriptor(value, key) {
  return OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
}

export function objectGetPrototypeOf(value) {
  return OBJECT_GET_PROTOTYPE_OF(value);
}

export function isPlainObject(value) {
  const prototype = OBJECT_GET_PROTOTYPE_OF(value);
  return prototype === OBJECT_PROTOTYPE || prototype === null;
}

export function objectHasOwn(value, key) {
  return OBJECT_HAS_OWN(value, key);
}

export function objectIs(left, right) {
  return OBJECT_IS(left, right);
}

export function reflectOwnKeys(value) {
  return REFLECT_OWN_KEYS(value);
}

export function objectFromEntries(value) {
  return OBJECT_FROM_ENTRIES(value);
}

export function isFrozenObject(value) {
  return isDeepFrozenValue(value, weakSetCreate());
}

export function jsonParse(value) {
  return JSON_PARSE(value);
}

export function jsonStringify(value, replacer, space) {
  return JSON_STRINGIFY(value, replacer, space);
}

export function isFiniteNumber(value) {
  return NUMBER_IS_FINITE(value);
}

export function isInteger(value) {
  return NUMBER_IS_INTEGER(value);
}

export function isSafeInteger(value) {
  return NUMBER_IS_SAFE_INTEGER(value);
}

export function maxNumber(left, right) {
  return MATH_MAX(left, right);
}

export function absNumber(value) {
  return MATH_ABS(value);
}

export function logNumber(value) {
  return MATH_LOG(value);
}

export function minNumbers(values) {
  return APPLY(MATH_MIN, undefined, values);
}

export function arrayAt(value, index) {
  return APPLY(ARRAY_AT, value, [index]);
}

export function arrayCreate(length) {
  return new ARRAY_CONSTRUCTOR(length);
}

export function arrayEvery(value, callback, thisArg) {
  return APPLY(ARRAY_EVERY, value, [callback, thisArg]);
}

export function arrayForEach(value, callback, thisArg) {
  return APPLY(ARRAY_FOR_EACH, value, [callback, thisArg]);
}

export function arrayFind(value, callback, thisArg) {
  return APPLY(ARRAY_FIND, value, [callback, thisArg]);
}

export function arrayFilter(value, callback, thisArg) {
  return APPLY(ARRAY_FILTER, value, [callback, thisArg]);
}

export function arrayIncludes(value, searchElement, fromIndex) {
  return APPLY(ARRAY_INCLUDES, value, [searchElement, fromIndex]);
}

export function arrayJoin(value, separator) {
  return APPLY(ARRAY_JOIN, value, [separator]);
}

export function arrayMap(value, callback, thisArg) {
  return APPLY(ARRAY_MAP, value, [callback, thisArg]);
}

export function arrayPush(value, ...entries) {
  return APPLY(ARRAY_PUSH, value, entries);
}

export function arrayReduce(value, callback, initialValue) {
  return APPLY(ARRAY_REDUCE, value, [callback, initialValue]);
}

export function arrayReverse(value) {
  return APPLY(ARRAY_REVERSE, value, []);
}

export function arraySlice(value, start, end) {
  return APPLY(ARRAY_SLICE, value, [start, end]);
}

export function arraySort(value, compareFunction) {
  return APPLY(ARRAY_SORT, value, [compareFunction]);
}

export function arraySome(value, callback, thisArg) {
  return APPLY(ARRAY_SOME, value, [callback, thisArg]);
}
