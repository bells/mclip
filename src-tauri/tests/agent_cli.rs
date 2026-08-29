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

fn write_invalid_history_fixture(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mclip-agent-cli-{name}-{unique}"));
    fs::create_dir_all(&dir).expect("fixture directory should be created");
    let path = dir.join("history.json");
    fs::write(&path, "not-json").expect("fixture history should be written");
    path
}

fn missing_history_fixture(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    std::env::temp_dir()
        .join(format!("mclip-agent-cli-{name}-{unique}"))
        .join("history.json")
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
fn top_level_help_does_not_read_history_file() {
    let history_path = write_invalid_history_fixture("help-no-history");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "--help",
    ]);

    assert_eq!(output.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("mclip-cli"));
    assert!(stdout.contains("agent"));
    assert!(String::from_utf8_lossy(&output.stderr).is_empty());
}

#[test]
fn command_help_does_not_read_history_file() {
    let history_path = write_invalid_history_fixture("command-help-no-history");

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().expect("history path should be utf-8"),
        "list",
        "--help",
    ]);

    assert_eq!(output.status.code(), Some(0));
    assert!(String::from_utf8_lossy(&output.stdout).contains("mclip-cli"));
    assert!(String::from_utf8_lossy(&output.stderr).is_empty());
}

#[test]
fn version_commands_do_not_read_history_file() {
    let history_paths = [
        write_invalid_history_fixture("version-invalid-history"),
        missing_history_fixture("version-missing-history"),
    ];

    for history_path in history_paths {
        for version_arg in ["--version", "-V", "version"] {
            let output = run_cli(&[
                "--history-path",
                history_path.to_str().expect("history path should be utf-8"),
                version_arg,
            ]);

            assert_eq!(output.status.code(), Some(0), "{version_arg}");
            assert_eq!(
                String::from_utf8_lossy(&output.stdout),
                format!("mclip-cli {}\n", env!("CARGO_PKG_VERSION")),
            );
            assert!(String::from_utf8_lossy(&output.stderr).is_empty());
        }
    }
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
    assert_eq!(stdout["schemaVersion"], 2);
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
fn classified_text_is_masked_by_default_and_revealed_only_explicitly() {
    const SYNTHETIC_SECRET: &str = "sk-proj-SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_1234567890";
    let history_path = missing_history_fixture("sensitive-output");
    fs::create_dir_all(history_path.parent().unwrap()).unwrap();
    let path = history_path.to_str().expect("history path should be utf-8");

    let added = run_cli(&["--history-path", path, "add", "--json", SYNTHETIC_SECRET]);
    assert!(added.status.success());
    let add_output = String::from_utf8_lossy(&added.stdout);
    assert!(!add_output.contains(SYNTHETIC_SECRET));

    for args in [
        vec!["--history-path", path, "list", "--json"],
        vec!["--history-path", path, "get", "--index", "1", "--json"],
        vec!["--history-path", path, "search", "SYNTHETIC", "--json"],
        vec!["--history-path", path, "context", "--json"],
    ] {
        let output = run_cli(&args);
        assert!(output.status.success());
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.contains("••••••••"));
        assert!(stdout.contains("openAiApiKey"));
        assert!(!stdout.contains(SYNTHETIC_SECRET));
    }

    let agent = run_cli(&["--history-path", path, "agent", "--json"]);
    let agent_json: serde_json::Value = serde_json::from_slice(&agent.stdout).unwrap();
    assert_eq!(agent_json["schemaVersion"], 2);
    assert_eq!(agent_json["context"][0]["text"], "••••••••");

    for args in [
        vec!["--history-path", path, "list"],
        vec![
            "--history-path",
            path,
            "search",
            "SYNTHETIC",
            "--format",
            "markdown",
        ],
        vec!["--history-path", path, "context"],
        vec!["--history-path", path, "agent"],
    ] {
        let output = run_cli(&args);
        assert!(output.status.success());
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.contains("••••••••"));
        assert!(!stdout.contains(SYNTHETIC_SECRET));
    }

    let revealed = run_cli(&[
        "--history-path",
        path,
        "get",
        "--index",
        "1",
        "--json",
        "--reveal-secrets",
    ]);
    assert!(String::from_utf8_lossy(&revealed.stdout).contains(SYNTHETIC_SECRET));

    for command in ["list", "search", "context", "agent"] {
        let args = if command == "search" {
            vec![
                "--history-path",
                path,
                command,
                "SYNTHETIC",
                "--reveal-secrets",
            ]
        } else {
            vec!["--history-path", path, command, "--reveal-secrets"]
        };
        let output = run_cli(&args);
        assert!(output.status.success(), "{command}");
        assert!(
            String::from_utf8_lossy(&output.stdout).contains(SYNTHETIC_SECRET),
            "{command}"
        );
    }

    let raw = run_cli(&["--history-path", path, "get", "--index", "1", "--raw"]);
    assert_eq!(
        String::from_utf8_lossy(&raw.stdout).trim(),
        SYNTHETIC_SECRET
    );
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
fn add_returns_the_saved_id_when_a_pin_stays_ahead_of_new_history() {
    let history_path = write_history_fixture("add-with-pin");
    let path = history_path.to_str().expect("history path should be utf-8");

    let pinned = run_cli(&[
        "--history-path",
        path,
        "pin",
        "--id",
        "text-panic",
        "--json",
    ]);
    assert!(
        pinned.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&pinned.stderr)
    );

    let output = run_cli(&[
        "--history-path",
        path,
        "add",
        "--json",
        "new history behind pin",
    ]);
    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be json");
    let history = read_history(&history_path);
    let saved = history
        .as_array()
        .expect("history should be array")
        .iter()
        .find(|entry| entry["text"] == "new history behind pin")
        .expect("new text should be persisted");

    assert_eq!(history[0]["id"], "text-panic");
    assert_eq!(stdout["id"], saved["id"]);
    assert_ne!(stdout["id"], "text-panic");
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
    assert_eq!(stdout["pinnedRemovedCount"], 0);
    assert!(!history_path.exists());
}

