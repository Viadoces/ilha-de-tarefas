// Aba Claude: roda o Claude Code (CLI) com a pasta do vault como diretório de trabalho
// e repassa a saída stream-json, linha a linha, para o front-end.
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::{env, fs, thread};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// Sem acentos, aspas ou % : o argumento passa pelo cmd.exe quando o claude é um .cmd do npm.
const SYSTEM: &str = "You are running inside a small always-on-top panel called Ilha, \
connected to the user's Obsidian vault (the current directory). Answer in the user's language, \
short and direct: the panel is narrow. When you mention notes, use Obsidian wiki links like [[Note name]].";

const EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];
const PERMISSIONS: [&str; 4] = ["bypassPermissions", "auto", "acceptEdits", "dontAsk"];

/// Execução em andamento: (id da execução, PID do processo).
#[derive(Default)]
pub struct ClaudeState(Mutex<Option<(u64, u32)>>);

#[derive(Clone, serde::Serialize)]
struct Line {
    run: u64,
    line: String,
}

#[derive(Clone, serde::Serialize)]
struct Done {
    run: u64,
    code: Option<i32>,
    stderr: String,
}

/// Procura o executável do Claude Code: .exe (instalador nativo) antes do .cmd (npm).
fn find() -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = env::var_os("PATH").map(|p| env::split_paths(&p).collect()).unwrap_or_default();
    if let Some(home) = env::var_os("USERPROFILE") {
        dirs.push(PathBuf::from(home).join(".local").join("bin"));
    }
    if let Some(appdata) = env::var_os("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("npm"));
    }
    ["claude.exe", "claude.cmd"]
        .iter()
        .flat_map(|name| dirs.iter().map(move |d| d.join(name)))
        .find(|p| p.is_file())
}

fn is_uuid(s: &str) -> bool {
    s.len() == 36 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

#[tauri::command]
pub fn claude_find() -> Option<String> {
    find().map(|p| p.display().to_string())
}

#[tauri::command]
pub fn claude_send(
    app: AppHandle,
    state: State<ClaudeState>,
    run: u64,
    prompt: String,
    cwd: String,
    session: Option<String>,
    model: Option<String>,
    effort: Option<String>,
    permission: Option<String>,
) -> Result<(), String> {
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    if current.is_some() {
        return Err("O Claude ainda está respondendo.".into());
    }
    let exe = find().ok_or("Claude Code não encontrado. Instale e faça login rodando `claude` num terminal.")?;
    if !PathBuf::from(&cwd).is_dir() {
        return Err(format!("Pasta do vault não encontrada: {cwd}"));
    }

    let mut cmd = Command::new(exe);
    cmd.args([
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--append-system-prompt",
        SYSTEM,
    ]);
    if let Some(s) = session.as_deref().filter(|s| is_uuid(s)) {
        cmd.args(["--resume", s]);
    }
    // Só nomes simples: o argumento pode passar pelo cmd.exe.
    if let Some(m) = model.as_deref().filter(|m| !m.is_empty() && m.chars().all(|c| c.is_ascii_alphanumeric() || "-._".contains(c))) {
        cmd.args(["--model", m]);
    }
    if let Some(e) = effort.as_deref().filter(|e| EFFORTS.contains(e)) {
        cmd.args(["--effort", e]);
    }
    // Sem tela para aprovar pedidos: o modo decide sozinho o que o Claude pode fazer.
    match permission.as_deref().filter(|p| PERMISSIONS.contains(p)) {
        Some(mode) if mode != "bypassPermissions" => cmd.args(["--permission-mode", mode]),
        _ => cmd.arg("--dangerously-skip-permissions"),
    };
    cmd.current_dir(&cwd)
        .env_remove("CLAUDECODE")
        .env_remove("CLAUDE_CODE_ENTRYPOINT")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| format!("Não consegui iniciar o Claude: {e}"))?;
    *current = Some((run, child.id()));
    drop(current);

    // O prompt vai pela entrada padrão: evita problemas de aspas/& no cmd.exe.
    let mut stdin = child.stdin.take().expect("stdin");
    thread::spawn(move || {
        let _ = stdin.write_all(prompt.as_bytes());
    });

    let mut stderr = child.stderr.take().expect("stderr");
    let err_reader = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stderr.read_to_end(&mut buf);
        let text = String::from_utf8_lossy(&buf).to_string();
        // Só o final interessa para a mensagem de erro.
        let start = text.char_indices().rev().nth(1500).map(|(i, _)| i).unwrap_or(0);
        text[start..].to_string()
    });

    let stdout = child.stdout.take().expect("stdout");
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();
        while reader.read_until(b'\n', &mut buf).map(|n| n > 0).unwrap_or(false) {
            let line = String::from_utf8_lossy(&buf).trim().to_string();
            if !line.is_empty() {
                let _ = app.emit("claude-line", Line { run, line });
            }
            buf.clear();
        }
        let code = child.wait().ok().and_then(|s| s.code());
        let stderr = err_reader.join().unwrap_or_default();
        if let Ok(mut cur) = app.state::<ClaudeState>().0.lock() {
            if cur.map(|(r, _)| r) == Some(run) {
                *cur = None;
            }
        }
        let _ = app.emit("claude-done", Done { run, code, stderr });
    });
    Ok(())
}

/// Interrompe a resposta. Mata a árvore toda (cmd.exe → node) e não só o processo direto.
#[tauri::command]
pub fn claude_stop(state: State<ClaudeState>) -> Result<(), String> {
    let Some((_, pid)) = *state.0.lock().map_err(|e| e.to_string())? else {
        return Ok(());
    };
    let mut kill = Command::new("taskkill");
    kill.args(["/PID", &pid.to_string(), "/T", "/F"]);
    #[cfg(windows)]
    kill.creation_flags(CREATE_NO_WINDOW);
    kill.output().map(|_| ()).map_err(|e| e.to_string())
}

/// Apaga o histórico que o Claude Code guarda da sessão (~/.claude/projects/*/<id>.jsonl).
#[tauri::command]
pub fn claude_forget(session: String) -> Result<(), String> {
    if !is_uuid(&session) {
        return Err("sessão inválida".into());
    }
    let base = match env::var_os("CLAUDE_CONFIG_DIR") {
        Some(dir) => PathBuf::from(dir),
        None => PathBuf::from(env::var_os("USERPROFILE").ok_or("USERPROFILE ausente")?).join(".claude"),
    };
    let Ok(projects) = fs::read_dir(base.join("projects")) else { return Ok(()) };
    for project in projects.flatten() {
        let dir = project.path();
        let file = dir.join(format!("{session}.jsonl"));
        if file.is_file() {
            fs::remove_file(&file).map_err(|e| e.to_string())?;
        }
        let extra = dir.join(&session); // subagentes etc.
        if extra.is_dir() {
            let _ = fs::remove_dir_all(extra);
        }
    }
    Ok(())
}
