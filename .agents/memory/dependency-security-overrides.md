---
name: Workspace dependency security overrides
description: Durable guidance for remediating transitive npm vulnerabilities in this workspace.
---

When a security advisory affects a transitive npm dependency and its parent package has not yet released a safe version, enforce a patched minimum through the workspace-level pnpm override, then regenerate the lockfile.

**Why:** Security advisories can be published after the dependency graph was locked, while the direct parent may still resolve the vulnerable version.

**How to apply:** Confirm the patched floor from the audit output, use a root override instead of editing generated lockfile entries by hand, run a frozen install, and verify both `pnpm audit` and `pnpm why` report only patched versions.