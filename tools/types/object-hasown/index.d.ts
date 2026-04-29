/*
 * Augment `Object.hasOwn` with a type predicate so it narrows the input the
 * same way the `in` operator does. The lib signature returns plain `boolean`,
 * which means TS cannot narrow after a `hasOwn` check — this restores parity.
 */
declare global {
  interface ObjectConstructor {
    hasOwn<O extends object, K extends PropertyKey>(
      o: O,
      v: K
    ): o is Extract<O, Record<K, unknown>> extends never
      ? O & Record<K, unknown>
      : Extract<O, Record<K, unknown>>;
  }
}

export {};
