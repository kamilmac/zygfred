#!/usr/bin/env bash
# Build the engine and publish web/ to gh-pages. Every local .js/.css/.wasm reference is
# stamped with ?v=<sha> so a browser can never mix resources from two deploys.
set -euo pipefail
cd "$(dirname "$0")"
VER=$(git rev-parse --short HEAD)

wasm-pack build engine --target web --release --out-dir ../web/pkg

SITE=$(mktemp -d)
cp -R web/. "$SITE/"
rm -f "$SITE/pkg/.gitignore" # wasm-pack generates it with '*' — it would exclude pkg from the commit
touch "$SITE/.nojekyll"

# cache-busting: stamp every cross-file reference in html + js
find "$SITE" -maxdepth 2 -name '*.js' -o -maxdepth 2 -name '*.html' | while read -r f; do
  sed -i '' -E "s|(\.(js\|css\|wasm))(['\"])|\1?v=$VER\3|g" "$f"
done

git -C "$SITE" init -q -b gh-pages
git -C "$SITE" add .
git -C "$SITE" commit -qm "deploy $VER"
git -C "$SITE" push -qf git@github.com:kamilmac/zygfred.git gh-pages
rm -rf "$SITE"
echo "deployed $VER"
