use super::Frame;
use core_foundation::{array::CFArrayRef, base::{CFRelease, CFTypeRef}, dictionary::{CFDictionaryGetValue, CFDictionaryRef}, number::{CFNumberGetValue, CFNumberRef, kCFNumberFloat64Type}, string::CFStringRef};
use core_graphics::geometry::CGRect;
use std::{os::unix::process::CommandExt, path::Path, process::Command};

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGWindowListCopyWindowInfo(option: u32, relative: u32) -> CFArrayRef;
    fn CGRectMakeWithDictionaryRepresentation(dict: CFDictionaryRef, rect: *mut CGRect) -> bool;
    fn CGEventSourceButtonState(state: i32, button: u32) -> bool;
    static kCGWindowBounds: CFStringRef;
    static kCGWindowLayer: CFStringRef;
    static kCGWindowOwnerPID: CFStringRef;
    static kCGWindowNumber: CFStringRef;
    static kCGWindowAlpha: CFStringRef;
}
unsafe fn number(dict: CFDictionaryRef, key: CFStringRef) -> Option<f64> {
    let value = CFDictionaryGetValue(dict, key as *const _);
    if value.is_null() { return None; }
    let mut result: f64 = 0.0;
    if CFNumberGetValue(value as CFNumberRef, kCFNumberFloat64Type, &mut result as *mut _ as *mut _) { Some(result) } else { None }
}
pub fn window_frames() -> Result<Vec<Frame>, String> {
    unsafe {
        let list = CGWindowListCopyWindowInfo(1 | 16, 0);
        if list.is_null() { return Err("unsupported: window geometry unavailable".into()); }
        let mut frames = Vec::new();
        for i in 0..core_foundation::array::CFArrayGetCount(list) {
            let dict = core_foundation::array::CFArrayGetValueAtIndex(list, i) as CFDictionaryRef;
            if number(dict, kCGWindowLayer) != Some(0.0) || number(dict, kCGWindowAlpha).unwrap_or(0.0) <= 0.0 { continue; }
            let bounds = CFDictionaryGetValue(dict, kCGWindowBounds as *const _) as CFDictionaryRef;
            if bounds.is_null() { continue; }
            let mut rect = CGRect::default();
            if !CGRectMakeWithDictionaryRepresentation(bounds, &mut rect)
                || !(crate::hardening::Area { x: rect.origin.x, y: rect.origin.y, width: rect.size.width, height: rect.size.height }).valid() { continue; }
            let pid = number(dict, kCGWindowOwnerPID).unwrap_or(0.0) as i32;
            if pid == std::process::id() as i32 { continue; }
            frames.push(Frame { id: number(dict, kCGWindowNumber).unwrap_or(0.0) as u32, pid, x: rect.origin.x, y: rect.origin.y, width: rect.size.width, height: rect.size.height });
        }
        CFRelease(list as CFTypeRef);
        Ok(frames)
    }
}
pub fn relative_cursor(app: &tauri::AppHandle, window: &tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let cursor = app.cursor_position().map_err(|_| "cursor unavailable")?;
    let primary = app.primary_monitor().map_err(|_| "monitor unavailable")?.ok_or("monitor unavailable")?;
    let position = window.outer_position().map_err(|_| "window unavailable")?;
    let scale = window.scale_factor().map_err(|_| "scale unavailable")?;
    // Tao scales the global cursor with the primary display, but windows with their own display.
    Ok((cursor.x / primary.scale_factor() - position.x as f64 / scale, cursor.y / primary.scale_factor() - position.y as f64 / scale))
}
pub fn buttons_pressed() -> bool { unsafe { (0..3).any(|b| CGEventSourceButtonState(0, b)) } }
pub fn token() -> Result<String, String> {
    let output = Command::new("/usr/bin/security").env_clear()
        .args(["find-generic-password", "-s", "work-agent", "-a", "local-api-token", "-w"])
        .stdin(std::process::Stdio::null()).stderr(std::process::Stdio::null())
        .output().map_err(|_| "credential store unavailable")?;
    if !output.status.success() { return Err("local API token unavailable".into()); }
    let value = String::from_utf8(output.stdout).map_err(|_| "invalid credential")?;
    let value = value.strip_suffix("\r\n").or_else(|| value.strip_suffix('\n')).unwrap_or(&value);
    if crate::hardening::valid_token(value) { Ok(value.to_owned()) } else { Err("invalid credential".into()) }
}
pub fn render_visibility(window: &tauri::WebviewWindow, on_screen: bool) {
    use tauri::Emitter;
    let window_copy=window.clone();
    let _=window.run_on_main_thread(move || {
        let visible=window_copy.ns_window().ok().filter(|p| !p.is_null()).map(|ptr| {
            let native=unsafe { &*(ptr as *const objc2_app_kit::NSWindow) };
            native.occlusionState().contains(objc2_app_kit::NSWindowOcclusionState::Visible)
        }).unwrap_or(true);
        let _=window_copy.emit("render-visibility",on_screen && visible);
    });
}
pub fn prepare(app: &tauri::AppHandle) { let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory); }
pub fn detach(command: &mut Command) {
    unsafe { command.pre_exec(|| { unsafe extern "C" { fn setsid() -> i32; } if setsid() < 0 { return Err(std::io::Error::last_os_error()); } Ok(()) }); }
}
pub fn open_folder(path: &Path) -> Result<(), String> {
    Command::new("/usr/bin/open").env_clear().arg(path)
        .stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
        .spawn().map(|mut child| { std::thread::spawn(move || { let _ = child.wait(); }); })
        .map_err(|_| "cannot open memory directory".into())
}
