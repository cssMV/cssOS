// CSSOS_WAVE_975 — 可拖拽空间控制窗(visionOS 原生 WindowGroup, 自带抓取条, 放房间任意处)。
// 整合【交易 + 多语言/多声线】于一窗(不再压在视频上、不再难点)。延续"在哪用在哪改"原则:
// 看着视频, 想打赏/换语言/换声线 → 抓这个小窗到顺手处, 一直在那, 不用找。
//
// 跨窗→沉浸: 打赏的"金光飞向银幕"是沉浸空间特效, 窗口按钮只 settings.tipPulse += 1,
// ImmersiveView 观察到再放特效 + 调后端。

import SwiftUI

// CSSOS_WAVE_1900 20260823 — 播放器重设计「A · 四轨控制台」落地(设计稿: MV 播放器重设计, Jing 选定 A)。
//
// 换掉了什么、为什么:
//  · 旧版是一列 emoji 胶囊(💝👁🎧💎🌐🎤)。emoji 会跟系统字体走, 粗细/风格在 Vision 这种
//    近距离高分辨率面板上不统一 —— 改成描边 SVG 同款的 SF Symbols, 统一线宽。
//    (只改 Vision, 网页 Dock 的 emoji 胶囊是宪法要求的视觉锚, 不动。)
//  · 旧版把语言/声线堆在底部一排通用胶囊。新版是【四轨可见 + 每轨自己拥有切换器】:
//    点歌词换语言, 点音乐换声线, 点画面换形态, 点字幕换样式 —— 这正是四轨架构本身,
//    四条线独立, 所以四个开关也独立。
//  · 舞台从方向 C 移植: 逐字情绪字幕【压在画面上】。注意是"叠", 不是"烧" —— 与平台
//    「严禁烧录」铁律同源, 架构上分开了, 视觉上也要看得出是两层。
//
// 一个诚实的取舍: 舞台放的是封面/当前幻灯帧, 不是第二路视频解码。
//   沉浸银幕已经在放画面了, 面板再解一路 = Vision Pro 上白烧 GPU。
//   静态帧 + 活的字幕已经达到设计意图(两层可见), 代价却低一个数量级。
//
// 另一个诚实的取舍: 只有【真有数据】的轨才显示切换器。
//   Vision 的 CSSVariant 目前只有语言这一个维度(见 Models.swift), 没有声线, 没有画面形态。
//   所以音乐/画面/字幕三轨如实显示"只有一种", 绝不摆一排点不动的假胶囊。
//   等后端把这些维度给到 Vision, 这里自然长出选项 —— 判据在数据, 不在写死的列表。

import SwiftUI
import Combine

struct ControlsPanel: View {
    @EnvironmentObject var player: PlayerController
    @EnvironmentObject var settings: CathedralSettings

    /// 当前选中的轨: 0 歌词 / 1 音乐 / 2 画面 / 3 情绪字幕。
    @State private var track: Int = 0
    /// 舞台上正在爆的字(订阅 PlayerController.burstSubject, 行尾整句淡出)。
    @State private var live: [LiveChar] = []

    struct LiveChar: Identifiable { let id = UUID(); let ch: String; let emotion: String; let intensity: Double }

