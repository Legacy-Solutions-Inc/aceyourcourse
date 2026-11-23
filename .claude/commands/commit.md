---
description: Stage and commit the current changes with a Conventional Commits message (no push).
argument-hint: "[optional: what the change is, or a scope]"
---

Commit the current work. Don't push: that's `/ship`, or I push myself.

1. **Branch.** Run `git branch --show-current`. If it's `main`, stop and ask
   me for a branch name. Never commit to `main`.

2. **Look.** Run `git status --short --untracked-files=all` and
   `git diff HEAD --stat`, then read the diff itself (`git diff HEAD`, plus the
   new files). Write the message from what the code does, not from the file
   names.

3. **Choose what goes in.** Stage paths by name (`git add -- <paths>`), never
   with `git add -A` or `git add .`. Leave these out, and tell me you did:
   - `.env*` files (except `.env.example`), keys, credentials and database dumps
   - build output, logs, and anything under `test-results/` or
     `playwright-report/`
   - changes that clearly belong to other work, since parallel sessions share
     this tree

   If the changes are two or more unrelated pieces of work, propose one commit
   for each and ask me before going on. If nothing is left to commit, say so
   and stop.

4. **Check it.** Skip this step when only docs or tests changed (for tests, run
   just the changed test files). Otherwise run `pnpm lint` and `pnpm test`; the
   pre-commit hook runs `pnpm type:check`. Don't run `pnpm build` while a dev
   server is up on :3000 or :3001 (check with `lsof -i :3000 -i :3001`),
   because a build in this tree breaks it. CI builds every push. If a check
   fails, stop and show me the failure. Don't commit around it.

5. **Write the message.** commitlint (`@commitlint/config-conventional`)
   checks it.
   - **Header:** `type(scope): subject`. Choose the type from what the change
     does; don't default to `feat`.
     - `feat`: new behaviour a Member, a Staff member or a visitor can see
     - `fix`: a bug fixed, including a test that was wrong
     - `test`: tests only
     - `refactor`: same behaviour, better code
     - `perf`, `style`
     - `docs`: `docs/`, `.scratch/` notes, README or comment-only changes
     - `build`: dependencies, `next.config`, `vercel.json`
     - `ci`: `.github/`
     - `chore`: tooling, config, anything else
   - **Scope** (optional) is the area: `admin`, `member-app`, `website`,
     `auth`, `reviewer-pdfs`, `db`, `e2e` and so on.
   - **Subject:** imperative, starting lowercase, with no trailing period. Keep
     the whole header at 72 characters or fewer.
   - **Body:** add one when the subject doesn't explain why. Leave a blank line
     after the header, say why it changed and what a reader would miss, and
     wrap lines at 72 characters.
   - If I passed text with the command (`$ARGUMENTS`), use it as a hint.

6. **Commit** with a heredoc (`git commit -F - <<'EOF' … EOF`) so the message
   keeps its lines. Two hooks run:
   - pre-commit runs lint-staged (`eslint --fix`, `prettier --write` on staged
     files) and then `pnpm type:check`
   - commit-msg runs commitlint

   Never use `--no-verify`, and don't `--amend` unless I ask. If a hook fails,
   show me why:
   - If the fix is mechanical (a lint error, or a message commitlint rejects),
     make it, re-stage, and commit again.
   - If `type:check` fails on stale `.next/types` after a route moved, run
     `pnpm exec next typegen` and commit again.
   - Otherwise, stop.

7. **Report** the commit's short hash and header, the files in it, and anything
   you left out and why.
