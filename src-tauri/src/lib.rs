use serde::Serialize;
use ssh2::Session;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

// ── Types ─────────────────────────────────────────────────────────────────────

enum ChannelMsg {
    Data(Vec<u8>),
    Resize(u32, u32),
    Close,
}

struct SshSession {
    sftp_session: Session,
    _sftp_tcp: TcpStream,
    channel_writer: std::sync::mpsc::Sender<ChannelMsg>,
    _label: String,
}

struct AppState {
    sessions: Mutex<HashMap<String, Arc<SshSession>>>,
}

// ── Serializable data types ───────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct FileItem {
    filename: String,
    is_dir: bool,
    size: u64,
}

#[derive(Serialize, Clone)]
struct DirectoryResult {
    resolved_path: String,
    items: Vec<FileItem>,
}

#[derive(Serialize, Clone)]
pub struct ProgressPayload {
    bytes_processed: u64,
    total_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct StatsPayload {
    session_id: String,
    cpu_percent: f32,
    mem_used_mb: u64,
    mem_total_mb: u64,
    uptime_secs: u64,
}

#[derive(Serialize, Clone)]
pub struct SystemInfo {
    hostname: String,
    os_pretty: String,
    kernel: String,
    arch: String,
    cpu_model: String,
    cpu_cores: u32,
    mem_total_gb: f32,
}

// ── Auth helper ───────────────────────────────────────────────────────────────

fn authenticate(
    sess: &mut Session,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
) -> Result<(), String> {
    if let Some(key_path) = private_key {
        let expanded = if key_path.starts_with('~') {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/root".into());
            key_path.replacen('~', &home, 1)
        } else {
            key_path.into()
        };
        sess.userauth_pubkey_file(username, None, Path::new(&expanded), password)
            .map_err(|e| format!("Key auth failed: {}", e))?;
    } else if let Some(pw) = password {
        sess.userauth_password(username, pw)
            .map_err(|e| format!("Password auth failed: {}", e))?;
    } else {
        let mut agent = sess.agent().map_err(|e| format!("Agent: {}", e))?;
        agent
            .connect()
            .map_err(|e| format!("Agent connect: {}", e))?;
        agent
            .list_identities()
            .map_err(|e| format!("Agent list: {}", e))?;
        let ids = agent
            .identities()
            .map_err(|e| format!("Agent ids: {}", e))?;
        let mut ok = false;
        for id in ids {
            if agent.userauth(username, &id).is_ok() {
                ok = true;
                break;
            }
        }
        if !ok {
            return Err("No valid authentication method. Provide a password, key file, or configure SSH agent.".into());
        }
    }
    if !sess.authenticated() {
        return Err("Authentication failed".into());
    }
    Ok(())
}

fn new_session(addr: &str) -> Result<(Session, TcpStream), String> {
    let tcp = TcpStream::connect(addr).map_err(|e| format!("TCP connect: {}", e))?;
    let mut sess = Session::new().map_err(|e| format!("SSH session: {}", e))?;
    sess.set_tcp_stream(tcp.try_clone().map_err(|e| format!("TCP clone: {}", e))?);
    sess.handshake().map_err(|e| format!("Handshake: {}", e))?;
    Ok((sess, tcp))
}

// ── connect_ssh ───────────────────────────────────────────────────────────────

#[tauri::command]
fn connect_ssh(
    app: AppHandle,
    host: String,
    username: String,
    password: Option<String>,
    private_key: Option<String>,
    port: u16,
    label: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let addr = format!("{}:{}", host, port);

    // Session 1: PTY shell
    let (mut term_sess, _term_tcp) = new_session(&addr)?;
    authenticate(
        &mut term_sess,
        &username,
        password.as_deref(),
        private_key.as_deref(),
    )?;

    let mut channel = term_sess
        .channel_session()
        .map_err(|e| format!("Channel: {}", e))?;
    channel
        .request_pty("xterm-256color", None, Some((80, 24, 0, 0)))
        .map_err(|e| format!("PTY: {}", e))?;
    channel.shell().map_err(|e| format!("Shell: {}", e))?;

    let session_id = Uuid::new_v4().to_string();
    let _sid = session_id.clone();

    // Session 2: Stats polling
    let (mut stats_sess, stats_tcp) = new_session(&addr)?;
    authenticate(
        &mut stats_sess,
        &username,
        password.as_deref(),
        private_key.as_deref(),
    )?;

    let stats_arc: Arc<Mutex<Session>> = Arc::new(Mutex::new(stats_sess));
    let stats_arc_bg = stats_arc.clone();
    let app_stats = app.clone();
    let sid_stats = session_id.clone();

    thread::spawn(move || {
        let _keep = stats_tcp;
        loop {
            thread::sleep(std::time::Duration::from_secs(5));
            let guard = stats_arc_bg.lock().unwrap();
            guard.set_blocking(true);
            if let Some(payload) = poll_stats(&guard, &sid_stats) {
                let _ = app_stats.emit("stats:update", payload);
            }
        }
    });

    // Session 3: SFTP + on-demand exec (get_system_info)
    let (mut sftp_sess, sftp_tcp) = new_session(&addr)?;
    authenticate(
        &mut sftp_sess,
        &username,
        password.as_deref(),
        private_key.as_deref(),
    )?;

    // Channel message pipe (term input/resize)
    let (tx, rx) = std::sync::mpsc::channel::<ChannelMsg>();

    // PTY thread
    let app_pty = app.clone();
    let sid_pty = session_id.clone();
    thread::spawn(move || {
        // Keep session in blocking mode with a short timeout (100 ms).
        // When the read times out we loop back and drain the write queue.
        // This eliminates the set_blocking(true/false) toggle that caused
        // the PTY thread to deadlock under SSH flow-control back-pressure.
        term_sess.set_blocking(true);
        term_sess.set_timeout(100); // ms

        let mut buf = [0u8; 8192];
        'outer: loop {
            // ── drain write / resize / close messages ──────────────────────
            loop {
                match rx.try_recv() {
                    Ok(ChannelMsg::Data(data)) => {
                        if channel.write_all(&data).is_err() {
                            break 'outer;
                        }
                        let _ = channel.flush();
                    }
                    Ok(ChannelMsg::Resize(cols, rows)) => {
                        let _ = channel.request_pty_size(cols, rows, None, None);
                    }
                    Ok(ChannelMsg::Close) => break 'outer,
                    Err(std::sync::mpsc::TryRecvError::Empty) => break,
                    Err(std::sync::mpsc::TryRecvError::Disconnected) => break 'outer,
                }
            }

            // ── blocking read (unblocks on data or on the 100 ms timeout) ──
            match channel.read(&mut buf) {
                Ok(0) => break 'outer, // clean EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_pty.emit(&format!("terminal:data:{}", sid_pty), data);
                }
                Err(_) => {
                    // Covers: timeout, EAGAIN/WouldBlock, transient errors.
                    // Only exit if the channel has truly closed.
                    if channel.eof() {
                        break 'outer;
                    }
                    // Otherwise (timeout / EAGAIN) → loop back and check write queue.
                }
            }
        }
    });

    state.sessions.lock().unwrap().insert(
        session_id.clone(),
        Arc::new(SshSession {
            sftp_session: sftp_sess,
            _sftp_tcp: sftp_tcp,
            channel_writer: tx,
            _label: label,
        }),
    );

    Ok(session_id)
}

