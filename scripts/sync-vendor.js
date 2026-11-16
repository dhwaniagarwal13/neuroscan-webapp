// Copies pinned front-end assets from node_modules into webapp/static/vendor so the Flask app
// works offline. Use --check to verify they are up to date without writing anything.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vendor = path.join(root, "webapp", "static", "vendor");
const assets = [
  // [package, file inside package, destination folder, destination name]
  ["bootstrap", "dist/css/bootstrap.min.css", "bootstrap", "bootstrap.min.css"],
  ["bootstrap", "dist/js/bootstrap.bundle.min.js", "bootstrap", "bootstrap.bundle.min.js"],
  ["bootstrap", "LICENSE", "bootstrap", "LICENSE"],
  ["@fontsource-variable/bricolage-grotesque", "files/bricolage-grotesque-latin-wght-normal.woff2", "fonts", "bricolage-grotesque-latin-wght-normal.woff2"],
  ["@fontsource-variable/bricolage-grotesque", "LICENSE", "fonts", "LICENSE-bricolage-grotesque.txt"],
  ["@fontsource/ibm-plex-mono", "files/ibm-plex-mono-latin-400-normal.woff2", "fonts", "ibm-plex-mono-latin-400-normal.woff2"],
  ["@fontsource/ibm-plex-mono", "files/ibm-plex-mono-latin-500-normal.woff2", "fonts", "ibm-plex-mono-latin-500-normal.woff2"],
  ["@fontsource/ibm-plex-mono", "LICENSE", "fonts", "LICENSE-ibm-plex-mono.txt"],
];
const check = process.argv.includes("--check");

let stale = 0;
for (const [pkg, from, dir, name] of assets) {
  const srcPath = path.join(root, "node_modules", pkg, from);
  if (!fs.existsSync(srcPath)) {
    console.error(`${pkg} is not installed. Run: npm install`);
    process.exit(1);
  }
  const src = fs.readFileSync(srcPath);
  const destDir = path.join(vendor, dir);
  const dest = path.join(destDir, name);
  const same = fs.existsSync(dest) && fs.readFileSync(dest).equals(src);
  if (check) {
    console.log(`${same ? "ok   " : "STALE"} ${dir}/${name}`);
    if (!same) stale++;
  } else if (!same) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(dest, src);
    console.log(`updated ${dir}/${name}`);
  } else {
    console.log(`up to date ${dir}/${name}`);
  }
}
process.exit(stale ? 1 : 0);
