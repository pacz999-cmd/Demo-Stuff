# Salesforce Component Catalog (Local-First)

This local tool helps you build a reusable Salesforce component catalog while preventing intake from unapproved sources.

## How source filtering works

- Scan roots are defined in `config/approved-sources.json`.
- Only projects listed in `allowedProjectRoots` are allowed.
- Components from any other source are ignored.
- If `allowedProjectRoots` is empty, all discovered Salesforce projects are included.
- `reviewMetadataTypes` controls which metadata types appear in the checklist (currently `lwc` only).
- `excludeAlreadyApproved` controls whether already imported source paths are removed from future review checklists.

## Review workflow (checkbox-based)

1. Generate a fresh review list:
   - `npm run catalog:review:generate`
2. Open `reports/review-checklist.md`.
   - Each line format is: `[ ] componentName | /absolute/source/folder/path`
3. Mark components to include by switching:
   - `[ ] ...`
   - to `[x] ...`
4. Apply selection:
   - `npm run catalog:review:apply`

Only checked components are copied to `catalog/approved/` and written to `index/approved-components.json`.

## Artifacts

- `reports/review-checklist.md` - your manual checklist
- `reports/discovered-projects.json` - projects discovered and filtered
- `reports/applied-summary.md` - what was imported after review
- `index/candidates.json` - all candidates from approved sources
- `index/approved-components.json` - final approved set

## Notes

- Start local-only as requested; no GitHub steps are executed by these scripts.
- You can add additional source projects by appending absolute paths to `allowedProjectRoots`.
