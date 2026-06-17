use std::env;
use std::io::{self, IsTerminal, Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::clipboard::write_history_item_to_clipboard;
use crate::history::{
    cleanup_unused_image_assets_for_history_path, clear_history_from_path, load_history_from_path,
    merge_text_history_item, persist_history_to_path, remove_history_item_by_id, HistoryEntry,
    HistoryKind,
};
use crate::settings::MAX_MAX_HISTORY_COUNT;

const APP_IDENTIFIER: &str = "com.watson.mclip";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OutputFormat {
    Text,
    Json,
    Raw,
    Markdown,
}

#[derive(Debug)]
enum CliError {
    Help,
    Usage(String),
    Runtime(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionResult {
    action: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    history_count: usize,
}

pub fn run_from_env() -> i32 {
    let args = env::args().skip(1).collect::<Vec<_>>();

    match run(args) {
        Ok(output) => {
            print!("{output}");
            0
        }
        Err(CliError::Help) => {
            print!("{}", usage());
            0
        }
        Err(CliError::Usage(message)) => {
            let _ = writeln!(io::stderr(), "{message}\n\n{}", usage());
            2
        }
        Err(CliError::Runtime(message)) => {
            let _ = writeln!(io::stderr(), "mclip-cli: {message}");
            1
        }
    }
}

fn run(args: Vec<String>) -> Result<String, CliError> {
    let (history_path, args) = extract_global_options(args)?;
    let Some((command, command_args)) = args.split_first() else {
        return Err(CliError::Usage("missing command".to_string()));
    };

    if command == "--help" || command == "-h" || command == "help" {
        return Err(CliError::Help);
    }

    let path = match history_path {
        Some(path) => path,
        None => default_history_path()?,
    };
    let history = load_history_from_path(&path).map_err(CliError::Runtime)?;

    match command.as_str() {
        "list" => run_list(&history, command_args),
        "get" => run_get(&history, command_args),
        "search" => run_search(&history, command_args),
        "context" => run_context(&history, command_args),
        "add" => run_add(&path, history, command_args),
        "copy" => run_copy(&history, command_args),
        "delete" | "remove" => run_delete(&path, &history, command_args),
        "clear" => run_clear(&path, command_args),
        other => Err(CliError::Usage(format!("unknown command: {other}"))),
    }
}

fn extract_global_options(args: Vec<String>) -> Result<(Option<PathBuf>, Vec<String>), CliError> {
    let mut history_path = None;
    let mut rest = Vec::new();
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--history-path" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| CliError::Usage("--history-path requires a path".to_string()))?;
                history_path = Some(PathBuf::from(value));
                index += 2;
            }
            arg => {
                rest.push(arg.to_string());
                index += 1;
            }
        }
    }

    Ok((history_path, rest))
}

fn run_list(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut limit = 10;
    let mut format = OutputFormat::Text;
    let mut kind = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--limit" => {
                limit = parse_usize_option(args, index, "--limit")?;
                index += 2;
            }
            "--kind" => {
                kind = Some(parse_kind_option(args, index)?);
                index += 2;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--format" => {
                format = parse_format_option(args, index)?;
                index += 2;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other => return Err(CliError::Usage(format!("unknown list option: {other}"))),
        }
    }

    let entries = select_recent(history, limit, kind);
    format_entries(&entries, format)
}

fn run_get(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut selector = None;
    let mut format = OutputFormat::Text;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--index" => {
                selector = Some(EntrySelector::Index(parse_usize_option(
                    args, index, "--index",
                )?));
                index += 2;
            }
            "--id" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| CliError::Usage("--id requires a value".to_string()))?;
                selector = Some(EntrySelector::Id(value.to_string()));
                index += 2;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--format" => {
                format = parse_format_option(args, index)?;
                index += 2;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other => return Err(CliError::Usage(format!("unknown get option: {other}"))),
        }
    }

    let selector =
        selector.ok_or_else(|| CliError::Usage("get requires --index or --id".to_string()))?;
    let entry = find_entry(history, selector)?;
    format_single_entry(entry, format)
}

