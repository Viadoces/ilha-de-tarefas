// Ponte com o Tauri. Fora dele (npm run dev no navegador) usa localStorage,
// o que permite mexer na interface sem compilar o app.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fakeClaude } from "./fakeClaude";
import type { NoteFile } from "./snippets";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const LS_KEY = "ilha-dados";

/** `docked` = colada no topo (notch); `up` = o painel abre para cima. */
export interface Placement { docked: boolean; up: boolean }
const TOP: Placement = { docked: true, up: false };

export interface ClaudeLine { run: number; line: string }
export interface ClaudeDone { run: number; code: number | null; stderr: string }

/** Enquanto um diálogo nativo está aberto a janela perde o foco, mas a ilha não deve recolher. */
let modals = 0;
export const isModalOpen = () => modals > 0;

/** `listen` do Tauri devolve uma Promise; aqui vira um "parar de ouvir" síncrono. */
function subscribe<T>(event: string, cb: (payload: T) => void): () => void {
  let stop: (() => void) | undefined;
  let cancelled = false;
  listen<T>(event, (e) => cb(e.payload)).then((un) => (cancelled ? un() : (stop = un)));
  return () => {
    cancelled = true;
    stop?.();
  };
}

export const native = {
  async setExpanded(expanded: boolean): Promise<Placement> {
    return isTauri ? invoke<Placement>("set_expanded", { expanded }) : TOP;
  },

  async placement(): Promise<Placement> {
    return isTauri ? invoke<Placement>("placement") : TOP;
  },

  /** Arrasta a janela com o mouse; ao soltar chega um `island-placed`. */
  async dragIsland() {
    if (isTauri) await invoke("drag_island");
  },

  /** Volta a ilha para o topo; a nova situação chega por `onPlaced`. */
  async resetPosition(expanded: boolean) {
    if (isTauri) await invoke("reset_position", { expanded });
  },

  onPlaced(cb: (p: Placement) => void): () => void {
    return isTauri ? subscribe("island-placed", cb) : () => {};
  },

  async load(): Promise<string | null> {
    return isTauri ? invoke<string | null>("load_data") : localStorage.getItem(LS_KEY);
  },

  async save(json: string) {
    if (isTauri) await invoke("save_data", { json });
    else localStorage.setItem(LS_KEY, json);
  },

  async dataLocation(): Promise<string> {
    return isTauri ? invoke<string>("data_location") : "localStorage do navegador";
  },

  async findVault(): Promise<string | null> {
    return isTauri ? invoke<string | null>("find_vault") : "demo";
  },

  async listVaults(): Promise<string[]> {
    return isTauri ? invoke<string[]>("list_vaults") : ["C:/Users/voce/Documents/Obsidian Vault"];
  },

  async pickFolder(): Promise<string | null> {
    if (!isTauri) return null;
    modals++;
    try {
      return await invoke<string | null>("pick_folder");
    } finally {
      modals--;
    }
  },

  claude: {
    async find(): Promise<string | null> {
      return isTauri ? invoke<string | null>("claude_find") : "demo";
    },
    async send(run: number, prompt: string, cwd: string, session: string | null, opts: { model?: string; effort?: string; permission?: string } = {}) {
      if (isTauri) {
        await invoke("claude_send", {
          run, prompt, cwd, session,
          model: opts.model || null,
          effort: opts.effort || null,
          permission: opts.permission || null,
        });
      } else {
        fakeClaude.send(run, prompt);
      }
    },
    async stop() {
      if (isTauri) await invoke("claude_stop");
      else fakeClaude.stop();
    },
    async forget(session: string) {
      if (isTauri) await invoke("claude_forget", { session });
    },
    onLine(cb: (p: ClaudeLine) => void) {
      return isTauri ? subscribe("claude-line", cb) : fakeClaude.on("line", cb);
    },
    onDone(cb: (p: ClaudeDone) => void) {
      return isTauri ? subscribe("claude-done", cb) : fakeClaude.on("done", cb);
    },
  },

  async readVault(root: string): Promise<NoteFile[]> {
    if (isTauri) return invoke<NoteFile[]>("read_vault", { root });
    const teste = Object.values(import.meta.glob<{ default: NoteFile[] }>("./__vault_teste.json"));
    return teste.length ? (await teste[0]()).default : (await import("./demoVault")).demoVault;
  },

  async openInObsidian(vaultRoot: string, file: string) {
    const vault = vaultRoot.split(/[\\/]/).filter(Boolean).pop() ?? "";
    const url = `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file.replace(/\.md$/i, ""))}`;
    await this.openLink(url);
  },

  /** Abre links obsidian:// e http(s):// no programa padrão. */
  async openLink(url: string) {
    if (isTauri) await invoke("open_link", { url });
    else console.info("abrir:", url);
  },

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Alternativa quando a API de área de transferência não está disponível.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  },

  async quit() {
    if (isTauri) await invoke("quit");
  },

  /** Chama `cb` quando a janela perde o foco. Retorna a função para parar de ouvir. */
  onBlur(cb: () => void): () => void {
    if (!isTauri) {
      window.addEventListener("blur", cb);
      return () => window.removeEventListener("blur", cb);
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => !focused && cb())
      .then((un) => (cancelled ? un() : (stop = un)));
    return () => {
      cancelled = true;
      stop?.();
    };
  },

  autostart: {
    async get(): Promise<boolean | null> {
      if (!isTauri) return null;
      const { isEnabled } = await import("@tauri-apps/plugin-autostart");
      return isEnabled();
    },
    async set(on: boolean) {
      const m = await import("@tauri-apps/plugin-autostart");
      await (on ? m.enable() : m.disable());
    },
  },
};
