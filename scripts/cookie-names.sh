#!/bin/bash
# Print exact cookie NAMES present in SUNO_COOKIE (no values, no leakage).
COOKIE=$(sudo grep "^SUNO_COOKIE=" /etc/cssos/suno-api.env | cut -d= -f2-)
echo "raw cookie len: ${#COOKIE}"
echo "--- exact cookie names found (one per line) ---"
echo "$COOKIE" | tr ';' '\n' | sed -E 's/^[[:space:]]*//; s/=.*//' | sort -u
echo "--- check for bare __client (without _uat suffix) ---"
echo "$COOKIE" | tr ';' '\n' | grep -qE '^[[:space:]]*__client=' && echo "BARE __client= FOUND" || echo "BARE __client= NOT FOUND"
