export type RepeatedStringOptionResult =
  | { success: true; values: string[] }
  | { success: false; error: string };

export function parseRepeatedStringOption(opts: {
  rawArgs: string[];
  name: string;
}): RepeatedStringOptionResult {
  const values: string[] = [];
  const assignmentPrefix = `${opts.name}=`;

  for (let index = 0; index < opts.rawArgs.length; index++) {
    const arg = opts.rawArgs[index];
    if (arg.startsWith(assignmentPrefix)) {
      const value = arg.slice(assignmentPrefix.length);
      if (value.length === 0) {
        return {
          success: false,
          error: `${opts.name} requires a non-empty value`,
        };
      }
      values.push(value);
      continue;
    }

    if (arg !== opts.name) {
      continue;
    }

    const value = opts.rawArgs[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith("-")) {
      return {
        success: false,
        error: `${opts.name} requires a non-empty value`,
      };
    }
    values.push(value);
    index++;
  }

  return { success: true, values };
}
