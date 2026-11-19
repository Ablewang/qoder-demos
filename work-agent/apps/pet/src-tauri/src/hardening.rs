use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, ffi::OsString, fs, path::{Component, Path, PathBuf}, process::Command};

pub fn resolve_data(root: &Path, value: Option<&std::ffi::OsStr>) -> Result<PathBuf, &'static str> {
    if !root.is_absolute() { return Err("invalid data directory"); }
    let raw = value.filter(|v| !v.is_empty()).map(PathBuf::from).unwrap_or_else(|| root.join("data"));
    let raw = if raw.is_absolute() { raw } else { root.join(raw) };
    // Check before removing '..', so a symlink/.. cannot be silently normalized away.
    let mut checked = PathBuf::new();
    for component in raw.components() {
        checked.push(component.as_os_str());
        match fs::symlink_metadata(&checked) {
            Ok(m) if m.file_type().is_symlink() => return Err("invalid data directory"),
            Ok(_) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => return Err("invalid data directory"),
        }
    }
    let mut absolute = PathBuf::new();
    for component in raw.components() {
        match component {
            Component::CurDir => (),
            Component::ParentDir => { if !absolute.pop() { return Err("invalid data directory"); } },
            _ => absolute.push(component.as_os_str()),
        }
    }
    Ok(absolute)
}

pub const SYSTEM_PATH: &str = "/usr/bin:/bin:/usr/sbin:/sbin";
pub fn child_environment(data: &Path, source: &BTreeMap<OsString, OsString>, dev_origin: Option<&str>) -> BTreeMap<OsString, OsString> {
    let mut result = BTreeMap::from([
        ("PATH".into(), SYSTEM_PATH.into()),
        ("WORK_AGENT_DATA_DIR".into(), data.as_os_str().to_owned()),
        // Daemon file logging would bypass native diagnostic filtering. Always discard it.
        ("WORK_AGENT_LOG".into(), "off".into()),
        ("WORK_AGENT_DEV_ORIGINS".into(), "".into()),
    ]);
    for key in ["HOME", "TMPDIR"] {
        if let Some(value) = source.get(std::ffi::OsStr::new(key)) {
            if value.to_str().is_some_and(|s| !s.is_empty() && s.len() <= 4096 && !s.chars().any(char::is_control)) && Path::new(value).is_absolute() {
                result.insert(key.into(), value.clone());
            }
        }
    }
    let lang = source.get(std::ffi::OsStr::new("LANG")).and_then(|v| v.to_str())
        .filter(|s| !s.is_empty() && s.len() <= 64 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"_.@-".contains(&b))).unwrap_or("en_US.UTF-8");
    result.insert("LANG".into(), lang.into());
    if let Some(port) = source.get(std::ffi::OsStr::new("WORK_AGENT_PORT")).and_then(|v| v.to_str())
        .filter(|s| s.bytes().all(|b| b.is_ascii_digit())).and_then(|s| s.parse::<u16>().ok()).filter(|p| *p > 0) {
        result.insert("WORK_AGENT_PORT".into(), port.to_string().into());
    }
    if let Some(origins) = source.get(std::ffi::OsStr::new("WORK_AGENT_DEV_ORIGINS")).and_then(|v| v.to_str()).filter(|s| s.len() <= 1024) {
        let approved: Vec<_> = origins.split(',').map(str::trim).filter(|s| loopback_origin(s)).collect();
        result.insert("WORK_AGENT_DEV_ORIGINS".into(), approved.join(",").into());
    }
    if let Some(origin) = dev_origin.filter(|s| loopback_origin(s)) {
        let key = std::ffi::OsStr::new("WORK_AGENT_DEV_ORIGINS");
        let mut origins = result.get(key).and_then(|v| v.to_str()).unwrap_or("").to_owned();
        if !origins.split(',').any(|s| s == origin) {
            if !origins.is_empty() { origins.push(','); }
            origins.push_str(origin);
            result.insert(key.into(), origins.into());
        }
    }
    result
}
fn loopback_origin(value: &str) -> bool {
    let Some(host) = value.strip_prefix("http://") else { return false; };
    let Some((host, port)) = host.rsplit_once(':') else { return false; };
    ["localhost", "127.0.0.1", "[::1]"].contains(&host) && !port.is_empty()
        && port.bytes().all(|b| b.is_ascii_digit()) && port.parse::<u16>().is_ok_and(|p| p > 0)
}
pub fn apply_environment(command: &mut Command, environment: &BTreeMap<OsString, OsString>) {
    command.env_clear().envs(environment);
}

