export const DEFAULT_SELECTION_PROPERTY = "baseops_selected";
export const DEFAULT_PREVIEW_LIMIT = 50;

export type BulkOperation = "replace" | "add" | "remove" | "clear";

export interface FilePropertyState {
  path: string;
  propertyExists: boolean;
  value: unknown;
}

export interface FileFrontmatterState {
  path: string;
  frontmatter: Record<string, unknown>;
  selected: boolean;
}

export interface PropertyValueSample {
  value: string;
  count: number;
}

export interface PropertyStat {
  name: string;
  fileCount: number;
  selectedCount: number;
  missingCount: number;
  sampleValues: PropertyValueSample[];
}

export interface PlannedChange {
  path: string;
  propertyExists: boolean;
  oldValue: unknown;
  newValue: unknown;
  oldDisplay: string;
  newDisplay: string;
}

export interface SkippedChange {
  path: string;
  value: unknown;
  reason: string;
}

export interface OperationPlan {
  operation: BulkOperation;
  propertyName: string;
  totalFiles: number;
  changedFiles: PlannedChange[];
  skippedFiles: SkippedChange[];
}

export function isSelectedValue(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }

  return false;
}

export function normalizePropertyName(propertyName: string): string {
  return propertyName.trim();
}

export function operationNeedsValue(operation: BulkOperation): boolean {
  return operation !== "clear";
}

export function parseInputValue(rawValue: string, operation: BulkOperation, propertyName: string): unknown {
  if (!operationNeedsValue(operation)) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    throw new Error("Enter a value before previewing this operation.");
  }

  if (operation === "add" || operation === "remove") {
    return splitListInput(trimmed, propertyName);
  }

  return normalizeToken(trimmed, propertyName);
}

export function planOperation(
  files: FilePropertyState[],
  propertyNameInput: string,
  operation: BulkOperation,
  rawValue: string
): OperationPlan {
  const propertyName = normalizePropertyName(propertyNameInput);
  if (propertyName.length === 0) {
    throw new Error("Enter a property name before previewing.");
  }

  const parsedValue = parseInputValue(rawValue, operation, propertyName);
  const changedFiles: PlannedChange[] = [];
  const skippedFiles: SkippedChange[] = [];

  for (const file of files) {
    const nextValue = nextPropertyValue(file.value, file.propertyExists, operation, parsedValue);

    if (valuesEqual(file.value, nextValue)) {
      skippedFiles.push({
        path: file.path,
        value: file.value,
        reason: "No change"
      });
      continue;
    }

    changedFiles.push({
      path: file.path,
      propertyExists: file.propertyExists,
      oldValue: file.value,
      newValue: nextValue,
      oldDisplay: formatValue(file.value),
      newDisplay: formatValue(nextValue)
    });
  }

  return {
    operation,
    propertyName,
    totalFiles: files.length,
    changedFiles,
    skippedFiles
  };
}

export function nextPropertyValue(
  currentValue: unknown,
  propertyExists: boolean,
  operation: BulkOperation,
  parsedValue: unknown
): unknown {
  if (operation === "clear") {
    return undefined;
  }

  if (operation === "replace") {
    return parsedValue;
  }

  const requested = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
  const currentItems = propertyExists ? toList(currentValue) : [];

  if (operation === "add") {
    const next = [...currentItems];
    for (const item of requested) {
      if (!next.some((existing) => valuesEqual(existing, item))) {
        next.push(item);
      }
    }
    return next;
  }

  if (operation === "remove") {
    return currentItems.filter((item) => !requested.some((removeItem) => valuesEqual(item, removeItem)));
  }

  return currentValue;
}

export function formatValue(value: unknown): string {
  if (typeof value === "undefined") {
    return "(missing)";
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(", ")}]`;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function summarizeProperties(files: FileFrontmatterState[], valueLimit = 5): PropertyStat[] {
  const totalFiles = files.length;
  const propertyCounts = new Map<
    string,
    {
      fileCount: number;
      selectedCount: number;
      values: Map<string, number>;
    }
  >();

  for (const file of files) {
    for (const [propertyName, value] of Object.entries(file.frontmatter)) {
      if (propertyName === "position") {
        continue;
      }

      const current = propertyCounts.get(propertyName) ?? {
        fileCount: 0,
        selectedCount: 0,
        values: new Map<string, number>()
      };
      current.fileCount += 1;
      if (file.selected) {
        current.selectedCount += 1;
      }
      const displayValue = formatValue(value);
      current.values.set(displayValue, (current.values.get(displayValue) ?? 0) + 1);
      propertyCounts.set(propertyName, current);
    }
  }

  return Array.from(propertyCounts.entries())
    .map(([name, stat]) => ({
      name,
      fileCount: stat.fileCount,
      selectedCount: stat.selectedCount,
      missingCount: totalFiles - stat.fileCount,
      sampleValues: Array.from(stat.values.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
        .slice(0, Math.max(1, valueLimit))
    }))
    .sort((left, right) => right.fileCount - left.fileCount || left.name.localeCompare(right.name));
}

function splitListInput(value: string, propertyName: string): string[] {
  const values = value
    .split(",")
    .map((part) => normalizeToken(part, propertyName))
    .filter((part) => part.length > 0);

  if (values.length === 0) {
    throw new Error("Enter at least one value before previewing this operation.");
  }

  return values;
}

function normalizeToken(value: string, propertyName: string): string {
  const trimmed = value.trim();
  if (isTagProperty(propertyName)) {
    return trimmed.replace(/^#+/, "");
  }
  return trimmed;
}

function isTagProperty(propertyName: string): boolean {
  const normalized = propertyName.trim().toLowerCase();
  return normalized === "tag" || normalized === "tags";
}

function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "undefined") {
    return [];
  }

  return [value];
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
