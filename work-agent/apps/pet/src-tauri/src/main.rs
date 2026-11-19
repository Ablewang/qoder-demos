mod platform;
mod hardening;
mod node_policy;
mod secure_fs;
use hardening::{Area, BootstrapStatus, Passthrough};
use secure_fs::SafeDir;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, ffi::OsString, path::PathBuf, process::{Command, Stdio}, sync::Mutex, time::Duration};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ClientSettings {
    size: u32, fixed: bool, positions: BTreeMap<String, Point>, entertainment: String,
    shortcut: String, badge_in_quiet: bool, decorations: Vec<String>,
}
impl Default for ClientSettings {
    fn default() -> Self { Self { size: 112, fixed: false, positions: BTreeMap::new(), entertainment: "medium".into(), shortcut: "Control+Alt+D".into(), badge_in_quiet: true, decorations: vec![] } }
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Point { x: f64, y: f64 }
struct HitState(Mutex<Vec<Area>>);
#[derive(Default)]
struct CursorSequences { pet: Passthrough, bubble: Passthrough }
struct CursorState(Mutex<CursorSequences>);
#[derive(Clone, Copy)]
enum CursorWindow { Pet, Bubble }
impl CursorState {
    // Window getters wait for the GUI thread, so only pure transitions may hold this lock.
    fn initialize(&self, window: CursorWindow, pressed: bool) -> Result<(), &'static str> {
        let mut sequences = self.0.lock().map_err(|_| "cannot update cursor state")?;
        let sequence = match window { CursorWindow::Pet => &mut sequences.pet, CursorWindow::Bubble => &mut sequences.bubble };
        sequence.initialize(pressed);
        Ok(())
    }
    fn ignore(&self, window: CursorWindow, pressed: bool, hit: bool) -> Result<bool, &'static str> {
        let mut sequences = self.0.lock().map_err(|_| "cannot update cursor state")?;
        let sequence = match window { CursorWindow::Pet => &mut sequences.pet, CursorWindow::Bubble => &mut sequences.bubble };
        Ok(sequence.update(pressed, hit))
    }
}
type OwnedShortcuts = (Option<tauri_plugin_global_shortcut::Shortcut>, Option<tauri_plugin_global_shortcut::Shortcut>);
struct ShortcutState(Mutex<OwnedShortcuts>);
struct RuntimePaths { root: PathBuf, data: PathBuf, environment: BTreeMap<OsString, OsString> }
impl RuntimePaths {
    fn from_environment(config: &tauri::Config) -> Result<Self, &'static str> {
        let root = PathBuf::from(env!("WORK_AGENT_REPO_ROOT"));
        let data = hardening::resolve_data(&root, std::env::var_os("WORK_AGENT_DATA_DIR").as_deref())?;
        let dev_origin = if cfg!(debug_assertions) && tauri::is_dev() {
            config.build.dev_url.as_ref().map(|url| url.origin().ascii_serialization())
        } else { None };
        let environment = hardening::child_environment(&data, &std::env::vars_os().collect(), dev_origin.as_deref());
        Ok(Self { root, data, environment })
    }
}
#[tauri::command]
fn get_api_token(window: tauri::WebviewWindow) -> Result<String, String> {
    if !["pet", "bubble", "panel"].contains(&window.label()) { return Err("forbidden".into()); }
    platform::token()
}
#[tauri::command]
fn read_daemon_info(paths: tauri::State<RuntimePaths>) -> Result<serde_json::Value, String> {
    let bytes = SafeDir::open(&paths.data.join("run"), false).and_then(|dir| dir.read("daemon.json"))
        .map_err(|_| "daemon discovery unavailable")?;
    let info: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| "invalid daemon discovery")?;
    let port = info["port"].as_u64().ok_or("invalid daemon discovery")?;
    if info["protocol"] != 1 || !(1..=65535).contains(&port) || !info["startedAt"].is_number() { return Err("unsupported daemon protocol".into()); }
    Ok(info)
}
#[tauri::command]
fn wake_daemon(paths: tauri::State<RuntimePaths>) -> Result<(), String> {
    let run = SafeDir::open(&paths.data.join("run"), true).map_err(|_| "cannot prepare daemon directory")?;
    run.check_target("daemon.log").and_then(|_| run.check_target("daemon.json"))
        .and_then(|_| run.check_target("bootstrap.log")).map_err(|_| "cannot prepare daemon directory")?;
    let node = std::path::Path::new(env!("WORK_AGENT_TRUSTED_NODE"));
    if node_policy::validate_node(node).is_err() {
        let _ = run.diagnostic(BootstrapStatus::NodeUnavailable);
        return Err("trusted Node.js 24 unavailable".into());
    }
    let mut command = Command::new(node);
    hardening::apply_environment(&mut command, &paths.environment);
    command.args(["--disable-warning=ExperimentalWarning", "src/daemon.ts"]).current_dir(&paths.root)
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    platform::detach(&mut command);
    match command.spawn() {
        Ok(mut child) => {
            let _ = run.diagnostic(BootstrapStatus::Spawned);
            std::thread::spawn(move || {
                let status = if child.wait().is_ok() { BootstrapStatus::Exited } else { BootstrapStatus::WaitFailed };
                let _ = run.diagnostic(status);
            });
            Ok(())
        },
        Err(_) => { let _ = run.diagnostic(BootstrapStatus::SpawnFailed); Err("cannot start daemon".into()) },
    }
}
fn load_client_settings(paths: &RuntimePaths) -> ClientSettings {
    SafeDir::open(&paths.data.join("client"), false).and_then(|dir| dir.read("settings.json"))
        .ok().and_then(|v| serde_json::from_slice(&v).ok()).filter(valid_settings).unwrap_or_default()
}
#[tauri::command]
fn read_client_settings(paths: tauri::State<RuntimePaths>) -> ClientSettings { load_client_settings(&paths) }
fn valid_settings(settings: &ClientSettings) -> bool {
    [96,112,128].contains(&settings.size) && ["off","low","medium"].contains(&settings.entertainment.as_str())
        && settings.shortcut.len() <= 80 && settings.shortcut.parse::<tauri_plugin_global_shortcut::Shortcut>().is_ok()
        && settings.positions.len() <= 32 && settings.positions.iter().all(|(id,p)| id.len() <= 256 && p.x.is_finite() && p.y.is_finite() && p.x.abs() <= 1_000_000.0 && p.y.abs() <= 1_000_000.0)
        && settings.decorations.len() <= 4 && settings.decorations.iter().all(|d| ["headset_mint","headset_sakura","nightcap","ball_yarn"].contains(&d.as_str()))
}
#[tauri::command]
fn write_client_settings(settings: ClientSettings, paths: tauri::State<RuntimePaths>) -> Result<(), String> {
    if !valid_settings(&settings) { return Err("invalid input".into()); }
    let directory = SafeDir::open(&paths.data.join("client"), true).map_err(|_| "cannot save client settings")?;
    let bytes = serde_json::to_vec_pretty(&settings).map_err(|_| "cannot encode client settings")?;
    directory.atomic_settings(&bytes).map_err(|_| "cannot save client settings".into())
}
#[tauri::command]
fn open_memory_folder(paths: tauri::State<RuntimePaths>) -> Result<(), String> {
    let path = paths.data.join("companion");
    let _directory = SafeDir::open(&path, false).map_err(|_| "cannot open memory directory")?;
    platform::open_folder(&path)
}
#[tauri::command]
fn window_frames() -> Result<Vec<platform::Frame>, String> { platform::window_frames() }
#[tauri::command]
fn fullscreen_probe() -> platform::Probe { platform::fullscreen_probe() }
#[tauri::command]
fn set_hit_areas(window: tauri::WebviewWindow, areas: Vec<Area>, state: tauri::State<HitState>) -> Result<(), String> {
    if window.label() != "pet" { return Err("invalid input".into()); }
    let size = window.inner_size().map_err(|_| "invalid input")?;
    let scale = window.scale_factor().map_err(|_| "invalid input")?;
    let areas = hardening::bounded_hits(areas, size.width as f64 / scale, size.height as f64 / scale)?;
    *state.0.lock().map_err(|_| "invalid input")? = areas;
    Ok(())
}
#[tauri::command]
fn show_aux(app: tauri::AppHandle, label: String, x: f64, y: f64, width: f64, height: f64, view: String) -> Result<(), String> {
    let focus = label == "panel";
    if !(label == "bubble" && view == "bubble" || focus && ["notices", "memory", "chat", "settings", "onboarding", "help"].contains(&view.as_str())) { return Err("invalid input".into()); }
    let workareas: Vec<_> = app.available_monitors().map_err(|_| "invalid input")?.iter().map(|monitor| {
        let work = monitor.work_area(); let scale = monitor.scale_factor();
        Area { x: work.position.x as f64 / scale, y: work.position.y as f64 / scale,
            width: work.size.width as f64 / scale, height: work.size.height as f64 / scale }
    }).collect();
    hardening::validate_aux(&Area { x,y,width,height }, &workareas)?;
    let window = if let Some(window) = app.get_webview_window(&label) { window } else {
        WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(format!("index.html?view={view}").into()))
            .title("团子").inner_size(width,height).position(x,y).decorations(false).transparent(true).always_on_top(true)
            .skip_taskbar(true).resizable(false).visible_on_all_workspaces(true).focused(false).focusable(focus).shadow(focus).visible(false)
            .build().map_err(|_| "cannot create companion window")?
    };
    window.set_size(tauri::LogicalSize::new(width,height)).map_err(|_| "cannot size window")?;
    window.set_position(tauri::LogicalPosition::new(x,y)).map_err(|_| "cannot position window")?;
    if focus {
        window.show().map_err(|_| "cannot show window")?;
        let _ = window.set_focus();
    } else {
        app.state::<CursorState>().initialize(CursorWindow::Bubble, platform::buttons_pressed()).map_err(|_| "cannot show window")?;
        window.set_ignore_cursor_events(true).map_err(|_| "cannot initialize window")?;
        window.show().map_err(|_| "cannot show window")?;
    }
    let _ = app.emit_to(&label, "panel-route", &view);
    Ok(())
}
#[tauri::command]
fn hide_aux(app: tauri::AppHandle, window: tauri::WebviewWindow, label: String) {
    if window.label() != "pet" && window.label() != label { return; }
    if ["bubble", "panel"].contains(&label.as_str()) { if let Some(w) = app.get_webview_window(&label) { let _ = w.hide(); } }
}
fn tray_image(closed: bool) -> tauri::image::Image<'static> {
    let mut rgba = vec![0u8; 22*22*4];
    for y in 0..22 { for x in 0..22 {
        let body = ((x as f64-11.0)/9.0).powi(2) + ((y as f64-12.0)/7.0).powi(2) <= 1.0;
        let eye = if closed { y == 11 && ((6..=9).contains(&x) || (13..=16).contains(&x)) } else { (y==10 || y==11) && (x==8 || x==14) };
        let i = (y*22+x)*4;
        if body { rgba[i..i+4].copy_from_slice(if eye { &[55,40,30,255] } else { &[245,235,218,255] }); }
    }}
    tauri::image::Image::new_owned(rgba,22,22)
}
#[tauri::command]
fn set_demo_visual(app: tauri::AppHandle, hidden: bool) {
    if let Some(w) = app.get_webview_window("pet") {
        if hidden { let _ = w.hide(); } else if app.state::<CursorState>().initialize(CursorWindow::Pet, platform::buttons_pressed()).is_ok() {
            if w.set_ignore_cursor_events(true).is_ok() { let _ = w.show(); }
        }
    }
    if hidden { for label in ["bubble","panel"] { if let Some(w) = app.get_webview_window(label) { let _ = w.hide(); } } }
    if let Some(tray) = app.tray_by_id("tuanzi") { let _ = tray.set_icon(Some(tray_image(hidden))); }
}
#[tauri::command]
fn register_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    let parsed: tauri_plugin_global_shortcut::Shortcut = shortcut.parse().map_err(|_| "invalid shortcut")?;
    let state = app.state::<ShortcutState>();
    let mut owned = state.0.lock().map_err(|_| "cannot change shortcut")?;
    let (current, rollback) = &mut *owned;
    hardening::replace_shortcut(current, rollback, parsed,
        |key| app.global_shortcut().register(key).map_err(|_| ()),
        |key| app.global_shortcut().unregister(key).map_err(|_| ())).map_err(str::to_owned)
}
#[tauri::command]
fn quit_pet(app: tauri::AppHandle) { app.exit(0); }
fn main() {
    let context = tauri::generate_context!();
    let paths = match RuntimePaths::from_environment(context.config()) {
        Ok(paths) => paths,
        Err(_) => { eprintln!("cannot initialize companion paths"); return; },
    };
    tauri::Builder::default()
        .manage(paths)
        .manage(HitState(Mutex::new(vec![])))
        .manage(CursorState(Mutex::new(CursorSequences::default())))
        .manage(ShortcutState(Mutex::new((None, None))))
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, _, event| {
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed { let _ = app.emit_to("pet", "menu-action", "demo-toggle"); }
        }).build())
        .invoke_handler(tauri::generate_handler![get_api_token,read_daemon_info,wake_daemon,read_client_settings,write_client_settings,open_memory_folder,window_frames,fullscreen_probe,set_hit_areas,show_aux,hide_aux,set_demo_visual,register_shortcut,quit_pet])
        .on_window_event(|window,event| { if window.label()=="panel" && matches!(event,tauri::WindowEvent::Focused(false)) { let _=window.hide(); } })
        .setup(|app| {
            platform::prepare(app.handle());
            use tauri::menu::{Menu, MenuItem, Submenu};
            let notices = MenuItem::with_id(app,"notices","通知中心",true,None::<&str>)?;
            let chat = MenuItem::with_id(app,"chat","聊天",true,None::<&str>)?;
            let memory = MenuItem::with_id(app,"memory","记忆",true,None::<&str>)?;
            let dnd30 = MenuItem::with_id(app,"dnd:30","30 分钟",true,None::<&str>)?;
            let dnd60 = MenuItem::with_id(app,"dnd:60","1 小时",true,None::<&str>)?;
            let dnd120 = MenuItem::with_id(app,"dnd:120","2 小时",true,None::<&str>)?;
            let dndwork = MenuItem::with_id(app,"dnd:work","到今天下班",true,None::<&str>)?;
            let dndforever = MenuItem::with_id(app,"dnd","直到我关闭",true,None::<&str>)?;
            let note = MenuItem::new(app,"开会自动安静：暂不可用（还没接日历）。共享屏幕识别：未知。要演示请用『演示模式』。",false,None::<&str>)?;
            let dnd = Submenu::with_items(app,"勿扰",true,&[&dnd30,&dnd60,&dnd120,&dndwork,&dndforever,&note])?;
            let demo = MenuItem::with_id(app,"demo-toggle","演示模式 / 从演示恢复",true,None::<&str>)?;
            let off = MenuItem::with_id(app,"quiet-off","关闭勿扰 / 恢复团子",true,None::<&str>)?;
            let settings = MenuItem::with_id(app,"settings","设置…",true,None::<&str>)?;
            let quit = MenuItem::with_id(app,"quit","退出团子（后台继续运行）",true,None::<&str>)?;
            let menu=Menu::with_items(app,&[&notices,&chat,&memory,&dnd,&demo,&off,&settings,&quit])?;
            tauri::tray::TrayIconBuilder::with_id("tuanzi").icon(tray_image(false)).menu(&menu).on_menu_event(|app,event| { let _ = app.emit_to("pet","menu-action",event.id().as_ref()); }).build(app)?;
            let settings = load_client_settings(&app.state::<RuntimePaths>());
            let _ = register_shortcut(app.handle().clone(), settings.shortcut);
            let pet = app.get_webview_window("pet").ok_or("pet window unavailable")?;
            app.state::<CursorState>().initialize(CursorWindow::Pet, platform::buttons_pressed()).map_err(|_| "cannot initialize window")?;
            pet.set_ignore_cursor_events(true)?;
            pet.show()?;
            let handle=app.handle().clone();
            std::thread::spawn(move || { let mut previous=platform::buttons_pressed(); let mut tick=0u32; loop {
                std::thread::sleep(Duration::from_millis(60));
                let Some(pet)=handle.get_webview_window("pet") else { break; };
                let pressed=platform::buttons_pressed();
                let state=handle.state::<CursorState>();
                let visible=pet.is_visible().unwrap_or(false);
                let cursor=platform::relative_cursor(&handle,&pet).ok().filter(|(x,y)| x.is_finite() && y.is_finite());
                if visible {
                    let hit=cursor.is_some_and(|(x,y)| handle.state::<HitState>().0.lock().is_ok_and(|areas| areas.iter().any(|r| r.contains(x,y))));
                    let Ok(ignore)=state.ignore(CursorWindow::Pet,pressed,hit) else { break; };
                    let _=pet.set_ignore_cursor_events(ignore);
                    if let Some((x,y))=cursor {
                        if (-200.0..=360.0).contains(&x) && (-200.0..=360.0).contains(&y) || previous {
                            let _=handle.emit_to("pet","global-cursor",serde_json::json!({"x":x,"y":y,"pressed":pressed,"released":previous && !pressed}));
                        }
                    }
                    tick=tick.wrapping_add(1);
                    if tick%17==0 {
                        if let (Ok(p),Ok(s),Ok(scale),Ok(monitors))=(pet.outer_position(),pet.outer_size(),pet.scale_factor(),handle.available_monitors()) {
                            let x=p.x as f64/scale; let y=p.y as f64/scale;
                            let on_screen=monitors.iter().any(|m| { let ms=m.scale_factor(); let mp=m.position(); let sz=m.size();
                                x+s.width as f64/scale>mp.x as f64/ms && y+s.height as f64/scale>mp.y as f64/ms && x<(mp.x as f64+sz.width as f64)/ms && y<(mp.y as f64+sz.height as f64)/ms });
                            platform::render_visibility(&pet,on_screen);
                        }
                    }
                } else if state.initialize(CursorWindow::Pet,pressed).is_err() { break; }
                if let Some(bubble)=handle.get_webview_window("bubble") {
                    if bubble.is_visible().unwrap_or(false) {
                        let hit=if let (Ok((x,y)),Ok(s),Ok(scale))=(platform::relative_cursor(&handle,&bubble),bubble.inner_size(),bubble.scale_factor()) {
                            Area { x:0.0,y:0.0,width:s.width as f64/scale,height:s.height as f64/scale }.contains(x,y)
                        } else { false };
                        let Ok(ignore)=state.ignore(CursorWindow::Bubble,pressed,hit) else { break; };
                        let _=bubble.set_ignore_cursor_events(ignore);
                    } else if state.initialize(CursorWindow::Bubble,pressed).is_err() { break; }
                } else if state.initialize(CursorWindow::Bubble,pressed).is_err() { break; }
                previous=pressed;
            }});
            Ok(())
        }).run(context).expect("cannot initialize companion client");
}

