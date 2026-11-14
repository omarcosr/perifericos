import { rmSync } from "node:fs";
import { canInstallUpdate, checkForUpdate, downloadUpdate, installUpdate, type Update } from "@tarve/core";
import { updateManifestUrl, updatePublicKey } from "./update-settings";

export type UpdateView =
  | { status: "idle" | "checking" | "unpublished" | "current" | "restarting" | "installed" }
  | { status: "available"; update: Update }
  | { status: "downloading"; percent: number }
  | { status: "error"; message: string; update?: Update };

export function hasUpdate(view: UpdateView | undefined): boolean {
  return view?.status === "available" || (view?.status === "error" && !!view.update);
}

class ManifestUnavailable extends Error {}

const fetchManifest: typeof fetch = Object.assign(async (...[url, options]: Parameters<typeof fetch>) => {
  const response = await fetch(url, options);
  if (response.status === 404) {
    await response.body?.cancel();
    throw new ManifestUnavailable();
  }
  if (!response.ok) {
    await response.body?.cancel();
    return response;
  }
  // GitHub redirects the manifest to a temporary CDN URL. Resolve the signed
  // artifact paths against the stable release URL that Tarve was given.
  return new Response(response.body, { headers: response.headers });
}, { preconnect() {} });

export class AppUpdates {
  view: UpdateView = { status: "idle" };
  private readonly url = process.env.PERIFERICOS_UPDATE_URL?.trim() || updateManifestUrl;
  private operation?: AbortController;
  private stopped = false;

  constructor(private readonly onChange: (view: UpdateView) => void) {}

  private show(view: UpdateView): void {
    this.view = view;
    this.onChange(view);
  }

  private async run(timeout: number, action: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const operation = new AbortController();
    this.operation = operation;
    const timer = setTimeout(() => operation.abort(new Error("Tempo limite da atualização.")), timeout);
    try {
      await action(operation.signal);
    } finally {
      clearTimeout(timer);
      this.operation = undefined;
    }
  }

  async checkRemote(background = false): Promise<void> {
    if (this.stopped || this.operation || this.view.status === "restarting") return;
    const knownUpdate = this.view.status === "available" || this.view.status === "error" ? this.view.update : undefined;
    if (!background) this.show({ status: "checking" });
    try {
      await this.run(15_000, async signal => {
        const update = await checkForUpdate({ url: this.url, publicKey: updatePublicKey, fetch: fetchManifest, signal });
        if (this.stopped) return;
        if (!update) { this.show({ status: "current" }); return; }
        if (!canInstallUpdate(update)) {
          this.show({ status: "error", message: "A pasta de instalação está sem permissão de gravação.", update });
          return;
        }
        this.show({ status: "available", update });
      });
    } catch (error) {
      if (this.stopped) return;
      if (error instanceof ManifestUnavailable) { this.show({ status: "unpublished" }); return; }
      console.error("Consulta de atualização:", error);
      if (!background || !knownUpdate) {
        this.show({ status: "error", message: "Falha ao consultar ou validar a versão no GitHub. Tente novamente.", update: knownUpdate });
      }
    }
  }

  async install(): Promise<string | undefined> {
    if (this.stopped || this.operation || this.view.status !== "available") return undefined;
    const { update } = this.view;
    let file: string | undefined;
    let installed = false;
    this.show({ status: "downloading", percent: 0 });
    try {
      await this.run(180_000, async signal => {
        file = await downloadUpdate(update, {
          signal,
          onProgress: (received, total) => {
            const percent = Math.round(received * 100 / total);
            if (!this.stopped && this.view.status === "downloading" && percent !== this.view.percent) {
              this.show({ status: "downloading", percent });
            }
          },
        });
        if (this.stopped || signal.aborted) return;
        installUpdate(file, { restart: false });
        installed = true;
        this.show({ status: "restarting" });
      });
    } catch (error) {
      console.error("Instalação de atualização:", error);
      if (!this.stopped) this.show({ status: "error", message: "Falha ao baixar, verificar ou instalar a versão. Consulte o GitHub novamente.", update });
    } finally {
      if (file && !installed) {
        try { rmSync(file, { force: true }); } catch { /* Tarve will reuse the temporary path on retry. */ }
      }
    }
    return installed ? update.version : undefined;
  }

  stop(): void {
    this.stopped = true;
    this.operation?.abort();
  }
}
