//! OS-backed storage for post-processing API keys.
//!
//! Windows stores secrets in Credential Manager and macOS stores them in the
//! user's Keychain. Linux keeps the legacy local-storage behavior for now so
//! existing installations do not lose functionality, but the public settings
//! payload always strips the actual secret before it reaches the webview.

use crate::settings::{ApiKeyStorageStatus, AppSettings};
use log::{info, warn};

const KEYCHAIN_SERVICE: &str = "com.fuwa.desktop.post-process";

trait CredentialBackend {
    fn is_secure(&self) -> bool;
    fn save(&self, provider_id: &str, api_key: &str) -> Result<(), String>;
    fn load(&self, provider_id: &str) -> Result<String, String>;
    fn delete(&self, provider_id: &str) -> Result<(), String>;
}

struct SystemCredentialBackend;

impl CredentialBackend for SystemCredentialBackend {
    fn is_secure(&self) -> bool {
        platform::IS_SECURE
    }

    fn save(&self, provider_id: &str, api_key: &str) -> Result<(), String> {
        platform::save(provider_id, api_key)
    }

    fn load(&self, provider_id: &str) -> Result<String, String> {
        platform::load(provider_id)
    }

    fn delete(&self, provider_id: &str) -> Result<(), String> {
        platform::delete(provider_id)
    }
}

pub(crate) fn migrate_legacy_api_keys(settings: &mut AppSettings) -> bool {
    migrate_legacy_api_keys_with_backend(settings, &SystemCredentialBackend)
}

pub(crate) fn save_api_key(
    settings: &mut AppSettings,
    provider_id: &str,
    api_key: &str,
) -> Result<(), String> {
    save_api_key_with_backend(settings, provider_id, api_key, &SystemCredentialBackend)
}

pub(crate) fn load_api_key(
    settings: &AppSettings,
    provider_id: &str,
) -> Result<String, String> {
    load_api_key_with_backend(settings, provider_id, &SystemCredentialBackend)
}

pub(crate) fn delete_api_key(
    settings: &mut AppSettings,
    provider_id: &str,
) -> Result<(), String> {
    delete_api_key_with_backend(settings, provider_id, &SystemCredentialBackend)
}

fn migrate_legacy_api_keys_with_backend(
    settings: &mut AppSettings,
    backend: &impl CredentialBackend,
) -> bool {
    let legacy_keys: Vec<(String, String)> = settings
        .post_process_api_keys
        .iter()
        .filter(|(_, value)| !value.trim().is_empty())
        .map(|(provider_id, value)| (provider_id.clone(), value.clone()))
        .collect();

    let mut changed = false;
    for (provider_id, api_key) in legacy_keys {
        if !backend.is_secure() {
            changed |= set_status(
                settings,
                &provider_id,
                ApiKeyStorageStatus::LocalPlaintext,
            );
            continue;
        }

        match backend
            .save(&provider_id, &api_key)
            .and_then(|_| backend.load(&provider_id))
        {
            Ok(stored_key) if stored_key == api_key => {
                settings
                    .post_process_api_keys
                    .insert(provider_id.clone(), String::new());
                changed = true;
                changed |= set_status(settings, &provider_id, ApiKeyStorageStatus::Secure);
                info!(
                    "Migrated post-processing API key for provider '{}' to OS credential storage",
                    provider_id
                );
            }
            Ok(_) => {
                changed |= set_status(
                    settings,
                    &provider_id,
                    ApiKeyStorageStatus::LocalPlaintext,
                );
                warn!(
                    "Credential verification failed while migrating provider '{}'; preserving legacy value",
                    provider_id
                );
            }
            Err(error) => {
                changed |= set_status(
                    settings,
                    &provider_id,
                    ApiKeyStorageStatus::LocalPlaintext,
                );
                warn!(
                    "Could not migrate API key for provider '{}' to OS credential storage: {}. Preserving legacy value.",
                    provider_id, error
                );
            }
        }
    }

    changed
}

fn save_api_key_with_backend(
    settings: &mut AppSettings,
    provider_id: &str,
    api_key: &str,
    backend: &impl CredentialBackend,
) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    if backend.is_secure() {
        backend.save(provider_id, api_key)?;
        let stored_key = backend.load(provider_id)?;
        if stored_key != api_key {
            return Err("Credential storage verification failed".to_string());
        }

        settings
            .post_process_api_keys
            .insert(provider_id.to_string(), String::new());
        set_status(settings, provider_id, ApiKeyStorageStatus::Secure);
    } else {
        // Linux compatibility path until Secret Service support is added.
        settings
            .post_process_api_keys
            .insert(provider_id.to_string(), api_key.to_string());
        set_status(
            settings,
            provider_id,
            ApiKeyStorageStatus::LocalPlaintext,
        );
    }

    Ok(())
}

