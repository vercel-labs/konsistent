import { splitWords } from '../case-utils.js';

export function validateSegmentsConstraint(opts: {
  value: string;
  arg?: string;
}): boolean {
  const { value, arg } = opts;
  if (arg === undefined) {
    return false;
  }
  const expected = Number(arg);
  if (!Number.isInteger(expected) || expected < 1) {
    return false;
  }
  return splitWords(value).length === expected;
}
