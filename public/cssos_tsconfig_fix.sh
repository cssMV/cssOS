#!/usr/bin/env bash
set -euo pipefail

cd /srv/cssos/repo

git checkout main
git fetch origin
git reset --hard origin/main
git clean -fd

if [ ! -f tsconfig.json ]; then
  echo "ERROR: tsconfig.json not found in repo root" >&2
  exit 1
fi

perl -0777 -i -pe '
  my $s = $_;
  if ($s !~ /"compilerOptions"\s*:\s*\{/) {
    $s =~ s/\{\s*/{\n  "compilerOptions": {},\n/;
  }
  $s =~ s/"module"\s*:\s*"[^"]*"/"module": "CommonJS"/g;
  $s =~ s/"target"\s*:\s*"[^"]*"/"target": "ES2020"/g;
  $s =~ s/"outDir"\s*:\s*"[^"]*"/"outDir": "dist"/g;
  $s =~ s/"rootDir"\s*:\s*"[^"]*"/"rootDir": "src"/g;
  $s =~ s/"esModuleInterop"\s*:\s*(true|false)/"esModuleInterop": true/g;
  $s =~ s/"moduleResolution"\s*:\s*"[^"]*"/"moduleResolution": "node"/g;

  if ($s !~ /"module"\s*:\s*"CommonJS"/) {
    $s =~ s/"compilerOptions"\s*:\s*\{/"compilerOptions": {\n    "module": "CommonJS",/;
  }
  if ($s !~ /"outDir"\s*:\s*"dist"/) {
    $s =~ s/"compilerOptions"\s*:\s*\{/"compilerOptions": {\n    "outDir": "dist",/;
  }
  if ($s !~ /"rootDir"\s*:\s*"src"/) {
    $s =~ s/"compilerOptions"\s*:\s*\{/"compilerOptions": {\n    "rootDir": "src",/;
  }
  if ($s !~ /"esModuleInterop"\s*:\s*true/) {
    $s =~ s/"compilerOptions"\s*:\s*\{/"compilerOptions": {\n    "esModuleInterop": true,/;
  }
  if ($s !~ /"moduleResolution"\s*:\s*"node"/) {
    $s =~ s/"compilerOptions"\s*:\s*\{/"compilerOptions": {\n    "moduleResolution": "node",/;
  }

  if ($s =~ /"types"\s*:\s*\[(.*?)\]/s) {
    my $inner = $1;
    if ($inner !~ /"node"/) {
      $s =~ s/"types"\s*:\s*\[(.*?)\]/"types": [$1, "node"]/s;
    }
  } else {
    $s =~ s/"compilerOptions"\s*:\s*\{/"compilerOptions": {\n    "types": ["node"],/;
  }

  $_ = $s;
' tsconfig.json

git add tsconfig.json
git commit -m "build: fix tsconfig to avoid TS1295" || true
git push origin main

sudo /srv/cssos/bin/deploy-release.sh

curl -sI https://cssstudio.app/versions.json | sed -n "1,20p"
