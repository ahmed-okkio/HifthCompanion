# Orchestrated implementation workflow

How features go from idea to merged code in this repo. Two skills drive it:
`grill-with-docs` (plan) and `implement` (build). The skills hold the operating instructions; this
doc is the project-facing overview and the contract everyone agrees to.

## The pipeline

```
  idea
   │
   ▼
/grill-with-docs   ── relentless Q&A (one question at a time, AskUser options,
   │                   recommended answer each), explore codebase to answer what it can
   │
   ├─► docs/prd/NNNN-<slug>.md            (PRD: decisions table, scope, security, non-goals)
   └─► docs/prd/NNNN-<slug>-contract.md   (acceptance contract: behaviors with stable IDs,
   │                                        written BEFORE any code)
   ▼
/implement docs/prd/NNNN-<slug>.md
   │
   ▼
ORCHESTRATOR (serial loop, one subagent at a time)
   │  per milestone:
   │   1. write worker brief (goal, files, contract IDs in scope, constraints)
   │   2. spawn 1 WORKER  ──► implements ──► diff receipt
   │   3. spawn 1 VALIDATOR (fresh context) ──► PASS/FAIL/BLOCKED per contract ID + evidence
   │   4. FAIL → new worker (fix brief) → new validator → repeat
   │      PASS → next milestone
   ▼
all contract IDs PASS → done
```

## Roles

| Role | Who | Can write? | Context | Job |
|------|-----|-----------|---------|-----|
| **Orchestrator** | main thread (`/implement`) | plans, briefs | full | Owns plan + sequencing. The **only** messenger. Never writes feature code, never validates own work. |
| **Worker** | spawned agent | yes | given a tight brief | Implements one milestone slice, returns a diff receipt. |
| **Validator** | spawned agent, **new each time** | no (read/run only) | cold — sees only the contract + how to test | Judges the slice against the contract. Reports per-ID. Fixes nothing. |

## Non-negotiable rules

1. **Strictly serial** — exactly one worker *or* validator in flight at a time. No parallel fan-out.
2. **Orchestrator mediates everything** — workers and validators never talk to each other.
3. **Validators are fresh context every time** — bias-free acceptance. A worker never grades its own
   work; a validator is never reused.
4. **The contract is written before the code** and is not edited to make a test pass. Amending it is
   a deliberate, user-approved decision (orchestrator asks via AskUser).
5. **Security-critical contract IDs block** the milestone on any FAIL.
6. **Done means validated** — a fresh validator's PASS with evidence, not the orchestrator's opinion.

## Why

- Serial + small slices keep blast radius and history legible.
- Separating the writer from the judge stops self-grading.
- A pre-written contract makes tests acceptance criteria, not a mirror of the implementation.

## See also

- Skill: `grill-with-docs` (planning + doc emission)
- Skill: `implement` (orchestrator operating instructions)
- Worked example: `docs/prd/0003-set-edit-sharing.md` + `…-contract.md`
</content>
