import { parent } from "../shared";
import { helper } from "./helper";
import type { Config } from "./types";
import React from "react";

export type ValueConfig = Config;
export const value = { React, helper, parent };
