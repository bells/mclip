use std::env;
use std::io::{self, IsTerminal, Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::clipboard::{write_history_item_to_clipboard, write_text_to_clipboard_for_cli};
use crate::history::{
    cleanup_unused_image_assets_for_history_path, clear_history_from_path,
    clear_history_keep_pinned_from_path, load_history_from_path, merge_text_history_item,
    persist_history_to_path, remove_history_item_by_id, toggle_history_item_pinned_from_path,
    HistoryEntry, HistoryKind,
};
use crate::settings::MAX_MAX_HISTORY_COUNT;
use crate::text_transform::{
    perform_text_transform, TextTransformAction, TextTransformRequest,
    MAX_TEXT_TRANSFORM_INPUT_BYTES,
};

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

trait CliInput {
    fn is_terminal(&self) -> bool;
    fn read_limited(&mut self, max_bytes: usize) -> Result<Vec<u8>, CliError>;
}

struct StandardInput;

impl CliInput for StandardInput {
    fn is_terminal(&self) -> bool {
        io::stdin().is_terminal()
    }

    fn read_limited(&mut self, max_bytes: usize) -> Result<Vec<u8>, CliError> {
        let mut bytes = Vec::new();
        io::stdin()
            .take(max_bytes.saturating_add(1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| CliError::Runtime(error.to_string()))?;
        Ok(bytes)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionResult {
    action: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    history_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_pinned: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    removed_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pinned_removed_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    kept_pinned: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentCommand {
    name: &'static str,
    purpose: &'static str,
    example: &'static str,
    mutates_history: bool,
    writes_clipboard: bool,
    destructive: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentBundle {
    schema_version: u8,
    mode: &'static str,
    history_count: usize,
    selected_count: usize,
    commands: Vec<AgentCommand>,
    safety: Vec<&'static str>,
    context: Vec<HistoryEntry>,
}

pub fn run_from_env() -> i32 {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let mut input = StandardInput;

    match run(args, &mut input) {
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

fn run<I: CliInput>(args: Vec<String>, input: &mut I) -> Result<String, CliError> {
    let (history_path, args) = extract_global_options(args)?;
    let Some((command, command_args)) = args.split_first() else {
        return Err(CliError::Usage("missing command".to_string()));
    };

    if command == "--help" || command == "-h" || command == "help" {
        return Err(CliError::Help);
    }

    if command == "--version" || command == "-V" || command == "version" {
        return Ok(version_output());
    }

    if command_args
        .iter()
        .any(|arg| arg == "--help" || arg == "-h")
    {
        return Err(CliError::Help);
    }

    if command == "transform" {
        return run_transform(command_args, input);
    }

    let path = match history_path {
        Some(path) => path,
        None => default_history_path()?,
    };
    if command == "copy" {
        return run_copy(&path, command_args, input);
    }
    let history = load_history_from_path(&path).map_err(CliError::Runtime)?;

    match command.as_str() {
        "list" => run_list(&history, command_args),
        "get" => run_get(&history, command_args),
        "search" => run_search(&history, command_args),
        "context" => run_context(&history, command_args),
        "agent" => run_agent(&history, command_args),
        "add" => run_add(&path, history, command_args, input),
        "delete" | "remove" => run_delete(&path, &history, command_args),
        "pin" => run_pin(&path, &history, command_args, true),
        "unpin" => run_pin(&path, &history, command_args, false),
        "clear" => run_clear(&path, &history, command_args),
        other => Err(CliError::Usage(format!("unknown command: {other}"))),
    }
}

fn version_output() -> String {
    format!("mclip-cli {}\n", env!("CARGO_PKG_VERSION"))
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
    let mut pinned_only = false;
    let mut reveal_secrets = false;
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
            "--pinned" => {
                pinned_only = true;
                index += 1;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--reveal-secrets" => {
                reveal_secrets = true;
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

    let entries = select_recent(history, limit, kind, pinned_only);
    format_entries(&entries, format, reveal_secrets)
}

fn run_get(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut selector = None;
    let mut format = OutputFormat::Text;
    let mut reveal_secrets = false;
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
            "--reveal-secrets" => {
                reveal_secrets = true;
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
    format_single_entry(entry, format, reveal_secrets)
}

fn run_search(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut query = None;
    let mut limit = 10;
    let mut format = OutputFormat::Text;
    let mut kind = None;
    let mut pinned_only = false;
    let mut reveal_secrets = false;
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
            "--pinned" => {
                pinned_only = true;
                index += 1;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--reveal-secrets" => {
                reveal_secrets = true;
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
        .filter(|entry| !pinned_only || entry.is_pinned())
        .filter(|entry| searchable_text(entry).to_lowercase().contains(&query))
        .take(limit)
        .cloned()
        .collect::<Vec<_>>();

    format_entries(&entries, format, reveal_secrets)
}

fn run_context(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut last = 5;
    let mut format = OutputFormat::Markdown;
    let mut kind = None;
    let mut pinned_only = false;
    let mut reveal_secrets = false;
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
            "--pinned" => {
                pinned_only = true;
                index += 1;
            }
            "--json" => {
                format = OutputFormat::Json;
                index += 1;
            }
            "--raw" => {
                format = OutputFormat::Raw;
                index += 1;
            }
            "--reveal-secrets" => {
                reveal_secrets = true;
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

    let entries = select_recent(history, last, kind, pinned_only);
    format_entries(&entries, format, reveal_secrets)
}

fn run_agent(history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut last = 5;
    let mut kind = None;
    let mut json = false;
    let mut pinned_only = false;
    let mut reveal_secrets = false;
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
                json = true;
                index += 1;
            }
            "--pinned" => {
                pinned_only = true;
                index += 1;
            }
            "--reveal-secrets" => {
                reveal_secrets = true;
                index += 1;
            }
            "--format" => {
                json = parse_agent_format_option(args, index)?;
                index += 2;
            }
            "--help" | "-h" => return Err(CliError::Help),
            other => return Err(CliError::Usage(format!("unknown agent option: {other}"))),
        }
    }

    let entries = select_recent(history, last, kind, pinned_only);
    let presented_entries = presentation_entries(&entries, reveal_secrets);

    if json {
        let bundle = AgentBundle {
            schema_version: 2,
            mode: "agent",
            history_count: history.len(),
            selected_count: entries.len(),
            commands: agent_commands(),
            safety: agent_safety_contract(),
            context: presented_entries,
        };

        return serde_json::to_string(&bundle)
            .map(|json| format!("{json}\n"))
            .map_err(|error| CliError::Runtime(error.to_string()));
    }

    Ok(format_agent_markdown(history.len(), &presented_entries))
}

fn run_add<I: CliInput>(
    path: &Path,
    history: Vec<HistoryEntry>,
    args: &[String],
    input: &mut I,
) -> Result<String, CliError> {
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
        read_stdin_text(input, false, "add")?.ok_or_else(|| {
            CliError::Usage("add requires text arguments or piped stdin".to_string())
        })?
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
            is_pinned: None,
            removed_count: None,
            pinned_removed_count: None,
            kept_pinned: None,
        },
        json,
    )
}

fn run_copy<I: CliInput>(
    history_path: &Path,
    args: &[String],
    input: &mut I,
) -> Result<String, CliError> {
    run_copy_with_sources(
        args,
        input,
        || load_history_from_path(history_path).map_err(CliError::Runtime),
        write_history_item_to_clipboard,
        write_text_to_clipboard_for_cli,
    )
}

fn run_copy_with_sources<I, L, H, T>(
    args: &[String],
    input: &mut I,
    load_history: L,
    mut write_history_clipboard: H,
    mut write_text_clipboard: T,
) -> Result<String, CliError>
where
    I: CliInput,
    L: FnOnce() -> Result<Vec<HistoryEntry>, CliError>,
    H: FnMut(HistoryEntry) -> Result<(), String>,
    T: FnMut(String) -> Result<(), String>,
{
    let options = parse_copy_args(args)?;
    if options.selector.is_some() && options.explicit_stdin {
        return Err(CliError::Usage(
            "copy accepts exactly one selector or stdin source".to_string(),
        ));
    }

    let stdin_text = read_stdin_text(input, options.explicit_stdin, "copy")?;
    if let Some(selector) = options.selector {
        if stdin_text.as_ref().is_some_and(|text| !text.is_empty()) {
            return Err(CliError::Usage(
                "copy accepts exactly one selector or stdin source".to_string(),
            ));
        }
        let history = load_history()?;
        let entry = find_entry(&history, selector)?.clone();
        let id = entry.id().to_string();
        write_history_clipboard(entry).map_err(CliError::Runtime)?;

        return format_action_result(
            ActionResult {
                action: "copy",
                id: Some(id),
                history_count: history.len(),
                is_pinned: None,
                removed_count: None,
                pinned_removed_count: None,
                kept_pinned: None,
            },
            options.json,
        );
    }

    let text = stdin_text.ok_or_else(|| {
        CliError::Usage("copy requires --index, --id, --stdin, or piped stdin".to_string())
    })?;
    write_text_clipboard(text).map_err(CliError::Runtime)?;

    if options.json {
        Ok("{\"action\":\"copy\",\"source\":\"stdin\"}\n".to_string())
    } else {
        Ok("Copied stdin text to the system clipboard.\n".to_string())
    }
}

#[derive(Debug)]
struct CopyOptions {
    selector: Option<EntrySelector>,
    explicit_stdin: bool,
    json: bool,
}

fn parse_copy_args(args: &[String]) -> Result<CopyOptions, CliError> {
    let mut selector = None;
    let mut explicit_stdin = false;
    let mut json = false;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--index" => {
                set_selector(
                    &mut selector,
                    EntrySelector::Index(parse_usize_option(args, index, "--index")?),
                    "copy",
                )?;
                index += 2;
            }
            "--id" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| CliError::Usage("--id requires a value".to_string()))?;
                set_selector(&mut selector, EntrySelector::Id(value.to_string()), "copy")?;
                index += 2;
            }
            "--stdin" => {
                if explicit_stdin {
                    return Err(CliError::Usage(
                        "copy accepts --stdin only once".to_string(),
                    ));
                }
                explicit_stdin = true;
                index += 1;
            }
            "--json" => {
                json = true;
                index += 1;
            }
            other => {
                return Err(CliError::Usage(format!("unknown copy option: {other}")));
            }
        }
    }
    Ok(CopyOptions {
        selector,
        explicit_stdin,
        json,
    })
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
            is_pinned: None,
            removed_count: None,
            pinned_removed_count: None,
            kept_pinned: None,
        },
        json,
    )
}