fn run_search(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut query = None;
    let mut limit = 10;
    let mut format = OutputFormat::Text;
    let mut kind = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--limit" => {
                limit = parse_usize_option(args, index, "--limit")?;
                index += 2;
            }
            "--kind" => {
                kind = Some(parse_kind_option(args, index)?);
                index += 2;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--format" => {
                format = parse_format_option(args, index)?;
                index += 2;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other if other.starts_with('-') => {
                return Err(CliError::Usage(format!("unknown search option: {other}")));
            }
            value => {
                if query.is_some() {
                    return Err(CliError::Usage(
                        "search accepts exactly one query".to_string(),
                    ));
                }
                query = Some(value.to_string());
                index += 1;
            }
        }
    }

    let query = query.ok_or_else(|| CliError::Usage("search requires a query".to_string()))?;
    let query = query.to_lowercase();
    let entries = history
        .iter()
        .filter(|entry| kind_matches(entry, kind))
        .filter(|entry| searchable_text(entry).to_lowercase().contains(&query))
        .take(limit)
        .cloned()
        .collect::<Vec<_>>();

    format_entries(&entries, format)
}

fn run_context(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut last = 5;
    let mut format = OutputFormat::Markdown;
    let mut kind = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--last" | "--limit" => {
                last = parse_usize_option(args, index, args[index].as_str())?;
                index += 2;
            }
            "--kind" => {
                kind = Some(parse_kind_option(args, index)?);
                index += 2;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--format" => {
                format = parse_format_option(args, index)?;
                index += 2;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other => return Err(CliError::Usage(format!("unknown context option: {other}"))),
        }
    }

    let entries = select_recent(history, last, kind);
    format_entries(&entries, format)
}

fn run_add(path: &Path, history: Vec<HistoryEntry>, args: &[String]) -> Result<String, CliError> {
    let mut source_app = Some("mclip-cli".to_string());
    let mut max_history_count = MAX_MAX_HISTORY_COUNT as usize;
    let mut json = false;
    let mut text_parts = Vec::new();
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--source-app" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| CliError::Usage("--source-app requires a value".to_string()))?;
                source_app = if value == "none" {
                    None
                } else {
                    Some(value.to_string())
                };
                index += 2;
            }
            "--max-history" => {
                max_history_count = parse_usize_option(args, index, "--max-history")?;
                index += 2;
            }
            "--json" => {
                json = true;
                index += 1;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other if other.starts_with('-') => {
                return Err(CliError::Usage(format!("unknown add option: {other}")));
            }
            value => {
                text_parts.push(value.to_string());
                index += 1;
            }
        }
    }

    let text = if text_parts.is_empty() {
        read_stdin_text()?
    } else {
        text_parts.join(" ")
    };

    if text.trim().is_empty() {
        return Err(CliError::Usage(
            "add requires non-empty text from arguments or stdin".to_string(),
        ));
    }

    let (next_history, saved_entry) =
        merge_text_history_item(history, text, source_app, max_history_count);
    persist_history_to_path(path, &next_history).map_err(CliError::Runtime)?;
    cleanup_unused_image_assets_for_history_path(path, &next_history).map_err(CliError::Runtime)?;

    format_action_result(
        ActionResult {
            action: "add",
            id: Some(saved_entry.id().to_string()),
            history_count: next_history.len(),
        },
        json,
    )
}

fn run_copy(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    run_copy_with_writer(history, args, write_history_item_to_clipboard)
}

fn run_copy_with_writer<F>(
    history: &[HistoryEntry],
    args: &[String],
    mut write_clipboard: F,
) -> Result<String, CliError>
where
    F: FnMut(HistoryEntry) -> Result<(), String>,
{
    let (selector, json) = parse_selector_action_args(args, "copy")?;
    let entry = find_entry(history, selector)?.clone();
    let id = entry.id().to_string();
    write_clipboard(entry).map_err(CliError::Runtime)?;

    format_action_result(
        ActionResult {
            action: "copy",
            id: Some(id),
            history_count: history.len(),
        },
        json,
    )
}

fn run_delete(path: &Path, history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let (selector, json) = parse_selector_action_args(args, "delete")?;
    let id = find_entry(history, selector)?.id().to_string();
    let (next_history, did_delete) = remove_history_item_by_id(history.to_vec(), &id);

    if !did_delete {
        return Err(CliError::Runtime(format!(
            "history item {id} was not found"
        )));
    }

    if next_history.is_empty() {
        clear_history_from_path(path).map_err(CliError::Runtime)?;
    } else {
        persist_history_to_path(path, &next_history).map_err(CliError::Runtime)?;
        cleanup_unused_image_assets_for_history_path(path, &next_history)
            .map_err(CliError::Runtime)?;
    }

    format_action_result(
        ActionResult {
            action: "delete",
            id: Some(id),
            history_count: next_history.len(),
        },
        json,
    )
}

