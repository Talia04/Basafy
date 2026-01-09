#!/bin/zsh
set -euo pipefail
set -x

# Ensure Xcode Cloud temp output locations exist.
mkdir -p /Volumes/workspace/tmp
touch /Volumes/workspace/tmp/resultBundleStream.json || true

# Fallback: ensure Pods exist before archive.
if [[ ! -f /Volumes/workspace/repository/basafy-mobile/basafy-rn-expo/ios/Pods/Target\ Support\ Files/Pods-Basafy/Pods-Basafy.release.xcconfig ]]; then
  cd /Volumes/workspace/repository/basafy-mobile/basafy-rn-expo
  npm ci
  cd ios
  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
fi

# Show available schemes for debugging.
xcodebuild -list -workspace /Volumes/workspace/repository/basafy-mobile/basafy-rn-expo/ios/Basafy.xcworkspace