fn run_pin(
    path: &Path,
    history: &[HistoryEntry],
    args: &[String],
    is_pinned: bool,
) -> Result<String, CliError> {
    let command = if is_pinned { "pin" } else { "unpin" };
    let (selector, json) = parse_selector_action_args(args, command)?;
    let selected = find_entry(history, selector)?;
    let id = selected.id().to_string();
    let (next_history, final_is_pinned) = if selected.is_pinned() == is_pinned {
        (history.to_vec(), is_pinned)
    } else {
        toggle_history_item_pinned_from_path(path, &id, MAX_MAX_HISTORY_COUNT as usize)
            .map_err(CliError::Runtime)?
    };

    format_action_result(
        ActionResult {
            action: command,
            id: Some(id),
            history_count: next_history.len(),
            is_pinned: Some(final_is_pinned),
            removed_count: None,
            pinned_removed_count: None,
            kept_pinned: None,
        },
        json,
    )
}

fn run_clear(path: &Path, history: &[HistoryEntry], args: &[String]) -> Result<String, CliError> {
    let mut confirmed = false;
    let mut json = false;
    let mut keep_pinned = false;
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
            "--keep-pinned" => {
                keep_pinned = true;
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

    let pinned_count = history.iter().filter(|entry| entry.is_pinned()).count();
    let (history_count, removed_count, pinned_removed_count) = if keep_pinned {
        let remaining = clear_history_keep_pinned_from_path(path).map_err(CliError::Runtime)?;
        (
            remaining.len(),
            history.len().saturating_sub(remaining.len()),
            0,
        )
    } else {
        clear_history_from_path(path).map_err(CliError::Runtime)?;
        (0, history.len(), pinned_count)
    };
    format_action_result(
        ActionResult {
            action: "clear",
            id: None,
            history_count,
            is_pinned: None,
            removed_count: Some(removed_count),
            pinned_removed_count: Some(pinned_removed_count),
            kept_pinned: Some(keep_pinned),
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
                set_selector(
                    &mut selector,
                    EntrySelector::Index(parse_usize_option(args, index, "--index")?),
                    command_name,
                )?;
                index += 2;
            }
            "--id" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| CliError::Usage("--id requires a value".to_string()))?;
                set_selector(
                    &mut selector,
                    EntrySelector::Id(value.to_string()),
                    command_name,
                )?;
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

fn set_selector(
    selector: &mut Option<EntrySelector>,
    next: EntrySelector,
    command_name: &str,
) -> Result<(), CliError> {
    if selector.is_some() {
        return Err(CliError::Usage(format!(
            "{command_name} accepts exactly one --index or --id selector"
        )));
    }
    *selector = Some(next);
    Ok(())
}

fn read_stdin_text<I: CliInput>(
    input: &mut I,
    explicit: bool,
    command_name: &str,
) -> Result<Option<String>, CliError> {
    if input.is_terminal() && !explicit {
        return Ok(None);
    }
    let bytes = input.read_limited(MAX_TEXT_TRANSFORM_INPUT_BYTES)?;
    if bytes.len() > MAX_TEXT_TRANSFORM_INPUT_BYTES {
        return Err(CliError::Usage(format!(
            "{command_name} stdin exceeds the {} byte limit",
            MAX_TEXT_TRANSFORM_INPUT_BYTES
        )));
    }
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| CliError::Usage(format!("{command_name} stdin must be valid UTF-8")))
}

fn run_transform<I: CliInput>(args: &[String], input: &mut I) -> Result<String, CliError> {
    let Some((action_name, options)) = args.split_first() else {
        return Err(CliError::Usage("transform requires an action".to_string()));
    };
    let action = TextTransformAction::from_cli_name(action_name)
        .ok_or_else(|| CliError::Usage(format!("unknown transform action: {action_name}")))?;
    let mut text = None;
    let mut explicit_stdin = false;
    let mut index = 0;
    while index < options.len() {
        match options[index].as_str() {
            "--text" => {
                if text.is_some() {
                    return Err(CliError::Usage(
                        "transform accepts --text only once".to_string(),
                    ));
                }
                text = Some(
                    options
                        .get(index + 1)
                        .ok_or_else(|| CliError::Usage("--text requires a value".to_string()))?
                        .to_string(),
                );
                index += 2;
            }
            "--stdin" => {
                if explicit_stdin {
                    return Err(CliError::Usage(
                        "transform accepts --stdin only once".to_string(),
                    ));
                }
                explicit_stdin = true;
                index += 1;
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown transform option: {other}"
                )));
            }
        }
    }

    if text.is_some() && explicit_stdin {
        return Err(CliError::Usage(
            "transform accepts exactly one --text or stdin source".to_string(),
        ));
    }
    let stdin_text = read_stdin_text(input, explicit_stdin, "transform")?;
    if text.is_some() && stdin_text.as_ref().is_some_and(|value| !value.is_empty()) {
        return Err(CliError::Usage(
            "transform accepts exactly one --text or stdin source".to_string(),
        ));
    }
    let input = text.or(stdin_text).ok_or_else(|| {
        CliError::Usage("transform requires --text, --stdin, or piped stdin".to_string())
    })?;
    perform_text_transform(TextTransformRequest { action, input })
        .map(|result| result.output)
        .map_err(|error| CliError::Runtime(error.diagnostic()))
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

    let clear_suffix = result
        .removed_count
        .map_or_else(String::new, |removed_count| {
            format!(
                " Removed: {removed_count}; pinned removed: {}; kept pinned: {}.",
                result.pinned_removed_count.unwrap_or(0),
                result.kept_pinned.unwrap_or(false)
            )
        });
    Ok(format!(
        "{} history item{id_suffix}. History count: {}{clear_suffix}\n",
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
        "pin" => "Pinned",
        "unpin" => "Unpinned",
        _ => "Updated",
    }
}

