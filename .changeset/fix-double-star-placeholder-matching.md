---
"@konsistent/convention": patch
"konsistent": patch
---

fix(konsistent): match variable-depth `**` alongside `{placeholder}` segments and glob-style `excludeFiles` patterns

`**` in a `paths` pattern next to a `{placeholder}` segment previously only matched a single intermediate directory level instead of every depth, because placeholder extraction required the pattern and path to have the same number of segments. `excludeFiles` entries prefixed with `**/` were silently ignored for the same reason. Path matching now backtracks through variable-depth `**` segments when extracting placeholders and when matching `excludeFiles` glob patterns, so both now behave as documented.

`excludeFiles` glob matching now delegates to picomatch, so it also correctly supports brace alternation (`{a,b}`) and character classes (`[ab]`), matching the same glob syntax `paths` resolves through. It no longer treats a `{name}` segment as a capturing placeholder: a brace group with no comma or range is matched literally, since `excludeFiles` patterns are plain glob patterns rather than placeholder patterns.
