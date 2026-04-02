import pc from 'picocolors';
import type { Diagnostic } from './diagnostics.js';
import { formatTime } from './format-time.js';
import type { RunResult } from './runner.js';

export interface Reporter {
  format(result: RunResult): string;
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

type ColorFn = (s: string) => string;

const identity: ColorFn = (s: string) => s;

function formatDiagnosticLine(opts: {
  diagnostic: Diagnostic;
  lineWidth: number;
  red: ColorFn;
  dim: ColorFn;
}): string {
  const { diagnostic: d, lineWidth, red, dim } = opts;
  const lineStr = d.line != null ? String(d.line) : '-';
  const paddedLine = lineStr.padStart(lineWidth);
  const severity = red(d.severity);
  const convention =
    d.conventionName != null ? `  ${dim(`[${d.conventionName}]`)}` : '';
  return `  ${paddedLine}  ${severity}  ${d.message}${convention}`;
}

function formatFileGroup(opts: {
  filePath: string;
  diagnostics: Diagnostic[];
  bold: ColorFn;
  red: ColorFn;
  dim: ColorFn;
}): string[] {
  const { bold, red, dim } = opts;
  const sorted = sortDiagnostics(opts.diagnostics);
  const lineWidth = maxLineWidth(sorted);
  const lines: string[] = [bold(opts.filePath)];
  for (const d of sorted) {
    lines.push(formatDiagnosticLine({ diagnostic: d, lineWidth, red, dim }));
  }
  lines.push('');
  return lines;
}

function formatSummary(opts: {
  filesChecked: number;
  violationCount: number;
  elapsed: number;
}): string {
  const { filesChecked, violationCount, elapsed } = opts;
  const fileWord = filesChecked === 1 ? 'file' : 'files';
  const checked = `Checked ${filesChecked} ${fileWord} in ${formatTime(elapsed)}.`;
  if (violationCount === 0) {
    return `${checked} No violations found.`;
  }
  const violationWord = violationCount === 1 ? 'violation' : 'violations';
  return `${checked} Found ${violationCount} ${violationWord}.`;
}

export function createJsonReporter(): Reporter {
  return {
    format(result: RunResult): string {
      const output = result.diagnostics.map((d) => {
        const obj: Record<string, unknown> = {
          severity: d.severity,
          conventionName: d.conventionName,
          filePath: d.filePath,
          predicateName: d.predicateName,
          message: d.message,
        };
        if (d.line != null) {
          obj.line = d.line;
        }
        return obj;
      });
      return JSON.stringify(output, null, 2);
    },
  };
}

export function createGithubReporter(): Reporter {
  return {
    format(result: RunResult): string {
      return result.diagnostics
        .map((d) => {
          let annotation = `::error file=${d.filePath}`;
          if (d.line != null) {
            annotation += `,line=${d.line}`;
          }
          if (d.conventionName) {
            annotation += `,title=${d.conventionName}`;
          }
          annotation += `::${d.message}`;
          return annotation;
        })
        .join('\n');
    },
  };
}

export function createMarkdownReporter(): Reporter {
  return {
    format(result: RunResult): string {
      const { diagnostics, filesChecked, elapsed } = result;
      const sections: string[] = [];

      if (diagnostics.length > 0) {
        const grouped = groupByFile(diagnostics);
        for (const [filePath, fileDiags] of grouped) {
          const sorted = sortDiagnostics(fileDiags);
          const lines: string[] = [
            `**\`${filePath}\`**`,
            '',
            '| Line | Severity | Message | Convention |',
            '|------|----------|---------|------------|',
          ];
          for (const d of sorted) {
            const lineStr = d.line != null ? String(d.line) : '-';
            const convention = d.conventionName ?? '';
            lines.push(
              `| ${lineStr} | ${d.severity} | ${d.message} | ${convention} |`
            );
          }
          sections.push(lines.join('\n'));
        }
      }

      sections.push(
        `**${formatSummary({ filesChecked, violationCount: diagnostics.length, elapsed })}**`
      );

      return sections.join('\n\n');
    },
  };
}

export function createDefaultReporter(opts?: { colors?: boolean }): Reporter {
  const useColors = opts?.colors ?? true;
  const bold = useColors ? pc.bold : identity;
  const red = useColors ? pc.red : identity;
  const dim = useColors ? pc.dim : identity;

  return {
    format(result: RunResult): string {
      const { diagnostics, filesChecked, elapsed } = result;
      const lines: string[] = [];

      if (diagnostics.length > 0) {
        const grouped = groupByFile(diagnostics);
        for (const [filePath, fileDiags] of grouped) {
          lines.push(
            ...formatFileGroup({
              filePath,
              diagnostics: fileDiags,
              bold,
              red,
              dim,
            })
          );
        }
      }

      lines.push(
        formatSummary({
          filesChecked,
          violationCount: diagnostics.length,
          elapsed,
        })
      );

      return lines.join('\n');
    },
  };
}
