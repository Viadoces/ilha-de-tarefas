// Onde a ilha fica na tela. Ela pode ser arrastada para qualquer lugar; perto da borda de
// cima ela "gruda" e vira um notch. O painel abre para baixo, ou para cima se não couber.
use std::sync::Mutex;
use std::{fs, path::PathBuf, thread, time::Duration};
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

/// Tamanhos (lógicos) da janela: a pílula fechada e o painel aberto.
/// A janela é transparente; o desenho preto é feito no front-end.
pub const COLLAPSED: (f64, f64) = (216.0, 38.0);
pub const EXPANDED: (f64, f64) = (468.0, 640.0);
/// Distância (lógica) da borda de cima em que a ilha gruda no topo.
const SNAP: f64 = 28.0;

/// Centro horizontal e topo da pílula, em pixels físicos. `None` = topo do monitor, centralizada.
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct Anchor {
    cx: i32,
    y: i32,
}

#[derive(Default)]
pub struct AnchorState(Mutex<Option<Anchor>>);

#[derive(Clone, serde::Serialize)]
pub struct Placement {
    /// Colada na borda de cima (desenha as "orelhas" do notch).
    docked: bool,
    /// O painel abre para cima.
    up: bool,
}

fn anchor_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("posicao.json"))
}

pub fn load(app: &AppHandle) {
    let saved = anchor_file(app)
        .and_then(|f| fs::read_to_string(f).ok())
        .and_then(|raw| serde_json::from_str::<Anchor>(&raw).ok());
    if let Ok(mut a) = app.state::<AnchorState>().0.lock() {
        *a = saved;
    }
}

fn save(app: &AppHandle, anchor: Option<Anchor>) {
    if let Ok(mut a) = app.state::<AnchorState>().0.lock() {
        *a = anchor;
    }
    let Some(file) = anchor_file(app) else { return };
    match anchor {
        Some(a) => {
            let _ = fs::write(file, serde_json::to_string(&a).unwrap_or_default());
        }
        None => {
            let _ = fs::remove_file(file);
        }
    }
}

pub fn current(app: &AppHandle) -> Option<Anchor> {
    app.state::<AnchorState>().0.lock().ok().and_then(|a| *a)
}

/// Monitor que contém o ponto; se nenhum, o da janela ou o principal.
fn monitor_at(win: &WebviewWindow, x: i32, y: i32) -> Option<Monitor> {
    let inside = |m: &Monitor| {
        let (p, s) = (m.position(), m.size());
        x >= p.x && x < p.x + s.width as i32 && y >= p.y && y < p.y + s.height as i32
    };
    win.available_monitors()
        .ok()
        .and_then(|ms| ms.into_iter().find(inside))
        .or_else(|| win.current_monitor().ok().flatten())
        .or_else(|| win.primary_monitor().ok().flatten())
}

/// Dimensiona e posiciona a janela a partir da âncora, sem sair do monitor.
pub fn place(win: &WebviewWindow, (w, h): (f64, f64), anchor: Option<Anchor>) -> tauri::Result<Placement> {
    let fallback = win.current_monitor()?.or(win.primary_monitor()?);
    let monitor = match anchor {
        Some(a) => monitor_at(win, a.cx, a.y),
        None => fallback,
    };
    let Some(m) = monitor else {
        win.set_size(tauri::LogicalSize::new(w, h))?;
        return Ok(Placement { docked: true, up: false });
    };
    let (mp, ms, scale) = (m.position(), m.size(), m.scale_factor());
    let (mx, my, mw, mh) = (mp.x, mp.y, ms.width as i32, ms.height as i32);
    let (wpx, hpx) = ((w * scale).round() as i32, (h * scale).round() as i32);
    let pill_h = (COLLAPSED.1 * scale).round() as i32;

    let cx = anchor.map(|a| a.cx).unwrap_or(mx + mw / 2);
    let top = anchor.map(|a| a.y).unwrap_or(my).clamp(my, (my + mh - pill_h).max(my));
    let docked = top == my;
    let up = !docked && top + hpx > my + mh;
    let x = (cx - wpx / 2).min(mx + mw - wpx).max(mx);
    let y = if up { (top + pill_h - hpx).max(my) } else { top.min(my + mh - hpx).max(my) };

    win.set_size(PhysicalSize::new(wpx as u32, hpx as u32))?;
    win.set_position(PhysicalPosition::new(x, y))?;
    Ok(Placement { docked, up })
}

#[tauri::command]
pub fn set_expanded(app: AppHandle, window: WebviewWindow, expanded: bool) -> Result<Placement, String> {
    let placement = place(&window, if expanded { EXPANDED } else { COLLAPSED }, current(&app)).map_err(|e| e.to_string())?;
    if expanded {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(placement)
}

#[cfg(windows)]
fn mouse_down() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
    unsafe { (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0 }
}
#[cfg(not(windows))]
fn mouse_down() -> bool {
    false
}

/// Começa a arrastar a pílula. Quando o botão do mouse é solto, grava a posição,
/// encaixa no topo se estiver perto e avisa o front (`island-placed`).
#[tauri::command]
pub fn drag_island(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())?;
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(60));
        while mouse_down() {
            thread::sleep(Duration::from_millis(25));
        }
        let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) else { return };
        let cx = pos.x + size.width as i32 / 2;
        let mut y = pos.y;
        if let Some(m) = monitor_at(&window, cx, pos.y + size.height as i32 / 2) {
            let my = m.position().y;
            if ((y - my) as f64) < SNAP * m.scale_factor() {
                y = my;
            }
        }
        let anchor = Some(Anchor { cx, y });
        save(&app, anchor);
        if let Ok(p) = place(&window, COLLAPSED, anchor) {
            let _ = app.emit("island-placed", p);
        }
    });
    Ok(())
}

/// Volta para o topo, centralizada (chamado com o painel aberto, pela engrenagem).
#[tauri::command]
pub fn reset_position(app: AppHandle, window: WebviewWindow, expanded: bool) -> Result<(), String> {
    save(&app, None);
    let p = place(&window, if expanded { EXPANDED } else { COLLAPSED }, None).map_err(|e| e.to_string())?;
    app.emit("island-placed", p).map_err(|e| e.to_string())
}

/// Situação atual (para o front desenhar notch ou pílula solta ao iniciar).
#[tauri::command]
pub fn placement(app: AppHandle, window: WebviewWindow) -> Result<Placement, String> {
    place(&window, COLLAPSED, current(&app)).map_err(|e| e.to_string())
}
