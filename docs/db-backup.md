# 数据库备份 (W2119 · 2026-09-20)

## 现状:两层,各补各的洞

| | 谁做的 | 保留 | 存在哪 | 能干什么 |
|---|---|---|---|---|
| **第一层** | Google Cloud SQL 自动备份 | **7 天** | 与实例同项目 | 7 天内**时点恢复**(最精细) |
| **第二层** | 本波新增的逻辑 dump | **永久**(不删) | **Cloudflare R2**(换一家) | 任何地方还原、`pg_restore -t` 单捞一张表 |

**第二层不是替代第一层, 是补它的三个洞:**

1. **只保 7 天, 而我们的「发现延迟」比这长。** W2061 那 17 首旧版音乐是【两周多之后】
   才被 Jing 逐首发现的 —— 等发现的时候, Cloud SQL 那一周的备份早就滚没了。**这是首要理由。**
2. **跟实例同生共死。** 删实例即删备份; 项目或账号出事, 备份一起没。
3. **只能还原成 Cloud SQL 实例。** 不能 grep, 不能单独捞一张表回来看。

## 装在哪

```
/usr/local/bin/db-backup-to-r2.sh      每天 04:30 UTC   (cssos-db-backup.timer)
/usr/local/bin/db-restore-test.sh      每周日 05:30 UTC (cssos-db-restore-test.timer)
/etc/cssos-db-backup.env               只含 PGPASSWORD, 0600 root:root —— 【不进仓库】
r2:cssos-artifacts/backups/db/<年>/<月>/cssstudio-<UTC时间戳>-<sha12>.pgc
r2:cssos-artifacts/backups/db/LAST_OK.json    心跳, 用来发现「备份悄悄停了」
```

仓库里的两份脚本(`scripts/db-backup-to-r2.sh` / `scripts/db-restore-test.sh`)是真源, 改完 scp 上去。

## 实测数字 (2026-09-20 首跑)

```
库大小 379 MB  →  dump 47 MB (-Fc --compress=9)
dump 8 秒 · 上传 3 秒 · 完整还原 17 秒
```

每天一份 ≈ 每年 **17 GB** ≈ R2 存储费 **$0.26/月**(一年的量)。

## 没还原过的备份不算备份

`db-restore-test.sh` 每周把 R2 上最新那份**完整还原**进一个临时库, 再逐表比对行数:

```
表                           生产库    还原库   判定
user_works                     2358      2358      ✅
work_language_tracks           1333      1333      ✅
work_media_versions            5865      5865      ✅
work_assets                   19461     19461      ✅
work_market_profiles           2335      2335      ✅
users                            32        32      ✅
```

**判据是「还原库 ≈ 生产库, 差距 < 1%」而不是严格相等** —— 生产库一直在写,
严格相等在活库上必然误报, 那种校验器是自欺欺人。

临时库叫 `cssstudio_restoretest_<时间戳>`, 跑完自己删掉(那是脚本造的, 不是任何人的数据)。

## 四条踩过的坑 —— 每一条都能做出「以为有备份」

1. **`pg_dump` 版本必须 ≥ 服务端。** 机器上原装的是 14.24, 服务端是 15.18,
   pg_dump 直接 `aborting because of server version mismatch`。已从 PGDG 装 `postgresql-client-15`,
   脚本里写死 `PGBIN=/usr/lib/postgresql/15/bin` ——**不要用裸 `pg_dump`**, 那会拿到 14。
2. **`set -o pipefail` + `grep -q` 会把成功判成失败。** `grep -q` 一匹配到就退出关管道 →
   上游 `pg_restore` 收 SIGPIPE 非零 → pipefail 判整条管道失败。
   **清单只取一次落盘, 之后对文件 grep。**
3. **root 没有 rclone 配置。** R2 凭据在 `/home/jing/.config/rclone/rclone.conf`,
   定时任务以 root 跑, 必须 `export RCLONE_CONFIG=` 指过去, 否则 `didn't find section (r2)`。
4. **`rclone ... | tail` 会把退出码藏起来。** 上传失败被当成成功继续往下走, 又是一个「以为有备份」。
   **上传不许接管道**, 失败直接 `fail`。

## 保留策略:没有。一个都不删。

一年的备份才 $0.26/月, 便宜到不值得为省钱冒删错的险。
**真要加保留期, 先问 Jing —— 删备份也是删。**

## 还没做的

- **告警**: 现在只有 `LAST_OK.json` 这个心跳, 没有人去看它。
  「备份停了两周没人知道」正是 W2061 的教训之一, 这条还欠着。
- `/home/jing/.config/rclone/rclone.conf` 是 **664**(同组可读), 里面是 R2 凭据。
  收紧到 600 大概没问题, 但可能有别的进程以别的用户读它, **没敢动, 先记在这里**。