fn run_clear(path: &Path, args: &[String]) -> Result<String, CliError> {
    let mut confirmed = false;
    let mut json = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--yes" | "--force" => {
                confirmed = true;
                index += 1;
            }
            "--json" => {
                json = true;
                index += 1;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other => return Err(CliError::Usage(format!("unknown clear option: {other}"))),
        }
    }

    if !confirmed {
        return Err(CliError::Usage(
            "clear requires --yes to remove clipboard history".to_string(),
        ));
    }

    clear_history_from_path(path).map_err(CliError::Runtime)?;
    format_action_result(
        ActionResult {
            action: "clear",
            id: None,
            history_count: 0,
        },
        json,
    )
}

#[derive(Debug)]
enum EntrySelector {
    Index(usize),
    Id(String),
}

fn find_entry(
    history: &[HistoryEntry],
    selector: EntrySelector,
) -> Result<&HistoryEntry, CliError> {
    match selector {
        EntrySelector::Index(index) => {
            if index == 0 {
                return Err(CliError::Usage("--index is one-based".to_string()));
            }
            history
                .get(index - 1)
                .ok_or_else(|| CliError::Runtime(format!("history index {index} was not found")))
        }
        EntrySelector::Id(id) => history
            .iter()
            .find(|entry| entry.id() == id)
            .ok_or_else(|| CliError::Runtime(format!("history item {id} was not found"))),
    }
}

fn parse_selector_action_args(
    args: &[String],
    command_name: &str,
) -> Result<(EntrySelector, bool), CliError> {
    let mut selector = None;
    let mut json = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--index" => {
                selector = Some(EntrySelector::Index(parse_usize_option(
                    args, index, "--index",
                )?));
                index += 2;
            }
            "--id" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| CliError::Usage("--id requires a value".to_string()))?;
                selector = Some(EntrySelector::Id(value.to_string()));
                index += 2;
            }
            "--json" => {
                json = true;
                index += 1;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other => {
                return Err(CliError::Usage(format!(
                    "unknown {command_name} option: {other}"
                )));
            }
        }
    }

    selector
        .map(|selector| (selector, json))
        .ok_or_else(|| CliError::Usage(format!("{command_name} requires --index or --id")))
}

fn read_stdin_text() -> Result<String, CliError> {
    let mut stdin = io::stdin();

    if stdin.is_terminal() {
        return Err(CliError::Usage(
            "add requires text arguments or piped stdin".to_string(),
        ));
    }

    let mut text = String::new();
    stdin
        .read_to_string(&mut text)
        .map_err(|error| CliError::Runtime(error.to_string()))?;
    Ok(text)
}

fn format_action_result(result: ActionResult, json: bool) -> Result<String, CliError> {
    if json {
        return serde_json::to_string(&result)
            .map(|json| format!("{json}\n"))
            .map_err(|error| CliError::Runtime(error.to_string()));
    }

    let id_suffix = result
        .id
        .as_deref()
        .map(|id| format!(" {id}"))
        .unwrap_or_default();

    Ok(format!(
        "{} history item{id_suffix}. History count: {}\n",
        past_tense_action(result.action),
        result.history_count
    ))
}

fn past_tense_action(action: &str) -> &'static str {
    match action {
        "add" => "Added",
        "copy" => "Copied",
        "delete" => "Deleted",
        "clear" => "Cleared",
        _ => "Updated",
    }
}

fn select_recent(
    history: &[HistoryEntry],
    limit: usize,
    kind: Option<HistoryKind>,
) -> Vec<HistoryEntry> {
    history
        .iter()
        .filter(|entry| kind_matches(entry, kind))
        .take(limit)
        .cloned()
        .collect()
}

fn format_entries(entries: &[HistoryEntry], format: OutputFormat) -> Result<String, CliError> {
    match format {
        OutputFormat::Json => serde_json::to_string(entries)
            .map(|json| format!("{json}\n"))
            .map_err(|error| CliError::Runtime(error.to_string())),
        OutputFormat::Raw => Ok(format_raw_entries(entries)),
        OutputFormat::Markdown => Ok(format_markdown_context(entries)),
        OutputFormat::Text => Ok(format_text_list(entries)),
    }
}

