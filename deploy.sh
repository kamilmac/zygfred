#!/usr/bin/env bash
# Build the engine and publish web/ to Cloudflare Pages (zygfred.zweibel-cocaine.com).
# Every local .js/.css/.wasm reference is stamped with ?v=<sha> so a browser can never
# mix resources from two deploys.
set -euo pipefail
cd "$(dirname "$0")"
VER=$(git rev-parse --short HEAD)

wasm-pack build engine --target web --release --out-dir ../web/pkg

SITE=$(mktemp -d)
mkdir -p "$SITE/app" "$SITE/pkg"
cp web/index.html web/theme.css web/styles.css web/manifest.webmanifest web/icon-192.png web/icon-512.png "$SITE/"
cp web/pkg/zygfred_engine_bg.wasm "$SITE/pkg/"

# bundle: source stays per-domain modules; the site ships two minified files.
# the worklet must remain its own file — audioWorklet.addModule loads it by URL.
npx esbuild web/app/main.js --bundle --minify --format=esm --outfile="$SITE/app/main.js" --log-level=warning
npx esbuild web/app/worklet.js --bundle --minify --format=esm --outfile="$SITE/app/worklet.js" --log-level=warning

# cache-busting. Surgical, not generic: the bundles CONTAIN the wasm-bindgen glue, whose
# internal import key ("./zygfred_engine_bg.js") must match the name baked into the binary.
sed -i '' -E "s|(\.(js\|css))(['\"])|\1?v=$VER\3|g" "$SITE/index.html"
sed -i '' "s|\./pkg/zygfred_engine_bg\.wasm|./pkg/zygfred_engine_bg.wasm?v=$VER|g" "$SITE/app/main.js"
sed -i '' "s|\./app/worklet\.js|./app/worklet.js?v=$VER|g" "$SITE/app/main.js"

npx wrangler pages deploy "$SITE" --project-name zygfred --branch main --commit-dirty=true
rm -rf "$SITE"
echo "deployed $VER"
