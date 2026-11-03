#!/bin/sh
# Publishes dist/ to the gh-pages branch, which GitHub Pages serves.
# Works from a temporary copy so dist/ never gets its own .git folder.
set -e
remote="$(git remote get-url origin)"
tmp="$(mktemp -d)"
rsync -a --exclude .git dist/ "$tmp"/
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c core.hooksPath=/dev/null commit -q -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$remote" gh-pages
cd - >/dev/null
rm -rf "$tmp"
echo "Deployed: https://anthonycfleung-spec.github.io/mat-notes/"
