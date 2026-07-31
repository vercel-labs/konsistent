import type { BlockedType } from "blocked-types";
import type { BlockedProject } from "blocked-type-project/entrypoint";
import type { BlockedToolkit } from "@blocked-types/toolkit/entrypoint";
import type { BlockedVendor } from "@blocked-types-vendor/package";

export type BlockedTypes =
  | BlockedType
  | BlockedProject
  | BlockedToolkit
  | BlockedVendor;
