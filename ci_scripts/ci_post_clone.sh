#!/bin/zsh
set -euo pipefail
set -x

# Xcode Cloud runs this from the repo root; ensure we install app deps and Pods.
cd "$(dirname "$0")/.."
cd basafy-mobile/basafy-rn-expo
npm ci

cd ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
