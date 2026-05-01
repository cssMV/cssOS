#!/usr/bin/env bash
set -e

echo "Cleaning disk..."

if [ -d "data/frames" ]; then
  rm -rf data/frames/*
  echo "frames cleaned"
fi

if [ -d "data/raw" ]; then
  rm -rf data/raw/*
  echo "raw cleaned"
fi

echo "clips kept"
df -h
du -sh data/* 2>/dev/null || true
echo "Done"
