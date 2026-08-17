const fs = require("fs");
const path = require("path");
const {
  ROOT,
  ensureDir,
  readJson,
  writeJson,
  slugify,
  copyFileOrDirectory,
} = require("./catalog-lib");

const checklistPath = path.join(ROOT, "reports", "review-checklist.md");
const candidatesPath = path.join(ROOT, "index", "candidates.json");
const approvedRoot = path.join(ROOT, "catalog", "approved");
const indexPath = path.join(ROOT, "index", "approved-components.json");
const reportPath = path.join(ROOT, "reports", "applied-summary.md");

if (!fs.existsSync(checklistPath)) {
  throw new Error("Checklist not found. Run `npm run catalog:review:generate` first.");
}
if (!fs.existsSync(candidatesPath)) {
  throw new Error("Candidates index not found. Run `npm run catalog:review:generate` first.");
}

const candidates = readJson(candidatesPath);
const byId = new Map(candidates.map((c) => [c.id, c]));
const checklist = fs.readFileSync(checklistPath, "utf8").split(/\r?\n/);

const checkedIds = [];
for (const line of checklist) {
  const checked = /^\s*-\s*\[[xX]\]\s+/.test(line);
  if (!checked) continue;
  const match = line.match(/^\s*-\s*\[[xX]\]\s+([^|]+)\s+\|\s+(.+)\s*$/);
  if (!match) continue;
  const parsedName = match[1].trim();
  const parsedSourcePath = match[2].trim();
  const candidate = candidates.find(
    (c) => c.name === parsedName && c.sourcePath === parsedSourcePath
  );
  if (candidate) checkedIds.push(candidate.id);
}

if (checkedIds.length === 0) {
  console.log("No checked items found. Nothing applied.");
  process.exit(0);
}

const approvedItems = [];
for (const id of checkedIds) {
  const item = byId.get(id);
  if (!item) continue;

  const projectSlug = slugify(path.basename(item.projectRoot));
  const targetBase = path.join(approvedRoot, item.metadataType, projectSlug);
  let targetPath = "";

  if (item.copyMode === "directory") {
    targetPath = path.join(targetBase, item.name);
  } else {
    const ext = path.extname(item.sourcePath);
    targetPath = path.join(targetBase, `${item.name}${ext}`);
  }

  copyFileOrDirectory(item.sourcePath, targetPath, item.copyMode);

  approvedItems.push({
    id: item.id,
    name: item.name,
    metadataType: item.metadataType,
    sourcePath: item.sourcePath,
    targetPath,
    projectRoot: item.projectRoot,
    copyMode: item.copyMode,
  });
}

approvedItems.sort((a, b) => {
  if (a.metadataType !== b.metadataType) return a.metadataType.localeCompare(b.metadataType);
  return a.name.localeCompare(b.name);
});

writeJson(indexPath, approvedItems);

const lines = [];
lines.push("# Applied Catalog Selection");
lines.push("");
lines.push(`Selected components: ${approvedItems.length}`);
lines.push("");
for (const item of approvedItems) {
  lines.push(`- ${item.metadataType} | ${item.name} | source=${item.sourcePath} | target=${item.targetPath}`);
}
lines.push("");
fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

console.log(`Applied selections: ${approvedItems.length}`);
console.log(`Approved index: ${indexPath}`);
