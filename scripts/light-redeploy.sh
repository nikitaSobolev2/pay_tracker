#!/usr/bin/env bash
# Pull the GHCR image and restart without building on the VPS.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-ubuntu.sh" light "$@"
