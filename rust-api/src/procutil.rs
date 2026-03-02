use nix::sys::signal::{killpg, Signal};
use nix::unistd::Pid;
use std::io;
use std::os::unix::process::CommandExt;
use std::path::Path;
use tokio::process::Command;

pub struct Spawned {
    pub pid: i32,
    pub pgid: i32,
    pub child: tokio::process::Child,
}

pub fn spawn_pgroup(mut cmd: Command) -> io::Result<Spawned> {
    unsafe {
        cmd.pre_exec(|| {
            if libc::setpgid(0, 0) != 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }
    let child = cmd.spawn()?;
    let pid = child.id().unwrap_or(0) as i32;
    Ok(Spawned {
        pid,
        pgid: pid,
        child,
    })
}

pub fn kill_pgid(pgid: i32, sig: i32) -> io::Result<()> {
    if pgid <= 0 {
        return Ok(());
    }
    let rc = unsafe { libc::kill(-pgid, sig) };
    if rc == 0 {
        return Ok(());
    }
    let e = io::Error::last_os_error();
    if e.kind() == io::ErrorKind::NotFound {
        return Ok(());
    }
    Err(e)
}

pub fn pid_alive(pid: i32) -> bool {
    if pid <= 0 {
        return false;
    }
    Path::new(&format!("/proc/{pid}")).exists()
}

pub fn kill_pgid_term_then_kill(pgid: i32) {
    if pgid <= 0 {
        return;
    }
    let _ = killpg(Pid::from_raw(pgid), Signal::SIGTERM);
}

pub fn kill_pgid_kill(pgid: i32) {
    if pgid <= 0 {
        return;
    }
    let _ = killpg(Pid::from_raw(pgid), Signal::SIGKILL);
}

pub async fn terminate_then_kill(pgid: i32, grace_ms: u64) {
    kill_pgid_term_then_kill(pgid);
    tokio::time::sleep(std::time::Duration::from_millis(grace_ms)).await;
    kill_pgid_kill(pgid);
}
