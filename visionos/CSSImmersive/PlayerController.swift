// CSSOS_WAVE_937 — 多银幕环绕 + 转头切换 控制器。
//   · 每个变体(主/Take2/语言版)一块环绕银幕, 各自一个 AVPlayer。
//   · 同时只有【激活屏】出声(画音分层: 优先它的独立音轨); 其余静音预览。
//   · ARKit 头部追踪: 用户转头朝哪块, 哪块自动成为激活屏(声音/字幕切过去)。
//   · 也支持看着某屏捏合(SpatialTap)手动切。
//
// 画音分层铁律: 画面走 video(静音), 真声音走独立 audioURL; 字幕跟【激活屏有声那条】时钟。

import Foundation
import AVFoundation
import Combine
import ARKit
import simd
import MediaToolbox   // W1404 — 原生音量表 MTAudioProcessingTap

@MainActor
final class PlayerController: ObservableObject {
    @Published var work: CSSWork?
    @Published var variants: [CSSVariant] = []
    /// 当前激活(出声 + 字幕)的银幕索引。
    @Published var activeIndex: Int = 0
    /// W1580 — 视频真实宽高比(width/height): 曲面银幕按它算高度 → 任何比例(2.39:1 宽银幕 / 16:9 / 竖屏)都不变形。
    ///   异步从 AVAsset 读, 默认 16:9; 读到后发布 → ImmersiveView 观察到即重建银幕网格。
    @Published var videoAspect: Float = 16.0 / 9.0
    /// 激活屏当前字幕行(-1 无)。
    @Published var currentLineIndex: Int = -1

    /// CSSOS_WAVE_938 — 逐字爆字幕事件流(空间爆字幕订阅它在用户身边炸字)。
    let burstSubject = PassthroughSubject<BurstEvent, Never>()
    /// W1399 — Gap2: 某行结束 → 发该行号, 订阅方把整行字一起淡出。
    let lineFadeSubject = PassthroughSubject<Int, Never>()
    private struct FireToken { let text: String; let start: Double; let emotion: String; let intensity: Double; let lineIndex: Int }
    private var fireTokens: [FireToken] = []
    private var nextFireIdx = 0
    private var lastTickSec: Double = 0
    private var lineSpans: [(idx: Int, end: Double)] = []   // 每行(行号, 结束秒), 按结束排序
    private var nextLineEndIdx = 0

    /// 每块银幕一个画面播放器。
    private var variantVideoURLs: [String?] = []   // W950 — 懒解码用: 切到才装项
    private(set) var videoPlayers: [AVPlayer] = []
    /// 每块银幕的独立音轨(可空)。
    private var audioPlayers: [AVPlayer?] = []

    private var timeObserver: Any?
    private var observedPlayer: AVPlayer?

    /// W1404 — 原生音量表(直通 tap 读 RMS, 不静音)。情绪字幕器乐段 emoji 密度【响应真音量】。
    private let audioLevelTap = AudioLevelTap()
    var currentAudioLevel: Float { audioLevelTap.level }
    private func attachAudioTap() { audioLevelTap.attach(to: activeClock.currentItem) }

    // ── 加载 ────────────────────────────────────────────────────────────────
    func load(_ w: CSSWork) {
        teardown()
        work = w
        variants = w.surroundVariants()

        // W950 — 解码保护: 只有【激活屏】装视频项(真解码), 其余屏不装项(显封面/暗屏), 转到才装。
        variantVideoURLs = variants.map { $0.videoURL }
        for (i, v) in variants.enumerated() {
            let vp = AVPlayer()
            if i == 0, let vs = v.videoURL, let url = URL(string: vs) {
                vp.replaceCurrentItem(with: AVPlayerItem(url: url))   // 仅激活屏(0)解码
            }
            var ap: AVPlayer? = nil
            if let asu = v.audioURL, let aurl = URL(string: asu) {
                vp.isMuted = true
                ap = (i == 0) ? AVPlayer(url: aurl) : nil            // 仅激活屏出声/解音
            }
            videoPlayers.append(vp)
            audioPlayers.append(ap)
        }
        activeIndex = 0
        applyActiveAudio()
        attachAudioTap()   // W1404 — 挂音量表到激活有声那路
        installTimeObserver()
        startHeadTracking()
        detectAspect()     // W1580 — 异步读真实宽高比 → 银幕按真比例, 不再假设 16:9
    }

