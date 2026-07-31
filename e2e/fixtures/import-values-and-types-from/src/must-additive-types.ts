import type { ReactType } from "type-react";
import type { ProjectType } from "type-project/entrypoint";
import type { VendoredType } from "@type-vendor/package/entrypoint";
import type { ToolkitType } from "@types/toolkit/entrypoint";

export type AdditiveTypes =
  | ReactType
  | ProjectType
  | VendoredType
  | ToolkitType;
