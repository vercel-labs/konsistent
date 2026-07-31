export interface ImportSourcePattern {
  source: string;
  wildcard: boolean;
}

export interface ImportSourceSelectorRule extends ImportSourcePattern {
  selected: boolean;
}

export interface ExactImportSourceConstraint {
  kind: "exact";
  source: string;
}

export interface ImportSourceSelectorConstraint {
  kind: "selector";
  rules: ImportSourceSelectorRule[];
  source: string;
}

export type ImportSourceConstraint =
  | ExactImportSourceConstraint
  | ImportSourceSelectorConstraint;

export type CompileImportSourceConstraintsResult =
  | { success: true; constraints: ImportSourceConstraint[] }
  | { success: false; index?: number; error: string };

function parsePattern(opts: { configuredSource: string; index?: number }):
  | {
      success: true;
      negated: boolean;
      pattern: ImportSourcePattern;
    }
  | { success: false; index?: number; error: string } {
  const negated = opts.configuredSource.startsWith("!");
  const source = negated
    ? opts.configuredSource.slice(1)
    : opts.configuredSource;

  if (source.length === 0) {
    return {
      success: false,
      index: opts.index,
      error: "Import source patterns must not be empty.",
    };
  }

  const firstAsterisk = source.indexOf("*");
  if (
    firstAsterisk !== -1 &&
    !(source.endsWith("/*") && firstAsterisk === source.length - 1)
  ) {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.configuredSource}" may only use "*" as a trailing "/*".`,
    };
  }

  if (source === "/*") {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.configuredSource}" must include a prefix before "/*".`,
    };
  }

  return {
    success: true,
    negated,
    pattern: {
      source,
      wildcard: source.endsWith("/*"),
    },
  };
}

function wildcardPrefix(pattern: ImportSourcePattern): string {
  return pattern.source.slice(0, -2);
}

function patternsEqual(opts: {
  left: ImportSourcePattern;
  right: ImportSourcePattern;
}): boolean {
  return (
    opts.left.source === opts.right.source &&
    opts.left.wildcard === opts.right.wildcard
  );
}

function patternContains(opts: {
  parent: ImportSourcePattern;
  child: ImportSourcePattern;
  strict?: boolean;
}): boolean {
  if (patternsEqual({ left: opts.parent, right: opts.child })) {
    return opts.strict !== true;
  }
  if (!opts.parent.wildcard) {
    return false;
  }

  const prefix = wildcardPrefix(opts.parent);
  if (opts.child.wildcard) {
    return wildcardPrefix(opts.child).startsWith(`${prefix}/`);
  }
  return opts.child.source.startsWith(`${prefix}/`);
}

function patternsOverlap(opts: {
  left: ImportSourcePattern;
  right: ImportSourcePattern;
}): boolean {
  return (
    patternContains({ parent: opts.left, child: opts.right }) ||
    patternContains({ parent: opts.right, child: opts.left })
  );
}

function constraintPattern(
  constraint: ImportSourceConstraint
): ImportSourcePattern {
  return {
    source: constraint.source,
    wildcard: constraint.kind === "selector",
  };
}

function selectorRules(
  constraint: ImportSourceSelectorConstraint
): ImportSourceSelectorRule[] {
  return [
    { source: constraint.source, wildcard: true, selected: true },
    ...constraint.rules,
  ];
}

function getUniformSelection(opts: {
  selector: ImportSourceSelectorConstraint;
  pattern: ImportSourcePattern;
}):
  | { success: true; selected: boolean; ancestor: ImportSourceSelectorRule }
  | { success: false } {
  const rules = selectorRules(opts.selector);
  const ancestors = rules.filter((rule) =>
    patternContains({ parent: rule, child: opts.pattern })
  );
  const ancestor = ancestors.sort(
    (left, right) => right.source.length - left.source.length
  )[0];

  if (!ancestor) {
    return { success: false };
  }

  const hasDescendant = rules.some((rule) =>
    patternContains({
      parent: opts.pattern,
      child: rule,
      strict: true,
    })
  );
  if (hasDescendant) {
    return { success: false };
  }

  return { success: true, selected: ancestor.selected, ancestor };
}

function addSelectorRule(opts: {
  selector: ImportSourceSelectorConstraint;
  pattern: ImportSourcePattern;
  selected: boolean;
  index: number;
}): { success: true } | { success: false; index: number; error: string } {
  if (
    !patternContains({
      parent: constraintPattern(opts.selector),
      child: opts.pattern,
      strict: true,
    })
  ) {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.pattern.source}" must be strictly nested under wildcard selector "${opts.selector.source}".`,
    };
  }

  const selection = getUniformSelection({
    selector: opts.selector,
    pattern: opts.pattern,
  });
  if (!selection.success) {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.pattern.source}" overlaps both included and excluded branches of wildcard selector "${opts.selector.source}".`,
    };
  }
  if (
    !patternContains({
      parent: selection.ancestor,
      child: opts.pattern,
      strict: true,
    })
  ) {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.pattern.source}" must be more specific than the rule it modifies.`,
    };
  }
  if (selection.selected === opts.selected) {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.pattern.source}" does not change wildcard selector "${opts.selector.source}".`,
    };
  }

  opts.selector.rules.push({ ...opts.pattern, selected: opts.selected });
  return { success: true };
}

type AddConfiguredPatternResult =
  | {
      success: true;
      activeSelector: ImportSourceSelectorConstraint | undefined;
    }
  | { success: false; index: number; error: string };

function addNegatedPattern(opts: {
  expectedIsArray: boolean;
  configuredSource: string;
  pattern: ImportSourcePattern;
  activeSelector: ImportSourceSelectorConstraint | undefined;
  index: number;
}): AddConfiguredPatternResult {
  if (!opts.expectedIsArray) {
    return {
      success: false,
      index: opts.index,
      error: "Negated import source patterns may only be used in arrays.",
    };
  }
  if (!opts.activeSelector) {
    return {
      success: false,
      index: opts.index,
      error: `Negated import source pattern "${opts.configuredSource}" must follow a wildcard selector.`,
    };
  }
  const added = addSelectorRule({
    selector: opts.activeSelector,
    pattern: opts.pattern,
    selected: false,
    index: opts.index,
  });
  if (!added.success) {
    return added;
  }
  return { success: true, activeSelector: opts.activeSelector };
}

function addPositivePattern(opts: {
  pattern: ImportSourcePattern;
  constraints: ImportSourceConstraint[];
  activeSelector: ImportSourceSelectorConstraint | undefined;
  index: number;
}): AddConfiguredPatternResult {
  if (
    opts.activeSelector &&
    patternContains({
      parent: constraintPattern(opts.activeSelector),
      child: opts.pattern,
    })
  ) {
    const added = addSelectorRule({
      selector: opts.activeSelector,
      pattern: opts.pattern,
      selected: true,
      index: opts.index,
    });
    return added.success
      ? { success: true, activeSelector: opts.activeSelector }
      : added;
  }

  const overlapping = opts.constraints.find((constraint) =>
    patternsOverlap({
      left: constraintPattern(constraint),
      right: opts.pattern,
    })
  );
  if (overlapping) {
    return {
      success: false,
      index: opts.index,
      error: `Import source pattern "${opts.pattern.source}" overlaps independent constraint "${overlapping.source}".`,
    };
  }

  if (!opts.pattern.wildcard) {
    opts.constraints.push({ kind: "exact", source: opts.pattern.source });
    return { success: true, activeSelector: undefined };
  }

  const selector: ImportSourceSelectorConstraint = {
    kind: "selector",
    source: opts.pattern.source,
    rules: [],
  };
  opts.constraints.push(selector);
  return { success: true, activeSelector: selector };
}

export function compileImportSourceConstraints(opts: {
  expected: string | string[];
}): CompileImportSourceConstraintsResult {
  const configuredSources =
    typeof opts.expected === "string" ? [opts.expected] : opts.expected;
  const constraints: ImportSourceConstraint[] = [];
  let activeSelector: ImportSourceSelectorConstraint | undefined;

  for (let index = 0; index < configuredSources.length; index++) {
    const configuredSource = configuredSources[index];
    if (configuredSource === undefined) {
      continue;
    }
    const parsed = parsePattern({ configuredSource, index });
    if (!parsed.success) {
      return parsed;
    }

    const added = parsed.negated
      ? addNegatedPattern({
          expectedIsArray: Array.isArray(opts.expected),
          configuredSource,
          pattern: parsed.pattern,
          activeSelector,
          index,
        })
      : addPositivePattern({
          pattern: parsed.pattern,
          constraints,
          activeSelector,
          index,
        });
    if (!added.success) {
      return added;
    }
    activeSelector = added.activeSelector;
  }

  return { success: true, constraints };
}

function doesPatternMatch(opts: {
  source: string;
  pattern: ImportSourcePattern;
}): boolean {
  if (!opts.pattern.wildcard) {
    return opts.source === opts.pattern.source;
  }
  const prefix = wildcardPrefix(opts.pattern);
  return (
    opts.source.length > prefix.length + 1 &&
    opts.source.startsWith(`${prefix}/`)
  );
}

export function doesImportSourceConstraintMatch(opts: {
  source: string;
  constraint: ImportSourceConstraint;
}): boolean {
  if (opts.constraint.kind === "exact") {
    return opts.source === opts.constraint.source;
  }

  if (
    !doesPatternMatch({
      source: opts.source,
      pattern: constraintPattern(opts.constraint),
    })
  ) {
    return false;
  }

  let selected = true;
  for (const rule of opts.constraint.rules) {
    if (doesPatternMatch({ source: opts.source, pattern: rule })) {
      selected = rule.selected;
    }
  }
  return selected;
}

export function importSourceConstraintValue(opts: {
  constraint: ImportSourceConstraint;
}): string | string[] {
  if (opts.constraint.kind === "exact" || opts.constraint.rules.length === 0) {
    return opts.constraint.source;
  }
  return [
    opts.constraint.source,
    ...opts.constraint.rules.map((rule) =>
      rule.selected ? rule.source : `!${rule.source}`
    ),
  ];
}