fn load_api_key_with_backend(
    settings: &AppSettings,
    provider_id: &str,
    backend: &impl CredentialBackend,
) -> Result<String, String> {
    let status = settings
        .post_process_api_key_status
        .get(provider_id)
        .copied()
        .unwrap_or_default();

    if status == ApiKeyStorageStatus::Secure {
        return backend.load(provider_id);
    }

    Ok(settings
        .post_process_api_keys
        .get(provider_id)
        .cloned()
        .unwrap_or_default())
}

fn delete_api_key_with_backend(
    settings: &mut AppSettings,
    provider_id: &str,
    backend: &impl CredentialBackend,
) -> Result<(), String> {
    let status = settings
        .post_process_api_key_status
        .get(provider_id)
        .copied()
        .unwrap_or_default();

    if status == ApiKeyStorageStatus::Secure {
        backend.delete(provider_id)?;
    }

    settings
        .post_process_api_keys
        .insert(provider_id.to_string(), String::new());
    set_status(settings, provider_id, ApiKeyStorageStatus::Missing);
    Ok(())
}

fn set_status(
    settings: &mut AppSettings,
    provider_id: &str,
    status: ApiKeyStorageStatus,
) -> bool {
    settings
        .post_process_api_key_status
        .insert(provider_id.to_string(), status)
        != Some(status)
}

#[cfg(target_os = "windows")]
mod platform {
    use super::KEYCHAIN_SERVICE;
    use std::ffi::c_void;
    use std::ptr::null_mut;
    use std::slice;
    use windows_sys::Win32::Foundation::{GetLastError, FILETIME};
    use windows_sys::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW,
        CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    pub(super) const IS_SECURE: bool = true;

    struct CredentialGuard(*mut CREDENTIALW);

    impl Drop for CredentialGuard {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe { CredFree(self.0.cast::<c_void>()) };
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn target_name(provider_id: &str) -> Vec<u16> {
        wide(&format!("{KEYCHAIN_SERVICE}/{provider_id}"))
    }

    fn last_error(action: &str) -> String {
        let code = unsafe { GetLastError() };
        format!("Windows Credential Manager could not {action} (error {code})")
    }

    pub(super) fn save(provider_id: &str, api_key: &str) -> Result<(), String> {
        let mut target = target_name(provider_id);
        let mut username = wide(provider_id);
        let mut secret = api_key.as_bytes().to_vec();

        let credential = CREDENTIALW {
            Flags: 0,
            Type: CRED_TYPE_GENERIC,
            TargetName: target.as_mut_ptr(),
            Comment: null_mut(),
            LastWritten: FILETIME {
                dwLowDateTime: 0,
                dwHighDateTime: 0,
            },
            CredentialBlobSize: secret.len() as u32,
            CredentialBlob: secret.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: null_mut(),
            TargetAlias: null_mut(),
            UserName: username.as_mut_ptr(),
        };

        let result = unsafe { CredWriteW(&credential, 0) };
        secret.fill(0);
        if result == 0 {
            Err(last_error("save the API key"))
        } else {
            Ok(())
        }
    }

    pub(super) fn load(provider_id: &str) -> Result<String, String> {
        let target = target_name(provider_id);
        let mut raw_credential: *mut CREDENTIALW = null_mut();
        let result = unsafe {
            CredReadW(
                target.as_ptr(),
                CRED_TYPE_GENERIC,
                0,
                &mut raw_credential,
            )
        };
        if result == 0 {
            return Err(last_error("read the API key"));
        }
        if raw_credential.is_null() {
            return Err("Windows Credential Manager returned an empty credential".to_string());
        }

        let _guard = CredentialGuard(raw_credential);
        let credential = unsafe { &*raw_credential };
        let secret = unsafe {
            slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            )
        };
        String::from_utf8(secret.to_vec())
            .map_err(|_| "Stored Windows credential is not valid UTF-8".to_string())
    }