// No body, exception, executable path, token, or arbitrary child output can enter this log API.
#[derive(Clone, Copy)]
pub enum BootstrapStatus { NodeUnavailable, Spawned, SpawnFailed, Exited, WaitFailed }
impl BootstrapStatus {
    pub fn diagnostic(self) -> &'static [u8] {
        match self {
            Self::NodeUnavailable => b"{\"event\":\"bootstrap\",\"status\":\"node_unavailable\"}\n",
            Self::Spawned => b"{\"event\":\"bootstrap\",\"status\":\"spawned\"}\n",
            Self::SpawnFailed => b"{\"event\":\"bootstrap\",\"status\":\"spawn_failed\"}\n",
            Self::Exited => b"{\"event\":\"bootstrap\",\"status\":\"exited\"}\n",
            Self::WaitFailed => b"{\"event\":\"bootstrap\",\"status\":\"wait_failed\"}\n",
        }
    }
}

#[derive(Clone, Deserialize, Serialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct Area { pub x: f64, pub y: f64, pub width: f64, pub height: f64 }
impl Area {
    pub fn valid(&self) -> bool {
        [self.x, self.y, self.width, self.height].iter().all(|n| n.is_finite())
            && self.x.abs() <= 1_000_000.0 && self.y.abs() <= 1_000_000.0
            && self.width > 0.0 && self.height > 0.0 && self.width <= 65_536.0 && self.height <= 65_536.0
    }
    pub fn contains(&self, x: f64, y: f64) -> bool {
        x.is_finite() && y.is_finite() && x >= self.x && y >= self.y && x <= self.x + self.width && y <= self.y + self.height
    }
    pub fn fits(&self, work: &Self) -> bool {
        self.valid() && work.valid() && self.x >= work.x && self.y >= work.y
            && self.x + self.width <= work.x + work.width && self.y + self.height <= work.y + work.height
    }
}
pub fn validate_hits(areas: &[Area], width: f64, height: f64) -> Result<(), &'static str> {
    let bounds = Area { x: 0.0, y: 0.0, width, height };
    if areas.len() > 32 || width > 184.0 || height > 184.0 || !bounds.valid() || areas.iter().any(|a| !a.fits(&bounds)) {
        Err("invalid input")
    } else { Ok(()) }
}
pub fn bounded_hits(mut areas: Vec<Area>, width: f64, height: f64) -> Result<Vec<Area>, &'static str> {
    // The unchanged client rounds the window size but scales hit rectangles continuously.
    // Admit at most half a logical pixel of rounding, then clip to the actual window.
    if areas.len() > 32 || areas.iter().any(|a| !a.valid() || a.x < 0.0 || a.y < 0.0
        || a.x >= width || a.y >= height || a.x + a.width > width + 0.5 || a.y + a.height > height + 0.5) {
        return Err("invalid input");
    }
    for area in &mut areas {
        area.width = area.width.min(width - area.x);
        area.height = area.height.min(height - area.y);
    }
    validate_hits(&areas, width, height)?;
    Ok(areas)
}
pub fn validate_aux(rect: &Area, workareas: &[Area]) -> Result<(), &'static str> {
    if rect.width > 1024.0 || rect.height > 1024.0 || !workareas.iter().any(|work| rect.fits(work)) {
        Err("invalid input")
    } else { Ok(()) }
}
pub fn valid_token(value: &str) -> bool {
    value.len() == 43 && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
enum Sequence { #[default] Idle, External, Captured }
#[derive(Default)]
pub struct Passthrough { previous: bool, sequence: Sequence }
impl Passthrough {
    // A window first seen while a button is already held cannot own that sequence.
    pub fn initialize(&mut self, pressed: bool) {
        self.previous = pressed;
        self.sequence = if pressed { Sequence::External } else { Sequence::Idle };
    }
    pub fn update(&mut self, pressed: bool, hit: bool) -> bool {
        if pressed && !self.previous { self.sequence = if hit { Sequence::Captured } else { Sequence::External }; }
        if !pressed { self.sequence = Sequence::Idle; }
        self.previous = pressed;
        match self.sequence { Sequence::External => true, Sequence::Captured => false, Sequence::Idle => !hit }
    }
}

// Small transactional policy, testable without the global shortcut plugin or a GUI.
pub fn replace_shortcut<T: Copy + PartialEq>(current: &mut Option<T>, rollback: &mut Option<T>, new: T,
    mut register: impl FnMut(T) -> Result<(), ()>, mut unregister: impl FnMut(T) -> Result<(), ()>) -> Result<(), &'static str> {
    if *current == Some(new) { return Ok(()); }
    // If the OS also refused rollback, remember that owned key and retry its removal
    // before another replacement. Never lose ownership or unregister unrelated keys.
    if let Some(key) = *rollback {
        unregister(key).map_err(|_| "cannot roll back shortcut")?;
        *rollback = None;
    }
    register(new).map_err(|_| "shortcut unavailable")?;
    if let Some(old) = *current {
        if unregister(old).is_err() {
            if unregister(new).is_err() { *rollback = Some(new); return Err("cannot roll back shortcut"); }
            return Err("cannot change shortcut");
        }
    }
    *current = Some(new);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn data_override_uses_repository_not_working_directory() {
        let root = Path::new(env!("WORK_AGENT_REPO_ROOT"));
        assert_eq!(resolve_data(root, Some("local/../private-data".as_ref())).unwrap(), root.join("private-data"));
        assert_eq!(resolve_data(root, None).unwrap(), root.join("data"));
        assert_eq!(resolve_data(root, Some("".as_ref())).unwrap(), root.join("data"));
        assert!(resolve_data(Path::new("relative"), None).is_err());
    }
    #[test]
    fn environment_is_a_whitelist_and_command_is_cleared() {
        let source: BTreeMap<OsString, OsString> = [
            ("PATH", "/attacker/bin"), ("HOME", "/Users/test"), ("TMPDIR", "/private/tmp"), ("LANG", "en_US.UTF-8"),
            ("NODE_OPTIONS", "--require=secret"), ("NODE_PATH", "/secret"), ("COMPANY_TOKEN", "credential"),
            ("WORK_AGENT_LOG", "file"), ("WORK_AGENT_PORT", "4721"),
            ("WORK_AGENT_DEV_ORIGINS", "http://127.0.0.1:1420,https://secret.example,http://user:pass@localhost:12,http://localhost:0")
        ].into_iter().map(|(k,v)| (k.into(),v.into())).collect();
        let env = child_environment(Path::new("/test/data"), &source, None);
        assert_eq!(env.get(std::ffi::OsStr::new("PATH")).unwrap(), SYSTEM_PATH);
        assert_eq!(env.get(std::ffi::OsStr::new("WORK_AGENT_DATA_DIR")).unwrap(), "/test/data");
        assert_eq!(env.get(std::ffi::OsStr::new("WORK_AGENT_DEV_ORIGINS")).unwrap(), "http://127.0.0.1:1420");
        assert_eq!(env.get(std::ffi::OsStr::new("WORK_AGENT_LOG")).unwrap(), "off");
        for key in ["NODE_OPTIONS", "NODE_PATH", "COMPANY_TOKEN"] { assert!(!env.contains_key(std::ffi::OsStr::new(key))); }
        let mut cmd = Command::new("unused"); cmd.env("COMPANY_TOKEN", "secret"); apply_environment(&mut cmd, &env);
        assert_eq!(cmd.get_envs().count(), env.len());
        assert!(cmd.get_envs().all(|(key, _)| env.contains_key(key)));
    }
    #[test]
    fn unsafe_config_values_are_not_forwarded() {
        let source = [("HOME", "relative"), ("TMPDIR", "/tmp\nsecret"), ("LANG", "secret\n"), ("WORK_AGENT_PORT", "65536")]
            .into_iter().map(|(k,v)| (k.into(),v.into())).collect();
        let env = child_environment(Path::new("/test/data"), &source, None);
        for key in ["HOME", "TMPDIR", "WORK_AGENT_PORT"] { assert!(!env.contains_key(std::ffi::OsStr::new(key))); }
        assert_eq!(env.get(std::ffi::OsStr::new("LANG")).unwrap(), "en_US.UTF-8");
    }
    #[test]
    fn configured_development_origin_is_exact_and_release_default_stays_closed() {
        let source = BTreeMap::new();
        let data = Path::new("/test/data");
        let key = std::ffi::OsStr::new("WORK_AGENT_DEV_ORIGINS");
        assert_eq!(child_environment(data, &source, None).get(key).unwrap(), "");
        assert_eq!(child_environment(data, &source, Some("http://127.0.0.1:1420")).get(key).unwrap(), "http://127.0.0.1:1420");
        let source = BTreeMap::from([("WORK_AGENT_DEV_ORIGINS".into(), "http://127.0.0.1:1421".into())]);
        assert_eq!(child_environment(data, &source, Some("http://127.0.0.1:1420")).get(key).unwrap(), "http://127.0.0.1:1421,http://127.0.0.1:1420");
        assert_eq!(child_environment(data, &source, Some("http://127.0.0.1:1421")).get(key).unwrap(), "http://127.0.0.1:1421");
        for origin in ["https://remote.example:1420", "http://remote.example:1420", "http://user:pass@localhost:1420", "http://127.0.0.1:0", "http://127.0.0.1:1420/path", "null", "*"] {
            assert_eq!(child_environment(data, &BTreeMap::new(), Some(origin)).get(key).unwrap(), "");
        }
    }
    #[test]
    fn diagnostics_have_only_approved_fixed_fields() {
        for status in [BootstrapStatus::NodeUnavailable, BootstrapStatus::Spawned, BootstrapStatus::SpawnFailed, BootstrapStatus::Exited, BootstrapStatus::WaitFailed] {
            let value: serde_json::Value = serde_json::from_slice(status.diagnostic()).unwrap();
            assert_eq!(value.as_object().unwrap().len(), 2);
            assert_eq!(value["event"], "bootstrap");
            assert!(["node_unavailable", "spawned", "spawn_failed", "exited", "wait_failed"].contains(&value["status"].as_str().unwrap()));
        }
    }
    fn area(x: f64,y: f64,width: f64,height: f64) -> Area { Area { x,y,width,height } }
    #[test]
    fn geometry_rejects_nonfinite_oversized_and_cross_monitor_rectangles() {
        let works = [area(-1440.0,24.0,1440.0,876.0), area(0.0,24.0,1440.0,876.0)];
        assert!(validate_aux(&area(-1400.0,40.0,360.0,520.0), &works).is_ok());
        for bad in [area(f64::NAN,40.0,360.0,520.0), area(0.0,40.0,f64::INFINITY,100.0), area(0.0,40.0,0.0,100.0), area(-100.0,40.0,360.0,520.0), area(0.0,0.0,360.0,520.0), area(0.0,40.0,2048.0,100.0)] {
            assert_eq!(validate_aux(&bad,&works),Err("invalid input"));
        }
        assert!(validate_hits(&[area(50.0,134.0,70.0,26.0)],160.0,160.0).is_ok());
        for bad in [vec![area(0.0,0.0,1.0,1.0);33], vec![area(-1.0,0.0,1.0,1.0)], vec![area(159.0,0.0,2.0,1.0)], vec![area(0.0,0.0,-1.0,1.0)]] { assert!(validate_hits(&bad,160.0,160.0).is_err()); }
    }
    #[test]
    fn scaled_hit_rounding_is_clipped_not_rejected_or_unbounded() {
        for size in [96.0,112.0,128.0] {
            let scale = size / 112.0;
            let hits = bounded_hits(vec![area(50.0*scale,134.0*scale,70.0*scale,26.0*scale)],(160.0*scale).round(),(160.0*scale).round()).unwrap();
            assert!(validate_hits(&hits,(160.0*scale).round(),(160.0*scale).round()).is_ok());
        }
        assert!(bounded_hits(vec![area(136.0,0.0,2.0,1.0)],137.0,137.0).is_err());
        assert!(bounded_hits(vec![],f64::NAN,160.0).is_err());
        assert!(bounded_hits(vec![],160.0,0.0).is_err());
    }
    #[test]
    fn external_press_stays_passthrough_for_pet_and_bubble() {
        for _ in ["pet", "bubble"] {
            let mut state = Passthrough::default(); state.initialize(false);
            assert!(state.update(true,false)); assert!(state.update(true,true)); assert!(state.update(true,false));
            assert!(!state.update(false,true));
            assert!(!state.update(true,true)); assert!(!state.update(true,false)); assert!(state.update(false,false));
        }
    }
    #[test]
    fn showing_mid_drag_cannot_capture_and_hidden_sequence_is_not_reused() {
        let mut state = Passthrough::default(); state.initialize(true);
        assert!(state.update(true,true)); assert!(state.update(true,false)); assert!(!state.update(false,true));
        assert!(!state.update(true,true)); state.initialize(true); assert!(state.update(true,true));
    }
    #[test]
    fn token_format_only_uses_synthetic_values() {
        assert!(valid_token(&"A".repeat(43))); assert!(valid_token(&format!("{}-_", "a".repeat(41))));
        for text in ["A".repeat(42), "A".repeat(44), format!("{}=", "A".repeat(42)), format!("{}\n", "A".repeat(42)), "é".repeat(22)] { assert!(!valid_token(&text)); }
    }
    #[test]
    fn shortcuts_are_owned_transactional_and_same_key_is_noop() {
        use std::cell::RefCell;
        let events = RefCell::new(vec![]); let mut current = Some(1); let mut rollback = None;
        assert!(replace_shortcut(&mut current, &mut rollback,1, |_| panic!("same key"), |_| panic!("same key")).is_ok());
        assert!(replace_shortcut(&mut current, &mut rollback,2, |k| { events.borrow_mut().push(("register",k));Ok(()) }, |k| { events.borrow_mut().push(("unregister",k));if k==1 {Err(())} else {Ok(())} }).is_err());
        assert_eq!(current,Some(1)); assert_eq!(*events.borrow(),vec![("register",2),("unregister",1),("unregister",2)]);
        assert!(replace_shortcut(&mut current, &mut rollback,2, |_| Err(()), |_| panic!("new unavailable")).is_err()); assert_eq!(current,Some(1));
        assert!(replace_shortcut(&mut current, &mut rollback,2, |_| Ok(()), |_| Ok(())).is_ok()); assert_eq!(current,Some(2));
    }
    #[test]
    fn failed_os_rollback_keeps_owned_keys_for_retry() {
        let mut current=Some(1); let mut rollback=None;
        assert_eq!(replace_shortcut(&mut current,&mut rollback,2, |_| Ok(()), |_| Err(())),Err("cannot roll back shortcut"));
        assert_eq!(current,Some(1)); assert_eq!(rollback,Some(2));
        let removed=std::cell::RefCell::new(vec![]);
        assert!(replace_shortcut(&mut current,&mut rollback,3, |_| Ok(()), |key| {removed.borrow_mut().push(key);Ok(())}).is_ok());
        assert_eq!(*removed.borrow(),vec![2,1]); assert_eq!(current,Some(3)); assert_eq!(rollback,None);
    }
}
