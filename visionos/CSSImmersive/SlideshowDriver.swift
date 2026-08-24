// CSSOS_WAVE_1934 20260824 — 幻灯轨渲染。
//
// Jing:「现在的作品都没有视频轨, 必须自动降级到幻灯。」——实测证实了这一点, 而且比
// 「没有视频」更彻底:
//   · 1680 首在世作品里 648 首有 preview_video_url,
//   · 但这 648 首里 video_cents > 0 的是【0 首】—— 没有一首付过视频引擎的钱。
//   也就是说那些 mp4 全是平台自己把封面拼出来的幻灯片视频。按 Jing 的裁定:
//   「我们自己把封面拼出来的幻灯片视频, 就是幻灯, 不能归类到真视频。」
//   → 整个平台目前【一个真视频都没有】, 画面轨的常态就是幻灯。
//
// 原来 Vision 端只有两条路: 有 videoURL 就 VideoMaterial, 没有就贴【一张】静态封面。
// 一首歌三四分钟盯着一张不动的图, 等于没有画面。而作品其实带着 15 张幻灯帧。
//
// 这个驱动做三件事:
//   ① 把 slides 逐张换到银幕上(纹理预取, 换图不卡帧);
//   ② 换图节奏跟【音乐时间】走, 不用自己的计时器 —— 暂停时画面也停, 拖动进度画面
//      跟着跳。四轨分离不等于各跑各的, 是各自独立但同一根时间轴。
//   ③ 一张都没有时退回封面, 再没有就退回品牌底色 —— 绝不留黑屏
//      (Jing:「画面不能是黑乎乎的视频框, 必须显示画面, 哪怕是一张封面图。」)

import Foundation
import RealityKit
import AVFoundation
import UIKit

@MainActor
final class SlideshowDriver {

    /// 每张停留秒数。取 6s: 一首 3-4 分钟的歌配 15 张 ≈ 走 1.5 轮, 既不闪也不呆。
    static let holdSeconds: Double = 6

    private weak var screen: ModelEntity?
    private var urls: [String] = []
    private var textures: [Int: TextureResource] = [:]
    private var shownIndex: Int = -1
    private var ticker: Timer?
    private weak var clock: AVPlayer?

    /// 装载一条幻灯轨。urls 为空 → 什么都不做(调用方负责退回封面)。
    func attach(screen: ModelEntity, urls: [String], clock: AVPlayer?) {
        self.screen = screen
        self.urls = urls
        self.clock = clock
        self.textures = [:]
        self.shownIndex = -1
        guard !urls.isEmpty else { return }

        // 先把第一张贴上去 —— 不让银幕有哪怕一秒是黑的。
        Task { await self.show(index: 0) }
        // 预取前几张, 后面的懒加载(15 张全预取会占太多内存, Vision Pro 上要克制)。
        for i in 1..<min(4, urls.count) { Task { _ = await self.texture(at: i) } }

        ticker?.invalidate()
        ticker = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    func detach() {
        ticker?.invalidate(); ticker = nil
        textures.removeAll()
        screen = nil
        urls = []
        shownIndex = -1
    }

    /// 跟着音乐时间走 —— 音乐停, 画面就停在那一张; 拖进度, 画面跟着跳。
    private func tick() {
        guard !urls.isEmpty else { return }
        // 没有时钟(纯图作品)就按墙钟走, 但仍然是同一套换图逻辑。
        let t: Double
        if let c = clock, c.rate != 0 || c.currentTime().seconds > 0 {
            t = max(0, c.currentTime().seconds)
        } else {
            t = Date().timeIntervalSinceReferenceDate
        }
        let idx = Int(t / Self.holdSeconds) % urls.count
        guard idx != shownIndex else { return }
        Task { await self.show(index: idx) }
        // 顺手预取下一张, 换过去时就不用等网络。
        let next = (idx + 1) % urls.count
        Task { _ = await self.texture(at: next) }
    }

    private func show(index: Int) async {
        guard let screen, index >= 0, index < urls.count else { return }
        guard let tex = await texture(at: index) else { return }
        shownIndex = index
        var m = UnlitMaterial()
        m.color = .init(texture: .init(tex))
        screen.model?.materials = [m]
    }

    private func texture(at index: Int) async -> TextureResource? {
        if let cached = textures[index] { return cached }
        guard index >= 0, index < urls.count, let url = URL(string: urls[index]) else { return nil }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let img = UIImage(data: data), let cg = img.cgImage,
              let tex = try? await TextureResource(image: cg, options: .init(semantic: .color))
        else { return nil }
        // 只留最近 6 张, 免得 15 张 4K 纹理把头显内存吃光(和 web 端 GPU 合成器 OOM 同一类风险)。
        if textures.count >= 6 {
            let drop = textures.keys.sorted(by: { abs($0 - index) > abs($1 - index) }).first
            if let d = drop { textures.removeValue(forKey: d) }
        }
        textures[index] = tex
        return tex
    }
}
