import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { native } from "../lib/native";
import type { Store } from "../lib/useData";
import { DEFAULT_PERMISSION } from "../lib/claudeOptions";
import { Check, External, Folder } from "./icons";
import { PermissionChoice } from "./ModelPicker";

const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

/** Primeira execução: escolher o vault do Obsidian e conferir o Claude Code. */
export function Onboarding({ store }: { store: Store }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [vaults, setVaults] = useState<string[] | null>(null);
  const [chosen, setChosen] = useState(store.data?.settings?.vaultPath?.trim() || "");
  const [claude, setClaude] = useState<boolean | undefined>(undefined);
  const [permission, setPermission] = useState(store.data?.settings?.claudePermission || DEFAULT_PERMISSION);

  useEffect(() => {
    native.listVaults().then((v) => {
      setVaults(v);
      setChosen((c) => c || v[0] || "");
    }).catch(() => setVaults([]));
  }, []);

  const checkClaude = () => {
    setClaude(undefined);
    native.claude.find().then((p) => setClaude(!!p)).catch(() => setClaude(false));
  };
  useEffect(checkClaude, []);

  const pick = async () => {
    const dir = await native.pickFolder().catch(() => null);
    if (dir) setChosen(dir);
  };

  const finish = () => store.setSettings({ onboarded: true, vaultPath: chosen, claudePermission: permission });
  const options = vaults ? (chosen && !vaults.includes(chosen) ? [...vaults, chosen] : vaults) : [];

  return (
    <div className="onboard">
      <AnimatePresence mode="wait" initial={false}>
        {step === 0 ? (
          <motion.div key="vault" className="onboard-step" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.16 }}>
            <h1>Bem-vindo à Ilha</h1>
            <p className="lead">Suas tarefas do mês num canto da tela, junto das suas notas do Obsidian e do Claude. Onde estão as notas?</p>

            <div className="choices">
              {vaults === null && <div className="faint">Procurando vaults…</div>}
              {vaults?.length === 0 && !chosen && <div className="faint">Nenhum vault do Obsidian encontrado neste computador.</div>}
              {options.map((v) => (
                <button key={v} className={`choice${chosen === v ? " on" : ""}`} onClick={() => setChosen(v)}>
                  <span className="radio">{chosen === v && <Check />}</span>
                  <span className="choice-text"><b>{baseName(v)}</b><small>{v}</small></span>
                </button>
              ))}
              <button className="ghost pick" onClick={pick}><Folder /> Escolher outra pasta…</button>
            </div>

            <div className="onboard-actions">
              <button className="ghost" onClick={() => { setChosen(""); setStep(1); }}>Pular</button>
              <span className="spacer" />
              <button className="primary" disabled={!chosen} onClick={() => setStep(1)}>Continuar</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="claude" className="onboard-step" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.16 }}>
            <h1>Claude</h1>
            <p className="lead">A aba Claude conversa com o seu vault usando o Claude Code deste computador e a sua assinatura do Claude.</p>

            <div className={`status-card${claude ? " ok" : ""}`}>
              {claude === undefined ? (
                <span className="faint">Procurando o Claude Code…</span>
              ) : claude ? (
                <><span className="radio on"><Check /></span> Claude Code encontrado</>
              ) : (
                <div>
                  <b>Claude Code não encontrado</b>
                  <p className="faint">Instale, abra um terminal e rode <code>claude</code> uma vez para fazer login. Dá para fazer isso depois.</p>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => native.openLink("https://claude.com/claude-code")}>Como instalar <External /></button>
                    <button className="ghost" onClick={checkClaude}>Verificar de novo</button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-label">O que o Claude pode fazer</div>
            <PermissionChoice value={permission} onChange={setPermission} />
            {permission === "bypassPermissions" && (
              <p className="warn">Com acesso total ele mexe em qualquer arquivo do computador e roda comandos sem pedir confirmação.</p>
            )}
            <p className="faint small">Dá para mudar depois no botão de modelo da aba Claude.</p>

            <div className="onboard-actions">
              <button className="ghost" onClick={() => setStep(0)}>Voltar</button>
              <span className="spacer" />
              <button className="primary" onClick={finish}>Começar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
