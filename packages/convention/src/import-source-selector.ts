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

type SourceLabel = "Import" | "Export";

function parsePattern(opts: {
  configuredSource: string;
  sourceLabel: SourceLabel;
  index?: number;
}):
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
      error: `${opts.sourceLabel} source patterns must not be empty.`,
      index: opts.index,
      success: false,
    };
  }

  const firstAsterisk = source.indexOf("*");
  if (
    firstAsterisk !== -1 &&
    !(source.endsWith("/*") && firstAsterisk === source.length - 1)
  ) {
    return {
      error: `${opts.sourceLabel} source pattern "${opts.configuredSource}" may only use "*" as a trailing "/*".`,
      index: opts.index,
      success: false,
    };
  }

  if (source === "/*") {
    return {
      error: `${opts.sourceLabel} source pattern "${opts.configuredSource}" must include a prefix before "/*".`,
      index: opts.index,
      success: false,
    };
  }

  return {
    negated,
    pattern: {
      source,
      wildcard: source.endsWith("/*"),
    },
    success: true,
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
    patternContains({ child: opts.right, parent: opts.left }) ||
    patternContains({ child: opts.left, parent: opts.right })
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
    { selected: true, source: constraint.source, wildcard: true },
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
    patternContains({ child: opts.pattern, parent: rule })
  );
  const [ancestor] = ancestors.sort(
    (left, right) => right.source.length - left.source.length
  );

  if (!ancestor) {
    return { success: false };
  }

  const hasDescendant = rules.some((rule) =>
    patternContains({
      child: rule,
      parent: opts.pattern,
      strict: true,
    })
  );
  if (hasDescendant) {
    return { success: false };
  }

  return { ancestor, selected: ancestor.selected, success: true };
}

function addSelectorRule(opts: {
  selector: ImportSourceSelectorConstraint;
  pattern: ImportSourcePattern;
  selected: boolean;
  index: number;
  sourceLabel: SourceLabel;
}): { success: true } | { success: false; index: number; error: string } {
  if (
    !patternContains({
      child: opts.pattern,
      parent: constraintPattern(opts.selector),
      strict: true,
    })
  ) {
    return {
      error: `${opts.sourceLabel} source pattern "${opts.pattern.source}" must be strictly nested under wildcard selector "${opts.selector.source}".`,
      index: opts.index,
      success: false,
    };
  }

  const selection = getUniformSelection({
    pattern: opts.pattern,
    selector: opts.selector,
  });
  if (!selection.success) {
    return {
      error: `${opts.sourceLabel} source pattern "${opts.pattern.source}" overlaps both included and excluded branches of wildcard selector "${opts.selector.source}".`,
      index: opts.index,
      success: false,
    };
  }
  if (
    !patternContains({
      child: opts.pattern,
      parent: selection.ancestor,
      strict: true,
    })
  ) {
    return {
      error: `${opts.sourceLabel} source pattern "${opts.pattern.source}" must be more specific than the rule it modifies.`,
      index: opts.index,
      success: false,
    };
  }
  if (selection.selected === opts.selected) {
    return {
      error: `${opts.sourceLabel} source pattern "${opts.pattern.source}" does not change wildcard selector "${opts.selector.source}".`,
      index: opts.index,
      success: false,
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
  sourceLabel: SourceLabel;
}): AddConfiguredPatternResult {
  if (!opts.expectedIsArray) {
    return {
      error: `Negated ${opts.sourceLabel.toLowerCase()} source patterns may only be used in arrays.`,
      index: opts.index,
      success: false,
    };
  }
  if (!opts.activeSelector) {
    return {
      error: `Negated ${opts.sourceLabel.toLowerCase()} source pattern "${opts.configuredSource}" must follow a wildcard selector.`,
      index: opts.index,
      success: false,
    };
  }
  const added = addSelectorRule({
    index: opts.index,
    pattern: opts.pattern,
    selected: false,
    selector: opts.activeSelector,
    sourceLabel: opts.sourceLabel,
  });
  if (!added.success) {
    return added;
  }
  return { activeSelector: opts.activeSelector, success: true };
}

function addPositivePattern(opts: {
  pattern: ImportSourcePattern;
  constraints: ImportSourceConstraint[];
  activeSelector: ImportSourceSelectorConstraint | undefined;
  index: number;
  sourceLabel: SourceLabel;
}): AddConfiguredPatternResult {
  if (
    opts.activeSelector &&
    patternContains({
      child: opts.pattern,
      parent: constraintPattern(opts.activeSelector),
    })
  ) {
    const added = addSelectorRule({
      index: opts.index,
      pattern: opts.pattern,
      selected: true,
      selector: opts.activeSelector,
      sourceLabel: opts.sourceLabel,
    });
    return added.success
      ? { activeSelector: opts.activeSelector, success: true }
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
      error: `${opts.sourceLabel} source pattern "${opts.pattern.source}" overlaps independent constraint "${overlapping.source}".`,
      index: opts.index,
      success: false,
    };
  }

  if (!opts.pattern.wildcard) {
    opts.constraints.push({ kind: "exact", source: opts.pattern.source });
    return { activeSelector: undefined, success: true };
  }

  const selector: ImportSourceSelectorConstraint = {
    kind: "selector",
    rules: [],
    source: opts.pattern.source,
  };
  opts.constraints.push(selector);
  return { activeSelector: selector, success: true };
}

export function compileImportSourceConstraints(opts: {
  expected: string | string[];
  sourceLabel?: SourceLabel;
}): CompileImportSourceConstraintsResult {
  const sourceLabel = opts.sourceLabel ?? "Import";
  const configuredSources =
    typeof opts.expected === "string" ? [opts.expected] : opts.expected;
  const constraints: ImportSourceConstraint[] = [];
  let activeSelector: ImportSourceSelectorConstraint | undefined;

  for (let index = 0; index < configuredSources.length; index += 1) {
    const configuredSource = configuredSources[index];
    if (configuredSource === undefined) {
      continue;
    }
    const parsed = parsePattern({ configuredSource, index, sourceLabel });
    if (!parsed.success) {
      return parsed;
    }

    const added = parsed.negated
      ? addNegatedPattern({
          activeSelector,
          configuredSource,
          expectedIsArray: Array.isArray(opts.expected),
          index,
          pattern: parsed.pattern,
          sourceLabel,
        })
      : addPositivePattern({
          activeSelector,
          constraints,
          index,
          pattern: parsed.pattern,
          sourceLabel,
        });
    if (!added.success) {
      return added;
    }
    ({ activeSelector } = added);
  }

  return { constraints, success: true };
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
      pattern: constraintPattern(opts.constraint),
      source: opts.source,
    })
  ) {
    return false;
  }

  let selected = true;
  for (const rule of opts.constraint.rules) {
    if (doesPatternMatch({ pattern: rule, source: opts.source })) {
      ({ selected } = rule);
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