    private struct TrackDef {
        let name: String, source: String, symbol: String, hue: Double
    }
    private var defs: [TrackDef] { [
        .init(name: L("Lyrics", "歌词"),    source: "Claude → GPT → Gemini", symbol: "text.alignleft",        hue: 155),
        .init(name: L("Music", "音乐"),     source: "Suno",                  symbol: "music.note",            hue: 192),
        .init(name: L("Visual", "画面"),    source: "Sora",                  symbol: "play.rectangle",        hue: 268),
        .init(name: L("Subtitles", "情绪字幕"), source: L("in-house", "自研 · 逐字"), symbol: "captions.bubble", hue: 48),
    ] }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            stage
            trackRow
            switcher
            transport
            deals
        }
        .padding(30)
        .frame(minWidth: 560, maxWidth: 680)
        .onReceive(player.burstSubject) { ev in
            live.append(LiveChar(ch: ev.text, emotion: ev.emotion, intensity: ev.intensity))
            if live.count > 14 { live.removeFirst(live.count - 14) }   // 只留一行的量, 不无限堆
        }
        .onReceive(player.lineFadeSubject) { _ in
            withAnimation(.easeOut(duration: 0.35)) { live.removeAll() }
        }
    }

    // MARK: 头

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Circle().fill(accent).frame(width: 7, height: 7)
                Text(L("Now playing", "正在播放"))
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.8).textCase(.uppercase)
                    .foregroundStyle(.secondary)
            }
            Text(player.work?.title ?? "—")
                .font(.system(size: 27, weight: .bold, design: .rounded))
                .lineLimit(2).minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: 舞台 —— 画面(封面/当前帧) + 压在上面的逐字情绪字幕

    private var stage: some View {
        ZStack(alignment: .bottomLeading) {
            // 画面层
            if let c = player.work?.coverURL, let u = URL(string: c) {
                AsyncImage(url: u) { img in
                    img.resizable().aspectRatio(contentMode: .fill)
                } placeholder: { Color.black.opacity(0.35) }
            } else {
                LinearGradient(colors: [Color(hue: 0.42, saturation: 0.5, brightness: 0.14),
                                        Color.black.opacity(0.9)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }

            // 字幕层 —— 叠在上面, 不是烧进去
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                ForEach(live) { c in
                    Text(c.ch)
                        .font(.system(size: 26 + c.intensity * (track == 3 ? 13 : 9),
                                      weight: .bold, design: .rounded))
                        .foregroundStyle(Color(SpatialSubtitleSystem.color(for: c.emotion)))
                        .shadow(color: Color(SpatialSubtitleSystem.color(for: c.emotion)).opacity(c.intensity * 0.7),
                                radius: track == 3 ? 14 : 9)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 18).padding(.bottom, 16)
            .animation(.easeOut(duration: 0.18), value: live.count)
        }
        .frame(height: 260)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(track == 3 ? hue(48).opacity(0.55) : hue(268).opacity(0.30), lineWidth: 1)
        )
    }

    // MARK: 四轨

    private var trackRow: some View {
        HStack(spacing: 9) {
            ForEach(defs.indices, id: \.self) { i in
                let d = defs[i]
                let on = i == track
                Button { track = i } label: {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Image(systemName: d.symbol)
                                .font(.system(size: 17, weight: .medium))
                                .foregroundStyle(hue(d.hue).opacity(on ? 1 : 0.72))
                            Spacer(minLength: 0)
                            Circle().fill(hue(d.hue)).frame(width: 6, height: 6).opacity(on ? 1 : 0.3)
                        }
                        Text(d.name).font(.system(size: 13.5, weight: .bold)).lineLimit(1)
                        Text(d.source)
                            .font(.system(size: 10)).foregroundStyle(.secondary)
                            .lineLimit(2).multilineTextAlignment(.leading)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 12)
                    .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
                    .background(hue(d.hue).opacity(on ? 0.19 : 0.07),
                                in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(hue(d.hue).opacity(on ? 0.58 : 0.20), lineWidth: 1))
                    .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .hoverEffect()
            }
        }
    }

    // MARK: 选中轨的切换器 —— 只有真有数据的轨才给选项

    private var switcher: some View {
        let d = defs[track]
        return VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(switcherLabel)
                    .font(.system(size: 11, weight: .semibold)).tracking(1.6).textCase(.uppercase)
                    .foregroundStyle(hue(d.hue))
                Spacer(minLength: 8)
                Text(switcherHint).font(.system(size: 11)).foregroundStyle(.secondary)
            }
            if track == 0 && player.variants.count > 1 {
                // 歌词轨 = 语言变体(唯一有真数据的维度)。零间隙共用边框, 沿用 W1416 的做法。
                HStack(spacing: 0) {
                    ForEach(Array(player.variants.enumerated()), id: \.offset) { i, v in
                        Button { player.setActive(i) } label: {
                            Text(v.label)
                                .font(.system(size: 15, weight: i == player.activeIndex ? .bold : .medium))
                                .foregroundStyle(.white.opacity(i == player.activeIndex ? 1 : 0.72))
                                .frame(maxWidth: .infinity, minHeight: 52)
                                .background(i == player.activeIndex ? hue(d.hue).opacity(0.34) : Color.clear)
                                .clipShape(Capsule())
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .hoverEffect()
                    }
                }
                .frame(height: 52)
                .background(hue(d.hue).opacity(0.07))
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(hue(d.hue).opacity(0.30), lineWidth: 1))
            } else {
                Text(L("Only one for now — this axis isn\u{2019}t generated yet.",
                       "目前只有一种 —— 这个维度还没生成。"))
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(hue(d.hue).opacity(0.06), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
            .strokeBorder(hue(d.hue).opacity(0.24), lineWidth: 1))
    }

    private var switcherLabel: String {
        switch track {
        case 0: return L("Language", "语言")
        case 1: return L("Voice", "声线")
        case 2: return L("Visual form", "画面形态")
        default: return L("Subtitle style", "字幕样式")
        }
    }
    private var switcherHint: String {
        if track == 0 && player.variants.count > 1 {
            return String(format: L("%d generated", "已生成 %d 条"), player.variants.count)
        }
        return ""
    }

    // MARK: 传输

    private var transport: some View {
        HStack(spacing: 18) {
            Spacer(minLength: 0)
            ghost("backward.end.fill") { player.setActive(max(0, player.activeIndex - 1)) }
            Button { player.isPlaying ? player.pauseAll() : player.playAll() } label: {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(.black.opacity(0.82))
                    .frame(width: 80, height: 80)
                    .background(accent.gradient, in: Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .hoverEffect()
            ghost("forward.end.fill") { player.setActive(min(player.variants.count - 1, player.activeIndex + 1)) }
            Spacer(minLength: 0)
        }
    }

    private func ghost(_ symbol: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
                .frame(width: 56, height: 56)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().strokeBorder(.white.opacity(0.14), lineWidth: 1))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .hoverEffect()
    }

    // MARK: 交易(沿用旧版行为与 W1068 的 IAP 门, 一字未改)

    private var deals: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(L("This work", "这一首"))
                .font(.system(size: 11, weight: .semibold)).tracking(1.8).textCase(.uppercase)
                .foregroundStyle(.secondary)
            HStack(spacing: 9) {
                if CSSPayments.visionPurchasesEnabled {
                    deal("heart", L("Tip", "打赏"), live: true) {
                        settings.tipPulse += 1
                        if let id = player.work?.id { Task { await SpatialTip.sendTip(workID: id, amountCents: 100) } }
                    }
                }
                deal("eye", L("View · Free", "欣赏 · 免费"), live: true) {}
                deal("headphones", L("Listen · Free", "聆听 · 免费"), live: true) {}
                if CSSPayments.visionPurchasesEnabled {
                    deal("cube", L("Buyout", "买断"), live: true) {}
                }
            }
        }
    }

    private func deal(_ symbol: String, _ text: String, live: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: symbol).font(.system(size: 15, weight: .medium))
                Text(text).font(.system(size: 13.5, weight: .semibold)).lineLimit(1)
            }
            .foregroundStyle(.white.opacity(live ? 0.95 : 0.42))
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 17, style: .continuous)
                .strokeBorder(.white.opacity(live ? 0.16 : 0.07), lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
        }
        .buttonStyle(.plain)
        .hoverEffect()
    }

    // MARK: 色

    /// 12 色相盘取色(与网页端 CSSOS_PILL_HUES 同源: 155 歌词 / 192 音乐 / 268 画面 / 48 字幕)。
    private func hue(_ h: Double) -> Color {
        Color(hue: h / 360.0, saturation: 0.72, brightness: 0.92)
    }
    private var accent: Color { hue(defs[track].hue) }
}