fn agent_commands() -> Vec<AgentCommand> {
    vec![
        AgentCommand {
            name: "pin",
            purpose: "Pin one selected history item by snapshot-relative index or stable id.",
            example: "mclip-cli pin --id h_xxx",
            mutates_history: true,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "unpin",
            purpose: "Unpin one selected history item and apply ordinary retention.",
            example: "mclip-cli unpin --index 1",
            mutates_history: true,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "agent",
            purpose: "Print an agent-ready bundle with recent context, command capabilities, and safety notes.",
            example: "mclip-cli agent --last 5 --json",
            mutates_history: false,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "list",
            purpose: "List recent history entries with metadata.",
            example: "mclip-cli list --limit 5 --json",
            mutates_history: false,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "get",
            purpose: "Read one history item by one-based index or stable id.",
            example: "mclip-cli get --index 1 --raw",
            mutates_history: false,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "search",
            purpose: "Search local history by text, id, source app, or raw content.",
            example: "mclip-cli search \"panic\" --json",
            mutates_history: false,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "context",
            purpose: "Print recent history as text, JSON, raw text, or Markdown.",
            example: "mclip-cli context --last 3 --format markdown",
            mutates_history: false,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "add",
            purpose: "Add text to mclip history without replacing the current system clipboard.",
            example: "cat build.log | mclip-cli add --source-app Codex",
            mutates_history: true,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "copy",
            purpose: "Write one selected history item or one explicit stdin source to the system clipboard without mutating history.",
            example: "printf 'hello' | mclip-cli copy",
            mutates_history: false,
            writes_clipboard: true,
            destructive: false,
        },
        AgentCommand {
            name: "transform",
            purpose: "Transform one explicit text or stdin source locally without reading history or writing the clipboard.",
            example: "printf '{\"ok\":true}' | mclip-cli transform json-prettify",
            mutates_history: false,
            writes_clipboard: false,
            destructive: false,
        },
        AgentCommand {
            name: "delete",
            purpose: "Delete one selected history item from local history.",
            example: "mclip-cli delete --id h_xxx",
            mutates_history: true,
            writes_clipboard: false,
            destructive: true,
        },
        AgentCommand {
            name: "clear",
            purpose: "Clear local history only when explicit confirmation is supplied.",
            example: "mclip-cli clear --yes",
            mutates_history: true,
            writes_clipboard: false,
            destructive: true,
        },
    ]
}