    pub(super) fn delete(provider_id: &str) -> Result<(), String> {
        let target = target_name(provider_id);
        let result = unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) };
        if result == 0 {
            let code = unsafe { GetLastError() };
            if code == windows_sys::Win32::Foundation::ERROR_NOT_FOUND {
                Ok(())
            } else {
                Err(format!(
                    "Windows Credential Manager could not delete the API key (error {code})"
                ))
            }
        } else {
            Ok(())
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::KEYCHAIN_SERVICE;
    use security_framework::passwords::{
        delete_generic_password, get_generic_password, set_generic_password,
    };
    use security_framework_sys::base::errSecItemNotFound;

    pub(super) const IS_SECURE: bool = true;

    pub(super) fn save(provider_id: &str, api_key: &str) -> Result<(), String> {
        set_generic_password(KEYCHAIN_SERVICE, provider_id, api_key.as_bytes())
            .map_err(|error| format!("macOS Keychain could not save the API key: {error}"))
    }

    pub(super) fn load(provider_id: &str) -> Result<String, String> {
        let secret = get_generic_password(KEYCHAIN_SERVICE, provider_id)
            .map_err(|error| format!("macOS Keychain could not read the API key: {error}"))?;
        String::from_utf8(secret)
            .map_err(|_| "Stored macOS Keychain credential is not valid UTF-8".to_string())
    }

    pub(super) fn delete(provider_id: &str) -> Result<(), String> {
        match delete_generic_password(KEYCHAIN_SERVICE, provider_id) {
            Ok(()) => Ok(()),
            Err(error) if error.code() == errSecItemNotFound => Ok(()),
            Err(error) => Err(format!(
                "macOS Keychain could not delete the API key: {error}"
            )),
        }
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod platform {
    pub(super) const IS_SECURE: bool = false;

    pub(super) fn save(_provider_id: &str, _api_key: &str) -> Result<(), String> {
        Err("Secure credential storage is not available on this platform".to_string())
    }

    pub(super) fn load(_provider_id: &str) -> Result<String, String> {
        Err("Secure credential storage is not available on this platform".to_string())
    }

    pub(super) fn delete(_provider_id: &str) -> Result<(), String> {
        Err("Secure credential storage is not available on this platform".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::get_default_settings;
    use std::cell::RefCell;
    use std::collections::HashMap;

    #[derive(Default)]
    struct MemoryBackend {
        values: RefCell<HashMap<String, String>>,
        fail_save: bool,
    }

    impl CredentialBackend for MemoryBackend {
        fn is_secure(&self) -> bool {
            true
        }

        fn save(&self, provider_id: &str, api_key: &str) -> Result<(), String> {
            if self.fail_save {
                return Err("simulated save failure".to_string());
            }
            self.values
                .borrow_mut()
                .insert(provider_id.to_string(), api_key.to_string());
            Ok(())
        }

        fn load(&self, provider_id: &str) -> Result<String, String> {
            self.values
                .borrow()
                .get(provider_id)
                .cloned()
                .ok_or_else(|| "missing test credential".to_string())
        }

        fn delete(&self, provider_id: &str) -> Result<(), String> {
            self.values.borrow_mut().remove(provider_id);
            Ok(())
        }
    }

    #[test]
    fn migration_moves_legacy_key_and_clears_plaintext() {
        let mut settings = get_default_settings();
        settings
            .post_process_api_keys
            .insert("anthropic".to_string(), "test-secret".to_string());
        let backend = MemoryBackend::default();

        assert!(migrate_legacy_api_keys_with_backend(
            &mut settings,
            &backend
        ));
        assert_eq!(
            settings.post_process_api_keys.get("anthropic"),
            Some(&String::new())
        );
        assert_eq!(
            settings.post_process_api_key_status.get("anthropic"),
            Some(&ApiKeyStorageStatus::Secure)
        );
        assert_eq!(
            backend.values.borrow().get("anthropic").map(String::as_str),
            Some("test-secret")
        );
    }

    #[test]
    fn failed_migration_never_discards_legacy_key() {
        let mut settings = get_default_settings();
        settings
            .post_process_api_keys
            .insert("anthropic".to_string(), "test-secret".to_string());
        let backend = MemoryBackend {
            fail_save: true,
            ..MemoryBackend::default()
        };

        assert!(migrate_legacy_api_keys_with_backend(
            &mut settings,
            &backend
        ));
        assert_eq!(
            settings.post_process_api_keys.get("anthropic").map(String::as_str),
            Some("test-secret")
        );
        assert_eq!(
            settings.post_process_api_key_status.get("anthropic"),
            Some(&ApiKeyStorageStatus::LocalPlaintext)
        );
    }
}
