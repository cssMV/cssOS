#!/usr/bin/env python3
"""CSSOS_WAVE_1774 — 广告周报: 来源 / 访客 / 注册 / 付费 一页纸。

回答的是那个唯一重要的问题: 广告带来的人, 到底留下了没有。
(2026-07 首波的教训: X 花了 $60、90,344 次展示、162 次点击, 但 7 天内新增用户 = 0。
 光看平台后台的 CTR/CPC 永远发现不了这件事 —— 必须把「落地」和「注册」对上。)

用法(在 api-vm 上):
    python3 /srv/cssos/repo/scripts/ad_report.py          # 最近 7 天
    python3 /srv/cssos/repo/scripts/ad_report.py 30       # 最近 30 天
"""
import subprocess
import sys


def db_url() -> str:
    with open("/etc/cssos.env") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    sys.exit("DATABASE_URL not found in /etc/cssos.env")


def q(url: str, sql: str) -> str:
    r = subprocess.run(["psql", url, "-tAF|", "-c", sql], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"查询失败: {r.stderr.strip()}")
    return r.stdout.strip()


def main() -> None:
    days = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 7
    url = db_url()
    w = f"now() - interval '{days} days'"

    print(f"\n{'='*66}")
    print(f"  CSS Studio 广告周报 · 最近 {days} 天")
    print(f"{'='*66}")

    # ── 花费(手工录入) ────────────────────────────────────────────
    spend = q(url, f"""
      SELECT platform || '|' || sum(spend_cents) || '|' || sum(impressions) || '|' || sum(clicks)
      FROM ad_spend WHERE day >= ({w})::date GROUP BY platform ORDER BY 1;""")
    print("\n【花费】(手工录入 ad_spend; 平台无免费 API)")
    if spend:
        tot_c = tot_i = tot_k = 0
        print(f"  {'平台':<10}{'花费':>10}{'展示':>12}{'点击':>10}{'CPC':>9}{'CTR':>8}")
        for line in spend.splitlines():
            p, c, i, k = line.split("|")
            c, i, k = int(c), int(i), int(k)
            tot_c += c; tot_i += i; tot_k += k
            cpc = f"${c/100/k:.2f}" if k else "—"
            ctr = f"{k/i*100:.2f}%" if i else "—"
            print(f"  {p:<10}{'$'+format(c/100,'.2f'):>10}{i:>12,}{k:>10,}{cpc:>9}{ctr:>8}")
        if tot_k:
            print(f"  {'合计':<10}{'$'+format(tot_c/100,'.2f'):>10}{tot_i:>12,}{tot_k:>10,}"
                  f"{'$'+format(tot_c/100/tot_k,'.2f'):>9}"
                  f"{format(tot_k/tot_i*100,'.2f')+'%' if tot_i else '—':>8}")
    else:
        print("  (无记录 —— 用 ad_spend_add.sh 录入)")

    # ── 落地流量(按来源) ──────────────────────────────────────────
    land = q(url, f"""
      SELECT source || '|' || count(*) || '|' || count(DISTINCT ip_hash)
      FROM ad_landings
      WHERE landed_at >= {w} AND NOT is_bot
      GROUP BY source ORDER BY count(DISTINCT ip_hash) DESC, 1 LIMIT 25;""")
    print("\n【落地流量】(按 ?cssADS= 来源; 已剔除爬虫)")
    if land:
        print(f"  {'来源':<24}{'落地次数':>10}{'独立访客':>10}")
        for line in land.splitlines():
            s, n, u = line.split("|")
            print(f"  {s:<24}{int(n):>10,}{int(u):>10,}")
    else:
        print("  (无记录 —— 检查 ad_ingest.py 是否在跑, 以及外链是否都带了 ?cssADS=)")

    bots = q(url, f"SELECT count(*) FROM ad_landings WHERE landed_at >= {w} AND is_bot;")
    if bots and int(bots) > 0:
        print(f"  (另有 {int(bots):,} 次被判定为爬虫, 未计入)")

    # ── 转化: 这才是关键 ─────────────────────────────────────────
    users = q(url, f"SELECT count(*) FROM users WHERE created_at >= {w};")
    paid = q(url, f"""
      SELECT count(*) FROM user_credits
      WHERE balance > 0 AND updated_at >= {w};""") or "0"
    uniq = q(url, f"""
      SELECT count(DISTINCT ip_hash) FROM ad_landings
      WHERE landed_at >= {w} AND NOT is_bot;""") or "0"

    print("\n【转化】")
    print(f"  广告独立访客        {int(uniq):>8,}")
    print(f"  新注册用户          {int(users):>8,}")
    print(f"  钱包有余额的用户    {int(paid):>8,}")
    if int(uniq) and int(users) == 0:
        print("\n  ⚠️  有访客但零注册 —— 问题不在广告素材, 在落地之后的转化环节。")
        print("     加预算只会买到更多「来了又走」。先解决「看完为什么要注册」。")
    elif int(uniq):
        print(f"  访客→注册转化率     {int(users)/int(uniq)*100:>7.2f}%")

    print(f"\n{'='*66}\n")


if __name__ == "__main__":
    main()
