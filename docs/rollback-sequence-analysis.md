# Sequence Analysis Rollback Checkpoint

- Original branch: `main`
- Original commit SHA: `11b7c8009535af341298a9eab4621bbcacfe3f9b`
- Backup branch: `backup/before-sequence-analysis-20260518-005700`
- Backup tag: `backup-before-sequence-analysis-20260518-005700`
- Backup zip path: `/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide-backups/sequence-analysis-20260518-005700/wahj-ngs-guide-before-sequence-analysis-20260518-005700.zip`
- Preserved local backup path: `/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide.local-backup-20260518-003435`

## Exact Rollback Commands

```bash
git checkout main
git reset --hard 11b7c8009535af341298a9eab4621bbcacfe3f9b
```

## Warning

Do not run `git clean -fd` unless you understand that it deletes untracked files inside the repo.

## Safer Restore Option

```bash
git checkout backup/before-sequence-analysis-20260518-005700
```
