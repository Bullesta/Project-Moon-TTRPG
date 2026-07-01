/**
 * Local dev helper — not part of the main build pipeline.
 *
 * Setup (once):
 *   copy tools\deploy.example.mjs        -> tools\deploy.mjs
 *   copy tools\watch-and-deploy.example.mjs -> tools\watch-and-deploy.mjs
 *   copy example.foundry-config.yaml     -> foundry-config.yaml  (set dataPath)
 *
 * Usage (instead of `npm run watch`):
 *   node tools/watch-and-deploy.mjs
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");

let deployTimer;
let deploying = false;

function runDeploy() {
	if (deploying) return;
	deploying = true;
	const child = spawn("node", ["./tools/deploy.mjs"], {
		cwd: root,
		stdio: "inherit",
		shell: true,
	});
	child.on("close", () => { deploying = false; });
}

function scheduleDeploy() {
	clearTimeout(deployTimer);
	deployTimer = setTimeout(runDeploy, 400);
}

function watchDist() {
	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
	}
	fs.watch(distDir, { recursive: true }, () => scheduleDeploy());
}

console.log("Starting gulp watch with auto-deploy to Foundry...");
console.log("Press Ctrl+C to stop.\n");

const gulp = spawn("npm", ["run", "gulp"], {
	cwd: root,
	stdio: "inherit",
	shell: true,
});

watchDist();

gulp.on("close", (code) => process.exit(code ?? 0));

process.on("SIGINT", () => {
	gulp.kill("SIGINT");
	process.exit(0);
});
