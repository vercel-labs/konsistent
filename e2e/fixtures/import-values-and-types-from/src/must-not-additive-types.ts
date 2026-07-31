import type { AllowedProjectRoot } from "blocked-type-project";
import type { AllowedToolkitRoot } from "@blocked-types/toolkit";
import type { OtherPackage } from "@allowed-types-vendor/package";
import type { OtherType } from "allowed-types";

export type AllowedAdditiveTypes =
  | AllowedProjectRoot
  | AllowedToolkitRoot
  | OtherPackage
  | OtherType;
