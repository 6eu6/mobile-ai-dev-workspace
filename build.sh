#!/bin/bash
set -e
cd /home/z/my-project/palmkit-repo
NODE_OPTIONS="--max-old-space-size=4096" npx remix vite:build 2>&1