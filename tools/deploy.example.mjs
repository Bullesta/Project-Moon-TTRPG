import * as fs from "fs";
import yaml from "js-yaml";
import path from "path";

const DIST = "dist";

if (!fs.existsSync("foundry-config.yaml")) {
	console.log("No foundry-config.yaml found, skipping deploy. Copy example.foundry-config.yaml to foundry-config.yaml and set dataPath to enable this.");
	process.exit(0);
}

const config = yaml.load(fs.readFileSync("foundry-config.yaml", "utf-8"));

if (!config.dataPath) {
	console.log("foundry-config.yaml has no dataPath set, skipping deploy.");
	process.exit(0);
}

if (!fs.existsSync(path.join(DIST, "system.json"))) {
	console.error("dist/system.json not found — run a build first.");
	process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, "system.json"), "utf-8"));
const target = path.join(config.dataPath, "systems", manifest.id);

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(DIST, target, { recursive: true });

console.log(`Deployed ${manifest.id}@${manifest.version} -> ${target}`);
