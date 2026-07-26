---
description: Find performance problems by measuring, not guessing
argument-hint: "[target]"
---
Investigate the performance of: ${@:-the thing most likely to be slow in this project}

Measure before claiming anything. A profile, a timing, an operation count — something reproducible, with the command shown.

Report per finding:
- The measurement, with the command that produced it.
- Where the time actually goes, in the code.
- Complexity in terms of the input that grows in practice, not the theoretical worst case.
- The expected gain from fixing it, and the cost in complexity.

Rules:
- Do not micro-optimise anything that is not on a hot path you have measured.
- Explicitly say when the honest answer is "this is fast enough".
- Prefer removing work over doing the same work faster.