// W1051 — 简易自动换行布局(visionOS 16+/iOS 16+ Layout): 胶囊放不下就换行, 不再被压扁难点。
struct FlowRow: Layout {
    var spacing: CGFloat = 12
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > 0 && x + sz.width > maxW { x = 0; y += rowH + spacing; rowH = 0 }
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
        return CGSize(width: maxW == .infinity ? x : maxW, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxW = bounds.width
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > 0 && x + sz.width > maxW { x = 0; y += rowH + spacing; rowH = 0 }
            s.place(at: CGPoint(x: bounds.minX + x + sz.width / 2, y: bounds.minY + y + sz.height / 2),
                    anchor: .center, proposal: ProposedViewSize(sz))
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
    }
}

// W1409 — 沉浸内【多语言/多声线胶囊条】(胶囊宪法: 单一共用轨道 + 各段图标+标签 + 激活段高亮凸出在前 + 两头圆)。
//   gaze 抬起高亮、捏合切激活屏(语言/声线)。只在多变体时显示(单语言作品不出现)。
struct LangVoiceCapsuleBar: View {
    @EnvironmentObject var player: PlayerController

    var body: some View {
        if player.variants.count > 1 {
            // W1416 — Jing「胶囊与轨道零间隙→共用边框」: 去掉外 padding, 各段满高贴住轨道内沿,
            //   激活段填满整条高度 + 外层 clipShape 把两头切成轨道圆角 = 零间隙共用边框。
            HStack(spacing: 0) {
                ForEach(Array(player.variants.enumerated()), id: \.offset) { i, v in
                    seg(i: i, v: v)
                }
            }
            .frame(height: 60)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())                                   // 段高亮裁进轨道圆角 → 零间隙共边
            .overlay(Capsule().strokeBorder(.white.opacity(0.16), lineWidth: 1))
        }
    }

    @ViewBuilder private func seg(i: Int, v: CSSVariant) -> some View {
        let active = (i == player.activeIndex)
        /* CSSOS_WAVE_1900 — 与 ControlsPanel 同批: emoji 换 SF Symbols。
         * 理由同上 —— emoji 跟系统字体走, 粗细/风格在 Vision 近距离高分辨率下和其余描边图标对不齐。
         * (只改 Vision; 网页 Dock 的 emoji 是胶囊宪法要求的视觉锚, 不动。) */
        let icon = (v.id == "main") ? "mic" : "globe"                // 原唱声线 / 语言版
        let label = (v.id == "main") ? L("Original", "原唱") : v.label
        Button { player.setActive(i) } label: {
            HStack(spacing: 7) {
                Image(systemName: icon).font(.system(size: 16, weight: .medium))
                Text(label).font(.system(size: 17, weight: .semibold, design: .rounded)).lineLimit(1)
            }
            .padding(.horizontal, 22)
            .frame(maxHeight: .infinity)                            // 满高 → 贴住轨道上下沿(共边)
            .background(active ? Color.green.opacity(0.30) : Color.clear)
            .foregroundStyle(active ? Color.green : .white.opacity(0.88))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverEffect()
    }
}
