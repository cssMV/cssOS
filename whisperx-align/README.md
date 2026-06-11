# cssOS whisperX 强制对齐服务(情绪字幕 B·根治)

演出级逐字对齐:对**真实渲染音频**做 forced-alignment,产出每字真实 onset/offset(长音=长窗口),
喂给情绪字幕管线。**去 OpenAI 依赖、零按调用成本、无配额墙。** 与 `audio-analysis/`(librosa 富集)同构。

## 契约(Node 后端 `alignViaWhisperXService` 对接)
```
POST /align
  { "audio_url": "...", "language": "zh", "ref_text": "<已知歌词, 可选>" }
→ { "words": [ {"word":"晨","start":3.30,"end":3.56}, ... ], "mode": "ref_forced|asr", "language": "zh" }
GET /health → {"ok": true}
```
- **ref_text 提供(推荐)**= 强制对齐到已知歌词:不靠 ASR 猜唱了什么,直接拿真歌词定位每字 →
  歌声里 ASR 常听错字,强制对齐不受影响 → **比 OpenAI 更稳**(OpenAI 接口吃不了参考文本)。
- ref_text 缺省 = ASR 转写 + 对齐(faster-whisper → wav2vec2)。

## 部署(一次性)
```bash
# 在服务器上:
sudo mkdir -p /srv/cssos/whisperx-align && sudo chown jing:jing /srv/cssos/whisperx-align
rsync -a whisperx-align/ api-vm:/srv/cssos/whisperx-align/     # 从本仓库
ssh api-vm 'bash /srv/cssos/whisperx-align/install.sh'         # 建 venv + 装 whisperX/torch + 起 systemd
# 首次会下载 whisper 模型 + 各语言 wav2vec2 对齐模型(数百 MB,缓存到 .hf-cache)
```
然后接进 Node 后端:
```bash
echo 'WHISPERX_ALIGN_URL=http://127.0.0.1:7892' | sudo tee -a /etc/cssos.env
sudo systemctl restart cssOS
# 回填 Jerusalem(以及任何作品):
curl -X POST 127.0.0.1:3000/api/admin/resubtitle/<workId> -H "x-admin-token: $CSSOS_ADMIN_TOKEN"
```

## 配置(systemd Environment / env)
| 变量 | 默认 | 说明 |
|---|---|---|
| `WHISPERX_PORT` | 7892 | 监听端口(仅本机) |
| `WHISPERX_MODEL` | medium | tiny/base/small/medium/large-v3(越大越准越慢) |
| `WHISPERX_DEVICE` | cpu | 有 GPU 设 `cuda`(秒级);CPU 可用但慢(分钟级) |
| `WHISPERX_COMPUTE` | int8 | CPU=int8;GPU=float16 |
| `HF_HOME` | .hf-cache | 模型缓存目录(下载一次) |

## 质量 / 性能
- 字级时间通常**比 OpenAI 更紧**(wav2vec2 音素级,~20–50ms)。中文歌声对齐需用 zh 对齐模型,
  建议先拿 Jerusalem 实测一版再定 model 大小。
- CPU medium ≈ 一首 3–4 分钟歌 几十秒~1 分钟;GPU 秒级。MemoryMax 默认 5G(large-v3 需调高)。

## 故障排查
```bash
sudo systemctl status cssos-whisperx-align
sudo journalctl -u cssos-whisperx-align -n 80
curl -s 127.0.0.1:7892/health
```
服务挂了不影响主站:Node 端 `alignViaWhisperXService` 静默回退 OpenAI(若有额度),再不行回退占位 + 前端 A 拉伸。
