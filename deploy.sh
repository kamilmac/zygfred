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

# cache-busting: stamp cross-file references in the html and app modules.
# NEVER touch pkg/ — the glue's internal wasm-import key ("./zygfred_engine_bg.js")
# must match the name baked into the wasm binary.
for f in "$SITE"/index.html "$SITE"/app/*.js; do
  sed -i '' -E "s|(\.(js\|css\|wasm))(['\"])|\1?v=$VER\3|g" "$f"
done

git -C "$SITE" init -q -b gh-pages
git -C "$SITE" add .
git -C "$SITE" commit -qm "deploy $VER"
git -C "$SITE" push -qf git@github.com:kamilmac/zygfred.git gh-pages
rm -rf "$SITE"
echo "deployed $VER"
