# Wahj Learning Hub Agent Workflow

## Roles

- Codex is the implementation agent.
- ChatGPT is the architecture, review, and debugging supervisor.

## Working rule

Codex should implement, test, and verify changes directly in this repository. If Codex hits a blocker after two repair attempts, it must stop and prepare a handoff document for ChatGPT instead of guessing further or making risky changes.

## Blocker triggers

Create `docs/chatgpt-handoff-current.md` and stop when any of these occurs:

- `Unsupported action` from the Sequence Analysis backend
- backend route mismatch or deployment uncertainty
- page loads but buttons do not work
- hardcoded demo data appears in live mode
- sequence cleaner returns `0 bp` for a valid sequence
- BLAST result is biologically implausible because stale or demo data leaked into live mode
- homepage, NGS page, or Real-Time PCR page is broken
- reader counter or comments are at risk
- tests fail after two fix attempts
- rollback safety or backup state could be damaged

## Handoff rule

When blocked, Codex must create `docs/chatgpt-handoff-current.md` by following [docs/chatgpt-handoff-template.md](/Users/mahmoodalmoalm/Documents/New%20project/wahj-ngs-guide/docs/chatgpt-handoff-template.md).

The user will paste that handoff into ChatGPT. ChatGPT should then return one exact next-step Codex repair prompt. Codex should resume from that prompt, not from fresh guesses.

## Safety constraints

- Do not delete rollback files, backup branches, backup tags, or backup archives unless the user explicitly asks.
- Do not push unless the user explicitly approves push or deployment.
- Prefer small commits after successful stages.
