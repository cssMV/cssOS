#!/usr/bin/env bash
# CSSOS_WAVE_1774 — 录一天的广告花费。X/Meta 都没有免费 API, 只能手工抄一次。
# 同一 (平台, campaign, 日期) 重复录入会 UPDATE 覆盖, 不会产生重复行。
#
# 用法:
#   ./ad_spend_add.sh <平台> <campaign> <日期> <花费美元> <展示> <点击> [来源标签]
# 例:
#   ./ad_spend_add.sh x "CSSOS Wave2 Daji Video" 2026-07-26 15.00 12043 87 x
#   ./ad_spend_add.sh meta "CSSOS Wave1 Traffic" 2026-07-26 15.00 8210 44 meta
set -euo pipefail

if [ $# -lt 6 ]; then
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

PLATFORM="$1"; CAMPAIGN="$2"; DAY="$3"; USD="$4"; IMPR="$5"; CLICKS="$6"; TAG="${7:-$1}"

# 美元 → 整数分。绝不用浮点存钱(与钱包口径一致)。
CENTS=$(python3 -c "print(int(round(float('$USD')*100)))")

URL=$(grep -o 'DATABASE_URL=[^ ]*' /etc/cssos.env | head -1 | cut -d= -f2-)

psql "$URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO ad_spend (platform, campaign, source_tag, day, spend_cents, impressions, clicks)
VALUES ('$PLATFORM', \$c\$$CAMPAIGN\$c\$, '$TAG', '$DAY', $CENTS, $IMPR, $CLICKS)
ON CONFLICT (platform, campaign, day) DO UPDATE SET
  spend_cents = EXCLUDED.spend_cents,
  impressions = EXCLUDED.impressions,
  clicks      = EXCLUDED.clicks,
  source_tag  = EXCLUDED.source_tag,
  updated_at  = now();"

echo "已录: $PLATFORM / $CAMPAIGN / $DAY → \$$USD, ${IMPR} 展示, ${CLICKS} 点击"
