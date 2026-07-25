---
description: Write tests that could actually fail
argument-hint: "<file or symbol>"
---
Write tests for: $@

First read the existing tests in this repo and match their framework, layout, and naming exactly. Do not introduce a new test library.

Prioritise, in this order:
1. Boundaries: empty, one, many, maximum, off-by-one at each edge.
2. Error paths, including partial failure and cleanup.
3. Inputs the implementation clearly did not consider.
4. The happy path, last and briefly.

Rules:
- A test that cannot fail is worse than no test. Skip trivial getters and pass-through wrappers.
- No mocking of the thing under test. Mock only at real I/O boundaries.
- Each test name states the behaviour and the condition, not the function name.
- Run the tests. If any fail, report whether the test or the implementation is wrong before changing either.
