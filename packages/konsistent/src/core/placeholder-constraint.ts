import { validateMatchesConstraint } from "./constraints/matches.js";
import { validateSegmentsConstraint } from "./constraints/segments.js";

export interface PlaceholderConstraint {
  arg?: string;
  name: string;
}

const CONSTRAINT_REGEX = /^(?<name>[a-zA-Z][a-zA-Z0-9]*)(?:\((?<arg>.*)\))?$/u;

export function parsePlaceholderConstraint(
  raw: string
): PlaceholderConstraint | null {
  const match = CONSTRAINT_REGEX.exec(raw);
  if (!match) {
    return null;
  }
  return {
    arg: match.groups?.arg,
    name: match.groups?.name ?? "",
  };
}

export function validatePlaceholderConstraint(opts: {
  value: string;
  constraint: PlaceholderConstraint;
}): boolean {
  const { value, constraint } = opts;
  switch (constraint.name) {
    case "segments":
      return validateSegmentsConstraint({ arg: constraint.arg, value });
    case "matches":
      return validateMatchesConstraint({ arg: constraint.arg, value });
    default:
      return true;
  }
}
