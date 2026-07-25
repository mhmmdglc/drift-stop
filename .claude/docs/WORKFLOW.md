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

## How to see who is doing what

Three layers, because each covers a gap the others leave:

| Layer | Where you look | Shows | Lifetime |
|---|---|---|---|
| **Live** | The task list in the UI, or `/tasks` | Every task with its **owner** (the agent name) and status: pending → in_progress → completed. Running background agents appear here too. | Current session |
| **Durable** | [`WORKLOG.md`](WORKLOG.md) | One row per dispatch: date, agent, task, outcome, evidence. Written when an agent is dispatched, updated when it reports back. Append-only — corrections are new rows, never edits. | Forever, in git |
| **Proof** | `git log` | The actual change, attributed, with the reasoning in the commit body | Forever |

Conventions that make this work:

- **Every task carries an owner.** When work is dispatched, the task's `owner` is set to the agent that owns it, so the live list reads as an assignment board rather than an anonymous checklist.
- **Status is moved when it changes, not at the end.** `in_progress` goes on before the agent starts, `completed` only after its report is in.
- **Every WORKLOG row needs evidence** — a commit hash, a build id, a screenshot path, or the literal words "not verified". A row with no evidence column filled in is an unfinished row.
- **Specs are the written brief.** `.claude/specs/<feature>.md` holds what was asked and the acceptance criteria, so "was this in scope?" has an answer that does not depend on anyone's memory.

If you ever want the current picture in one shot, ask for a status report: you get the open tasks by owner, what is blocked and on whom, and what shipped since a given date.

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
