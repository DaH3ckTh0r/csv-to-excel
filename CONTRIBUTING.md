# Contributing

Thanks for helping improve **csv-to-excel**!

## Ground rules

- The TypeScript and Python versions are **feature-equivalent**. A behavior change in one should land in the other in the same pull request.
- Both projects share the same BDD spec (`features/convert.feature`). Edit it in one project and copy it to the other; CI fails if either side's step definitions don't match.
- Every change needs tests: a unit test for the logic, plus a BDD scenario when the change is user-visible.

## Workflow

1. Fork and create a branch: `git checkout -b feat/my-change`
2. Make your change and run the full check for the project(s) you touched:
   - TypeScript: `cd src/typescript && npm run test:all`
   - Python: `cd src/python && ruff check . && ruff format --check . && mypy && pytest && behave`
3. Update `CHANGELOG.md` under **Unreleased**.
4. Open a pull request. CI runs both projects on Linux and Windows.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
