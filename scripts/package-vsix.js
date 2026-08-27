const { execSync } = require("child_process");
const { mkdirSync } = require("fs");
const path = require("path");
const version = require("../package.json").version;

const outDir = path.join(__dirname, "..", "vsix");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `kitchen-co-mcp-${version}.vsix`);

execSync(`npx vsce package --out "${outFile}"`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
