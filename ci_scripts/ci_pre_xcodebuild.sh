#!/bin/zsh
set -euo pipefail
set -x

# Ensure Xcode Cloud temp output locations exist.
mkdir -p /Volumes/workspace/tmp
touch /Volumes/workspace/tmp/resultBundleStream.json || true

# Show available schemes for debugging.
xcodebuild -list -workspace /Volumes/workspace/repository/basafy-mobile/basafy-rn-expo/ios/Basafy.xcworkspace
