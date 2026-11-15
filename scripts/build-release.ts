import { verifyUpdateManifest, type SignedUpdateManifest } from "@tarve/core";
import { spawnSync } from "node:child_process";
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import manifest from "../package.json";
import { updateManifestFile, updatePublicKey } from "../src/update-settings";

const { values, positionals: [command] } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, notes: { type: "string" }, "base-url": { type: "string" } },
});
if (command !== "build" && command !== "release") throw new Error("Use build ou release.");
const { version } = manifest;
const { name } = manifest.tarve;
const localKey = join(process.env.LOCALAPPDATA ?? ".", "PerifericosTarve", "assinatura", "tarve-update.key");
const key = process.env.TARVE_UPDATE_PRIVATE_KEY || (existsSync(localKey) ? localKey : undefined);
if (!key) throw new Error("A chave de assinatura do Periféricos não foi encontrada.");
const privateKey = createPrivateKey({
  key: Buffer.from((existsSync(key) ? readFileSync(key, "utf8") : key).trim(), "base64"),
  format: "der",
  type: "pkcs8",
});
const publicKey = createPublicKey(privateKey).export({ format: "jwk" });
if (publicKey.crv !== "Ed25519" || !publicKey.x || Buffer.from(publicKey.x, "base64url").toString("base64") !== updatePublicKey) {
  throw new Error("A chave de assinatura não corresponde à chave pública do Periféricos.");
}
const root = join(import.meta.dir, "..");
// TARVE_CLI: a Tarve checkout's packages/core/cli.ts instead of the installed package.
const cli = process.env.TARVE_CLI || join(root, "node_modules", "@tarve", "core", "dist", "npm", "cli.js");
const env = { ...process.env, TARVE_UPDATE_PRIVATE_KEY: key };
const common = ["src/main.tsx", "--runtime", "txiki", "--native-features", "core"];
function tarve(...args: string[]): void {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tarve ${args[0]} retornou ${result.status ?? "um erro"}.`);
}

// The installer is a Tarve app too (`tarve package --format setup`), configured by
// package.json `tarve.installer`: wizard, Start menu entry, Apps & features, hooks.
function installer(host: string, out: string): void {
  tarve("package", host, "--format", "setup", "--entry", "src/main.tsx", "--runtime", "txiki",
    "--native-features", "core", "--version", version, "--out", out);
}

if (command === "build") {
  tarve("build", ...common, "--packs", "--version", version, "--outfile", join(values.out ?? "dist", "Perifericos.exe"));
} else {
  const out = resolve(root, values.out ?? join("releases", version));
  const staging = mkdtempSync(join(tmpdir(), "perifericos-release-"));
  const release = join(staging, "release");
  const host = join(staging, "Perifericos.exe");
  const pack = join(staging, "Perifericos.tarve");
  try {
    tarve("build", ...common, "--packs", "--version", version, "--outfile", host);
    tarve("pack", ...common, "--version", version, "--outfile", pack);
    tarve("release", "--name", name, "--version", version, "--artifact", `win32-x64=${host}`,
      "--pack", pack, "--public-key", updatePublicKey, "--out", release,
      ...(values.notes ? ["--notes", values.notes] : []), ...(values["base-url"] ? ["--base-url", values["base-url"]] : []));

    const envelope = JSON.parse(readFileSync(join(release, updateManifestFile), "utf8")) as SignedUpdateManifest;
    const update = verifyUpdateManifest(envelope, updatePublicKey);
    const artifact = update.platforms["win32-x64"];
    const incremental = update.packs?.["win32-x64"]?.txiki;
    if (!artifact || !incremental) throw new Error("A release precisa do executável e do pacote incremental para Windows x64.");
    const exeName = `Perifericos-${version}-win32-x64.exe`;
    const packName = `Perifericos-${version}-win32-x64-txiki.tarve`;
    const packUrlName = incremental.url.slice(incremental.url.lastIndexOf("/") + 1);
    // GitHub normalizes asset names. The pack still records the app name internally.
    incremental.url = incremental.url.slice(0, -packUrlName.length) + packName;
    const payload = JSON.stringify(update);
    const signature = sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64");
    const signed = { payload, signature };
    verifyUpdateManifest(signed, updatePublicKey);
    mkdirSync(out, { recursive: true });
    installer(host, out);
    copyFileSync(join(release, exeName), join(out, exeName));
    copyFileSync(pack, join(out, packName));
    writeFileSync(join(out, updateManifestFile), JSON.stringify(signed, null, 2) + "\n");
    console.log(`Release pronta em ${out}`);
  } finally {
    const stagePath = resolve(staging);
    const stagePrefix = join(resolve(tmpdir()), "perifericos-release-");
    if (stagePath.startsWith(stagePrefix)) rmSync(stagePath, { recursive: true, force: true });
  }
}
