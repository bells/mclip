use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn cli_path() -> &'static str {
    env!("CARGO_BIN_EXE_mclip-cli")
}

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
    "id": "text-older",
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
    assert!(!stdout.contains(r#""id":"text-older""#));
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
