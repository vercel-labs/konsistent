import { sharedValue, type Shared } from "../shared";

export const current = (shared: Shared) => shared.value || sharedValue;
