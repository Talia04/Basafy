#!/bin/zsh
set -euo pipefail
set -x

RESULT_PATH="/Volumes/workspace/resultbundle.xcresult"

if [[ -d "$RESULT_PATH" ]]; then
  xcrun xcresulttool get --format json --path "$RESULT_PATH" | head -n 200
else
  echo "xcresult not found at $RESULT_PATH"
fi
