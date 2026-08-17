const fs = require("fs");
const path = require("path");
const {
  ROOT,
  ensureDir,
  readJson,
  writeJson,
  hashId,
  canonicalizePath,
  listSalesforceProjects,
  collectComponents,
} = require("./catalog-lib");

const configPath = path.join(ROOT, "config", "approved-sources.json");
const reportsDir = path.join(ROOT, "reports");
const indexDir = path.join(ROOT, "index");
const approvedIndexPath = path.join(indexDir, "approved-components.json");

ensureDir(reportsDir);
ensureDir(indexDir);

if (!fs.existsSync(configPath)) {
  throw new Error(`Missing config file: ${configPath}`);
}

const config = readJson(configPath);
const scanRoots = config.scanRoots || [];
const allowedProjects = new Set(
  (config.allowedProjectRoots || []).map((p) => canonicalizePath(path.resolve(p)))
);
const includeAllDiscovered = allowedProjects.size === 0;
const reviewMetadataTypes = new Set(config.reviewMetadataTypes || ["lwc"]);
const excludedPathSubstrings = config.excludedPathSubstrings || [];
const excludeAlreadyApproved = config.excludeAlreadyApproved !== false;
const approvedSourcePaths = new Set();

if (excludeAlreadyApproved && fs.existsSync(approvedIndexPath)) {
  const approved = readJson(approvedIndexPath);
  for (const item of approved) {
    if (item && item.sourcePath) {
      approvedSourcePaths.add(canonicalizePath(item.sourcePath));
    }
  }
}

const discoveredProjects = listSalesforceProjects(scanRoots).map((p) => canonicalizePath(path.resolve(p)));
const candidates = [];
const seenCandidateKeys = new Set();

for (const projectRoot of discoveredProjects) {
  if (!includeAllDiscovered && !allowedProjects.has(projectRoot)) {
    continue;
  }
  const components = collectComponents(projectRoot);
  for (const component of components) {
    if (!reviewMetadataTypes.has(component.metadataType)) {
      continue;
    }
    const normalizedSourcePath = canonicalizePath(component.sourcePath);
    if (excludedPathSubstrings.some((s) => normalizedSourcePath.includes(s))) {
      continue;
    }
    if (excludeAlreadyApproved && approvedSourcePaths.has(normalizedSourcePath)) {
      continue;
    }
    const dedupeKey = `${projectRoot}::${component.metadataType}::${component.name}::${normalizedSourcePath}`;
    if (seenCandidateKeys.has(dedupeKey)) {
      continue;
    }
    seenCandidateKeys.add(dedupeKey);
    const id = hashId(dedupeKey);
    candidates.push({
      id,
      metadataType: component.metadataType,
      name: component.name,
      sourcePath: normalizedSourcePath,
      projectRoot,
      copyMode: component.copyMode,
    });
  }
}

candidates.sort((a, b) => {
  if (a.metadataType !== b.metadataType) return a.metadataType.localeCompare(b.metadataType);
  return a.name.localeCompare(b.name);
});

const checklistLines = [];
checklistLines.push("# Catalog Review Checklist");
checklistLines.push("");
checklistLines.push("Mark `[x]` for components you want in the catalog.");
checklistLines.push("");
for (const c of candidates) {
  checklistLines.push(`- [ ] ${c.name} | ${c.sourcePath}`);
}
checklistLines.push("");

const checklistPath = path.join(reportsDir, "review-checklist.md");
fs.writeFileSync(checklistPath, checklistLines.join("\n"), "utf8");

writeJson(path.join(indexDir, "candidates.json"), candidates);
writeJson(path.join(reportsDir, "discovered-projects.json"), {
  scanRoots,
  allowedProjectRoots: Array.from(allowedProjects),
  includeAllDiscovered,
  reviewMetadataTypes: Array.from(reviewMetadataTypes),
  excludedPathSubstrings,
  excludeAlreadyApproved,
  approvedSourcePathsCount: approvedSourcePaths.size,
  discoveredProjects,
  includedProjects: includeAllDiscovered
    ? discoveredProjects
    : discoveredProjects.filter((p) => allowedProjects.has(p)),
});

console.log(`Generated checklist: ${checklistPath}`);
console.log(`Candidates found from approved sources: ${candidates.length}`);
