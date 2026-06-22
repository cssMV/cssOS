# cssOS Rust API Ops

这份说明用于日常发布和验活 `cssos-rust-api`。

> 注：原中国机 `gzvm` 已下线,相关脚本/文档已移除。当前只有 `api-vm` 一台。

## 脚本列表

- `smoke-rust-api.sh`
  - 单独做接口验活
  - 检查：
    - `/api/health`
    - `/cssapi/v1/engines`
    - `/cssapi/v1/pricing`
    - `/cssapi/v1/schema/mv`

- `deploy-and-smoke.sh`
  - 完整发布脚本
  - 同步代码 -> 编译 -> 重启服务 -> smoke
  - 支持 `TARGET=api-vm`(默认)

- `deploy-fast.sh`
  - 日常快速发布
  - 适合小改动高频迭代
  - 单机执行

- `install-slim-release-deploy.sh`
  - 给 `api-vm` 安装瘦身版 `deploy-release.sh`
  - 避免每个 release 继续复制 `rust-api / registry / remote-rust-api`
  - 默认把 release 保留数量压到 `3`

- `archive-shared-media-to-gcs.sh`
  - 把 `/srv/cssos/shared` 下的大体量共享内容镜像到 GCS
  - 默认覆盖：
    - `runs`
    - `assets/examples`

- `prune-test-runs-before-date.sh`
  - 按日期批量删除历史测试 run
  - 默认保留：
    - `RUNNING`
    - `INIT`
  - 适合执行"删掉今天以前的测试产物"

- `tail-api-logs.sh`
  - 查看 `cssos-rust-api` 的 systemd 日志
  - 支持最近 N 行和持续追踪

- `api-status.sh`
  - 一屏看状态
  - 输出：
    - service 状态
    - 监听端口
    - smoke 摘要

## 常用命令

### 1. 完整发布

```bash
cd /Users/jing/cssOS
./scripts/deploy-and-smoke.sh
```

### 2. 快速发布

```bash
TARGET=api-vm ./scripts/deploy-fast.sh
```

### 3. 单独 smoke

本机默认：

```bash
./scripts/smoke-rust-api.sh
```

公网：

```bash
BASE_URL=https://cssstudio.app ./scripts/smoke-rust-api.sh
```

### 4. 查看日志

最近 120 行：

```bash
./scripts/tail-api-logs.sh
```

最近 200 行：

```bash
TARGET=api-vm LINES=200 ./scripts/tail-api-logs.sh
```

### 5. 查看整体状态

```bash
./scripts/api-status.sh
```

## 推荐工作流

### 日常小改动

1. 本地改代码
2. `TARGET=api-vm ./scripts/deploy-fast.sh`
3. `TARGET=api-vm ./scripts/api-status.sh`

### 正式发布

1. `./scripts/deploy-and-smoke.sh`
2. `./scripts/api-status.sh`
3. 如需排查，再用 `./scripts/tail-api-logs.sh`

## 服务器约定

### api-vm

- Rust API 工作目录：
  - `/srv/cssos/repo/rust-api`
- 可执行文件：
  - `/usr/local/bin/cssos-rust-api`
- smoke：
  - `/usr/local/bin/cssos-rust-smoke`

## 备注

- 这些脚本当前只覆盖 Rust API 发布链路
- Node/前端服务没有包含进来
- 如果后面要把前端也并进统一发布，可以在此基础上继续扩展