// ── Stats polling helper ──────────────────────────────────────────────────────

fn poll_stats(sess: &Session, session_id: &str) -> Option<StatsPayload> {
    let cmd = "cat /proc/stat | head -1; cat /proc/meminfo | grep -E 'MemTotal:|MemAvailable:'; cat /proc/uptime";
    let mut ch = sess.channel_session().ok()?;
    ch.exec(cmd).ok()?;
    let mut out = String::new();
    ch.read_to_string(&mut out).ok()?;
    ch.close().ok()?;

    let lines: Vec<&str> = out.lines().collect();

    let cpu = lines
        .first()
        .and_then(|l| {
            let nums: Vec<u64> = l
                .split_whitespace()
                .skip(1)
                .filter_map(|x| x.parse().ok())
                .collect();
            if nums.len() < 5 {
                return None;
            }
            let total: u64 = nums.iter().sum();
            let idle = nums[3] + nums.get(4).copied().unwrap_or(0);
            if total == 0 {
                return None;
            }
            Some(((total - idle) as f32 / total as f32) * 100.0)
        })
        .unwrap_or(0.0);

    let mut mem_total: u64 = 0;
    let mut mem_avail: u64 = 0;
    for l in &lines {
        if l.starts_with("MemTotal") {
            mem_total = l
                .split_whitespace()
                .nth(1)
                .and_then(|x| x.parse().ok())
                .unwrap_or(0)
                / 1024;
        } else if l.starts_with("MemAvailable") {
            mem_avail = l
                .split_whitespace()
                .nth(1)
                .and_then(|x| x.parse().ok())
                .unwrap_or(0)
                / 1024;
        }
    }
    let mem_used = mem_total.saturating_sub(mem_avail);

    let uptime = lines
        .last()
        .and_then(|l| l.split_whitespace().next())
        .and_then(|x| x.parse::<f64>().ok())
        .unwrap_or(0.0) as u64;

    Some(StatsPayload {
        session_id: session_id.to_string(),
        cpu_percent: cpu,
        mem_used_mb: mem_used,
        mem_total_mb: mem_total,
        uptime_secs: uptime,
    })
}