fn format_single_entry(entry: &HistoryEntry, format: OutputFormat) -> Result<String, CliError> {
    match format {
        OutputFormat::Json => serde_json::to_string(entry)
            .map(|json| format!("{json}\n"))
            .map_err(|error| CliError::Runtime(error.to_string())),
        OutputFormat::Raw => Ok(format!("{}\n", raw_content(entry))),
        OutputFormat::Markdown => Ok(format_markdown_context(std::slice::from_ref(entry))),
        OutputFormat::Text => Ok(format_text_item(1, entry)),
    }
}

fn format_text_list(entries: &[HistoryEntry]) -> String {
    entries
        .iter()
        .enumerate()
        .map(|(index, entry)| format_text_item(index + 1, entry))
        .collect::<String>()
}

fn format_text_item(index: usize, entry: &HistoryEntry) -> String {
    let common = entry.common();
    format!(
        "{index}. [{}] {} | sourceApp: {} | lastCopiedAt: {} | copyCount: {}\n",
        kind_name(entry),
        common.display_text,
        common.source_app.as_deref().unwrap_or("unknown"),
        common.last_copied_at,
        common.copy_count
    )
}

fn format_raw_entries(entries: &[HistoryEntry]) -> String {
    let body = entries
        .iter()
        .map(raw_content)
        .collect::<Vec<_>>()
        .join("\n---\n");

    if body.is_empty() {
        String::new()
    } else {
        format!("{body}\n")
    }
}

fn format_markdown_context(entries: &[HistoryEntry]) -> String {
    let mut markdown = String::from("# mclip Clipboard Context\n\n");

    if entries.is_empty() {
        markdown.push_str("No clipboard history entries matched.\n");
        return markdown;
    }

    for (index, entry) in entries.iter().enumerate() {
        let common = entry.common();
        markdown.push_str(&format!("## {}. {}\n\n", index + 1, common.display_text));
        markdown.push_str(&format!("- id: {}\n", common.id));
        markdown.push_str(&format!("- kind: {}\n", kind_name(entry)));
        markdown.push_str(&format!(
            "- sourceApp: {}\n",
            common.source_app.as_deref().unwrap_or("unknown")
        ));
        markdown.push_str(&format!("- lastCopiedAt: {}\n", common.last_copied_at));
        markdown.push_str(&format!("- copyCount: {}\n\n", common.copy_count));
        markdown.push_str(&markdown_code_block("text", &raw_content(entry)));
        markdown.push('\n');
    }

    markdown
}

fn markdown_code_block(language: &str, content: &str) -> String {
    let fence = if content.contains("```") {
        "````"
    } else {
        "```"
    };

    format!("{fence}{language}\n{content}\n{fence}\n")
}

fn searchable_text(entry: &HistoryEntry) -> String {
    let common = entry.common();
    format!(
        "{}\n{}\n{}\n{}",
        common.id,
        common.display_text,
        common.source_app.as_deref().unwrap_or_default(),
        raw_content(entry)
    )
}

fn raw_content(entry: &HistoryEntry) -> String {
    match entry {
        HistoryEntry::Text { text, .. } => text.clone(),
        HistoryEntry::Image { image_path, .. } => image_path.clone(),
        HistoryEntry::Files { file_paths, .. } => file_paths.join("\n"),
    }
}

fn kind_matches(entry: &HistoryEntry, kind: Option<HistoryKind>) -> bool {
    kind.map(|expected| history_entry_kind(entry) == expected)
        .unwrap_or(true)
}

fn history_entry_kind(entry: &HistoryEntry) -> HistoryKind {
    match entry {
        HistoryEntry::Text { .. } => HistoryKind::Text,
        HistoryEntry::Image { .. } => HistoryKind::Image,
        HistoryEntry::Files { .. } => HistoryKind::Files,
    }
}

fn kind_name(entry: &HistoryEntry) -> &'static str {
    match entry {
        HistoryEntry::Text { .. } => "text",
        HistoryEntry::Image { .. } => "image",
        HistoryEntry::Files { .. } => "files",
    }
}

fn parse_usize_option(args: &[String], index: usize, option_name: &str) -> Result<usize, CliError> {
    let value = args
        .get(index + 1)
        .ok_or_else(|| CliError::Usage(format!("{option_name} requires a value")))?;
    let parsed = value
        .parse::<usize>()
        .map_err(|_| CliError::Usage(format!("{option_name} requires a positive integer")))?;

    if parsed == 0 {
        return Err(CliError::Usage(format!(
            "{option_name} requires a positive integer"
        )));
    }

    Ok(parsed)
}

