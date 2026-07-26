---
description: Explain how something actually works, by reading it
argument-hint: "<file, symbol or question>"
---
Explain: $@

Ground every claim in the code as it exists in this repository. Read it first; do not answer from familiarity with the library or from the name of the thing.

Structure:
1. What it does, in two sentences.
2. The path a real call takes through it, naming the files and functions in order.
3. The parts that are not obvious from reading: implicit ordering, invariants held elsewhere, error paths, anything load-bearing that looks incidental.
4. What breaks it — the inputs or states it does not handle.

If the code contradicts its own comments or naming, say so and trust the code. If you cannot find something, say what you searched for rather than guessing.
