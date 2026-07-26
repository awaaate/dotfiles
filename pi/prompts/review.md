---
description: Review staged changes for bugs, not style
argument-hint: "[focus]"
---
Review the staged changes (`git diff --cached`). If nothing is staged, review `git diff` instead and say so.

Focus on defects that survive a careless reading:
- Logic that is wrong for a specific input, not merely unusual. Give the input.
- Error paths that swallow, mask, or mislabel a failure.
- State that can be observed half-updated, and concurrency assumptions that are not enforced.
- Resources that leak on the error path but not the happy path.
- Security: injection, path traversal, secrets in logs, permissions widened.

${1:+Pay particular attention to: $1}

Rules:
- Do NOT report formatting, naming, or stylistic preference.
- For each finding give file:line, the concrete input or sequence that breaks it, and the resulting behaviour.
- If you are unsure whether something is a real defect, say so explicitly rather than padding the list.
- If the diff is clean, say it is clean. Do not invent findings.
