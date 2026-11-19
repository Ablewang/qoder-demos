use std::{fs, path::Path, process::{Command, Stdio}};

pub fn valid_version(bytes: &[u8]) -> bool {
    let Ok(text) = std::str::from_utf8(bytes) else { return false; };
    let version = text.strip_suffix("\r\n").or_else(|| text.strip_suffix('\n')).unwrap_or(text);
    let Some(version) = version.strip_prefix("v24.") else { return false; };
    let parts: Vec<_> = version.split('.').collect();
    parts.len() == 2 && parts.iter().all(|p| !p.is_empty() && p.len() <= 5 && p.bytes().all(|b| b.is_ascii_digit()))
}

// Shared by the build script and runtime; never uses a shell or inherited Node options.
pub fn validate_node(path: &Path) -> Result<(), &'static str> {
    if !path.is_absolute() || fs::canonicalize(path).ok().as_deref() != Some(path) {
        return Err("trusted Node unavailable");
    }
    let metadata = fs::symlink_metadata(path).map_err(|_| "trusted Node unavailable")?;
    if !metadata.is_file() || metadata.file_type().is_symlink() { return Err("trusted Node unavailable"); }
    #[cfg(unix)] {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o111 == 0 { return Err("trusted Node unavailable"); }
    }
    let output = Command::new(path).env_clear().arg("--version").stdin(Stdio::null())
        .stderr(Stdio::null()).output().map_err(|_| "trusted Node unavailable")?;
    if output.status.success() && valid_version(&output.stdout) { Ok(()) } else { Err("Node.js 24 required") }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn version_is_strict_and_never_exposes_diagnostics() {
        for text in ["v24.21.0\n", "v24.22.1", "v24.0.0\r\n"] { assert!(valid_version(text.as_bytes()), "{text:?}"); }
        for text in ["v23.1.0\n", "v25.0.0", "v24.1", "v24.1.0 secret", "v24.1.0\nsecret", " v24.1.0", "v24.1.0\n\n"] { assert!(!valid_version(text.as_bytes()), "{text:?}"); }
    }
}
