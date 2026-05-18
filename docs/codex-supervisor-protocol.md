# Codex + ChatGPT Supervisor Protocol

This repository uses a two-agent workflow:

1. The user asks ChatGPT for a feature or repair prompt.
2. The user gives that prompt to Codex.
3. Codex edits the repository, runs tests, and verifies behavior locally.
4. If Codex resolves the issue, Codex reports the result and stops unless asked to continue.
5. If Codex is blocked after two repair attempts, Codex creates `docs/chatgpt-handoff-current.md`.
6. The user pastes that handoff into ChatGPT.
7. ChatGPT reviews the evidence and returns one precise next-step Codex repair prompt.
8. Codex applies that prompt, tests again, and either resolves the issue or creates a new handoff if still blocked.
9. Push, merge, or deployment happens only after explicit user approval.

## When Codex must stop and hand off

- backend route mismatch
- unsupported Apps Script action
- page loads but interaction is broken
- demo data contaminates live results
- biologically implausible BLAST output suggests stale state
- sequence cleaning fails for valid input
- two unsuccessful repair attempts on the same bug
- rollback protection could be damaged

## Required handoff quality

The handoff must be concrete. It should include:

- the exact branch and commit
- the rollback checkpoint references
- the exact frontend action names
- the exact backend action names
- the current backend URL state
- the commands and tests already run
- the precise user-visible symptom
- the best current hypothesis

The goal is to let ChatGPT return one actionable Codex prompt instead of a general discussion.
