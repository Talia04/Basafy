#!/bin/zsh
set -euo pipefail
set -x

# Xcode Cloud may set the working directory to this app folder.
ios_dir="$(cd "$(dirname "$0")/.." && pwd)"
app_dir="$(cd "$ios_dir/.." && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  brew install node@20
  brew link --force --overwrite node@20
fi

npm ci --prefix "$app_dir"

cd "$ios_dir"
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
