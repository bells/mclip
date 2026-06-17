use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

fn cli_path() -> &'static str {
    env!("CARGO_BIN_EXE_mclip-cli")
}

const REMEMBER_DOCS_ID: &str = "h_72a416715c8413f3530461c02d0f14f03b096ad289bac1c4211d80c6481a9d5f";

fn write_history_fixture(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mclip-agent-cli-{name}-{unique}"));
    fs::create_dir_all(&dir).expect("fixture directory should be created");
    let path = dir.join("history.json");
    fs::write(
        &path,
        r#"[
  {
    "kind": "text",
    "id": "text-panic",
    "displayText": "panic: database unavailable",
    "firstCopiedAt": 1781234500000,
    "lastCopiedAt": 1781234567890,
    "sourceApp": "Cursor",
    "copyCount": 2,
    "text": "thread 'main' panicked at database unavailable"
  },
  {
    "kind": "files",
    "id": "files-report",
    "displayText": "report.txt, notes.md",
    "firstCopiedAt": 1781234400000,
    "lastCopiedAt": 1781234400000,
    "sourceApp": "Finder",
    "copyCount": 1,
    "filePaths": ["/tmp/report.txt", "/tmp/notes.md"]
  },
  {
    "kind": "text",
    "id": "h_72a416715c8413f3530461c02d0f14f03b096ad289bac1c4211d80c6481a9d5f",
    "displayText": "older note",
    "firstCopiedAt": 1781234300000,
    "lastCopiedAt": 1781234300000,
    "sourceApp": null,
    "copyCount": 1,
    "text": "remember to update docs"
  }
]
"#,
    )
    .expect("fixture history should be written");
    path
}

fn run_cli(args: &[&str]) -> std::process::Output {
    Command::new(cli_path())
        .args(args)
        .output()
        .expect("mclip-cli should run")
}

fn run_cli_with_stdin(args: &[&str], stdin: &str) -> std::process::Output {
    let mut child = Command::new(cli_path())
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("mclip-cli should run");

    child
        .stdin
        .as_mut()
        .expect("stdin should be piped")
        .write_all(stdin.as_bytes())
        .expect("stdin should be written");

    child
        .wait_with_output()
        .expect("mclip-cli output should be collected")
}

fn read_history(path: &PathBuf) -> serde_json::Value {
    serde_json::from_str(&fs::read_to_string(path).expect("history should be readable"))
        .expect("history should be json")
}

