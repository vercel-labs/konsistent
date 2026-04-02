import pc from 'picocolors';
import type { Diagnostic } from './diagnostics.js';

export interface Reporter {
  format(diagnostics: Diagnostic[]): string;
}

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const aLine = a.line ?? -1;
    const bLine = b.line ?? -1;
    return aLine - bLine;
  });
}

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const existing = grouped.get(d.filePath);
    if (existing) {
      existing.push(d);
    } else {
      grouped.set(d.filePath, [d]);
    }
  }
  return grouped;
}

function maxLineWidth(diagnostics: Diagnostic[]): number {
  return diagnostics.reduce((max, d) => {
    const w = d.line != null ? String(d.line).length : 1;
    return Math.max(max, w);
  }, 1);
}

function formatDiagnosticLine(opts: {
  diagnostic: Diagnostic;
  lineWidth: number;
}): string {
  const { diagnostic: d, lineWidth } = opts;
  const lineStr = d.line != null ? String(d.line) : '-';
  const paddedLine = lineStr.padStart(lineWidth);
  const severity = pc.red(d.severity);
  const convention =
    d.conventionName != null ? `  ${pc.dim(`[${d.conventionName}]`)}` : '';
  return `  ${paddedLine}  ${severity}  ${d.message}${convention}`;
}

function formatFileGroup(opts: {
  filePath: string;
  diagnostics: Diagnostic[];
}): string[] {
  const sorted = sortDiagnostics(opts.diagnostics);
  const lineWidth = maxLineWidth(sorted);
  const lines: string[] = [pc.bold(opts.filePath)];
  for (const d of sorted) {
    lines.push(formatDiagnosticLine({ diagnostic: d, lineWidth }));
  }
  lines.push('');
  return lines;
}

export function createDefaultReporter(): Reporter {
  return {
    format(diagnostics: Diagnostic[]): string {
      if (diagnostics.length === 0) {
        return '';
      }

      const grouped = groupByFile(diagnostics);
      const lines: string[] = [];
      for (const [filePath, fileDiags] of grouped) {
        lines.push(...formatFileGroup({ filePath, diagnostics: fileDiags }));
      }

      const errorCount = diagnostics.filter(
        (d) => d.severity === 'error'
      ).length;
      lines.push(`Found ${diagnostics.length} problems (${errorCount} errors)`);

      return lines.join('\n');
    },
  };
}