fn agent_safety_contract() -> Vec<&'static str> {
    vec![
        "list, get, search, context, and agent mask classified secrets by default; --raw and --reveal-secrets explicitly reveal them.",
        "add writes text into history without replacing the system clipboard.",
        "copy writes one selected history item back to the system clipboard.",
        "copy stdin mode writes only the supplied UTF-8 text to the system clipboard and does not mutate history.",
        "transform reads no history, writes no clipboard, executes no shell or network action, and prints content-only stdout on success.",
        "pin and unpin mutate one stable entry; --pinned filters supported read commands.",
        "delete removes one selected item; clear requires --yes, and --keep-pinned preserves pins.",
        "mclip-cli does not start the desktop UI and all history data stays local.",
    ]
}

fn format_agent_markdown(history_count: usize, entries: &[HistoryEntry]) -> String {
    let mut markdown = String::from("# mclip Agent Mode\n\n");

    markdown.push_str("## Scope\n\n");
    markdown.push_str(&format!(
        "- historyCount: {history_count}\n- selectedCount: {}\n- defaultFormat: markdown\n- jsonFormat: `mclip-cli agent --json`\n\n",
        entries.len()
    ));

    markdown.push_str("## Safety Contract\n\n");
    for note in agent_safety_contract() {
        markdown.push_str(&format!("- {note}\n"));
    }
    markdown.push('\n');

    markdown.push_str("## Command Map\n\n");
    markdown.push_str("| Command | Example | Mutates history | Writes clipboard | Destructive |\n");
    markdown.push_str("| --- | --- | --- | --- | --- |\n");
    for command in agent_commands() {
        markdown.push_str(&format!(
            "| {} | `{}` | {} | {} | {} |\n",
            command.name,
            command.example,
            yes_no(command.mutates_history),
            yes_no(command.writes_clipboard),
            yes_no(command.destructive)
        ));
    }
    markdown.push('\n');

    markdown.push_str("## Recent Clipboard Context\n\n");
    push_markdown_entries(&mut markdown, entries, "###");

    markdown
}