fn parse_kind_option(args: &[String], index: usize) -> Result<HistoryKind, CliError> {
    let value = args
        .get(index + 1)
        .ok_or_else(|| CliError::Usage("--kind requires a value".to_string()))?;

    match value.as_str() {
        "text" => Ok(HistoryKind::Text),
        "image" => Ok(HistoryKind::Image),
        "files" => Ok(HistoryKind::Files),
        _ => Err(CliError::Usage(
            "--kind must be text, image, or files".to_string(),
        )),
    }
}

fn parse_format_option(args: &[String], index: usize) -> Result<OutputFormat, CliError> {
    let value = args
        .get(index + 1)
        .ok_or_else(|| CliError::Usage("--format requires a value".to_string()))?;

    match value.as_str() {
        "text" => Ok(OutputFormat::Text),
        "json" => Ok(OutputFormat::Json),
        "raw" => Ok(OutputFormat::Raw),
        "markdown" => Ok(OutputFormat::Markdown),
        _ => Err(CliError::Usage(
            "--format must be text, json, raw, or markdown".to_string(),
        )),
    }
}

fn default_history_path() -> Result<PathBuf, CliError> {
    if let Some(path) = env::var_os("MCLIP_HISTORY_PATH") {
        return Ok(PathBuf::from(path));
    }

    default_config_dir()
        .map(|dir| dir.join(APP_IDENTIFIER).join("history.json"))
        .ok_or_else(|| CliError::Runtime("failed to locate the app config directory".to_string()))
}

#[cfg(target_os = "macos")]
fn default_config_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join("Library").join("Application Support"))
}

#[cfg(target_os = "windows")]
fn default_config_dir() -> Option<PathBuf> {
    env::var_os("APPDATA").map(PathBuf::from)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn default_config_dir() -> Option<PathBuf> {
    env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
}

fn usage() -> &'static str {
    r#"Usage:
  mclip-cli [--history-path PATH] list [--limit N] [--kind text|image|files] [--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] get (--index N|--id ID) [--raw|--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] search QUERY [--limit N] [--kind text|image|files] [--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] context [--last N] [--kind text|image|files] [--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] add [--source-app NAME] [--max-history N] [--json] [TEXT...]
  mclip-cli [--history-path PATH] copy (--index N|--id ID) [--json]
  mclip-cli [--history-path PATH] delete (--index N|--id ID) [--json]
  mclip-cli [--history-path PATH] clear --yes [--json]

Environment:
  MCLIP_HISTORY_PATH  Override the default local mclip history.json path.
"#
}

#[cfg(test)]
mod tests {
    use super::{run_copy_with_writer, CliError};
    use crate::history::{HistoryEntry, HistoryEntryCommon};

    fn text_entry(id: &str, text: &str) -> HistoryEntry {
        HistoryEntry::Text {
            common: HistoryEntryCommon {
                id: id.to_string(),
                display_text: text.to_string(),
                first_copied_at: 100,
                last_copied_at: 200,
                source_app: Some("Codex".to_string()),
                copy_count: 1,
            },
            text: text.to_string(),
        }
    }

    #[test]
    fn copy_selects_history_item_and_delegates_clipboard_write() {
        let history = vec![text_entry("first", "alpha"), text_entry("second", "beta")];
        let mut copied = None;

        let output = run_copy_with_writer(
            &history,
            &[
                "--id".to_string(),
                "second".to_string(),
                "--json".to_string(),
            ],
            |entry| {
                copied = Some(entry.id().to_string());
                Ok(())
            },
        )
        .expect("copy should succeed");

        assert_eq!(copied.as_deref(), Some("second"));
        assert!(output.contains(r#""action":"copy""#));
        assert!(output.contains(r#""id":"second""#));
    }

    #[test]
    fn copy_reports_clipboard_write_errors() {
        let history = vec![text_entry("first", "alpha")];

        let error = run_copy_with_writer(
            &history,
            &["--index".to_string(), "1".to_string()],
            |_entry| Err("clipboard unavailable".to_string()),
        )
        .expect_err("copy should fail");

        assert!(matches!(error, CliError::Runtime(message) if message == "clipboard unavailable"));
    }
}
