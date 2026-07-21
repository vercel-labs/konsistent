---
"@konsistent/convention": patch
"konsistent": patch
---

fix(konsistent): match variable-depth `**` alongside `{placeholder}` segments and glob-style `excludeFiles` patterns

`**` in a `paths` pattern next to a `{placeholder}` segment previously only matched a single intermediate directory level instead of every depth, because placeholder extraction required the pattern and path to have the same number of segments. `excludeFiles` entries prefixed with `**/` were silently ignored for the same reason. Path matching now backtracks through variable-depth `**` segments when extracting placeholders and when matching `excludeFiles` glob patterns, so both now behave as documented.
