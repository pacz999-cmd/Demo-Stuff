const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".sfdx",
  ".sf",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "coverage",
  ".next",
]);
const DARWIN_DATA_PREFIX = "/System/Volumes/Data";

function canonicalizePath(inputPath) {
  if (!inputPath) return inputPath;
  let resolved = inputPath;
  try {
    resolved = fs.realpathSync.native(inputPath);
  } catch (_error) {
    resolved = inputPath;
  }
  if (resolved.startsWith(`${DARWIN_DATA_PREFIX}/`)) {
    return resolved.slice(DARWIN_DATA_PREFIX.length);
  }
  return resolved;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function walkForFile(startDir, fileName, found = []) {
  if (!fs.existsSync(startDir)) return found;
  let entries = [];
  try {
    entries = fs.readdirSync(startDir, { withFileTypes: true });
  } catch (_error) {
    // Permission denied or transient FS issues: skip this directory.
    return found;
  }
  for (const entry of entries) {
    const full = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walkForFile(full, fileName, found);
      }
      continue;
    }
    if (entry.isFile() && entry.name === fileName) {
      found.push(full);
    }
  }
  return found;
}

function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function hashId(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function listSalesforceProjects(scanRoots) {
  const projectRoots = new Set();
  for (const root of scanRoots) {
    const matches = walkForFile(root, "sfdx-project.json");
    for (const match of matches) {
      const rawRoot = path.dirname(match);
      projectRoots.add(canonicalizePath(rawRoot));
    }
  }
  return Array.from(projectRoots).sort();
}

function collectComponents(projectRoot) {
  const components = [];
  const defaultDir = path.join(projectRoot, "force-app", "main", "default");
  if (!fs.existsSync(defaultDir)) return components;

  const lwcRoot = path.join(defaultDir, "lwc");
  if (fs.existsSync(lwcRoot)) {
    for (const entry of fs.readdirSync(lwcRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(lwcRoot, entry.name);
      components.push({
        metadataType: "lwc",
        name: entry.name,
        sourcePath: dirPath,
        copyMode: "directory",
      });
    }
  }

  function walkMetadata(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walkMetadata(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(defaultDir, full);
      if (rel.startsWith(`lwc${path.sep}`)) continue;

      const basename = path.basename(full);
      let metadataType = null;
      if (basename.endsWith(".cls")) metadataType = "apexClass";
      else if (basename.endsWith(".flow-meta.xml")) metadataType = "flow";
      else if (basename.endsWith(".object-meta.xml")) metadataType = "customObject";
      else if (basename.endsWith(".permissionset-meta.xml")) metadataType = "permissionSet";
      else if (rel.includes(`${path.sep}digitalExperiences${path.sep}`))
        metadataType = "experienceBundle";
      else if (basename.endsWith(".page-meta.xml")) metadataType = "flexipage";
      else if (basename.endsWith(".app-meta.xml")) metadataType = "customApp";

      if (!metadataType) continue;
      const name = basename.replace(/(\.flow-meta\.xml|\.object-meta\.xml|\.permissionset-meta\.xml|\.page-meta\.xml|\.app-meta\.xml|\.cls)$/, "");
      components.push({
        metadataType,
        name,
        sourcePath: full,
        copyMode: "file",
      });
    }
  }

  walkMetadata(defaultDir);
  return components;
}

function copyFileOrDirectory(sourcePath, targetPath, copyMode) {
  ensureDir(path.dirname(targetPath));
  if (copyMode === "directory") {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  } else {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

module.exports = {
  ROOT,
  ensureDir,
  readJson,
  writeJson,
  slugify,
  hashId,
  listSalesforceProjects,
  collectComponents,
  copyFileOrDirectory,
  canonicalizePath,
};
