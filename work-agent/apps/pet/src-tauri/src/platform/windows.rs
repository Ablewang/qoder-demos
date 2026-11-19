use super::Frame;
use std::{path::Path, process::Command};
pub fn window_frames() -> Result<Vec<Frame>, String> { Err("unsupported".into()) }
pub fn relative_cursor(app: &tauri::AppHandle, window: &tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let cursor=app.cursor_position().map_err(|_| "cursor unavailable")?;
    let position=window.outer_position().map_err(|_| "window unavailable")?;
    let scale=window.scale_factor().map_err(|_| "scale unavailable")?;
    Ok(((cursor.x-position.x as f64)/scale,(cursor.y-position.y as f64)/scale))
}
#[cfg(target_os = "windows")]
pub fn buttons_pressed() -> bool {
    #[link(name = "user32")] extern "system" { fn GetAsyncKeyState(key: i32) -> i16; }
    unsafe { [1,2,4].into_iter().any(|key| GetAsyncKeyState(key)<0) }
}
#[cfg(not(target_os = "windows"))]
pub fn buttons_pressed() -> bool { false }
pub fn token() -> Result<String, String> { Err("unsupported: credential store unavailable".into()) }
pub fn render_visibility(window: &tauri::WebviewWindow, on_screen: bool) { use tauri::Emitter; let _=window.emit("render-visibility",on_screen); }
pub fn prepare(_: &tauri::AppHandle) {}
pub fn detach(_: &mut Command) {}
pub fn open_folder(path: &Path) -> Result<(), String> {
    Command::new("explorer").arg(path).spawn().map(|_| ()).map_err(|_| "unsupported".into())
}