    /// W1580 — 异步读激活视频的真实宽高比(含 preferredTransform 旋转校正), 发布给银幕用。默认保持 16:9。
    private func detectAspect() {
        guard let item = videoPlayers.first(where: { $0.currentItem != nil })?.currentItem else { return }
        Task { @MainActor in
            guard let track = try? await item.asset.loadTracks(withMediaType: .video).first,
                  let size = try? await track.load(.naturalSize),
                  let tf = try? await track.load(.preferredTransform) else { return }
            let r = size.applying(tf)
            let w = abs(r.width), h = abs(r.height)
            guard w > 1, h > 1 else { return }
            let ratio = Float(w / h)
            if ratio > 0.2, ratio < 6, abs(ratio - videoAspect) > 0.01 { videoAspect = ratio }
        }
    }

    /// W1405 — 情绪字幕能显示的关键: 大厅/市场作品不带 aligned_lyrics(toWork 为 nil), 进影院后异步拉
    ///   subtitle JSON 注入 → 逐字 token 有了, 字幕时钟下一 tick 即开始爆字。
    func applyAlignedLyrics(_ lines: [SubtitleLine]) {
        guard !lines.isEmpty else { return }
        for i in variants.indices { variants[i].alignedLyrics = lines }   // 各变体先共用 orig(多语言以后细分)
        buildFireTokens()   // 重建发射表; timeObserver 已在跑, 下一 tick 生效
    }

    /// CSSOS_WAVE_939 — SharePlay 媒体同步用: 当前激活屏的画面播放器。
    var activeVideoPlayer: AVPlayer? { videoPlayers[safe: activeIndex] }

    func playAll() {
        // W950 — 只播激活屏(其余无项=不解码)。
        videoPlayers[safe: activeIndex]?.play()
        (audioPlayers[safe: activeIndex] ?? nil)?.play()
    }

    func pauseAll() {
        for (i, vp) in videoPlayers.enumerated() {
            vp.pause()
            audioPlayers[i]?.pause()
        }
        stopHeadTracking()
    }

    // ── 激活屏切换(转头 / 点选都走这里)──────────────────────────────────────
    /// CSSOS_WAVE_939 — 切激活屏时通知(SharePlay 用来广播给同殿伙伴; 防回环靠调用方 flag)。
    var onActiveSwitched: ((Int) -> Void)?

    func setActive(_ idx: Int) {
        guard idx >= 0, idx < variants.count, idx != activeIndex else { return }
        // W950 — 解码保护切换: 卸下旧屏视频项(释放解码) → 装上新屏 → seek 到同一时间 → 播。
        let t = activeClock.currentTime()
        let old = activeIndex
        videoPlayers[safe: old]?.pause()
        videoPlayers[safe: old]?.replaceCurrentItem(with: nil)   // 释放旧屏解码缓冲
        (audioPlayers[safe: old] ?? nil)?.pause()

        activeIndex = idx
        if videoPlayers[safe: idx]?.currentItem == nil,
           let vs = variantVideoURLs[safe: idx] ?? nil, let url = URL(string: vs) {
            videoPlayers[safe: idx]?.replaceCurrentItem(with: AVPlayerItem(url: url))
        }
        // 懒建激活屏音轨(若该变体有独立音轨且尚未建)。
        if (audioPlayers[safe: idx] ?? nil) == nil,
           let asu = variants[safe: idx]?.audioURL, let aurl = URL(string: asu) {
            audioPlayers[idx] = AVPlayer(url: aurl)
        }
        applyActiveAudio()
        videoPlayers[safe: idx]?.seek(to: t); videoPlayers[safe: idx]?.play()
        (audioPlayers[safe: idx] ?? nil)?.seek(to: t)
        (audioPlayers[safe: idx] ?? nil)?.play()
        attachAudioTap()        // W1404 — 音量表改跟新激活屏的有声那条
        installTimeObserver()   // 字幕时钟改跟新激活屏
        onActiveSwitched?(idx)
    }

