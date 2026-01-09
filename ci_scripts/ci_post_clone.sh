#!/bin/zsh
set -euo pipefail

# Ensure the iOS workspace is generated before Xcode Cloud builds.
cd basafy-mobile/basafy-rn-expo/ios
pod install
