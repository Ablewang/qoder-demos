#[path = "src/node_policy.rs"]
mod node_policy;
use std::{env, fs, path::PathBuf};

const COMMANDS: &[&str] = &[
    "get_api_token", "read_daemon_info", "wake_daemon", "read_client_settings",
    "write_client_settings", "open_memory_folder", "window_frames", "fullscreen_probe",
    "set_hit_areas", "show_aux", "hide_aux", "set_demo_visual", "register_shortcut", "quit_pet",
];

fn main() {
    println!("cargo:rerun-if-env-changed=WORK_AGENT_NODE");
    println!("cargo:rerun-if-env-changed=PATH");
    println!("cargo:rerun-if-changed=src/node_policy.rs");
    let node = if let Some(explicit) = env::var_os("WORK_AGENT_NODE") {
        let path = PathBuf::from(explicit);
        assert!(path.is_absolute(), "WORK_AGENT_NODE must be absolute");
        fs::canonicalize(path).expect("explicit build Node unavailable")
    } else {
        // PATH is consulted only here, in the trusted local developer build environment.
        env::var_os("PATH").into_iter().flat_map(|p| env::split_paths(&p).collect::<Vec<_>>())
            .filter(|p| p.is_absolute()).map(|p| p.join(if cfg!(windows) { "node.exe" } else { "node" }))
            .find(|p| p.is_file()).and_then(|p| fs::canonicalize(p).ok())
            .expect("set WORK_AGENT_NODE to an absolute Node.js 24 executable")
    };
    node_policy::validate_node(&node).expect("trusted build Node must be version 24");
    let root = fs::canonicalize(PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap())
        .ancestors().nth(3).expect("repository root")).expect("repository root unavailable");
    for (key, path) in [("WORK_AGENT_TRUSTED_NODE", &node), ("WORK_AGENT_REPO_ROOT", &root)] {
        let value = path.to_str().expect("build path must be UTF-8");
        assert!(!value.contains(['\r', '\n']), "invalid build path");
        println!("cargo:rustc-env={key}={value}");
    }
    tauri_build::try_build(tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)))
        .expect("cannot build native ACL/configuration");
}
