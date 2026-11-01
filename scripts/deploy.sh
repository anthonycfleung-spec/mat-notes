#!/bin/sh
# Publishes dist/ to the gh-pages branch, which GitHub Pages serves.
set -e
cd dist
git init -q -b gh-pages
git add -A
git -c core.hooksPath=/dev/null commit -q -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "Deployed: https://anthonycfleung-spec.github.io/mat-notes/"
