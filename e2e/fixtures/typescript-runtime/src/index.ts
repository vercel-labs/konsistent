import type { Foo } from "./missing";
import { send } from "./missing";

export type Value = Readonly<{
  enabled?: boolean;
  token: Foo;
}>;
export const count: 1_000 = 1_000;

send("é😀", { a: 1 }, "extra");
