#!/usr/bin/env bash
set -u
K=$(grep "^GROQ_API_KEY=" /etc/cssos.env | cut -d= -f2-)
PS="env PGPASSWORD=Au#20016 psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F@|@"
for suf in 5285b72d048a.a1.m4a jerusalem_en_hillsong.mp3; do
  U=$(env PGPASSWORD=Au#20016 psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -c \
      "SELECT preview_audio_url FROM user_works WHERE preview_audio_url LIKE '%$suf' AND status IN ('ready','published') LIMIT 1")
  [ -z "$U" ] && continue
  curl -sL -o /tmp/aud.bin "$U"
  curl -s -m 900 -o "/tmp/asr_$suf.txt" -w "" https://api.groq.com/openai/v1/audio/transcriptions \
    -H "Authorization: Bearer $K" -F "model=whisper-large-v3-turbo" -F "response_format=text" \
    -F "file=@/tmp/aud.bin;type=audio/mp4;filename=a.m4a"
  echo "OK $suf"
done
