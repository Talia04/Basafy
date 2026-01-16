#!/bin/zsh
set -euo pipefail

# Ensure JS deps are available, then generate the iOS workspace.
cd basafy-mobile/basafy-rn-expo
npm ci

cd ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