#[test]
fn list_outputs_recent_history_as_json() {
    let history_path = write_history_fixture("list-json");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "list",
        "--limit",
        "2",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""id":"text-panic""#));
    assert!(stdout.contains(r#""id":"files-report""#));
    assert!(!stdout.contains(REMEMBER_DOCS_ID));
}

#[test]
fn get_outputs_raw_text_by_one_based_index() {
    let history_path = write_history_fixture("get-raw");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "get",
        "--index",
        "3",
        "--raw",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        String::from_utf8_lossy(&output.stdout),
        "remember to update docs\n"
    );
}

#[test]
fn search_filters_history_case_insensitively() {
    let history_path = write_history_fixture("search-json");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "search",
        "PANIC",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""id":"text-panic""#));
    assert!(!stdout.contains(r#""id":"files-report""#));
}

#[test]
fn context_outputs_markdown_for_recent_history() {
    let history_path = write_history_fixture("context-markdown");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "context",
        "--last",
        "2",
        "--format",
        "markdown",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("# mclip Clipboard Context"));
    assert!(stdout.contains("sourceApp: Cursor"));
    assert!(stdout.contains("thread 'main' panicked at database unavailable"));
    assert!(stdout.contains("/tmp/report.txt"));
    assert!(!stdout.contains("remember to update docs"));
}

#[test]
fn agent_mode_outputs_markdown_bundle_for_agents() {
    let history_path = write_history_fixture("agent-markdown");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "agent",
        "--last",
        "2",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("# mclip Agent Mode"));
    assert!(stdout.contains("## Safety Contract"));
    assert!(stdout.contains("add writes text into history without replacing the system clipboard"));
    assert!(stdout.contains("copy writes one selected history item back to the system clipboard"));
    assert!(stdout.contains("mclip-cli copy --index 1"));
    assert!(stdout.contains("thread 'main' panicked at database unavailable"));
    assert!(stdout.contains("/tmp/report.txt"));
    assert!(!stdout.contains("remember to update docs"));
}

#[test]
fn agent_mode_outputs_json_bundle_with_commands_and_context() {
    let history_path = write_history_fixture("agent-json");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "agent",
        "--last",
        "2",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be json");
    assert_eq!(stdout["schemaVersion"], 1);
    assert_eq!(stdout["mode"], "agent");
    assert_eq!(stdout["historyCount"], 3);
    assert_eq!(stdout["selectedCount"], 2);
    assert_eq!(stdout["context"][0]["id"], "text-panic");
    assert_eq!(stdout["context"][1]["id"], "files-report");
    assert!(stdout["commands"]
        .as_array()
        .expect("commands should be an array")
        .iter()
        .any(|command| command["name"] == "add" && command["mutatesHistory"] == true));
    assert!(stdout["commands"]
        .as_array()
        .expect("commands should be an array")
        .iter()
        .any(|command| command["name"] == "copy" && command["writesClipboard"] == true));
    assert!(stdout["safety"]
        .as_array()
        .expect("safety should be an array")
        .iter()
        .any(|note| note
            .as_str()
            .unwrap_or_default()
            .contains("clear requires --yes")));
}

#[test]
fn add_writes_piped_text_to_history_without_touching_existing_items() {
    let history_path = write_history_fixture("add-stdin");

    let output = run_cli_with_stdin(
        &[
            "--history-path",
            history_path.to_str().expect("history path should be utf-8"),
            "add",
            "--source-app",
            "Codex",
            "--json",
        ],
        "new agent note\nwith details",
    );

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be json");
    assert_eq!(stdout["action"], "add");
    assert_eq!(stdout["historyCount"], 4);

    let history = read_history(&history_path);
    assert_eq!(history[0]["kind"], "text");
    assert_eq!(history[0]["sourceApp"], "Codex");
    assert_eq!(history[0]["text"], "new agent note\nwith details");
    assert_eq!(history[1]["id"], "text-panic");
}

#[test]
fn add_deduplicates_text_and_moves_it_to_the_front() {
    let history_path = write_history_fixture("add-dedupe");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "add",
        "--source-app",
        "Codex",
        "remember to update docs",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let history = read_history(&history_path);
    assert_eq!(
        history.as_array().expect("history should be array").len(),
        3
    );
    assert_eq!(history[0]["id"], REMEMBER_DOCS_ID);
    assert_eq!(history[0]["copyCount"], 2);
    assert_eq!(history[0]["sourceApp"], "Codex");
}

#[test]
fn delete_removes_history_item_by_one_based_index() {
    let history_path = write_history_fixture("delete-index");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "delete",
        "--index",
        "2",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be json");
    assert_eq!(stdout["action"], "delete");
    assert_eq!(stdout["id"], "files-report");
    assert_eq!(stdout["historyCount"], 2);

    let history = read_history(&history_path);
    assert_eq!(
        history.as_array().expect("history should be array").len(),
        2
    );
    assert_eq!(history[0]["id"], "text-panic");
    assert_eq!(history[1]["id"], REMEMBER_DOCS_ID);
}

#[test]
fn clear_requires_confirmation_and_removes_history_file() {
    let history_path = write_history_fixture("clear");

    let rejected = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "clear",
    ]);
    assert_eq!(rejected.status.code(), Some(2));
    assert!(history_path.exists());

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "clear",
        "--yes",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be json");
    assert_eq!(stdout["action"], "clear");
    assert_eq!(stdout["historyCount"], 0);
    assert!(!history_path.exists());
}
