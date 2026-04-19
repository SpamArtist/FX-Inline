## Worktree Policy

When Codex creates a git worktree for this repository:
- Do not create the worktree inside `.codex/`.
- Do not create the worktree anywhere inside the repository clone.
- Create the worktree in the parent directory of this repository.
- Use the path pattern `../<worktree-name>`.

Example:
`git worktree add ../feature-branch -b feature/feature-branch`
