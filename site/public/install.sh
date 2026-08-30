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
  install_temp="$INSTALL_DIR/.$BIN_NAME.install.$$"
  install_backup="$INSTALL_DIR/.$BIN_NAME.backup.$$"

  [ -f "$source_path" ] || fail "binary not found: $source_path"
  mkdir -p "$INSTALL_DIR"

  if [ -L "$install_path" ] || { [ -e "$install_path" ] && [ ! -f "$install_path" ]; }; then
    fail "destination is not a regular file: $install_path"
  fi

  if ! cp "$source_path" "$install_temp"; then
    rm -f "$install_temp"
    fail "unable to stage $BIN_NAME in $INSTALL_DIR"
  fi

  if ! chmod 755 "$install_temp"; then
    rm -f "$install_temp"
    fail "unable to make the staged $BIN_NAME executable"
  fi

  had_existing=false
  if [ -f "$install_path" ]; then
    if ! mv "$install_path" "$install_backup"; then
      rm -f "$install_temp"
      fail "unable to preserve the existing $install_path"
    fi
    had_existing=true
  fi

  if ! mv "$install_temp" "$install_path"; then
    if [ "$had_existing" = true ]; then
      mv "$install_backup" "$install_path" || true
    fi
    rm -f "$install_temp"
    fail "unable to replace $install_path; make sure mclip-cli is not running"
  fi

  if [ "$had_existing" = true ]; then
    rm -f "$install_backup"
  fi

  log "Installed $BIN_NAME to $install_path"
}

detect_release_asset() {
  os_name="$(uname -s 2>/dev/null || printf unknown)"
  arch_name="$(uname -m 2>/dev/null || printf unknown)"

  if [ "${OS:-}" = "Windows_NT" ]; then
    case "${PROCESSOR_ARCHITECTURE:-$arch_name}" in
      AMD64|x86_64|amd64) printf 'mclip-cli-windows-x64.exe' ;;
      *) printf '' ;;
    esac
    return
  fi

  case "$os_name:$arch_name" in
    Darwin:arm64|Darwin:aarch64) printf 'mclip-cli-darwin-arm64' ;;
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

sha256_file() {
  file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file_path" | awk '{print $NF}'
  else
    fail "sha256sum, shasum, or openssl is required to verify the downloaded binary"
  fi
}

verify_checksum() {
  binary_path="$1"
  checksum_path="$2"
  expected_checksum="$(awk 'NR == 1 { print $1 }' "$checksum_path")"

  case "$expected_checksum" in
    ''|*[!0-9a-fA-F]*)
      fail "release checksum is malformed"
      ;;
  esac

  [ "${#expected_checksum}" -eq 64 ] || fail "release checksum is malformed"
  actual_checksum="$(sha256_file "$binary_path")"

  [ "$actual_checksum" = "$expected_checksum" ] ||
    fail "downloaded binary failed SHA-256 verification; existing mclip-cli was preserved"
}

download_prebuilt_binary() {
  asset_name="$(detect_release_asset)"

  if [ -z "$asset_name" ]; then
    os_name="$(uname -s 2>/dev/null || printf unknown)"
    arch_name="$(uname -m 2>/dev/null || printf unknown)"
    log "No supported prebuilt mclip-cli asset for $os_name/$arch_name; falling back to local/source build."
    return 1
  fi
  command -v curl >/dev/null 2>&1 || return 1

  cleanup_dir="$(make_temp_dir)"
  downloaded_path="$cleanup_dir/$BIN_NAME"
  checksum_path="$cleanup_dir/$BIN_NAME.sha256"
  download_url="$(release_download_url "$asset_name")"
  checksum_url="$(release_download_url "$asset_name.sha256")"

  log "Downloading prebuilt $asset_name"
  binary_http_status=""
  if binary_http_status="$(curl -sSL -w '%{http_code}' "$download_url" -o "$downloaded_path")"; then
    curl_status=0
  else
    curl_status="$?"
  fi

  case "$binary_http_status" in
    2??)
      [ "$curl_status" -eq 0 ] ||
        fail "unable to download the prebuilt CLI (curl $curl_status, HTTP $binary_http_status); existing mclip-cli was preserved"
      log "Downloading checksum $asset_name.sha256"
      curl -fsSL "$checksum_url" -o "$checksum_path" ||
        fail "release checksum is unavailable; existing mclip-cli was preserved"
      verify_checksum "$downloaded_path" "$checksum_path"
      copy_binary "$downloaded_path"
      return 0
      ;;
    404)
      rm -rf "$cleanup_dir"
      cleanup_dir=""
      log "Prebuilt asset is missing; falling back to local/source build."
      return 1
      ;;
    000|'')
      fail "unable to download the prebuilt CLI (curl $curl_status, HTTP unknown); existing mclip-cli was preserved"
      ;;
    *)
      fail "unable to download the prebuilt CLI (curl $curl_status, HTTP $binary_http_status); existing mclip-cli was preserved"
      ;;
  esac
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
