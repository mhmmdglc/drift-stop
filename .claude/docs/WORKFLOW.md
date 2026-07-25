# DriftStop — how work gets done

This project uses a fixed agent pipeline. The point is that nothing reaches the store on the strength of "it compiles."

## The agents

| Agent | Owns | Never does |
|---|---|---|
| `project-manager` | Intake, clarifying questions, the written spec + acceptance criteria, work split, triage of QA findings, the loop until done | Touch product code |
| `ux-designer` | Information hierarchy, placement, copy, conversion flow, states, accessibility, both themes | Structural component rewrites (specs them instead) |
| `frontend-dev` | `src/app`, `src/components`, `src/hooks`, `src/i18n`, `src/locales`, `src/utils`, `src/widgets` | Claim UI works — only that it compiles and tests pass |
| `backend-dev` | `supabase/`, `src/services`, `src/db`, `src/lib`, `scripts/` | Weaken the entitlement/RLS model; run account-auth steps |
| `code-reviewer` | Reading the diff for silent no-ops, leaks, platform hazards, state bugs | Fix anything |
| `qa-tester` | Driving the real app on simulator/emulator, verifying every criterion, filing reproducible bugs | Fix anything; claim untestable paths pass |
| `release-manager` | Pre-build audit, EAS build, store submission, post-release doc hygiene | Skip the env-var audit; call an unsubmitted upload "shipped" |

## The loop

```
user request
   │
   ▼
project-manager ──► asks the blocking questions ──► user answers
   │                                                   │
   │◄──────────────────────────────────────────────────┘
   ▼
writes .claude/specs/<feature>.md (goal, scope, acceptance criteria, risks, DoD)
   │
   ├──► ux-designer      (if any UI surface is involved)
   ├──► frontend-dev     ─┐
   └──► backend-dev      ─┤ (may run in parallel when independent)
                          │
                          ▼
                    code-reviewer  ──► findings ──┐
                          │                       │
                          ▼                       │
                     qa-tester                    │
                          │                       │
              ┌───────────┴───────────┐           │
              ▼                       ▼           │
        all criteria PASS        any FAIL ────────┤
              │                                   │
              │                                   ▼
              │                         back to project-manager,
              │                         who triages and re-dispatches
              │                                   │
              │                                   └──► (loop)
              ▼
      release-manager ──► pre-build audit ──► build ──► submit ──► docs updated
```

The loop does not exit on "the code is written." It exits when `qa-tester` returns `RELEASE-READY: yes` with every acceptance criterion marked PASS, and anything untestable is explicitly recorded as unverified rather than assumed.

## Rules that bind every agent

1. **Docs before code.** `PRODUCT.md`, `ARCHITECTURE.md`, `OPERATIONS.md`, `TODO.md` are the source of truth for questions of fact. If a doc disagrees with the code, that is a finding to raise — not a thing to quietly work around.
2. **Docs stay true.** Any change that makes a doc wrong must update the doc in the same piece of work.
3. **Expo SDK 56 is not the Expo you remember.** Read `https://docs.expo.dev/versions/v56.0.0/` before using an Expo API.
4. **Say what you did not verify.** Every report separates observed from assumed. "Not verified" is an acceptable answer; a false "done" is not.
5. **User actions are named, not implied.** Creating credentials, granting permissions, entering passwords, dragging the AAB into Play Console — these belong to the account owner. List them as explicit blockers with the owner named.
6. **Never invent prices, SKUs, or store copy implying a price.**

## Invoking it

Either say what you want and let the pipeline run, or name an agent directly (`@agent-qa-tester run the regression sweep`).

For a one-line change — a typo, a copy tweak, a version bump — skip the pipeline. It is there for work with a real chance of breaking something.
