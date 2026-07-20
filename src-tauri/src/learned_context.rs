//! Contexto aprendido: Fuwa mira el historial (hasta ~50 dictados ya corregidos)
//! para encontrar PATRONES — los nombres propios, marcas y términos que el
//! usuario usa seguido — y arma un glosario personalizado. Junto con la app
//! activa y el idioma, forma un bloque de "Contexto" que se antepone al prompt
//! de corrección, para que el LLM entienda la situación y personalice sin que el
//! usuario configure nada. Todo local: la minería no manda nada a la nube.

use std::collections::{HashMap, HashSet};

/// Contexto de una corrección: situación (app + idioma) + glosario aprendido.
pub struct LearnedContext {
    pub app_category: String, // "email" | "code" | "chat" | "notes" | ""
    pub language: String,     // código de idioma (p.ej. "es"), "auto" o ""
    pub glossary: Vec<String>,
}

fn language_name(code: &str) -> &str {
    match code {
        "es" => "Spanish",
        "en" => "English",
        "fr" => "French",
        "de" => "German",
        "pt" => "Portuguese",
        "it" => "Italian",
        _ => "",
    }
}

/// Renderiza el bloque de contexto (o "" si no hay señal). Se antepone al prompt.
pub fn build_context_block(ctx: &LearnedContext) -> String {
    let mut lines: Vec<String> = Vec::new();

    let app = match ctx.app_category.as_str() {
        "email" => "an email client",
        "code" => "a code editor or terminal",
        "chat" => "a chat / messaging app",
        "notes" => "a notes or document app",
        _ => "",
    };
    if !app.is_empty() {
        lines.push(format!("- The user is dictating into {app}."));
    }

    if !ctx.language.is_empty() && ctx.language != "auto" {
        let name = language_name(&ctx.language);
        if name.is_empty() {
            lines.push(format!("- The user is speaking in '{}'.", ctx.language));
        } else {
            lines.push(format!("- The user is speaking in {name}."));
        }
    }

    if !ctx.glossary.is_empty() {
        let terms = ctx.glossary.join(", ");
        lines.push(format!(
            "- This user frequently uses these names, brands and terms (respect their exact spelling; if the transcript has a word phonetically close to one of them, prefer the correct term): {terms}."
        ));
    }

    if lines.is_empty() {
        return String::new();
    }
    format!(
        "Context about this user — use it to understand the situation and correct accurately:\n{}",
        lines.join("\n")
    )
}

/// Antepone el bloque de contexto al prompt de corrección (no-op si vacío).
pub fn prepend_context(prompt: &str, ctx: &LearnedContext) -> String {
    let block = build_context_block(ctx);
    if block.is_empty() {
        prompt.to_string()
    } else {
        format!("{block}\n\n{prompt}")
    }
}

/// Minería heurística del historial: encuentra los términos salientes recurrentes
/// (nombres propios, CamelCase, marcas, jerga) y los une con los `seed`
/// (Palabras Personalizadas del usuario). Determinista, local, sin LLM.
pub fn mine_glossary(texts: &[String], seed: &[String], max: usize) -> Vec<String> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut display: HashMap<String, String> = HashMap::new();

    for text in texts {
        for raw in text.split(|c: char| !c.is_alphanumeric() && c != '/' && c != '.') {
            let tok = raw.trim_matches(|c: char| c == '/' || c == '.');
            if tok.chars().count() < 3 {
                continue;
            }
            if tok.chars().all(|c| c.is_numeric()) {
                continue;
            }
            let key = tok.to_lowercase();
            if is_stopword(&key) {
                continue;
            }
            *counts.entry(key.clone()).or_insert(0) += 1;
            let entry = display.entry(key).or_insert_with(|| tok.to_string());
            // Prefer a casing that carries an uppercase (proper noun / brand).
            if tok.chars().any(|c| c.is_uppercase()) && !entry.chars().any(|c| c.is_uppercase()) {
                *entry = tok.to_string();
            }
        }
    }

    // Saliente = parece nombre propio/marca (tiene mayúscula) o se repite mucho.
    let mut candidates: Vec<(String, usize)> = counts
        .into_iter()
        .filter(|(k, n)| {
            let d = display.get(k).cloned().unwrap_or_default();
            let has_upper = d.chars().any(|c| c.is_uppercase());
            let camel = d.chars().skip(1).any(|c| c.is_uppercase());
            camel || (has_upper && *n >= 2) || *n >= 3
        })
        .collect();
    candidates.sort_by(|a, b| b.1.cmp(&a.1));

    let mut out: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    // Los términos del usuario (seed) van primero, siempre.
    for s in seed {
        let k = s.trim().to_lowercase();
        if k.len() >= 2 && seen.insert(k) {
            out.push(s.trim().to_string());
        }
    }
    for (k, _) in candidates {
        if out.len() >= max {
            break;
        }
        if seen.insert(k.clone()) {
            out.push(display.get(&k).cloned().unwrap_or(k));
        }
    }
    out.truncate(max);
    out
}

/// Stopwords comunes (es/en) para no meter ruido de palabras funcionales.
fn is_stopword(w: &str) -> bool {
    const STOP: &[&str] = &[
        // español
        "que", "para", "con", "los", "las", "una", "unos", "unas", "del", "por", "como", "pero",
        "más", "muy", "esto", "esta", "este", "esos", "esas", "eso", "ese", "esa", "son", "porque",
        "cuando", "donde", "sobre", "entre", "hasta", "desde", "también", "ya", "sí", "no", "the",
        "and", "for", "with", "this", "that", "have", "has", "was", "were", "are", "you", "your",
        "then", "than", "from", "just", "like", "into", "about", "there", "their", "them", "what",
        "when", "where", "which", "would", "could", "should", "porque", "todo", "toda", "algo",
    ];
    STOP.contains(&w)
}
