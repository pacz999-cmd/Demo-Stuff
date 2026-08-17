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

function walkFiles(dir, collected = []) {
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, collected);
    } else if (entry.isFile()) {
      collected.push(full);
    }
  }
  return collected;
}

function kebabToCamel(value) {
  return value.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function parseLwcDependencies(lwcDir) {
  const deps = {
    apexClasses: new Set(),
    staticResources: new Set(),
    lwcComponents: new Set(),
  };
  const files = walkFiles(lwcDir);
  const apexPattern = /@salesforce\/apex\/([A-Za-z0-9_]+)\.[A-Za-z0-9_]+/g;
  const resourcePattern = /@salesforce\/resourceUrl\/([A-Za-z0-9_]+)/g;
  const lwcImportPattern = /from\s+['"]c\/([A-Za-z0-9_]+)['"]/g;
  const lwcHtmlTagPattern = /<c-([a-z0-9][a-z0-9-]*)\b/g;

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (![".js", ".ts", ".html"].includes(ext)) continue;
    let text = "";
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (_error) {
      continue;
    }

    for (const match of text.matchAll(apexPattern)) {
      deps.apexClasses.add(match[1]);
    }
    for (const match of text.matchAll(resourcePattern)) {
      deps.staticResources.add(match[1]);
    }
    for (const match of text.matchAll(lwcImportPattern)) {
      deps.lwcComponents.add(match[1]);
    }
    for (const match of text.matchAll(lwcHtmlTagPattern)) {
      deps.lwcComponents.add(kebabToCamel(match[1]));
    }
  }

  return deps;
}

function collectLwcDependencyRecords(rootLwcItem) {
  const projectRoot = rootLwcItem.projectRoot;
  const defaultDir = path.join(projectRoot, "force-app", "main", "default");
  const lwcRoot = path.join(defaultDir, "lwc");
  const staticResourcesRoot = path.join(defaultDir, "staticresources");

  const records = [];
  const visitedLwcNames = new Set([rootLwcItem.name]);
  const queue = [rootLwcItem.name];

  while (queue.length > 0) {
    const lwcName = queue.shift();
    const lwcPath = path.join(lwcRoot, lwcName);
    if (!fs.existsSync(lwcPath)) continue;

    const deps = parseLwcDependencies(lwcPath);

    for (const depName of deps.lwcComponents) {
      if (visitedLwcNames.has(depName)) continue;
      const depPath = path.join(lwcRoot, depName);
      if (!fs.existsSync(depPath)) continue;
      visitedLwcNames.add(depName);
      queue.push(depName);
      records.push({
        metadataType: "lwc",
        name: depName,
        sourcePath: depPath,
        projectRoot,
        copyMode: "directory",
        dependencyOf: rootLwcItem.name,
        dependencyKind: "lwcImport",
      });
    }

    for (const className of deps.apexClasses) {
      const clsPath = path.join(defaultDir, "classes", `${className}.cls`);
      if (!fs.existsSync(clsPath)) continue;
      records.push({
        metadataType: "apexClass",
        name: className,
        sourcePath: clsPath,
        projectRoot,
        copyMode: "file",
        dependencyOf: rootLwcItem.name,
        dependencyKind: "apexImport",
      });
    }

    for (const resourceName of deps.staticResources) {
      const packedResourceFile = path.join(staticResourcesRoot, `${resourceName}.resource`);
      const unpackedResourceDir = path.join(staticResourcesRoot, resourceName);
      const metaFile = path.join(staticResourcesRoot, `${resourceName}.resource-meta.xml`);
      if (
        !fs.existsSync(packedResourceFile) &&
        !fs.existsSync(unpackedResourceDir) &&
        !fs.existsSync(metaFile)
      ) {
        continue;
      }
      if (fs.existsSync(unpackedResourceDir)) {
        records.push({
          metadataType: "staticResource",
          name: resourceName,
          sourcePath: unpackedResourceDir,
          projectRoot,
          copyMode: "directory",
          dependencyOf: rootLwcItem.name,
          dependencyKind: "staticResourceImport",
        });
      } else if (fs.existsSync(packedResourceFile)) {
        records.push({
          metadataType: "staticResource",
          name: resourceName,
          sourcePath: packedResourceFile,
          projectRoot,
          copyMode: "file",
          dependencyOf: rootLwcItem.name,
          dependencyKind: "staticResourceImport",
        });
      }
      if (fs.existsSync(metaFile)) {
        records.push({
          metadataType: "staticResourceMeta",
          name: `${resourceName}.resource-meta`,
          sourcePath: metaFile,
          projectRoot,
          copyMode: "file",
          dependencyOf: rootLwcItem.name,
          dependencyKind: "staticResourceImport",
        });
      }
    }
  }

  return records;
}

function copyCatalogRecord(item) {
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
  return targetPath;
}

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

let rootItems = [];
if (checkedIds.length > 0) {
  rootItems = checkedIds.map((id) => byId.get(id)).filter(Boolean);
} else if (fs.existsSync(indexPath)) {
  const existingApproved = readJson(indexPath);
  rootItems = existingApproved
    .filter((item) => item && item.metadataType === "lwc" && !item.isDependency)
    .map((item) => ({
      id: item.id || `root-${item.name}-${item.sourcePath}`,
      name: item.name,
      metadataType: item.metadataType,
      sourcePath: item.sourcePath,
      projectRoot: item.projectRoot,
      copyMode: item.copyMode || "directory",
    }));
  if (rootItems.length > 0) {
    console.log(
      `No checked items found. Syncing dependencies for existing approved LWCs: ${rootItems.length}`
    );
  }
}

if (rootItems.length === 0) {
  console.log("No checked items found. Nothing applied.");
  process.exit(0);
}

const approvedItems = [];
const copiedKeys = new Set();
for (const item of rootItems) {
  if (!item) continue;

  const itemKey = `${item.metadataType}|${item.sourcePath}`;
  if (copiedKeys.has(itemKey)) continue;
  copiedKeys.add(itemKey);
  const targetPath = copyCatalogRecord(item);

  approvedItems.push({
    id: item.id,
    name: item.name,
    metadataType: item.metadataType,
    sourcePath: item.sourcePath,
    targetPath,
    projectRoot: item.projectRoot,
    copyMode: item.copyMode,
    isDependency: false,
  });

  if (item.metadataType === "lwc") {
    const dependencies = collectLwcDependencyRecords(item);
    for (const dep of dependencies) {
      const depKey = `${dep.metadataType}|${dep.sourcePath}`;
      if (copiedKeys.has(depKey)) continue;
      copiedKeys.add(depKey);
      const depTargetPath = copyCatalogRecord(dep);
      approvedItems.push({
        id: `dep-${depKey}`,
        name: dep.name,
        metadataType: dep.metadataType,
        sourcePath: dep.sourcePath,
        targetPath: depTargetPath,
        projectRoot: dep.projectRoot,
        copyMode: dep.copyMode,
        isDependency: true,
        dependencyOf: dep.dependencyOf,
        dependencyKind: dep.dependencyKind,
      });

      if (dep.metadataType === "apexClass") {
        const apexMetaPath = `${dep.sourcePath}-meta.xml`;
        if (fs.existsSync(apexMetaPath)) {
          const apexMetaKey = `apexClassMeta|${apexMetaPath}`;
          if (!copiedKeys.has(apexMetaKey)) {
            copiedKeys.add(apexMetaKey);
            const apexMetaRecord = {
              metadataType: "apexClassMeta",
              name: `${dep.name}.cls-meta`,
              sourcePath: apexMetaPath,
              projectRoot: dep.projectRoot,
              copyMode: "file",
              dependencyOf: dep.dependencyOf,
              dependencyKind: dep.dependencyKind,
            };
            const apexMetaTargetPath = copyCatalogRecord(apexMetaRecord);
            approvedItems.push({
              id: `dep-${apexMetaKey}`,
              name: apexMetaRecord.name,
              metadataType: apexMetaRecord.metadataType,
              sourcePath: apexMetaRecord.sourcePath,
              targetPath: apexMetaTargetPath,
              projectRoot: apexMetaRecord.projectRoot,
              copyMode: apexMetaRecord.copyMode,
              isDependency: true,
              dependencyOf: apexMetaRecord.dependencyOf,
              dependencyKind: apexMetaRecord.dependencyKind,
            });
          }
        }
      }
    }
  }
}

approvedItems.sort((a, b) => {
  if (a.metadataType !== b.metadataType) return a.metadataType.localeCompare(b.metadataType);
  return a.name.localeCompare(b.name);
});

writeJson(indexPath, approvedItems);

const lines = [];
lines.push("# Applied Catalog Selection");
lines.push("");
const selectedRoots = approvedItems.filter((x) => !x.isDependency).length;
const dependencyCount = approvedItems.filter((x) => x.isDependency).length;
lines.push(`Selected components: ${selectedRoots}`);
lines.push(`Auto-added dependencies: ${dependencyCount}`);
lines.push("");
for (const item of approvedItems) {
  if (item.isDependency) {
    lines.push(
      `- ${item.metadataType} | ${item.name} | dependencyOf=${item.dependencyOf} (${item.dependencyKind}) | source=${item.sourcePath} | target=${item.targetPath}`
    );
  } else {
    lines.push(`- ${item.metadataType} | ${item.name} | source=${item.sourcePath} | target=${item.targetPath}`);
  }
}
lines.push("");
fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

console.log(`Applied selections: ${selectedRoots}`);
console.log(`Auto-added dependencies: ${dependencyCount}`);
console.log(`Approved index: ${indexPath}`);
