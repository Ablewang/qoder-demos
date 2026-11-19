use serde::Serialize;
use std::{path::Path, process::Command};

#[derive(Clone, Serialize)]
pub struct Frame { pub id: u32, pub pid: i32, pub x: f64, pub y: f64, pub width: f64, pub height: f64 }
#[derive(Serialize)]
pub struct Probe { pub detection: &'static str, pub supported: bool }

#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(target_os = "macos"))]
mod windows;
#[cfg(target_os = "macos")]
use macos as native;
#[cfg(not(target_os = "macos"))]
use windows as native;

pub fn window_frames() -> Result<Vec<Frame>, String> { native::window_frames() }
pub fn fullscreen_probe() -> Probe { Probe { detection: "unknown", supported: false } }
pub fn buttons_pressed() -> bool { native::buttons_pressed() }
pub fn relative_cursor(app: &tauri::AppHandle, window: &tauri::WebviewWindow) -> Result<(f64, f64), String> { native::relative_cursor(app, window) }
pub fn token() -> Result<String, String> { native::token() }
pub fn render_visibility(window: &tauri::WebviewWindow, on_screen: bool) { native::render_visibility(window, on_screen); }
pub fn prepare(app: &tauri::AppHandle) { native::prepare(app); }
pub fn detach(command: &mut Command) { native::detach(command); }
pub fn open_folder(path: &Path) -> Result<(), String> { native::open_folder(path) }
