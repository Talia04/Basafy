#!/bin/zsh
set -euo pipefail

# Xcode Cloud may set the working directory to this app folder.
cd "$(dirname "$0")/.."
npm ci

cd ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
