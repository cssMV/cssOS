#!/usr/bin/env bash
export PATH=/home/jing/.cargo/bin:$PATH
export LIBTORCH_USE_PYTORCH=1
cd /srv/cssos/repo/rust-api
cargo build --release 2>&1
echo EXIT=$?
