export function validateMatchesConstraint(opts: {
  value: string;
  arg?: string;
}): boolean {
  const { value, arg } = opts;
  if (arg === undefined) {
    return false;
  }
  let regex: RegExp;
  try {
    regex = new RegExp(arg, "u");
  } catch {
    return false;
  }
  return regex.test(value);
}
