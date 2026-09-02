import type {
  ConstantEnumSchemaV1,
  ConstantScalarTypeV1,
  ConstantValueSchemaV1,
  InnerTypeConstraintV1,
} from "@konsistent/convention";
import ts from "typescript";

type ConstantScalarValue = string | number | boolean | null;

interface ConstantScalarTypeInfo {
  kind: "scalar";
  type: ConstantScalarTypeV1;
}

interface ConstantEnumTypeInfo {
  kind: "enum";
  type: ConstantScalarTypeV1;
  values: ConstantScalarValue[];
}

interface ConstantArrayTypeInfo {
  itemType: string;
  kind: "array";
}

interface ConstantObjectPropertyTypeInfo {
  name: string;
  optional: boolean;
  type?: string;
}

interface ConstantObjectTypeInfo {
  kind: "object";
  properties: ConstantObjectPropertyTypeInfo[];
}

interface UnsupportedConstantTypeInfo {
  kind: "unsupported";
}

export type ConstantTypeInfo =
  | ConstantScalarTypeInfo
  | ConstantEnumTypeInfo
  | ConstantArrayTypeInfo
  | ConstantObjectTypeInfo
  | UnsupportedConstantTypeInfo;

export type TypeShapeInfo = ConstantTypeInfo;

export interface ConstantSchemaMatchResult {
  matches: boolean;
  reason?: string;
}

function resolveInnerTypeConstraint(opts: {
  constraint: InnerTypeConstraintV1;
  resolveTemplate: (template: string) => string;
}): InnerTypeConstraintV1 {
  return typeof opts.constraint === "string"
    ? opts.resolveTemplate(opts.constraint)
    : opts.constraint;
}

export function resolveConstantValueSchema(opts: {
  schema: ConstantValueSchemaV1;
  resolveTemplate: (template: string) => string;
}): ConstantValueSchemaV1 {
  const { schema, resolveTemplate } = opts;
  if (schema.type === "array") {
    return {
      ...schema,
      items: resolveInnerTypeConstraint({
        constraint: schema.items,
        resolveTemplate,
      }),
    };
  }
  if (schema.type === "object") {
    const properties: typeof schema.properties = Object.create(null);
    for (const [name, constraint] of Object.entries(schema.properties)) {
      properties[name] =
        typeof constraint === "string"
          ? resolveTemplate(constraint)
          : constraint;
    }
    return {
      ...schema,
      properties,
    };
  }
  return schema;
}

function innerTypeConstraintText(
  constraint: InnerTypeConstraintV1 | Record<string, never>
): string | undefined {
  if (typeof constraint === "string") {
    return constraint;
  }
  if (Object.hasOwn(constraint, "type")) {
    return (constraint as { type: ConstantScalarTypeV1 }).type;
  }
  return;
}

function parseScalarType(
  node: ts.TypeNode | undefined
): ConstantScalarTypeV1 | undefined {
  switch (node?.kind) {
    case ts.SyntaxKind.StringKeyword:
      return "string";
    case ts.SyntaxKind.NumberKeyword:
      return "number";
    case ts.SyntaxKind.BooleanKeyword:
      return "boolean";
    default:
      if (
        node &&
        ts.isLiteralTypeNode(node) &&
        node.literal.kind === ts.SyntaxKind.NullKeyword
      ) {
        return "null";
      }
      return;
  }
}

