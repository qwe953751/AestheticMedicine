#!/usr/bin/env bash
set -euo pipefail

# The source repository must never be used as the website deployment target.
readonly target='git@github.com:frank-AestheticMedicine/frank-aestheticmedicine.github.io.git'
readonly build_dir="${1:-dist}"
[[ -s "$build_dir/index.html" ]] || { echo 'Missing built index.html' >&2; exit 1; }
[[ -n "${GIT_SSH_COMMAND:-}" ]] || { echo 'A scoped SSH deploy key is required' >&2; exit 1; }

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

git clone --quiet --single-branch --branch gh-pages "$target" "$stage/site"
rsync -a --delete --exclude='.git' "$build_dir/" "$stage/site/"
touch "$stage/site/.nojekyll"
git -C "$stage/site" config user.name 'github-actions[bot]'
git -C "$stage/site" config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git -C "$stage/site" add --all
if git -C "$stage/site" diff --cached --quiet; then
  echo 'The published assets already match this build.'
else
  git -C "$stage/site" commit --quiet -m "Publish skin journal ${GITHUB_SHA:-local-build}"
  git -C "$stage/site" push origin HEAD:gh-pages
fi
printf 'Published website commit: '
git -C "$stage/site" rev-parse HEAD
