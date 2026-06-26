// CSS Watch — 播放器: 音频(AVPlayer)主时钟 + 逐字 token 发射(驱动中央爆字)。
import Foundation
import AVFoundation
import Combine

@MainActor
final class WatchPlayer: ObservableObject {
    @Published var works: [CSSWatchWork] = []
    @Published var index: Int = 0
    @Published var isPlaying = false
    @Published var loading = true
    @Published var burst: WSubToken? = nil   // 当前要爆的字
    @Published var burstTick = 0             // 每个新字 +1(驱动动画重建)
    @Published var volume: Double = 0.85     // W1426 — 表冠调音量
    @Published var showVol = false           // 调音量时短暂显示指示
    @Published var elapsed: Double = 0       // W1427 — 已播秒(左上角倒计时)
    @Published var duration: Double = 0
    private var lastBurstSec: Double = -10
    @Published var lastEmotion: String = "calm"   // W1427 — 器乐段 emoji 用近期情绪

    /// 器乐段(前奏/间奏/尾声/无歌声): 近期无字爆。
    var instrumental: Bool { duration > 0 && elapsed - lastBurstSec > 1.6 }
    /// 左上角: 剩余时长倒计时 m:ss。
    var remainingText: String {
        guard duration > 0 else { return "" }
        let r = max(0, duration - elapsed)
        return String(format: "%d:%02d", Int(r) / 60, Int(r) % 60)
    }

    private var player: AVPlayer?
    private var fireTokens: [WSubToken] = []
    private var nextFire = 0
    private var lastSec = 0.0
    private var timeObs: Any?

    var current: CSSWatchWork? { works.indices.contains(index) ? works[index] : nil }

    func load() async {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        works = await WatchBackend.fetchWorks(limit: 20)
        loading = false
        if !works.isEmpty { await playIndex(0) }
    }

    func playIndex(_ i: Int) async {
        guard works.indices.contains(i) else { return }
        index = i
        var w = works[i]
        if w.lines.isEmpty { w.lines = await WatchBackend.fetchLines(workID: w.id); works[i] = w }
        fireTokens = w.lines.flatMap { $0.tokens ?? [] }
            .filter { tk in
                let s = tk.resolved.trimmingCharacters(in: .whitespaces)
                guard !s.isEmpty else { return false }
                if let f = s.first, "[【#(（♪".contains(f) { return false }   // 滤 [Music]/段落头/拟声等非歌词
                if s.count > 12 { return false }                              // 整句散文(非逐字)不当字爆
                return true
            }
            .sorted { $0.startSec < $1.startSec }
        nextFire = 0; lastSec = 0; burst = nil; elapsed = 0; duration = 0; lastBurstSec = -10
        guard let url = URL(string: w.audioURL) else { return }
        if let old = timeObs, let pl = player { pl.removeTimeObserver(old); timeObs = nil }
        let p = AVPlayer(url: url)
        player = p
        timeObs = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.06, preferredTimescale: 600),
                                            queue: .main) { [weak self] t in
            Task { @MainActor in self?.tick(t.seconds) }
        }
        // 放完 → 自动下一首(一直有歌、一直有字爆)。
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: nil)
        NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime,
                                               object: p.currentItem, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.next() }
        }
        p.volume = Float(volume)
        p.play(); isPlaying = true
    }

    private var volHideWork: DispatchWorkItem?
    func setVolume(_ v: Double) {
        volume = min(1, max(0, v))
        player?.volume = Float(volume)
        showVol = true
        volHideWork?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.showVol = false }
        volHideWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1, execute: w)
    }

    private func tick(_ sec: Double) {
        guard sec.isFinite else { return }
        let e = floor(sec)
        if e != elapsed { elapsed = e }   // W1427b — 倒计时降到 1Hz, 别每 0.06s 全界面重渲染(会饿死器乐 emoji 定时器)
        if duration <= 0, let d = player?.currentItem?.duration.seconds, d.isFinite, d > 0 { duration = d }
        if sec + 0.05 < lastSec { nextFire = fireTokens.firstIndex { $0.startSec >= sec } ?? fireTokens.count }
        lastSec = sec
        while nextFire < fireTokens.count, sec >= fireTokens[nextFire].startSec {
            burst = fireTokens[nextFire]; burstTick += 1; lastBurstSec = sec
            if let e = fireTokens[nextFire].emotion, !e.isEmpty { lastEmotion = e }
            nextFire += 1
        }
    }

    func togglePlay() {
        guard let p = player else { return }
        if isPlaying { p.pause() } else { p.play() }
        isPlaying.toggle()
    }

    func next() { Task { await playIndex((index + 1) % max(1, works.count)) } }
    func prev() { Task { await playIndex((index - 1 + max(1, works.count)) % max(1, works.count)) } }
}
