#!/usr/bin/env bash
# Removes node_modules from Git history so push to GitHub succeeds.
# Run from repo root: ./fix-git-history.sh

set -e
cd "$(dirname "$0")"

echo "==> Removing node_modules from Git history..."
git filter-branch --force --index-filter \
  'git rm -rf --cached --ignore-unmatch \
    dashboard/node_modules \
    client-portal/node_modules \
    platform/node_modules \
    opencpa/node_modules' \
  --prune-empty -- --all

echo ""
echo "==> Cleaning up..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "==> Done. Now run: git push --force origin main"
echo "    (Force push is needed because history was rewritten)"