fn yes_no(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}

fn select_recent(
    history: &[HistoryEntry],
    limit: usize,
    kind: Option<HistoryKind>,
    pinned_only: bool,
) -> Vec<HistoryEntry> {
    history
        .iter()
        .filter(|entry| kind_matches(entry, kind))
        .filter(|entry| !pinned_only || entry.is_pinned())
        .take(limit)
        .cloned()
        .collect()
}

fn presentation_entries(entries: &[HistoryEntry], reveal_secrets: bool) -> Vec<HistoryEntry> {
    if reveal_secrets {
        entries.to_vec()
    } else {
        entries
            .iter()
            .map(HistoryEntry::masked_for_presentation)
            .collect()
    }
}

fn format_entries(
    entries: &[HistoryEntry],
    format: OutputFormat,
    reveal_secrets: bool,
) -> Result<String, CliError> {
    let presented_entries = presentation_entries(entries, reveal_secrets);
    match format {
        OutputFormat::Json => serde_json::to_string(&presented_entries)
            .map(|json| format!("{json}\n"))
            .map_err(|error| CliError::Runtime(error.to_string())),
        OutputFormat::Raw => Ok(format_raw_entries(entries)),
        OutputFormat::Markdown => Ok(format_markdown_context(&presented_entries)),
        OutputFormat::Text => Ok(format_text_list(&presented_entries)),
    }
}

