import type { Diagnostic } from './diagnostics.js';

export interface Reporter {
  format(diagnostics: Diagnostic[]): string;
}

export function createDefaultReporter(): Reporter {
  return {
    format(diagnostics: Diagnostic[]): string {
      if (diagnostics.length === 0) {
        return '';
      }

      const grouped = new Map<string, Diagnostic[]>();
      for (const d of diagnostics) {
        const existing = grouped.get(d.filePath);
        if (existing) {
          existing.push(d);
        } else {
          grouped.set(d.filePath, [d]);
        }
      }

      const lines: string[] = [];
      for (const [filePath, fileDiags] of grouped) {
        lines.push(filePath);
        for (const d of fileDiags) {
          const line = d.line ?? '-';
          lines.push(`  ${line}  ${d.severity}  ${d.message}`);
        }
        lines.push('');
      }

      const errorCount = diagnostics.filter(
        (d) => d.severity === 'error'
      ).length;
      lines.push(`Found ${diagnostics.length} problems (${errorCount} errors)`);

      return lines.join('\n');
    },
  };
}
