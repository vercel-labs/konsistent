import { helper, type HelperOptions } from "./helper";

export const external = (options: HelperOptions) =>
  `${helper}:${options.value}`;
