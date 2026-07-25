---
description: Write a commit message for the staged changes
argument-hint: "[extra context]"
---
Read `git diff --cached` and write a commit message for it.

- Subject line in the imperative, under 72 characters, no trailing period.
- Then a blank line, then a body explaining WHY the change is being made and what the alternative was, not a restatement of the diff. The diff already says what changed.
- If the change fixes a bug, state the failure it produced, concretely.
- If a decision in the diff looks arbitrary but is not, explain the constraint that forced it.
- No marketing adjectives, no "improved" or "enhanced" without saying measured how.
- Mention anything a reader would be surprised by, including things deliberately NOT done.

${1:+Additional context: $1}

Output only the commit message, ready to paste. Do not run `git commit`.
