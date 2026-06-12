#!/bin/sh
set -eu

BIN_NAME="mclip-cli"
REPO_URL="${MCLIP_REPO_URL:-https://github.com/bells/mclip.git}"
REPO_REF="${MCLIP_REF:-main}"
INSTALL_DIR="${MCLIP_INSTALL_DIR:-$HOME/.local/bin}"

if [ "${OS:-}" = "Windows_NT" ]; then
  BIN_NAME="mclip-cli.exe"
fi

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'mclip-cli install failed: %s\n' "$*" >&2
  exit 1
}

make_temp_dir() {
  mktemp -d 2>/dev/null || mktemp -d -t mclip-cli
}

copy_binary() {
  source_path="$1"
  install_path="$INSTALL_DIR/$BIN_NAME"

  [ -f "$source_path" ] || fail "binary not found: $source_path"
  mkdir -p "$INSTALL_DIR"
  cp "$source_path" "$install_path"
  chmod 755 "$install_path"
  log "Installed $BIN_NAME to $install_path"
}

build_repo_binary() {
  repo_dir="$1"

  command -v cargo >/dev/null 2>&1 || fail "cargo is required to build mclip-cli"
  cargo build --manifest-path "$repo_dir/src-tauri/Cargo.toml" --bin mclip-cli --release
  copy_binary "$repo_dir/src-tauri/target/release/$BIN_NAME"
}

cleanup_dir=""
cleanup() {
  if [ -n "$cleanup_dir" ] && [ -d "$cleanup_dir" ]; then
    rm -rf "$cleanup_dir"
  fi
}
trap cleanup EXIT INT TERM

if [ -n "${MCLIP_CLI_SOURCE:-}" ]; then
  copy_binary "$MCLIP_CLI_SOURCE"
elif [ -f "./src-tauri/target/release/$BIN_NAME" ]; then
  copy_binary "./src-tauri/target/release/$BIN_NAME"
elif [ -f "./src-tauri/target/debug/$BIN_NAME" ]; then
  copy_binary "./src-tauri/target/debug/$BIN_NAME"
elif [ -f "./src-tauri/Cargo.toml" ]; then
  build_repo_binary "."
else
  command -v git >/dev/null 2>&1 || fail "git is required to fetch mclip source"
  cleanup_dir="$(make_temp_dir)"
  log "Fetching mclip from $REPO_URL"
  git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$cleanup_dir/mclip"
  build_repo_binary "$cleanup_dir/mclip"
fi

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    log ""
    log "$INSTALL_DIR is not on PATH yet."
    log "Add this to your shell profile:"
    log "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac

log ""
log "Try:"
log "  mclip-cli list --limit 5 --json"