    /// 激活屏出声(优先独立音轨), 其余全静音。
    private func applyActiveAudio() {
        for (i, vp) in videoPlayers.enumerated() {
            let isActive = (i == activeIndex)
            if let ap = audioPlayers[i] {
                ap.isMuted = !isActive
                vp.isMuted = true            // 有独立音轨 → 画面永远静音
            } else {
                vp.isMuted = !isActive       // 无独立音轨 → 画面自带声, 仅激活屏出
            }
        }
    }

    // ── 字幕时钟(跟激活屏的有声那条)─────────────────────────────────────────
    private var activeClock: AVPlayer {
        audioPlayers[safe: activeIndex].flatMap { $0 } ?? videoPlayers[safe: activeIndex] ?? AVPlayer()
    }

    private func installTimeObserver() {
        if let ob = timeObserver, let p = observedPlayer { p.removeTimeObserver(ob) }
        timeObserver = nil; observedPlayer = nil
        let clock = activeClock
        let interval = CMTime(seconds: 0.1, preferredTimescale: 600)
        observedPlayer = clock
        buildFireTokens()
        timeObserver = clock.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] t in
            guard let self else { return }
            self.updateCurrentLine(at: t.seconds)
            self.fireBursts(at: t.seconds)
        }
    }

    /// 把激活屏的逐字 token 摊平成带绝对时间的发射表(有 tokens 用 tokens, 否则按行发整行)。
    private func buildFireTokens() {
        fireTokens.removeAll(); nextFireIdx = 0; lastTickSec = 0
        lineSpans.removeAll(); nextLineEndIdx = 0
        let lines = variants[safe: activeIndex]?.alignedLyrics ?? []
        for (li, line) in lines.enumerated() {
            var lineMaxEnd = line.endSeconds
            if let toks = line.tokens, !toks.isEmpty {
                for tk in toks {
                    let txt = tk.resolvedText.trimmingCharacters(in: .whitespaces)
                    guard !txt.isEmpty else { continue }
                    fireTokens.append(FireToken(text: txt, start: tk.startSeconds,
                                                emotion: tk.emotion ?? "",
                                                intensity: tk.emotionIntensity ?? 0.6, lineIndex: li))
                    lineMaxEnd = max(lineMaxEnd, tk.endSeconds)
                }
            } else {
                let txt = line.resolvedText.trimmingCharacters(in: .whitespaces)
                if !txt.isEmpty {
                    fireTokens.append(FireToken(text: txt, start: line.startSeconds, emotion: "", intensity: 0.7, lineIndex: li))
                }
            }
            // 行尾淡出时刻: 行/末字结束后留 0.5s 余韵再整句淡出。
            if lineMaxEnd > 0 { lineSpans.append((idx: li, end: lineMaxEnd + 0.5)) }
        }
        fireTokens.sort { $0.start < $1.start }
        lineSpans.sort { $0.end < $1.end }
        NSLog("[CSSDIAG] buildFireTokens lines=\(lines.count) tokens=\(fireTokens.count) active=\(activeIndex) variants=\(variants.count) work=\(work?.id.prefix(8) ?? "nil")")
    }

    /// 时间推进到某字 start 就发一次爆字; 回退(seek)则重定位发射指针。
    private func fireBursts(at sec: Double) {
        if sec + 0.05 < lastTickSec {   // 明显回退 → 重定位两个指针
            nextFireIdx = fireTokens.firstIndex(where: { $0.start >= sec }) ?? fireTokens.count
            nextLineEndIdx = lineSpans.firstIndex(where: { $0.end >= sec }) ?? lineSpans.count
        }
        lastTickSec = sec
        while nextFireIdx < fireTokens.count, sec >= fireTokens[nextFireIdx].start {
            let f = fireTokens[nextFireIdx]
            burstSubject.send(BurstEvent(text: f.text, emotion: f.emotion, intensity: f.intensity, lineIndex: f.lineIndex))
            nextFireIdx += 1
        }
        // W1399 — Gap2: 时间越过某行结束 → 通知订阅方把整行字一起淡出。
        while nextLineEndIdx < lineSpans.count, sec >= lineSpans[nextLineEndIdx].end {
            lineFadeSubject.send(lineSpans[nextLineEndIdx].idx)
            nextLineEndIdx += 1
        }
    }

    private func updateCurrentLine(at sec: Double) {
        let lines = variants[safe: activeIndex]?.alignedLyrics ?? []
        var idx = -1
        for (i, line) in lines.enumerated() where sec >= line.startSeconds && sec <= line.endSeconds {
            idx = i; break
        }
        if idx != currentLineIndex { currentLineIndex = idx }
    }

    var currentLineText: String {
        let lines = variants[safe: activeIndex]?.alignedLyrics ?? []
        guard currentLineIndex >= 0, currentLineIndex < lines.count else { return "" }
        return lines[currentLineIndex].resolvedText
    }

    // ── ARKit 头部追踪: 转头自动切激活屏 ─────────────────────────────────────
    private let arSession = ARKitSession()
    private let worldTracking = WorldTrackingProvider()
    private var headTask: Task<Void, Never>?

    /// CSSOS_WAVE_944 — 头显(=用户)实时位置/朝向, 给"情绪字幕炸在你身边/身上"用(恐龙演示式贴脸)。
    @MainActor var headPos = SIMD3<Float>(0, 1.5, 0)
    @MainActor var headFwd = SIMD3<Float>(0, 0, -1)

    private func startHeadTracking() {
        stopHeadTracking()
        headTask = Task { [weak self] in
            guard let self else { return }
            do { try await self.arSession.run([self.worldTracking]) }
            catch { return }   // 没权限/不支持 → 退化为只用点选切换
            while !Task.isCancelled {
                if let anchor = self.worldTracking.queryDeviceAnchor(atTimestamp: CACurrentMediaTime()) {
                    let m = anchor.originFromAnchorTransform
                    // 头部前方向 = -Z 列。水平偏航角 yaw(度): 0=正前, 负=左, 正=右。
                    let fwd = SIMD3<Float>(-m.columns.2.x, -m.columns.2.y, -m.columns.2.z)
                    let yawDeg = atan2(fwd.x, -fwd.z) * 180 / .pi
                    let pos = SIMD3<Float>(m.columns.3.x, m.columns.3.y, m.columns.3.z)
                    // W955 — Jing「转头换屏太灵敏, 体验不好」: 取消转头自动切屏, 只更新头位
                    //   (身边爆字用)。切屏改为只靠注视+捏合手动(SpatialTapGesture)。
                    _ = yawDeg
                    await MainActor.run { self.headPos = pos; self.headFwd = fwd }
                }
                try? await Task.sleep(nanoseconds: 200_000_000) // 0.2s
            }
        }
    }

    private func stopHeadTracking() {
        headTask?.cancel(); headTask = nil
    }

    /// 偏航角最接近哪块银幕角度, 就激活哪块(留 ~18° 死区防抖动)。
    private func pickScreenByYaw(_ yawDeg: Float) {
        guard variants.count > 1 else { return }
        var best = activeIndex
        var bestDiff = Float.greatestFiniteMagnitude
        for (i, v) in variants.enumerated() {
            let d = abs(angleDelta(yawDeg, v.angleDegrees))
            if d < bestDiff { bestDiff = d; best = i }
        }
        // 只有明显朝向另一块(差值比当前小且当前已偏离)才切, 减少误切。
        if best != activeIndex {
            let curDiff = abs(angleDelta(yawDeg, variants[activeIndex].angleDegrees))
            if curDiff > 32 && bestDiff < curDiff - 10 {
                setActive(best)
            }
        }
    }

    private func angleDelta(_ a: Float, _ b: Float) -> Float {
        var d = (a - b).truncatingRemainder(dividingBy: 360)
        if d > 180 { d -= 360 }; if d < -180 { d += 360 }
        return d
    }

    // ── 清理 ────────────────────────────────────────────────────────────────
    private func teardown() {
        if let ob = timeObserver, let p = observedPlayer { p.removeTimeObserver(ob) }
        timeObserver = nil; observedPlayer = nil
        for (i, vp) in videoPlayers.enumerated() { vp.pause(); audioPlayers[safe: i]??.pause() }
        videoPlayers.removeAll(); audioPlayers.removeAll()
        stopHeadTracking()
    }
}

