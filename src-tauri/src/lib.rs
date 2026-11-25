mod claude;
mod position;

use std::{fs, path::PathBuf};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use position::COLLAPSED;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

fn data_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("dados.json"))
}

#[tauri::command]
fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let path = data_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

/// Grava num arquivo temporário e renomeia, para nunca deixar o JSON pela metade.
#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    let path = data_file(&app)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_location(app: AppHandle) -> Result<String, String> {
    data_file(&app).map(|p| p.display().to_string())
}

/// Vaults do Obsidian (de %APPDATA%\obsidian\obsidian.json), o aberto por último primeiro.
#[tauri::command]
fn list_vaults() -> Vec<String> {
    let read = || -> Option<Vec<String>> {
        let appdata = std::env::var("APPDATA").ok()?;
        let raw = fs::read_to_string(PathBuf::from(appdata).join("obsidian").join("obsidian.json")).ok()?;
        let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
        let mut vaults: Vec<(bool, String)> = json
            .get("vaults")?
            .as_object()?
            .values()
            .filter_map(|v| {
                let open = v.get("open").and_then(|o| o.as_bool()) == Some(true);
                Some((open, v.get("path")?.as_str()?.to_string()))
            })
            .collect();
        vaults.sort_by_key(|(open, _)| !open);
        Some(vaults.into_iter().map(|(_, p)| p).collect())
    };
    read().unwrap_or_default()
}

#[tauri::command]
fn find_vault() -> Option<String> {
    list_vaults().into_iter().next()
}

/// Seletor de pasta nativo do Windows, preso à janela da ilha.
#[tauri::command]
async fn pick_folder(window: WebviewWindow) -> Option<String> {
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Pasta do vault do Obsidian")
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.display().to_string())
}

#[derive(serde::Serialize)]
struct NoteFile {
    path: String,
    content: String,
}

/// Todas as notas .md do vault, menos pastas ocultas (.obsidian, .trash…). Só leitura.
#[tauri::command]
fn read_vault(root: String) -> Result<Vec<NoteFile>, String> {
    let root = PathBuf::from(root);
    if !root.is_dir() {
        return Err(format!("Pasta do vault não encontrada: {}", root.display()));
    }
    let mut notes = Vec::new();
    let mut pending = vec![root.clone()];
    while let Some(dir) = pending.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue; // .obsidian, .trash etc.
            }
            if path.is_dir() {
                pending.push(path);
                continue;
            }
            if !name.to_lowercase().ends_with(".md") {
                continue;
            }
            // Ignora arquivos gigantes (> 2 MB) para não travar a ilha.
            if entry.metadata().map(|m| m.len() > 2_000_000).unwrap_or(true) {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else { continue };
            let rel = path.strip_prefix(&root).unwrap_or(&path);
            notes.push(NoteFile {
                path: rel.to_string_lossy().replace('\\', "/"),
                content,
            });
        }
    }
    Ok(notes)
}

/// Abre um link no programa padrão. Só aceita obsidian://, http:// e https://.
#[tauri::command]
fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    if !["obsidian://", "http://", "https://"].iter().any(|p| url.starts_with(p)) {
        return Err("link inválido".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(claude::ClaudeState::default())
        .manage(position::AnchorState::default())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            position::set_expanded,
            position::drag_island,
            position::reset_position,
            position::placement,
            load_data,
            save_data,
            data_location,
            find_vault,
            list_vaults,
            pick_folder,
            read_vault,
            claude::claude_find,
            claude::claude_send,
            claude::claude_stop,
            claude::claude_forget,
            open_link,
            quit
        ])
        .setup(|app| {
            // Obs.: no Tauri 2.12/Windows, criar a janela com `visible(false)` ou
            // `skip_taskbar(true)` falha ("identificador da janela é inválido").
            // Por isso ela nasce visível fora da tela e some da barra de tarefas depois.
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Ilha de Tarefas")
                .inner_size(COLLAPSED.0, COLLAPSED.1)
                .position(-10_000.0, -10_000.0)
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .always_on_top(true)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .build()?;
            win.set_skip_taskbar(true)?;
            position::load(app.handle());
            position::place(&win, COLLAPSED, position::current(app.handle()))?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a Ilha de Tarefas");
}
