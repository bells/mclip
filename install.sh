#!/bin/sh
set -eu

BIN_NAME="mclip-cli"
REPO_URL="${MCLIP_REPO_URL:-https://github.com/bells/mclip.git}"
REPO_REF="${MCLIP_REF:-main}"
RELEASE_BASE_URL="${MCLIP_RELEASE_BASE_URL:-https://github.com/bells/mclip/releases}"
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

detect_release_asset() {
  os_name="$(uname -s 2>/dev/null || printf unknown)"
  arch_name="$(uname -m 2>/dev/null || printf unknown)"

  if [ "${OS:-}" = "Windows_NT" ]; then
    case "${PROCESSOR_ARCHITECTURE:-$arch_name}" in
      ARM64|arm64|aarch64) printf 'mclip-cli-windows-arm64.exe' ;;
      *) printf 'mclip-cli-windows-x64.exe' ;;
    esac
    return
  fi

  case "$os_name:$arch_name" in
    Darwin:arm64|Darwin:aarch64) printf 'mclip-cli-darwin-arm64' ;;
    Darwin:x86_64|Darwin:amd64) printf 'mclip-cli-darwin-x64' ;;
    Linux:arm64|Linux:aarch64) printf 'mclip-cli-linux-arm64' ;;
    Linux:x86_64|Linux:amd64) printf 'mclip-cli-linux-x64' ;;
    *) printf '' ;;
  esac
}

release_download_url() {
  asset_name="$1"

  if [ -n "${MCLIP_VERSION:-}" ]; then
    printf '%s/download/v%s/%s' "$RELEASE_BASE_URL" "$MCLIP_VERSION" "$asset_name"
  else
    printf '%s/latest/download/%s' "$RELEASE_BASE_URL" "$asset_name"
  fi
}

download_prebuilt_binary() {
  asset_name="$(detect_release_asset)"

  [ -n "$asset_name" ] || return 1
  command -v curl >/dev/null 2>&1 || return 1

  cleanup_dir="$(make_temp_dir)"
  downloaded_path="$cleanup_dir/$BIN_NAME"
  download_url="$(release_download_url "$asset_name")"

  log "Downloading prebuilt $asset_name"
  if curl -fL "$download_url" -o "$downloaded_path"; then
    copy_binary "$downloaded_path"
    return 0
  fi

  log "Prebuilt download failed; falling back to local/source build."
  return 1
}

build_repo_binary() {
  repo_dir="$1"

  command -v cargo >/dev/null 2>&1 || fail "cargo is required only when prebuilt download is unavailable"
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
elif download_prebuilt_binary; then
  :
elif [ -f "./src-tauri/Cargo.toml" ]; then
  build_repo_binary "."
else
  command -v git >/dev/null 2>&1 || fail "git is required only when prebuilt download is unavailable and source fallback is needed"
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
log "  mclip-cli --version"
log "  mclip-cli list --limit 5 --json"
