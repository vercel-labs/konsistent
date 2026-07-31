import React from "react";
import { z } from "zod";
import type { Core } from "@ai-sdk/core";
import { harness } from "@ai-sdk/harness";
import { testing } from "@ai-sdk/harness/testing";

export type WrongKindCore = Core;
export const excludedValues = { React, z, harness, testing };
