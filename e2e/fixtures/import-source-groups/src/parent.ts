import { sharedValue, type Shared } from "../shared";

export const parent = (shared: Shared) => shared.value || sharedValue;