// ── get_system_info ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_system_info(session_id: String, state: State<'_, AppState>) -> Result<SystemInfo, String> {
    let sess_entry = {
        let guard = state.sessions.lock().unwrap();
        guard.get(&session_id).cloned().ok_or("Session not found")?
    };
    let sess = &sess_entry.sftp_session;
    sess.set_blocking(true);

    let cmd = concat!(
        "printf 'HOSTNAME=%s\\n' \"$(hostname)\"; ",
        "grep '^PRETTY_NAME' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '\"' || echo 'Unknown OS'; ",
        "printf 'KERNEL=%s\\n' \"$(uname -r)\"; ",
        "printf 'ARCH=%s\\n' \"$(uname -m)\"; ",
        "printf 'CORES=%s\\n' \"$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo)\"; ",
        "grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | sed 's/^ //'; ",
        "grep '^MemTotal' /proc/meminfo 2>/dev/null"
    );

    let mut ch = sess
        .channel_session()
        .map_err(|e| format!("Channel: {}", e))?;
    ch.exec(cmd).map_err(|e| format!("Exec: {}", e))?;
    let mut out = String::new();
    ch.read_to_string(&mut out)
        .map_err(|e| format!("Read: {}", e))?;
    ch.close().ok();

    let mut hostname = "unknown".to_string();
    let mut os_pretty = "Unknown OS".to_string();
    let mut kernel = "unknown".to_string();
    let mut arch = "unknown".to_string();
    let mut cpu_model = "Unknown CPU".to_string();
    let mut cpu_cores: u32 = 0;
    let mut mem_total_gb: f32 = 0.0;

    for (i, line) in out.lines().enumerate() {
        if line.starts_with("HOSTNAME=") {
            hostname = line["HOSTNAME=".len()..].trim().to_string();
        } else if line.starts_with("KERNEL=") {
            kernel = line["KERNEL=".len()..].trim().to_string();
        } else if line.starts_with("ARCH=") {
            arch = line["ARCH=".len()..].trim().to_string();
        } else if line.starts_with("CORES=") {
            cpu_cores = line["CORES=".len()..].trim().parse().unwrap_or(0);
        } else if line.starts_with("MemTotal:") {
            let kb: u64 = line
                .split_whitespace()
                .nth(1)
                .and_then(|x| x.parse().ok())
                .unwrap_or(0);
            mem_total_gb = kb as f32 / 1024.0 / 1024.0;
        } else if i == 1 {
            // Second line is the OS pretty name
            os_pretty = line.trim().to_string();
        } else if !line.is_empty()
            && !line.starts_with("HOSTNAME=")
            && !line.starts_with("KERNEL=")
            && !line.starts_with("ARCH=")
            && !line.starts_with("CORES=")
            && !line.starts_with("MemTotal:")
            && cpu_model == "Unknown CPU"
        {
            // Likely the CPU model line
            let candidate = line.trim().to_string();
            if !candidate.is_empty() && candidate != "Unknown OS" {
                cpu_model = candidate;
            }
        }
    }

    Ok(SystemInfo {
        hostname,
        os_pretty,
        kernel,
        arch,
        cpu_model,
        cpu_cores,
        mem_total_gb,
    })
}

// ── disconnect_ssh ────────────────────────────────────────────────────────────

#[tauri::command]
fn disconnect_ssh(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(s) = state.sessions.lock().unwrap().remove(&session_id) {
        let _ = s.channel_writer.send(ChannelMsg::Close);
        let _ = s.sftp_session.disconnect(None, "User disconnect", None);
    }
    Ok(())
}

// ── terminal_input / terminal_resize ─────────────────────────────────────────