#[cfg(test)]
mod native_tests {
    use super::*;
    #[test]
    fn cursor_transitions_release_lock_before_waiting_for_window_dispatch() {
        let state = std::sync::Arc::new(CursorState(Mutex::new(CursorSequences::default())));
        state.initialize(CursorWindow::Pet, false).unwrap();
        assert!(state.0.try_lock().is_ok());
        let (query_tx, query_rx) = std::sync::mpsc::sync_channel(1);
        let (reply_tx, reply_rx) = std::sync::mpsc::sync_channel(1);
        let worker_state = state.clone();
        let worker = std::thread::spawn(move || {
            let ignore = worker_state.ignore(CursorWindow::Pet, true, true).unwrap();
            query_tx.send(ignore).unwrap();
            reply_rx.recv_timeout(Duration::from_secs(2)).unwrap();
            worker_state.ignore(CursorWindow::Bubble, true, true).unwrap()
        });
        assert!(!query_rx.recv_timeout(Duration::from_secs(2)).unwrap());
        assert!(state.0.try_lock().is_ok());
        state.initialize(CursorWindow::Bubble, true).unwrap();
        assert!(state.0.try_lock().is_ok());
        reply_tx.send(()).unwrap();
        assert!(worker.join().unwrap());
        assert!(state.0.try_lock().is_ok());
    }
    #[test]
    fn cursor_windows_preserve_independent_button_sequences() {
        let state = CursorState(Mutex::new(CursorSequences::default()));
        state.initialize(CursorWindow::Pet, false).unwrap();
        assert!(!state.ignore(CursorWindow::Pet, true, true).unwrap());
        state.initialize(CursorWindow::Bubble, true).unwrap();
        assert!(state.ignore(CursorWindow::Bubble, true, true).unwrap());
        assert!(!state.ignore(CursorWindow::Pet, true, false).unwrap());
        for window in [CursorWindow::Pet, CursorWindow::Bubble] {
            assert!(state.ignore(window, false, false).unwrap());
            assert!(!state.ignore(window, false, true).unwrap());
            state.initialize(window, true).unwrap();
            assert!(state.ignore(window, true, true).unwrap());
            assert!(state.ignore(window, true, false).unwrap());
            assert!(!state.ignore(window, false, true).unwrap());
            assert!(state.0.try_lock().is_ok());
        }
    }
    #[test]
    fn generated_commands_are_default_deny_and_capabilities_are_local_minimal() {
        let manifests: serde_json::Value = serde_json::from_str(include_str!("../gen/schemas/acl-manifests.json")).unwrap();
        let app = &manifests["__app-acl__"];
        assert!(app["default_permission"].is_null());
        for command in ["get_api_token","read_daemon_info","wake_daemon","read_client_settings","write_client_settings",
            "open_memory_folder","window_frames","fullscreen_probe","set_hit_areas","show_aux","hide_aux","set_demo_visual","register_shortcut","quit_pet"] {
            let slug = command.replace('_',"-");
            assert_eq!(app["permissions"][format!("allow-{slug}")]["commands"]["allow"],serde_json::json!([command]));
            assert_eq!(app["permissions"][format!("deny-{slug}")]["commands"]["deny"],serde_json::json!([command]));
            assert_eq!(app["permissions"][format!("native-{slug}")]["commands"]["allow"],serde_json::json!([command]));
        }
        let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(config["app"]["windows"][0]["visible"],false);
        assert_eq!(config["app"]["security"]["capabilities"],serde_json::json!(["pet-master","pet-panel","pet-bubble"]));
        for (text, expected) in [(include_str!("../capabilities/client.json"),"pet"), (include_str!("../capabilities/panel.json"),"panel"), (include_str!("../capabilities/bubble.json"),"bubble")] {
            let capability: serde_json::Value = serde_json::from_str(text).unwrap();
            assert_eq!(capability["windows"],serde_json::json!([expected]));
            assert_eq!(capability["local"],true); assert!(capability["remote"].is_null());
            let permissions: Vec<_> = capability["permissions"].as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
            for p in &permissions {
                assert!(!p.ends_with(":default"));
                if let Some((namespace, name)) = p.rsplit_once(':') { assert!(manifests[namespace]["permissions"][name].is_object(),"invalid permission {p}"); }
                else { assert!(app["permissions"][*p].is_object(),"invalid custom permission {p}"); }
            }
            assert!(!permissions.contains(&"core:window:allow-set-ignore-cursor-events"));
            assert!(!permissions.contains(&"core:window:allow-show"));
            assert!(!permissions.contains(&"native-fullscreen-probe"));
            if expected != "pet" {
                for denied in ["native-wake-daemon","native-show-aux","native-window-frames","native-set-hit-areas","native-set-demo-visual","native-quit-pet","core:menu:allow-new","core:window:allow-start-dragging"] {
                    assert!(!permissions.contains(&denied),"{expected} must not receive {denied}");
                }
            }
            if expected == "bubble" { assert!(!permissions.contains(&"native-write-client-settings")); assert!(!permissions.contains(&"native-register-shortcut")); }
        }
    }
    #[test]
    fn settings_validation_is_bounded_and_loaded_settings_are_validated() {
        let mut settings=ClientSettings::default(); assert!(valid_settings(&settings));
        settings.positions.insert("display".into(),Point { x:f64::INFINITY,y:0.0 }); assert!(!valid_settings(&settings));
        settings.positions.clear(); settings.decorations.push("unapproved".into()); assert!(!valid_settings(&settings));
        settings.decorations.clear(); settings.shortcut="not a shortcut".into(); assert!(!valid_settings(&settings));
    }
}