// 安全下标。
extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}

// W1404 — 原生音量表: 给激活音轨挂 MTAudioProcessingTap【直通】(读 RMS, 声音照常播, 不静音 ——
//   原生 AVFoundation tap 与网页端 createMediaElementSource 静音劫持是两回事, 不犯铁律)。
//   音频线程算 RMS → 平滑成 0..1 电平; 主线程读 level 驱动器乐段 emoji 密度【响应真音量】。
final class AudioLevelTap {
    var level: Float = 0                 // 音频线程写 / 主线程读: 仅驱动视觉, 容许良性竞争
    private var attachedItem: AVPlayerItem?

    func attach(to item: AVPlayerItem?) {
        guard let item, item !== attachedItem else { return }
        attachedItem = item
        Task { [weak self] in
            guard let self else { return }
            guard let track = try? await item.asset.loadTracks(withMediaType: .audio).first else { return }
            await MainActor.run {
                guard item === self.attachedItem else { return }   // 期间又换屏 → 放弃
                self.install(on: item, track: track)
            }
        }
    }

    private func install(on item: AVPlayerItem, track: AVAssetTrack) {
        let unmanaged = Unmanaged.passRetained(self)
        var callbacks = MTAudioProcessingTapCallbacks(
            version: kMTAudioProcessingTapCallbacksVersion_0,
            clientInfo: UnsafeMutableRawPointer(unmanaged.toOpaque()),
            init: tapInit, finalize: tapFinalize, prepare: nil, unprepare: nil, process: tapProcess)
        var tap: MTAudioProcessingTap?
        let err = MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks,
                                             kMTAudioProcessingTapCreationFlag_PostEffects, &tap)
        guard err == noErr, let tap else { unmanaged.release(); return }
        let params = AVMutableAudioMixInputParameters(track: track)
        params.audioTapProcessor = tap
        let mix = AVMutableAudioMix()
        mix.inputParameters = [params]
        item.audioMix = mix
    }

    fileprivate func push(rms: Float) {
        let norm = min(1, rms * 6)            // 增益: 乐曲 RMS 多在 0.02~0.25
        level = level * 0.82 + norm * 0.18    // 平滑
    }
}

private let tapInit: MTAudioProcessingTapInitCallback = { _, clientInfo, storageOut in
    storageOut.pointee = clientInfo
}
private let tapFinalize: MTAudioProcessingTapFinalizeCallback = { tap in
    Unmanaged<AudioLevelTap>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).release()
}
private let tapProcess: MTAudioProcessingTapProcessCallback = { tap, frames, flags, bufferListInOut, framesOut, flagsOut in
    let status = MTAudioProcessingTapGetSourceAudio(tap, frames, bufferListInOut, flagsOut, nil, framesOut)
    guard status == noErr else { return }
    let me = Unmanaged<AudioLevelTap>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).takeUnretainedValue()
    let abl = UnsafeMutableAudioBufferListPointer(bufferListInOut)
    var sum: Float = 0
    var count = 0
    for buf in abl {
        guard let mdata = buf.mData else { continue }
        let n = Int(buf.mDataByteSize) / MemoryLayout<Float>.size
        let p = mdata.assumingMemoryBound(to: Float.self)
        var i = 0
        while i < n { let s = p[i]; sum += s * s; i += 1 }
        count += n
    }
    if count > 0 { me.push(rms: (sum / Float(count)).squareRoot()) }
}