#[tauri::command]
fn terminal_input(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Some(s) = state.sessions.lock().unwrap().get(&session_id) {
        let _ = s.channel_writer.send(ChannelMsg::Data(data.into_bytes()));
    }
    Ok(())
}

#[tauri::command]
fn terminal_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Some(s) = state.sessions.lock().unwrap().get(&session_id) {
        let _ = s.channel_writer.send(ChannelMsg::Resize(cols, rows));
    }
    Ok(())
}

// ── SFTP ─────────────────────────────────────────────────────────────────────

#[tauri::command]
fn request_directory(
    session_id: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<DirectoryResult, String> {
    let sess = {
        let guard = state.sessions.lock().unwrap();
        guard.get(&session_id).cloned().ok_or("Session not found")?
    };
    sess.sftp_session.set_blocking(true);

    let sftp = sess
        .sftp_session
        .sftp()
        .map_err(|e| format!("SFTP: {}", e))?;

    // Always resolve to an absolute path so navigation stays absolute
    let target = if path == "." || path.is_empty() {
        sftp.realpath(Path::new("."))
            .unwrap_or_else(|_| std::path::PathBuf::from("/"))
    } else {
        // Also canonicalize user-supplied paths to catch any .. or symlinks
        sftp.realpath(Path::new(&path))
            .unwrap_or_else(|_| std::path::PathBuf::from(&path))
    };

    let resolved_path = target.to_string_lossy().to_string();

    let entries = sftp
        .readdir(&target)
        .map_err(|e| format!("readdir: {}", e))?;
    let mut items: Vec<FileItem> = entries
        .into_iter()
        .filter_map(|(pb, stat)| {
            let filename = pb.file_name()?.to_string_lossy().to_string();
            if filename.starts_with('.') {
                return None;
            }
            Some(FileItem {
                filename,
                is_dir: stat.is_dir(),
                size: stat.size.unwrap_or(0),
            })
        })
        .collect();

    items.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.filename.to_lowercase().cmp(&b.filename.to_lowercase()),
    });
    Ok(DirectoryResult {
        resolved_path,
        items,
    })
}

fn get_total_size(local_path: &Path) -> Result<u64, String> {
    let metadata = std::fs::metadata(local_path).map_err(|e| format!("Metadata {}: {}", local_path.display(), e))?;
    if metadata.is_dir() {
        let mut total = 0;
        for entry in std::fs::read_dir(local_path).map_err(|e| format!("Read dir {}: {}", local_path.display(), e))? {
            let entry = entry.map_err(|e| format!("Dir entry: {}", e))?;
            total += get_total_size(&entry.path())?;
        }
        Ok(total)
    } else {
        Ok(metadata.len())
    }
}

fn upload_recursive(app: &AppHandle, sftp: &ssh2::Sftp, session_id: &str, local_path: &Path, remote_dir: &str, uploaded: &mut u64, total: u64) -> Result<(), String> {
    let metadata = std::fs::metadata(local_path).map_err(|e| format!("Metadata {}: {}", local_path.display(), e))?;
    let filename = local_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "upload".into());
    let dest = format!("{}/{}", remote_dir.trim_end_matches('/'), filename);

    if metadata.is_dir() {
        let _ = sftp.mkdir(Path::new(&dest), 0o755);
        for entry in std::fs::read_dir(local_path).map_err(|e| format!("Read dir {}: {}", local_path.display(), e))? {
            let entry = entry.map_err(|e| format!("Dir entry: {}", e))?;
            upload_recursive(app, sftp, session_id, &entry.path(), &dest, uploaded, total)?;
        }
    } else {
        let mut file = std::fs::File::open(local_path).map_err(|e| format!("Open {}: {}", local_path.display(), e))?;
        let mut rf = sftp
            .create(Path::new(&dest))
            .map_err(|e| format!("Create {}: {}", dest, e))?;
        
        let mut buffer = [0u8; 65536]; // 64KB chunks
        loop {
            let n = file.read(&mut buffer).map_err(|e| format!("Read {}: {}", local_path.display(), e))?;
            if n == 0 { break; }
            rf.write_all(&buffer[..n]).map_err(|e| format!("Write {}: {}", dest, e))?;
            *uploaded += n as u64;
            
            // Emit progress
            let _ = app.emit(&format!("sftp:progress:{}", session_id), ProgressPayload {
                bytes_processed: *uploaded,
                total_bytes: total,
            });
        }
    }
    Ok(())
}

