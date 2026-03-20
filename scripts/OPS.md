# cssOS Rust API Ops

这份说明用于日常发布和验活 `cssos-rust-api`。

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
  - 支持：
    - `TARGET=api-vm`
    - `TARGET=gzvm`
    - `TARGET=all`

- `deploy-fast.sh`
  - 日常快速发布
  - 适合小改动高频迭代
  - 单机执行

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

发布两台：

```bash
cd /Users/jing/cssOS
./scripts/deploy-and-smoke.sh
```

只发美国：

```bash
TARGET=api-vm ./scripts/deploy-and-smoke.sh
```

只发中国：

```bash
TARGET=gzvm ./scripts/deploy-and-smoke.sh
```

### 2. 快速发布

美国：

```bash
TARGET=api-vm ./scripts/deploy-fast.sh
```

中国：

```bash
TARGET=gzvm ./scripts/deploy-fast.sh
```

### 3. 单独 smoke

本机默认：

```bash
./scripts/smoke-rust-api.sh
```

美国公网：

```bash
BASE_URL=https://cssstudio.app ./scripts/smoke-rust-api.sh
```

中国机域名入口：

```bash
SKIP_HEALTH=1 \
RESOLVE_HOST=zh.cssstudio.app:443:127.0.0.1 \
BASE_URL=https://zh.cssstudio.app \
CURL_OPTS="-kfsS" \
./scripts/smoke-rust-api.sh
```

说明：

- `gzvm` 这里使用 `--resolve` 命中本机 nginx
- 这样可以绕过外层 CDN/解析波动，适合发布后快速验活

### 4. 查看日志

两台最近 120 行：

```bash
./scripts/tail-api-logs.sh
```

美国最近 200 行：

```bash
TARGET=api-vm LINES=200 ./scripts/tail-api-logs.sh
```

中国持续追踪：

```bash
TARGET=gzvm FOLLOW=1 ./scripts/tail-api-logs.sh
```

### 5. 查看整体状态

两台：

```bash
./scripts/api-status.sh
```

美国：

```bash
TARGET=api-vm ./scripts/api-status.sh
```

中国：

```bash
TARGET=gzvm ./scripts/api-status.sh
```

### 6. 复测中国入口

本机 + 美国机 + 中国机一起复测：

```bash
./scripts/zh-probe-matrix.sh
```

只做公网探测：

```bash
PUBLIC_ONLY=1 ATTEMPTS=5 ./scripts/zh-probe-matrix.sh
```

说明：

- `local_public` 代表当前机器到 `https://zh.cssstudio.app`
- `api_vm_public` 代表美国机视角
- `gzvm_public` 代表中国机走公网域名视角
- `gzvm_loopback` 代表中国机本机命中 `127.0.0.1:443`

重点看 3 个值：

- `TLS`：握手成功率
- `HTTP`：真正拿到 HTTP 响应的成功率
- `Resets`：连接被重置的比例

### 7. 定时公网监控

仓库已新增 GitHub Actions：

- `.github/workflows/zh-probe.yml`

它会：

- 每 30 分钟从 GitHub runner 做一次公网探测
- 把结果写进 Actions summary
- 上传 `zh-probe-report.txt` artifact
- 当 `TLS` 或 `HTTP` 成功率低于 80% 时让任务失败，便于快速发现异常

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

### gzvm

- Rust API 工作目录：
  - `/home/ubuntu/cssOS/rust-api`
- 可执行文件：
  - `/usr/local/bin/cssos-rust-api`
- smoke：
  - `/usr/local/bin/cssos-rust-smoke`

## 备注

- 这些脚本当前只覆盖 Rust API 发布链路
- Node/前端服务没有包含进来
- 如果后面要把前端也并进统一发布，可以在此基础上继续扩展
