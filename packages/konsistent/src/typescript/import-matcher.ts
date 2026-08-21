import type { ImportDefinitionV1 } from "../config/schema.js";
import type { PredicateContext } from "../core/context.js";
import type { FileStructure } from "./types.js";

type ImportEntry = string | ImportDefinitionV1;
type ImportKind = "type" | "value";

export function hasImport(opts: {
  expected: ImportEntry;
  importKind: ImportKind;
  matchLocalName?: boolean;
  context: PredicateContext;
  fileStructure: FileStructure;
}): boolean {
  const { expected, importKind, matchLocalName, context, fileStructure } = opts;
  const definition =
    typeof expected === "string" ? { name: expected } : expected;
  const name = context.resolveTemplate(definition.name);
  const from = definition.from
    ? context.resolveTemplate(definition.from)
    : undefined;
  const alias =
    definition.alias === undefined
      ? undefined
      : context.resolveTemplate(definition.alias);

  return fileStructure.imports.some((importInfo) => {
    if (
      importInfo.isType !== (importKind === "type") ||
      (from !== undefined && importInfo.from !== from)
    ) {
      return false;
    }
    if (matchLocalName) {
      return importInfo.name === name;
    }
    if (alias !== undefined) {
      return (
        importInfo.kind === "named" &&
        importInfo.sourceName !== "default" &&
        importInfo.sourceName === name &&
        importInfo.name === alias
      );
    }
    if (importInfo.kind === "named" && importInfo.sourceName !== "default") {
      return importInfo.sourceName === name;
    }
    return importInfo.name === name;
  });
}

export function hasImportFrom(opts: {
  expected: string;
  importKind: ImportKind;
  context: PredicateContext;
  fileStructure: FileStructure;
}): boolean {
  const { expected, importKind, context, fileStructure } = opts;
  const from = context.resolveTemplate(expected);

  return fileStructure.importSources.some(
    (importSource) =>
      importSource.isType === (importKind === "type") &&
      importSource.from === from
  );
}