#[tauri::command]
fn sftp_upload(
    app: AppHandle,
    session_id: String,
    local_path: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sess = {
        let guard = state.sessions.lock().unwrap();
        guard.get(&session_id).cloned().ok_or("Session not found")?
    };
    sess.sftp_session.set_blocking(true);

    let sftp = sess
        .sftp_session
        .sftp()
        .map_err(|e| format!("SFTP: {}", e))?;

    let total_size = get_total_size(Path::new(&local_path))?;
    let mut uploaded = 0;

    let _ = app.emit(&format!("sftp:progress:{}", session_id), ProgressPayload {
        bytes_processed: 0,
        total_bytes: total_size,
    });

    upload_recursive(&app, &sftp, &session_id, Path::new(&local_path), &remote_path, &mut uploaded, total_size)
}

#[tauri::command]
fn sftp_mkdir(
    session_id: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sess = {
        let guard = state.sessions.lock().unwrap();
        guard.get(&session_id).cloned().ok_or("Session not found")?
    };
    sess.sftp_session.set_blocking(true);
    let sftp = sess
        .sftp_session
        .sftp()
        .map_err(|e| format!("SFTP: {}", e))?;
    sftp.mkdir(Path::new(&remote_path), 0o755)
        .map_err(|e| format!("mkdir: {}", e))?;
    Ok(())
}

fn get_remote_total_size(sftp: &ssh2::Sftp, remote_path: &Path) -> Result<u64, String> {
    let stat = sftp.stat(remote_path).map_err(|e| format!("Stat {}: {}", remote_path.display(), e))?;
    if stat.is_dir() {
        let mut total = 0;
        for entry in sftp.readdir(remote_path).unwrap_or_default() {
            let (path, _) = entry;
            if path.file_name().map(|n| n == "." || n == "..").unwrap_or(false) {
                continue;
            }
            total += get_remote_total_size(sftp, &path)?;
        }
        Ok(total)
    } else {
        Ok(stat.size.unwrap_or(0))
    }
}

fn delete_recursive(app: &AppHandle, sftp: &ssh2::Sftp, session_id: &str, remote_path: &Path, processed: &mut u64, total: u64) -> Result<(), String> {
    let stat = sftp.stat(remote_path).map_err(|e| format!("Stat {}: {}", remote_path.display(), e))?;
    if stat.is_dir() {
        for entry in sftp.readdir(remote_path).unwrap_or_default() {
            let (path, _) = entry;
            if path.file_name().map(|n| n == "." || n == "..").unwrap_or(false) {
                continue;
            }
            delete_recursive(app, sftp, session_id, &path, processed, total)?;
        }
        sftp.rmdir(remote_path).map_err(|e| format!("rmdir {}: {}", remote_path.display(), e))?;
    } else {
        let size = stat.size.unwrap_or(0);
        sftp.unlink(remote_path).map_err(|e| format!("unlink {}: {}", remote_path.display(), e))?;
        *processed += size;
        let _ = app.emit(&format!("sftp:progress:{}", session_id), ProgressPayload {
            bytes_processed: *processed,
            total_bytes: total,
        });
    }
    Ok(())
}

#[tauri::command]
fn sftp_delete(
    app: AppHandle,
    session_id: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sess = {
        let guard = state.sessions.lock().unwrap();
        guard.get(&session_id).cloned().ok_or("Session not found")?
    };
    sess.sftp_session.set_blocking(true);
    let sftp = sess
        .sftp_session
        .sftp()
        .map_err(|e| format!("SFTP: {}", e))?;
    
    let remote_path_obj = Path::new(&remote_path);
    let total = get_remote_total_size(&sftp, remote_path_obj).unwrap_or(1);
    let mut processed = 0;
    
    let _ = app.emit(&format!("sftp:progress:{}", session_id), ProgressPayload {
        bytes_processed: 0,
        total_bytes: total,
    });
    
    delete_recursive(&app, &sftp, &session_id, remote_path_obj, &mut processed, total)
}

pub mod snmp_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            connect_ssh,
            disconnect_ssh,
            get_system_info,
            request_directory,
            terminal_input,
            terminal_resize,
            sftp_upload,
            sftp_mkdir,
            sftp_delete,
            snmp_commands::snmp_connect_and_walk,
            snmp_commands::snmp_get,
            snmp_commands::snmp_set,
            snmp_commands::snmp_run_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
