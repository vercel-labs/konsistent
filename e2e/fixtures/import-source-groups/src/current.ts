import { helper, type HelperOptions } from "./helper";

export const current = (options: HelperOptions) => `${helper}:${options.value}`;
