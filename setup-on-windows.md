# Putting this repository on D:\

1. Extract `fitsphere.zip` so you get `D:\fitsphere\CLAUDE.md` (not `D:\fitsphere\fitsphere\...`).
2. Open PowerShell or Git Bash:

   ```powershell
   cd D:\fitsphere
   git init
   git add .
   git commit -m "docs: initial pre-development documentation"
   ```

3. Start Claude Code from the repo root:

   ```powershell
   cd D:\fitsphere
   claude
   ```

4. Run the read-only review prompt from `docs/pre-development-guide.md` §9 before any coding.

You can delete this file after setup.
