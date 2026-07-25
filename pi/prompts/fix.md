---
description: Diagnose an error before changing anything
argument-hint: "<error text or command>"
---
Diagnose this: $@

Work in this order and do not skip ahead:
1. Reproduce it. Run the failing thing yourself and paste the real output. If you cannot reproduce it, say so and stop — do not fix by inspection.
2. Find the actual cause by reading the code on the failure path. State it in one sentence.
3. Only then propose the fix, and say what it does NOT fix.
4. Apply it, re-run, and paste the real output again.

Do not paper over the symptom. If the correct fix is larger than the immediate error, say so and describe both options rather than silently choosing the small one. If the error is in a dependency and cannot be fixed here, say that instead of working around it invisibly.
