// Descriptor-relative traversal: no component or file target follows a symlink.
// Windows fails closed until equivalent reparse-point-safe operations are implemented.
#[cfg(unix)]
mod implementation {
    use std::{ffi::{CString, OsStr}, fs::File, io::{self, Read, Write}, os::unix::{ffi::OsStrExt, fs::{MetadataExt, PermissionsExt}, io::{AsRawFd, FromRawFd}}, path::{Component, Path}, sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};
    #[cfg(target_os = "macos")]
    mod flags { pub const DIRECTORY: i32 = 0x100000; pub const NOFOLLOW: i32 = 0x100; pub const CLOEXEC: i32 = 0x1000000; pub const NONBLOCK: i32 = 4; pub const CREATE: i32 = 0x200; pub const EXCLUSIVE: i32 = 0x800; pub const APPEND: i32 = 8; }
    #[cfg(not(target_os = "macos"))]
    mod flags { pub const DIRECTORY: i32 = 0x10000; pub const NOFOLLOW: i32 = 0x20000; pub const CLOEXEC: i32 = 0x80000; pub const NONBLOCK: i32 = 0x800; pub const CREATE: i32 = 0x40; pub const EXCLUSIVE: i32 = 0x80; pub const APPEND: i32 = 0x400; }
    #[cfg(target_os = "macos")]
    type Mode = u16;
    #[cfg(not(target_os = "macos"))]
    type Mode = u32;
    unsafe extern "C" {
        fn openat(fd: i32, path: *const std::ffi::c_char, flags: i32, ...) -> i32;
        fn mkdirat(fd: i32, path: *const std::ffi::c_char, mode: Mode) -> i32;
        fn renameat(oldfd: i32, old: *const std::ffi::c_char, newfd: i32, new: *const std::ffi::c_char) -> i32;
        fn unlinkat(fd: i32, path: *const std::ffi::c_char, flags: i32) -> i32;
    }
    static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);
    fn invalid() -> io::Error { io::Error::new(io::ErrorKind::InvalidInput, "unsafe local path") }
    fn name(value: &OsStr) -> io::Result<CString> {
        if value.is_empty() || value == "." || value == ".." || value.as_bytes().contains(&b'/') { return Err(invalid()); }
        CString::new(value.as_bytes()).map_err(|_| invalid())
    }
    fn opened(fd: i32) -> io::Result<File> {
        if fd < 0 { Err(io::Error::last_os_error()) } else { Ok(unsafe { File::from_raw_fd(fd) }) }
    }
    pub struct SafeDir(File);
    impl SafeDir {
        pub fn open(path: &Path, create: bool) -> io::Result<Self> {
            if !path.is_absolute() { return Err(invalid()); }
            let mut directory = Self(File::open("/")?);
            for component in path.components() {
                match component {
                    Component::RootDir | Component::CurDir => (),
                    Component::Normal(part) => { directory = directory.child(part, create)?; },
                    _ => return Err(invalid()),
                }
            }
            Ok(directory)
        }
        fn child(&self, part: &OsStr, create: bool) -> io::Result<Self> {
            let part = name(part)?;
            let open = || opened(unsafe { openat(self.0.as_raw_fd(), part.as_ptr(), flags::DIRECTORY | flags::NOFOLLOW | flags::CLOEXEC) });
            match open() {
                Ok(file) => Ok(Self(file)),
                Err(e) if create && e.kind() == io::ErrorKind::NotFound => {
                    if unsafe { mkdirat(self.0.as_raw_fd(), part.as_ptr(), 0o700) } < 0 {
                        let err = io::Error::last_os_error();
                        if err.kind() != io::ErrorKind::AlreadyExists { return Err(err); }
                    }
                    open().map(Self)
                },
                Err(e) => Err(e),
            }
        }
        fn file(&self, value: &str, options: i32) -> io::Result<File> {
            let value = name(OsStr::new(value))?;
            let file = opened(unsafe { openat(self.0.as_raw_fd(), value.as_ptr(), options | flags::NOFOLLOW | flags::CLOEXEC | flags::NONBLOCK, 0o600u32) })?;
            let metadata = file.metadata()?;
            // Hard-linked targets also cannot be used to append into unrelated files.
            if !metadata.is_file() || metadata.nlink() != 1 { return Err(invalid()); }
            Ok(file)
        }
        pub fn check_target(&self, value: &str) -> io::Result<()> {
            match self.file(value, 0) {
                Ok(_) => Ok(()),
                Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(e),
            }
        }
        pub fn read(&self, value: &str) -> io::Result<Vec<u8>> {
            let file = self.file(value, 0)?;
            let mut bytes = vec![]; file.take(65_537).read_to_end(&mut bytes)?;
            if bytes.len() > 65_536 { return Err(invalid()); }
            Ok(bytes)
        }
        fn temporary(&self) -> io::Result<(String, File)> {
            let time = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| invalid())?.as_nanos();
            for _ in 0..32 {
                let name = format!(".settings-{}-{time}-{}.tmp", std::process::id(), NEXT_TEMP.fetch_add(1,Ordering::Relaxed));
                match self.file(&name, 1 | flags::CREATE | flags::EXCLUSIVE) {
                    Ok(file) => { file.set_permissions(std::fs::Permissions::from_mode(0o600))?; return Ok((name,file)); },
                    Err(e) if e.kind() == io::ErrorKind::AlreadyExists => (),
                    Err(e) => return Err(e),
                }
            }
            Err(invalid())
        }
        pub fn atomic_settings(&self, bytes: &[u8]) -> io::Result<()> {
            self.check_target("settings.json")?;
            // Reject the legacy fixed temp name if it was planted, but never use it.
            self.check_target("settings.tmp")?;
            let (temporary, mut file) = self.temporary()?;
            let temp = name(OsStr::new(&temporary))?;
            let target = name(OsStr::new("settings.json"))?;
            let result = (|| {
                file.write_all(bytes)?; file.sync_all()?;
                self.check_target("settings.json")?;
                if unsafe { renameat(self.0.as_raw_fd(), temp.as_ptr(), self.0.as_raw_fd(), target.as_ptr()) } < 0 { return Err(io::Error::last_os_error()); }
                self.0.sync_all()
            })();
            if result.is_err() { unsafe { unlinkat(self.0.as_raw_fd(), temp.as_ptr(), 0); } }
            result
        }
        pub fn diagnostic(&self, status: crate::hardening::BootstrapStatus) -> io::Result<()> {
            let mut file = self.file("bootstrap.log", 1 | flags::CREATE | flags::APPEND)?;
            file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
            file.write_all(status.diagnostic())?; file.sync_all()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{fs, os::unix::fs::symlink, path::PathBuf};
        struct Fixture(PathBuf);
        impl Fixture {
            fn new() -> Self {
                // All test writes remain under native target, not real client data.
                let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target").join(format!("native-test-{}-{}",std::process::id(),NEXT_TEMP.fetch_add(1,Ordering::Relaxed)));
                fs::create_dir(&path).unwrap(); Self(path)
            }
            fn dir(&self) -> SafeDir { SafeDir::open(&self.0,true).unwrap() }
        }
        impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
        #[test]
        fn symlink_components_and_dotdot_overrides_are_rejected() {
            let fixture = Fixture::new(); fs::create_dir(fixture.0.join("real")).unwrap();
            symlink(fixture.0.join("real"),fixture.0.join("linked")).unwrap();
            assert!(SafeDir::open(&fixture.0.join("linked/client"),true).is_err());
            assert!(crate::hardening::resolve_data(&fixture.0,Some("linked/../client".as_ref())).is_err());
            assert!(!fixture.0.join("real/client").exists());
        }
        #[test]
        fn settings_log_and_legacy_temp_symlinks_never_touch_victim() {
            for name in ["settings.json", "settings.tmp", "bootstrap.log", "daemon.log"] {
                let fixture = Fixture::new(); let victim = fixture.0.join("victim"); fs::write(&victim,b"secret").unwrap();
                symlink(&victim,fixture.0.join(name)).unwrap(); let dir = fixture.dir();
                assert!(dir.check_target(name).is_err());
                match name {
                    "settings.json" | "settings.tmp" => assert!(dir.atomic_settings(b"replacement").is_err()),
                    "bootstrap.log" => assert!(dir.diagnostic(crate::hardening::BootstrapStatus::Spawned).is_err()),
                    _ => (),
                }
                assert_eq!(fs::read(victim).unwrap(),b"secret");
            }
        }
        #[test]
        fn unique_exclusive_temps_atomic_write_and_private_permissions() {
            let fixture = Fixture::new(); let dir = fixture.dir();
            let (first,a) = dir.temporary().unwrap(); let (second,b) = dir.temporary().unwrap();
            assert_ne!(first,second); assert_eq!(a.metadata().unwrap().permissions().mode() & 0o777,0o600);
            assert_eq!(b.metadata().unwrap().permissions().mode() & 0o777,0o600);
            assert!(dir.file(&first,1 | flags::CREATE | flags::EXCLUSIVE).is_err());
            dir.atomic_settings(b"old").unwrap(); dir.atomic_settings(b"new").unwrap(); assert_eq!(dir.read("settings.json").unwrap(),b"new");
            assert_eq!(fs::metadata(fixture.0.join("settings.json")).unwrap().permissions().mode() & 0o777,0o600);
            assert_eq!(fs::read_dir(&fixture.0).unwrap().count(),3);
        }
        #[test]
        fn pinned_directory_cannot_be_redirected_by_parent_symlink_swap() {
            let fixture = Fixture::new(); fs::create_dir(fixture.0.join("client")).unwrap(); fs::create_dir(fixture.0.join("victim")).unwrap();
            let dir = SafeDir::open(&fixture.0.join("client"),false).unwrap();
            fs::rename(fixture.0.join("client"),fixture.0.join("pinned")).unwrap();
            symlink(fixture.0.join("victim"),fixture.0.join("client")).unwrap();
            dir.atomic_settings(b"safe").unwrap(); assert!(!fixture.0.join("victim/settings.json").exists());
            assert_eq!(fs::read(fixture.0.join("pinned/settings.json")).unwrap(),b"safe");
        }
        #[test]
        fn hardlinks_and_invalid_leaf_names_are_rejected() {
            let fixture = Fixture::new(); fs::write(fixture.0.join("victim"),b"secret").unwrap();
            fs::hard_link(fixture.0.join("victim"),fixture.0.join("bootstrap.log")).unwrap();
            let dir = fixture.dir(); assert!(dir.diagnostic(crate::hardening::BootstrapStatus::Spawned).is_err());
            for value in ["../victim", "/victim", "", ".", ".."] { assert!(dir.check_target(value).is_err()); }
            assert_eq!(fs::read(fixture.0.join("victim")).unwrap(),b"secret");
        }
    }
}
#[cfg(unix)]
pub use implementation::SafeDir;

#[cfg(not(unix))]
pub struct SafeDir;
#[cfg(not(unix))]
impl SafeDir {
    pub fn open(_: &std::path::Path, _: bool) -> std::io::Result<Self> { Err(std::io::ErrorKind::Unsupported.into()) }
    pub fn check_target(&self, _: &str) -> std::io::Result<()> { Err(std::io::ErrorKind::Unsupported.into()) }
    pub fn read(&self, _: &str) -> std::io::Result<Vec<u8>> { Err(std::io::ErrorKind::Unsupported.into()) }
    pub fn atomic_settings(&self, _: &[u8]) -> std::io::Result<()> { Err(std::io::ErrorKind::Unsupported.into()) }
    pub fn diagnostic(&self, _: crate::hardening::BootstrapStatus) -> std::io::Result<()> { Err(std::io::ErrorKind::Unsupported.into()) }
}
