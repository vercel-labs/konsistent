import { validateMatchesConstraint } from './constraints/matches.js';
import { validateSegmentsConstraint } from './constraints/segments.js';

export interface PlaceholderConstraint {
  name: string;
  arg?: string;
}

const CONSTRAINT_REGEX = /^([a-zA-Z][a-zA-Z0-9]*)(?:\((.*)\))?$/;

export function parsePlaceholderConstraint(
  raw: string
): PlaceholderConstraint | null {
  const match = CONSTRAINT_REGEX.exec(raw);
  if (!match) {
    return null;
  }
  return {
    name: match[1],
    arg: match[2],
  };
}

export function validatePlaceholderConstraint(opts: {
  value: string;
  constraint: PlaceholderConstraint;
}): boolean {
  const { value, constraint } = opts;
  switch (constraint.name) {
    case 'segments':
      return validateSegmentsConstraint({ value, arg: constraint.arg });
    case 'matches':
      return validateMatchesConstraint({ value, arg: constraint.arg });
    default:
      return true;
  }
}
