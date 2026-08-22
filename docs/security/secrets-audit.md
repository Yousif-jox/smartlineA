# Secrets Audit (Day 6, Task 82)

## Method

A secrets audit must cover **both** the working tree and the **full Git
history** — deleting a file in a new commit is not enough (the secret is still
in `git log` and recoverable with `git checkout <old-sha>`).

### 1) Working-tree scan (this repository)

Scanned every tracked file for secret-shaped values:

- `password =`, `secret =`, `api_key`, `token =` patterns with real values
- PEM blocks (`BEGIN RSA PRIVATE KEY`, `BEGIN EC PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`)
- Supabase/Postgres connection strings with embedded credentials
- `.env` / `.env.*` files (must be gitignored)

**Result: CLEAN.** The only matches are:
- `credentials_hash` — the bcrypt column definition and the seed's
  `'hash-placeholder'` (a placeholder, not a credential),
- `.env.example` — **empty values only** (no real secrets, no suspicious
  placeholders),
- test secrets (`'test-secret-not-for-production'`) — explicitly non-production
  values, standard practice.

### 2) Git-history scan (the user's repository)

The delivered zip contains **no `.git/` directory** — the audit of the pushed
history is performed by the user on their machine:

```bash
# 1) scan every commit in history for secret patterns
git log --all -p | grep -iE "(BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|postgres(ql)?://[^ ]+:[^ ]+@|password\s*=\s*['\"][^'\"]{6,}|api[_-]?key\s*=\s*['\"][^'\"]{8,})" || echo "HISTORY CLEAN"

# 2) also check what the current tree contains
git ls-files | xargs grep -l -iE "BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" 2>/dev/null || echo "TREE CLEAN"
```

If anything is found, **rewriting history is required** — not a delete commit:

```bash
# filter-repo (recommended; rewrites history, then force-push — coordinate with any other contributors first)
git filter-repo --replace-text <(echo 'SECRET_VALUE==>REDACTED')
# or the classic filter-branch
git filter-branch --tree-filter 'rm -f .env' -- --all
git push --force-with-lease origin main
```

After rewrites, **rotate the leaked credential** — rewriting history removes
the bytes from the repo, but anyone who already cloned it still has them.

### 3) Prevent future leaks

- `.gitignore` already covers `.env` and `node_modules` — verify locally with `git status` before every push.
- `pre-commit` hook (optional): run the grep above on staged files and block
  the commit on a match.

## Evidence for the signoff

- [x] Working tree scanned — no secrets (grep output in this doc's method)
- [x] `.env.example` ships with empty values only
- [x] Git history scan instructions + rewrite procedure documented
- [ ] User runs the history scan on their pushed repo and records the result here

## Interview one-liner

> "Deleting a secret in a new commit doesn't work — it stays in every clone's
> history. The audit covers the tree AND `git log --all`, and the fix for a
> found secret is history rewrite plus rotation, because rewriting can't
> un-leak a credential from clones that already exist."
