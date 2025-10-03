# E-commerce Personalization Monorepo

One-command dev environment for a real-time personalized e-commerce app: Next.js storefront, Node.js API gateway, Flask recommendations microservice, PostgreSQL, MongoDB, Stripe Checkout, and Socket.IO.

## Quick start (local dev without Docker)

Prereqs: Node 20 + pnpm, Python 3.11, local PostgreSQL and MongoDB running.

```bash
cd ecommerce-personalization

# Install Node dependencies (creates the workspace node_modules/ tree)
pnpm install

# Install Python dependencies for the recommendation service (optional)
pnpm setup:recs          # runs "python -m pip install -r apps/recs/requirements.txt"

# Create local envs (copy examples and adjust as needed)
# apps/api/.env -> see values in infra/.env.example but use localhost
# apps/web/.env -> NEXT_PUBLIC_API_BASE=http://127.0.0.1:4000/api

# Start API + Web in parallel (safe even if Python deps are missing)
pnpm dev

# Start everything, including the recommender (requires pip install step)
pnpm dev:all

# In another terminal, apply migrations and seed
pnpm migrate
pnpm seed
```

- Web (Next.js): http://localhost:3000
- API (Express): http://localhost:4000/api
- Recs (Flask): http://127.0.0.1:5000/health (only when `pnpm dev:all` is running)

If `pnpm dev:web` reports missing binaries such as `next`, re-run `pnpm install` in the
repository root to (re)create the workspace `node_modules/` directory before starting
the dev servers.

## Docker (prod-like) startup

```bash
docker compose -f infra/docker-compose.yml --project-name ecommerce up --build
```

## Scripts

```bash
# Seed demo data in local dev
yarn seed # or pnpm seed

# Run tests
pnpm -r test
```

See `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/RUNBOOK.md`.

## Publishing the latest work branch

This repository currently tracks day-to-day development on the `work` branch. If you
need the changes on your GitHub account, create the remote branch and push it up, then
merge it into `main` when ready:

```bash
# From your local checkout
git checkout work
git pull --rebase                     # ensure the branch is up to date
git push origin work                  # creates the branch on the remote

# Fast-forward main to include the work that landed on work
git checkout main
git pull                              # sync the remote state
git merge --ff-only work              # or open a PR from work -> main
git push origin main
```

If the repository on GitHub does not yet have a `main` branch, you can publish it directly
from `work` with `git push origin work:main`. Once the branches exist remotely, protect
`main` and continue iterating on `work` via pull requests.

### Troubleshooting: `git pull` but no new files

If `git pull` reports "Already up to date" yet you do not see the checkout or shipping
changes locally, double-check the following:

1. Confirm you are on the `work` branch locally.
   ```bash
   git status -sb
   # Expect to see "## work" at the top
   ```
2. Make sure the remote branch exists and has the latest commit.
   ```bash
   git fetch origin                      # updates your knowledge of the remote
   git branch -rv | grep work            # shows the remote HEAD commit for work
   ```
   The commit hash should match the latest `feat: expand checkout flow with shipping support`
   commit (`9cc977d`).
3. If the remote branch is missing, publish it from your local checkout.
   ```bash
   git push origin work
   ```
4. If the remote is up to date but files are still missing, ensure you cloned the correct
   repository URL (run `git remote -v`) and that no sparse checkout is configured
   (`git config core.sparseCheckout` should be empty).
5. As a last resort, re-clone the repository or delete the local branch and fetch it again:
   ```bash
   git checkout main
   git branch -D work
   git fetch origin work:work
   git checkout work
   ```

Following the above steps will align your local checkout with the committed milestone 3
changes.

## Environments

Copy `infra/.env.example` to `.env` for local overrides if needed. Secrets should be injected via environment (not committed).
