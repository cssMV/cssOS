#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""心跳 —— 全片母题, 只许出现三次, 三次必须【完全一致】。

第 1 次: b_open §1 冷开场, 黑屏上先响起
第 2 次: b_converge §6, 71 分钟那一刻
第 3 次: coda, 最后四秒

因为「三次必须完全一致」, 它和最后四秒、暗淡蓝点是同一类东西:
不可以是生成的(圣经铁律 7.6)。这里确定性合成 —— 同一份脚本, 同一个哈希。

剧本对它的全部描述只有一句:
    「慢, 不急, 比静息稍快一点。」

所以: 78 bpm(静息 60–100 的偏上, 但不到紧张), S1「lub」低而长,
S2「dub」略高而短, 中间收缩期约 0.30 s。加一层极轻的低频房间声,
因为这是 1977 年一次接触式录音, 不是合成器音色。

用法:
    python3 INVARIANT-heartbeat.py out.wav 4.0
"""
import math
import struct
import sys
import wave

SR = 48000
BPM = 78.0                 # 「比静息稍快一点」
SYSTOLE = 0.30             # S1 → S2 的间隔
PEAK = 0.72                # 峰值电平, 留头room


def thump(t, f0, dur, amp, bend=0.55):
    """一次心音。低频正弦, 指数衰减, 频率在衰减中略微下滑
    —— 真实心音是瓣膜与血流的钝响, 不是纯音。"""
    if t < 0 or t >= dur:
        return 0.0
    e = math.exp(-t / (dur * 0.28))                 # 快起慢落
    f = f0 * (1.0 - bend * (t / dur))               # 略微下滑
    body = math.sin(2 * math.pi * f * t)
    # 二次谐波给一点「肉感」, 相位反转让它不至于变亮
    body += 0.30 * math.sin(2 * math.pi * f * 2 * t + math.pi)
    return amp * e * body


def render(seconds):
    n = int(SR * seconds)
    beat = 60.0 / BPM
    buf = [0.0] * n
    # 房间底噪 —— 极轻的低频起伏, 让它像录下来的而不是算出来的
    rumble_ph = 0.0
    for i in range(n):
        t = i / SR
        # 心音
        tb = t % beat
        v = thump(tb, 44.0, 0.20, 1.00)                       # S1  lub
        v += thump(tb - SYSTOLE, 58.0, 0.13, 0.62)            # S2  dub
        # 底噪
        rumble_ph += 2 * math.pi * (7.3 + 2.1 * math.sin(t * 0.37)) / SR
        v += 0.012 * math.sin(rumble_ph)
        buf[i] = v
    # 归一
    m = max(abs(x) for x in buf) or 1.0
    return [x / m * PEAK for x in buf]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "heartbeat.wav"
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
    samples = render(secs)
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(
            struct.pack("<h", max(-32768, min(32767, int(s * 32767)))) for s in samples))
    print("  %s  %.3f s · %d Hz · mono" % (out, secs, SR))


if __name__ == "__main__":
    main()