fn format_single_entry(
    entry: &HistoryEntry,
    format: OutputFormat,
    reveal_secrets: bool,
) -> Result<String, CliError> {
    let presented_entry = if reveal_secrets {
        entry.clone()
    } else {
        entry.masked_for_presentation()
    };
    match format {
        OutputFormat::Json => serde_json::to_string(&presented_entry)
            .map(|json| format!("{json}\n"))
            .map_err(|error| CliError::Runtime(error.to_string())),
        OutputFormat::Raw => Ok(format!("{}\n", raw_content(entry))),
        OutputFormat::Markdown => Ok(format_markdown_context(std::slice::from_ref(
            &presented_entry,
        ))),
        OutputFormat::Text => Ok(format_text_item(1, &presented_entry)),
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
        "{index}. [{}] {} | sourceApp: {} | lastCopiedAt: {} | copyCount: {} | isPinned: {}\n",
        kind_name(entry),
        common.display_text,
        common.source_app.as_deref().unwrap_or("unknown"),
        common.last_copied_at,
        common.copy_count,
        common.is_pinned
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

    push_markdown_entries(&mut markdown, entries, "##");
    markdown
}

fn push_markdown_entries(markdown: &mut String, entries: &[HistoryEntry], heading: &str) {
    if entries.is_empty() {
        markdown.push_str("No clipboard history entries matched.\n");
        return;
    }

    for (index, entry) in entries.iter().enumerate() {
        let common = entry.common();
        markdown.push_str(&format!(
            "{heading} {}. {}\n\n",
            index + 1,
            common.display_text
        ));
        markdown.push_str(&format!("- id: {}\n", common.id));
        markdown.push_str(&format!("- kind: {}\n", kind_name(entry)));
        markdown.push_str(&format!(
            "- sourceApp: {}\n",
            common.source_app.as_deref().unwrap_or("unknown")
        ));
        markdown.push_str(&format!("- lastCopiedAt: {}\n", common.last_copied_at));
        markdown.push_str(&format!("- copyCount: {}\n\n", common.copy_count));
        markdown.push_str(&format!("- isPinned: {}\n\n", common.is_pinned));
        markdown.push_str(&markdown_code_block("text", &raw_content(entry)));
        markdown.push('\n');
    }
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

fn parse_agent_format_option(args: &[String], index: usize) -> Result<bool, CliError> {
    let value = args
        .get(index + 1)
        .ok_or_else(|| CliError::Usage("--format requires a value".to_string()))?;

    match value.as_str() {
        "markdown" => Ok(false),
        "json" => Ok(true),
        _ => Err(CliError::Usage(
            "--format must be markdown or json for agent mode".to_string(),
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
  mclip-cli [--history-path PATH] list [--limit N] [--kind text|image|files] [--pinned] [--reveal-secrets] [--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] get (--index N|--id ID) [--reveal-secrets] [--raw|--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] search QUERY [--limit N] [--kind text|image|files] [--pinned] [--reveal-secrets] [--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] context [--last N] [--kind text|image|files] [--pinned] [--reveal-secrets] [--json|--format text|json|raw|markdown]
  mclip-cli [--history-path PATH] agent [--last N] [--kind text|image|files] [--pinned] [--reveal-secrets] [--json|--format markdown|json]
  mclip-cli [--history-path PATH] add [--source-app NAME] [--max-history N] [--json] [TEXT...]
  mclip-cli [--history-path PATH] copy [(--index N|--id ID)|--stdin] [--json]
  command | mclip-cli copy [--json]
  mclip-cli transform <json-prettify|json-minify|base64-encode|base64-decode|url-component-encode|url-component-decode> (--text TEXT|--stdin)
  command | mclip-cli transform <action>
  mclip-cli [--history-path PATH] delete (--index N|--id ID) [--json]
  mclip-cli [--history-path PATH] pin (--index N|--id ID) [--json]
  mclip-cli [--history-path PATH] unpin (--index N|--id ID) [--json]
  mclip-cli [--history-path PATH] clear --yes [--keep-pinned] [--json]

Environment:
  MCLIP_HISTORY_PATH  Override the default local mclip history.json path.

Privacy:
  Classified secrets are masked by default. --raw and --reveal-secrets explicitly reveal
  local plaintext history for that invocation. Detection is heuristic and masking is not
  encryption at rest.
"#
}

#[cfg(test)]
mod tests {
    use super::{
        run_copy_with_sources, run_transform, CliError, CliInput, MAX_TEXT_TRANSFORM_INPUT_BYTES,
    };
    use crate::history::{HistoryEntry, HistoryEntryCommon};
    use crate::sensitive_content::{SecretType, SECRET_DETECTOR_VERSION};

    struct TestInput {
        bytes: Vec<u8>,
        terminal: bool,
    }

    impl TestInput {
        fn terminal() -> Self {
            Self {
                bytes: Vec::new(),
                terminal: true,
            }
        }

        fn piped(bytes: impl Into<Vec<u8>>) -> Self {
            Self {
                bytes: bytes.into(),
                terminal: false,
            }
        }
    }

    impl CliInput for TestInput {
        fn is_terminal(&self) -> bool {
            self.terminal
        }

        fn read_limited(&mut self, max_bytes: usize) -> Result<Vec<u8>, CliError> {
            Ok(self
                .bytes
                .iter()
                .copied()
                .take(max_bytes.saturating_add(1))
                .collect())
        }
    }

    fn run_copy_with_writer<F>(
        history: &[HistoryEntry],
        args: &[String],
        writer: F,
    ) -> Result<String, CliError>
    where
        F: FnMut(HistoryEntry) -> Result<(), String>,
    {
        let mut input = TestInput::terminal();
        run_copy_with_sources(
            args,
            &mut input,
            || Ok(history.to_vec()),
            writer,
            |_| panic!("selector copy must not use the text writer"),
        )
    }

    fn text_entry(id: &str, text: &str) -> HistoryEntry {
        HistoryEntry::Text {
            common: HistoryEntryCommon {
                id: id.to_string(),
                display_text: text.to_string(),
                first_copied_at: 100,
                last_copied_at: 200,
                source_app: Some("Codex".to_string()),
                copy_count: 1,
                is_pinned: false,
                pinned_at: None,
            },
            text: text.to_string(),
            secret_type: None,
            secret_detector_version: None,
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
    fn stdin_copy_validates_sources_and_utf8_before_clipboard_mutation() {
        let mut copied = None;
        let mut input = TestInput::piped(b"pipeline text".to_vec());
        let output = run_copy_with_sources(
            &[],
            &mut input,
            || panic!("stdin copy must not load history"),
            |_| panic!("stdin copy must not use the history writer"),
            |text| {
                copied = Some(text);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(copied.as_deref(), Some("pipeline text"));
        assert!(output.contains("Copied stdin text"));

        let mut wrote = false;
        let mut invalid = TestInput::piped(vec![0xff]);
        let error = run_copy_with_sources(
            &[],
            &mut invalid,
            || Ok(Vec::new()),
            |_| Ok(()),
            |_| {
                wrote = true;
                Ok(())
            },
        )
        .unwrap_err();
        assert!(matches!(error, CliError::Usage(message) if message.contains("UTF-8")));
        assert!(!wrote);
    }

    #[test]
    fn copy_rejects_terminal_no_source_and_selector_stdin_ambiguity() {
        let mut terminal = TestInput::terminal();
        let error = run_copy_with_sources(
            &[],
            &mut terminal,
            || Ok(Vec::new()),
            |_| Ok(()),
            |_| Ok(()),
        )
        .unwrap_err();
        assert!(matches!(error, CliError::Usage(_)));

        let mut piped = TestInput::piped(b"ambiguous".to_vec());
        let error = run_copy_with_sources(
            &["--id".to_string(), "first".to_string()],
            &mut piped,
            || Ok(vec![text_entry("first", "alpha")]),
            |_| Ok(()),
            |_| Ok(()),
        )
        .unwrap_err();
        assert!(matches!(error, CliError::Usage(message) if message.contains("exactly one")));

        let mut explicit = TestInput {
            bytes: b"explicit".to_vec(),
            terminal: true,
        };
        let mut copied = None;
        run_copy_with_sources(
            &["--stdin".to_string()],
            &mut explicit,
            || panic!("explicit stdin must not load history"),
            |_| panic!("explicit stdin must not use history clipboard"),
            |text| {
                copied = Some(text);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(copied.as_deref(), Some("explicit"));

        let mut terminal = TestInput::terminal();
        let duplicate_selector = run_copy_with_sources(
            &[
                "--id".to_string(),
                "first".to_string(),
                "--index".to_string(),
                "1".to_string(),
            ],
            &mut terminal,
            || Ok(vec![text_entry("first", "alpha")]),
            |_| Ok(()),
            |_| Ok(()),
        )
        .unwrap_err();
        assert!(
            matches!(duplicate_selector, CliError::Usage(message) if message.contains("exactly one"))
        );

        let mut oversized = TestInput::piped(vec![b'x'; MAX_TEXT_TRANSFORM_INPUT_BYTES + 1]);
        let oversize_error = run_copy_with_sources(
            &[],
            &mut oversized,
            || Ok(Vec::new()),
            |_| Ok(()),
            |_| Ok(()),
        )
        .unwrap_err();
        assert!(matches!(oversize_error, CliError::Usage(message) if message.contains("exceeds")));
    }

    #[test]
    fn transform_supports_text_and_piped_sources_with_content_only_output() {
        let mut terminal = TestInput::terminal();
        let output = run_transform(
            &[
                "json-minify".to_string(),
                "--text".to_string(),
                "{ \"ok\": true }".to_string(),
            ],
            &mut terminal,
        )
        .unwrap();
        assert_eq!(output, "{\"ok\":true}");

        let mut piped = TestInput::piped("hello".as_bytes().to_vec());
        let output = run_transform(&["base64-encode".to_string()], &mut piped).unwrap();
        assert_eq!(output, "aGVsbG8=");
    }

    #[test]
    fn copy_writes_original_classified_text_without_echoing_it() {
        let original = "sk-proj-SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_1234567890";
        let mut entry = text_entry("classified", original);
        if let HistoryEntry::Text {
            secret_type,
            secret_detector_version,
            ..
        } = &mut entry
        {
            *secret_type = Some(SecretType::OpenAiApiKey);
            *secret_detector_version = Some(SECRET_DETECTOR_VERSION);
        }
        let history = vec![entry];
        let mut copied = None;

        let output = run_copy_with_writer(
            &history,
            &["--index".to_string(), "1".to_string()],
            |entry| {
                copied = match entry {
                    HistoryEntry::Text { text, .. } => Some(text),
                    _ => None,
                };
                Ok(())
            },
        )
        .expect("copy should succeed");

        assert_eq!(copied.as_deref(), Some(original));
        assert!(!output.contains(original));
        assert!(!output.contains("••••••••"));
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