#[test]
fn pin_unpin_filter_dedupe_and_keep_pinned_clear_share_one_persisted_contract() {
    let history_path = write_history_fixture("pin-flow");
    let path = history_path.to_str().expect("history path should be utf-8");

    let pin = run_cli(&[
        "--history-path",
        path,
        "pin",
        "--id",
        REMEMBER_DOCS_ID,
        "--json",
    ]);
    assert!(
        pin.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&pin.stderr)
    );
    let pin_json: serde_json::Value = serde_json::from_slice(&pin.stdout).unwrap();
    assert_eq!(pin_json["isPinned"], true);
    assert_eq!(read_history(&history_path)[0]["id"], REMEMBER_DOCS_ID);

    let filtered = run_cli(&["--history-path", path, "list", "--pinned", "--json"]);
    let filtered_json: serde_json::Value = serde_json::from_slice(&filtered.stdout).unwrap();
    assert_eq!(filtered_json.as_array().unwrap().len(), 1);
    assert_eq!(filtered_json[0]["id"], REMEMBER_DOCS_ID);

    let duplicate = run_cli(&[
        "--history-path",
        path,
        "add",
        "remember to update docs",
        "--json",
    ]);
    assert!(duplicate.status.success());
    let history = read_history(&history_path);
    assert_eq!(history[0]["id"], REMEMBER_DOCS_ID);
    assert_eq!(history[0]["isPinned"], true);
    assert_eq!(history[0]["copyCount"], 2);

    let keep = run_cli(&[
        "--history-path",
        path,
        "clear",
        "--yes",
        "--keep-pinned",
        "--json",
    ]);
    let keep_json: serde_json::Value = serde_json::from_slice(&keep.stdout).unwrap();
    assert_eq!(keep_json["historyCount"], 1);
    assert_eq!(keep_json["keptPinned"], true);
    assert_eq!(keep_json["pinnedRemovedCount"], 0);
    assert_eq!(read_history(&history_path).as_array().unwrap().len(), 1);

    let unpin = run_cli(&["--history-path", path, "unpin", "--index", "1", "--json"]);
    let unpin_json: serde_json::Value = serde_json::from_slice(&unpin.stdout).unwrap();
    assert_eq!(unpin_json["isPinned"], false);
    assert_eq!(read_history(&history_path)[0]["isPinned"], false);
}

#[test]
fn cli_rejects_the_one_hundred_and_first_pin_without_mutating_history() {
    let history_path = missing_history_fixture("pin-cap");
    fs::create_dir_all(history_path.parent().unwrap()).unwrap();
    let entries = (0..=100)
        .map(|index| {
            serde_json::json!({
                "kind": "text",
                "id": format!("item-{index}"),
                "displayText": format!("item-{index}"),
                "firstCopiedAt": index,
                "lastCopiedAt": index,
                "sourceApp": null,
                "copyCount": 1,
                "isPinned": index < 100,
                "pinnedAt": (index < 100).then_some(index),
                "text": format!("item-{index}")
            })
        })
        .collect::<Vec<_>>();
    fs::write(&history_path, serde_json::to_vec(&entries).unwrap()).unwrap();
    let before = fs::read(&history_path).unwrap();

    let output = run_cli(&[
        "--history-path",
        history_path.to_str().unwrap(),
        "pin",
        "--id",
        "item-100",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("pinnedHistoryLimitReached"));
    assert_eq!(fs::read(&history_path).unwrap(), before);
}