function parseLiteralValue(node: ts.TypeNode): ConstantScalarValue | undefined {
  if (!ts.isLiteralTypeNode(node)) {
    return;
  }

  const { literal } = node;
  if (ts.isStringLiteral(literal)) {
    return literal.text;
  }
  if (ts.isNumericLiteral(literal)) {
    return Number(literal.text);
  }
  if (literal.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (literal.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (literal.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (
    ts.isPrefixUnaryExpression(literal) &&
    literal.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(literal.operand)
  ) {
    return -Number(literal.operand.text);
  }
  return;
}

function getScalarValueType(value: ConstantScalarValue): ConstantScalarTypeV1 {
  return value === null ? "null" : (typeof value as ConstantScalarTypeV1);
}

function parseEnumType(node: ts.TypeNode): ConstantEnumTypeInfo | undefined {
  const members = ts.isUnionTypeNode(node) ? node.types : [node];
  const values: ConstantScalarValue[] = [];

  for (const member of members) {
    const value = parseLiteralValue(member);
    if (value === undefined) {
      return;
    }
    values.push(value);
  }

  const type =
    values[0] === undefined ? undefined : getScalarValueType(values[0]);
  if (!(type && values.every((value) => getScalarValueType(value) === type))) {
    return;
  }
  return { kind: "enum", type, values };
}

function parseArrayType(node: ts.TypeNode): ConstantArrayTypeInfo | undefined {
  if (ts.isArrayTypeNode(node)) {
    const itemType = parseInnerType(node.elementType);
    return itemType ? { kind: "array", itemType } : undefined;
  }

  if (
    ts.isTypeOperatorNode(node) &&
    node.operator === ts.SyntaxKind.ReadonlyKeyword &&
    ts.isArrayTypeNode(node.type)
  ) {
    const itemType = parseInnerType(node.type.elementType);
    return itemType ? { kind: "array", itemType } : undefined;
  }

  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    if (
      (name === "Array" || name === "ReadonlyArray") &&
      node.typeArguments?.length === 1
    ) {
      const itemType = parseInnerType(node.typeArguments[0]);
      return itemType ? { kind: "array", itemType } : undefined;
    }
  }

  return;
}

function parseInnerType(node: ts.TypeNode | undefined): string | undefined {
  if (!(node && (parseScalarType(node) || ts.isTypeReferenceNode(node)))) {
    return;
  }
  return node.getText();
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return;
}

function parseObjectType(opts: {
  members: ts.NodeArray<ts.TypeElement>;
}): ConstantObjectTypeInfo | undefined {
  const { members } = opts;
  const properties: ConstantObjectPropertyTypeInfo[] = [];
  const names = new Set<string>();

  for (const member of members) {
    if (!(ts.isPropertySignature(member) && member.name)) {
      return;
    }
    const name = getPropertyName(member.name);
    if (name === undefined || names.has(name)) {
      return;
    }
    names.add(name);
    const type = parseInnerType(member.type);
    properties.push({
      name,
      optional: Boolean(member.questionToken),
      ...(type ? { type } : {}),
    });
  }

  return { kind: "object", properties };
}

export function parseTypeShape(opts: {
  node: ts.TypeNode | undefined;
}): ConstantTypeInfo | undefined {
  const { node } = opts;
  if (!node) {
    return;
  }

  const scalarType = parseScalarType(node);
  if (scalarType) {
    return { kind: "scalar", type: scalarType };
  }

  const enumType = parseEnumType(node);
  if (enumType) {
    return enumType;
  }

  const arrayType = parseArrayType(node);
  if (arrayType) {
    return arrayType;
  }

  if (ts.isTypeLiteralNode(node)) {
    return (
      parseObjectType({ members: node.members }) ?? { kind: "unsupported" }
    );
  }

  return { kind: "unsupported" };
}

export function parseInterfaceTypeShape(opts: {
  node: ts.InterfaceDeclaration;
}): ConstantTypeInfo {
  const { node } = opts;
  if (node.heritageClauses?.length) {
    return { kind: "unsupported" };
  }
  return parseObjectType({ members: node.members }) ?? { kind: "unsupported" };
}

function scalarValueKey(value: ConstantScalarValue): string {
  return `${getScalarValueType(value)}:${String(value)}`;
}

function matchEnumSchema(opts: {
  actual: ConstantTypeInfo;
  schema: ConstantEnumSchemaV1;
}): ConstantSchemaMatchResult {
  const { actual, schema } = opts;
  if (
    actual.kind === "scalar" &&
    actual.type === "null" &&
    schema.type === "null" &&
    schema.enum.length === 1 &&
    schema.enum[0] === null
  ) {
    return { matches: true };
  }
  if (actual.kind !== "enum" || actual.type !== schema.type) {
    return {
      matches: false,
      reason: `must have the configured ${schema.type} enum type`,
    };
  }

  const actualValues = new Set(actual.values.map(scalarValueKey));
  const expectedValues = new Set(schema.enum.map(scalarValueKey));
  if (
    actualValues.size !== expectedValues.size ||
    [...expectedValues].some((value) => !actualValues.has(value))
  ) {
    return {
      matches: false,
      reason: "must have exactly the configured enum values",
    };
  }
  return { matches: true };
}

function isEnumSchema(
  schema: ConstantValueSchemaV1
): schema is ConstantEnumSchemaV1 {
  return Object.hasOwn(schema, "enum");
}

function matchObjectSchema(opts: {
  actual: ConstantTypeInfo;
  schema: Extract<ConstantValueSchemaV1, { type: "object" }>;
}): ConstantSchemaMatchResult {
  const { actual, schema } = opts;
  if (actual.kind !== "object") {
    return { matches: false, reason: "must have an inline object type" };
  }

  const actualProperties = new Map(
    actual.properties.map((property) => [property.name, property])
  );
  const requiredProperties = new Set(schema.required ?? []);

  for (const [name, propertySchema] of Object.entries(schema.properties)) {
    const property = actualProperties.get(name);
    if (!property) {
      return {
        matches: false,
        reason: requiredProperties.has(name)
          ? `must have required property "${name}"`
          : `must define property "${name}"`,
      };
    }
    if (requiredProperties.has(name) && property.optional) {
      return {
        matches: false,
        reason: `property "${name}" must not be optional`,
      };
    }
    if (!(requiredProperties.has(name) || property.optional)) {
      return {
        matches: false,
        reason: `property "${name}" must be optional`,
      };
    }
    const expectedType = innerTypeConstraintText(propertySchema);
    if (expectedType !== undefined && property.type !== expectedType) {
      return {
        matches: false,
        reason: `property "${name}" must be of type "${expectedType}"`,
      };
    }
  }

  if (schema.additionalProperties === false) {
    const unexpected = actual.properties.find(
      (property) => !Object.hasOwn(schema.properties, property.name)
    );
    if (unexpected) {
      return {
        matches: false,
        reason: `must not have additional property "${unexpected.name}"`,
      };
    }
  }

  return { matches: true };
}

function matchTypeSchema(opts: {
  actual: ConstantTypeInfo | undefined;
  missingReason: string;
  schema: ConstantValueSchemaV1;
  unsupportedReason: string;
}): ConstantSchemaMatchResult {
  const { actual, missingReason, schema, unsupportedReason } = opts;
  if (!actual) {
    return { matches: false, reason: missingReason };
  }
  if (actual.kind === "unsupported") {
    return { matches: false, reason: unsupportedReason };
  }
  if (isEnumSchema(schema)) {
    return matchEnumSchema({ actual, schema });
  }
  if (schema.type === "array") {
    const expectedItemType = innerTypeConstraintText(schema.items);
    if (actual.kind !== "array" || actual.itemType !== expectedItemType) {
      return {
        matches: false,
        reason: `must be an array with items of type "${expectedItemType}"`,
      };
    }
    return { matches: true };
  }
  if (schema.type === "object") {
    return matchObjectSchema({ actual, schema });
  }
  if (actual.kind !== "scalar" || actual.type !== schema.type) {
    return { matches: false, reason: `must be of type "${schema.type}"` };
  }
  return { matches: true };
}

export function matchConstantTypeSchema(opts: {
  actual: ConstantTypeInfo | undefined;
  schema: ConstantValueSchemaV1;
}): ConstantSchemaMatchResult {
  return matchTypeSchema({
    ...opts,
    missingReason: "must have an explicit type annotation",
    unsupportedReason: "uses an unsupported type annotation",
  });
}

export function matchTypeDefinitionSchema(opts: {
  actual: ConstantTypeInfo | undefined;
  schema: ConstantValueSchemaV1;
}): ConstantSchemaMatchResult {
  return matchTypeSchema({
    ...opts,
    missingReason: "must have a local type definition",
    unsupportedReason: "uses an unsupported type definition",
  });
}
