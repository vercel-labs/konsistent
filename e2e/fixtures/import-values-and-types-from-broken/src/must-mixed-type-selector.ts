import type { ReactType } from "type-react";
import type { ZodType } from "type-zod";
import type { PrivateApi } from "@vendor/project/internal/public/private";
import { publicApi } from "@vendor/project/internal/public/api";

export type ExcludedTypes = ReactType | ZodType | PrivateApi;
export const wrongKindPublicApi = publicApi;
