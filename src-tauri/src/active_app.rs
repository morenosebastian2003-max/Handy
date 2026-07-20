//! Detecta la app a la que el usuario está por escribir, para que el Modo
//! Camuflaje elija el formato solo ("se adapta a la app donde escribes, sin que
//! se lo pidas"). Por privacidad, de este módulo SOLO sale una categoría gruesa
//! (`email` | `code` | `chat` | `notes` | ""), nunca el título de la ventana,
//! que podría contener contenido privado. Windows implementado; otras
//! plataformas devuelven "" (→ Pulido) hasta que se implementen.

/// Categoría de la app en primer plano: `"email"`, `"code"`, `"chat"`,
/// `"notes"`, o `""` (desconocida → pulido por defecto).
#[cfg(target_os = "windows")]
pub fn active_app_category() -> String {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return String::new();
        }

        // Título de la ventana — usado SOLO localmente para categorizar; nunca
        // se envía a ningún lado.
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = if title_len > 0 {
            String::from_utf16_lossy(&title_buf[..title_len as usize]).to_lowercase()
        } else {
            String::new()
        };

        // Nombre del ejecutable del proceso dueño de la ventana.
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
        let mut exe = String::new();
        if pid != 0 {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut buf = [0u16; 260];
                let mut size = buf.len() as u32;
                if QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    PWSTR(buf.as_mut_ptr()),
                    &mut size,
                )
                .is_ok()
                {
                    let full = String::from_utf16_lossy(&buf[..size as usize]);
                    exe = full
                        .rsplit(|c| c == '\\' || c == '/')
                        .next()
                        .unwrap_or("")
                        .to_lowercase();
                }
                let _ = CloseHandle(handle);
            }
        }

        categorize(&exe, &title)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn active_app_category() -> String {
    // TODO(mac/linux): implementar detección de la app activa
    // (NSWorkspace.frontmostApplication en macOS; X11/wlroots en Linux).
    String::new()
}

/// Mapea (ejecutable, título) → categoría de Camuflaje. Heurística por nombre de
/// app, con el título como refuerzo (útil para navegadores: Gmail, WhatsApp Web…).
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn categorize(exe: &str, title: &str) -> String {
    let has = |hay: &str, needles: &[&str]| needles.iter().any(|n| hay.contains(n));

    // Chat / mensajería
    if has(
        exe,
        &["slack", "discord", "whatsapp", "telegram", "teams", "messenger", "signal"],
    ) || has(title, &["whatsapp", "slack", "discord", "messenger", "telegram"])
    {
        return "chat".to_string();
    }
    // Editores de código / terminales
    if has(
        exe,
        &[
            "code", "cursor", "devenv", "idea64", "pycharm64", "webstorm64", "goland64",
            "clion64", "rider64", "sublime_text", "windowsterminal", "powershell", "pwsh",
            "cmd", "alacritty", "wezterm",
        ],
    ) {
        return "code".to_string();
    }
    // Correo (incluye Outlook/Gmail en navegador, por título)
    if has(exe, &["outlook", "thunderbird", "mailspring", "spark", "airmail"])
        || has(
            title,
            &[
                "gmail", "outlook", "proton mail", "bandeja de entrada", "inbox",
                "correo", "redactar", "compose", "mensaje nuevo", "new message",
            ],
        )
    {
        return "email".to_string();
    }
    // Notas / documentos
    if has(
        exe,
        &["notion", "obsidian", "winword", "onenote", "notepad", "typora", "logseq"],
    ) || has(title, &["google docs", "documentos de google", "notion", "obsidian"])
    {
        return "notes".to_string();
    }

    String::new()
}
