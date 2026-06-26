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
            .filter { !$0.resolved.trimmingCharacters(in: .whitespaces).isEmpty }
            .sorted { $0.startSec < $1.startSec }
        nextFire = 0; lastSec = 0; burst = nil
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
        p.play(); isPlaying = true
    }

    private func tick(_ sec: Double) {
        guard sec.isFinite else { return }
        if sec + 0.05 < lastSec { nextFire = fireTokens.firstIndex { $0.startSec >= sec } ?? fireTokens.count }
        lastSec = sec
        while nextFire < fireTokens.count, sec >= fireTokens[nextFire].startSec {
            burst = fireTokens[nextFire]; burstTick += 1
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
