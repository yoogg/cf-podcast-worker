import { execFileSync } from "node:child_process";
import fs from "node:fs";

function runWrangler(args) {
  const result = execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "wrangler",
    ...args,
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  return result;
}

function parseIdFromCreateOutput(text, key) {
  const re = new RegExp(`${key}\\s*=\\s*\"([^\"]+)\"`);
  const match = text.match(re);
  if (!match) {
    throw new Error(`Failed to parse ${key} from wrangler output: ${text}`);
  }
  return match[1];
}

function getKvNamespaceIdByTitle(namespaces, title) {
  const found = namespaces.find((n) => n.title === title || n.name === title);
  return found?.id;
}

const kvNamespaceName = process.env.KV_NAMESPACE_NAME || "PODCAST_DB";
const kvBinding = process.env.KV_BINDING || "PODCAST_KV";

const listRaw = runWrangler(["kv", "namespace", "list", "--json"]);
const namespaces = JSON.parse(listRaw);

let id = getKvNamespaceIdByTitle(namespaces, kvNamespaceName);
if (!id) {
  const createOut = runWrangler(["kv", "namespace", "create", kvNamespaceName]);
  id = parseIdFromCreateOutput(createOut, "id");
}

// Wrangler keeps preview namespaces separate; we create a preview namespace and use its ID.
const previewNamespaceName = `${kvNamespaceName}_preview`;
let previewId = getKvNamespaceIdByTitle(namespaces, previewNamespaceName);
if (!previewId) {
  const createPreviewOut = runWrangler([
    "kv",
    "namespace",
    "create",
    previewNamespaceName,
  ]);
  previewId = parseIdFromCreateOutput(createPreviewOut, "id");
}

const wranglerToml = fs.readFileSync("wrangler.toml", "utf8");

const updated = wranglerToml
  // replace the first kv namespace id/preview_id in file
  .replace(/\bid\s*=\s*\"[^\"]*\"/, `id = "${id}"`)
  .replace(/\bpreview_id\s*=\s*\"[^\"]*\"/, `preview_id = "${previewId}"`)
  // ensure binding matches env (optional safety)
  .replace(/\bbinding\s*=\s*\"[^\"]*\"/, `binding = "${kvBinding}"`);

fs.writeFileSync("wrangler.ci.toml", updated, "utf8");

console.log(`Using KV namespace: ${kvNamespaceName} -> ${id}`);
console.log(`Using KV preview namespace: ${previewNamespaceName} -> ${previewId}`);
console.log("Generated wrangler.ci.toml");
