import type { ConstantValueSchemaV1 } from "@konsistent/convention";
import type { PredicateContext } from "../core/context.js";
import { findTypeDefinition } from "../core/declaration-utils.js";
import type { Diagnostic, DiagnosticSeverity } from "../core/diagnostics.js";
import { createDiagnostic } from "../core/diagnostics.js";
import {
  type ConstantSchemaMatchResult,
  matchConstantTypeSchema,
  matchTypeDefinitionSchema,
  matchTypeExpression,
  resolveConstantValueSchema,
} from "./constant-type-schema.js";
import type { FileStructure, SourcePosition } from "./types.js";

interface DefinitionConstraint {
  schema?: ConstantValueSchemaV1;
  type?: string;
}

function getSchema(opts: {
  definition: object;
}): ConstantValueSchemaV1 | undefined {
  if (!Object.hasOwn(opts.definition, "schema")) {
    return;
  }
  return (opts.definition as DefinitionConstraint).schema;
}

function getType(opts: { definition: object }): string | undefined {
  if (!Object.hasOwn(opts.definition, "type")) {
    return;
  }
  return (opts.definition as DefinitionConstraint).type;
}

function createConstraintDiagnostic(opts: {
  column?: number;
  context: PredicateContext;
  conventionName?: string;
  label: "Constant" | "Type";
  line?: number;
  name: string;
  predicateName: string;
  reason: string | undefined;
  severity?: DiagnosticSeverity;
}): Diagnostic {
  return createDiagnostic({
    column: opts.column,
    conventionName: opts.conventionName,
    filePath: opts.context.path,
    line: opts.line,
    message: `${opts.label} "${opts.name}" ${opts.reason}`,
    predicateName: opts.predicateName,
    severity: opts.severity,
  });
}

export function checkConstantDefinitionConstraint(opts: {
  context: PredicateContext;
  conventionName?: string;
  definition: object;
  fallbackPosition?: SourcePosition;
  fileStructure: FileStructure;
  name: string;
  predicateName: string;
  severity?: DiagnosticSeverity;
}): Diagnostic | undefined {
  const constantInfo = opts.fileStructure.constants.find(
    (constant) => constant.name === opts.name
  );
  const schema = getSchema({ definition: opts.definition });
  const configuredType = getType({ definition: opts.definition });
  let result: ConstantSchemaMatchResult | undefined;
  if (schema) {
    result = matchConstantTypeSchema({
      actual: constantInfo?.typeInfo,
      schema: resolveConstantValueSchema({
        resolveTemplate: opts.context.resolveTemplate,
        schema,
      }),
    });
  } else if (configuredType) {
    result = matchTypeExpression({
      actual: constantInfo?.typeName?.text,
      expected: opts.context.resolveTemplate(configuredType),
      missingReason: "must have an explicit type annotation",
      session: opts.context.typescriptSession,
    });
  }

  if (!result || result.matches) {
    return;
  }
  return createConstraintDiagnostic({
    column: constantInfo?.pos.column ?? opts.fallbackPosition?.column,
    context: opts.context,
    conventionName: opts.conventionName,
    label: "Constant",
    line: constantInfo?.pos.line ?? opts.fallbackPosition?.line,
    name: opts.name,
    predicateName: opts.predicateName,
    reason: result.reason,
    severity: opts.severity,
  });
}

export function checkTypeDefinitionConstraint(opts: {
  context: PredicateContext;
  conventionName?: string;
  definition: object;
  fallbackPosition?: SourcePosition;
  fileStructure: FileStructure;
  name: string;
  predicateName: string;
  severity?: DiagnosticSeverity;
}): Diagnostic | undefined {
  const schema = getSchema({ definition: opts.definition });
  const configuredType = getType({ definition: opts.definition });
  const typeDefinition = schema
    ? findTypeDefinition({
        fileStructure: opts.fileStructure,
        name: opts.name,
      })
    : undefined;
  const typeAlias = configuredType
    ? opts.fileStructure.typeAliases.find((entry) => entry.name === opts.name)
    : undefined;
  let result: ConstantSchemaMatchResult | undefined;
  if (schema) {
    result = matchTypeDefinitionSchema({
      actual: typeDefinition?.typeInfo,
      schema: resolveConstantValueSchema({
        resolveTemplate: opts.context.resolveTemplate,
        schema,
      }),
    });
  } else if (configuredType) {
    result = matchTypeExpression({
      actual: typeAlias?.typeName.text,
      expected: opts.context.resolveTemplate(configuredType),
      missingReason: "must be a type alias",
      session: opts.context.typescriptSession,
    });
  }

  if (!result || result.matches) {
    return;
  }
  return createConstraintDiagnostic({
    column:
      typeDefinition?.pos.column ??
      typeAlias?.pos.column ??
      opts.fallbackPosition?.column,
    context: opts.context,
    conventionName: opts.conventionName,
    label: "Type",
    line:
      typeDefinition?.pos.line ??
      typeAlias?.pos.line ??
      opts.fallbackPosition?.line,
    name: opts.name,
    predicateName: opts.predicateName,
    reason: result.reason,
    severity: opts.severity,
  });
}
