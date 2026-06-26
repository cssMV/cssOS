// CSSOS_WAVE_1059 — Vision 大厅(Cover Arc): 精简自桌面, 符合 visionOS 习惯。
//   · 三货架 tab(为你 / 我的 / 旗舰)+ 横向封面廊, gaze 抬起高亮, pinch 进影院。
//   · 语音优先入口(说出想听的)替代文字搜索框 —— 现版用一次性听写/搜索 sheet(键盘麦克风可听写),
//     全程免打字的 SFSpeechRecognizer 听写为下一步(需麦克风/语音权限)。
//   · Surprise me(随机一首)+ 创作入口。
//   · 不再"一进来硬播某首歌": 封面可见可选, pinch 才进影院。

import SwiftUI

struct LobbyView: View {
    var onEnter: (CSSWork) -> Void
    var onCreate: () -> Void
    var onSpell: (String) -> Void          // 语音咒语未命中作品 → 创作
    var signedIn: Bool = true              // W1062 — 未登录显示 Sign in 入口
    var onSignIn: () -> Void = {}

    @State private var shelf = "for-you"
    @State private var items: [CSSBackend.LobbyItem] = []
    @State private var loading = true
    @State private var query = ""
    @State private var searching = false
    @StateObject private var voice = VoiceInput()
    @State private var orbSpin = 0.0   // W1075 — 大厅金球 2D 自转角度
    @State private var orbGlow = 0.0   // 金球脉冲光强 0…1(随机脉动)
    @State private var orbHue = 0.0    // 金球光晕色相 0…1(随机色循环)
    @State private var beamPhase = 0.0 // 光束相位 0…1(repeatForever), 凝视金球时连续射出
    @State private var pageLimit = 5   // 默认加载 5(4 全显 + 第5露头), 左滑分页 +10
    @State private var loadingMore = false
    @State private var canLoadMore = true
    @Namespace private var orbNS               // 金球凝视组(金球触发 → 光束跟随显)

    private let shelves: [(String, String, String)] = [
        ("for-you", "For you", "为你"),
        ("mine", "Mine", "我的"),
        ("flagship", "Flagship", "旗舰"),
    ]

    private var filtered: [CSSBackend.LobbyItem] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return items }
        return items.filter { $0.title.lowercased().contains(q) || $0.meta.lowercased().contains(q) }
    }

    var body: some View {
        Group {
            if loading && items.isEmpty {
                splashView          // W1076 — 品牌化加载页: 大 logo 铺满, 盖掉系统空占位
            } else {
                mainView
            }
        }
        .task {
            voice.onFinal = { spoken in handleSpoken(spoken) }
            await load()
            // 不自动触发 —— 用户凝视大厅这枚魔镜 + 捏合 才发光束登录(只此一枚, 无浮空重复球)。
        }
        .onChange(of: voice.transcript) { _, t in if voice.isListening { query = t } }
        .sheet(isPresented: $searching) { searchSheet }
    }

    // W1076 — 启动加载态: 大魔镜 logo(紧裁, 填满) + 名称 + 转圈, 居中铺满玻璃窗。
    private var splashView: some View {
        VStack(spacing: 22) {
            ZStack {
                Image("MirrorFull").resizable().scaledToFit()
                    .frame(width: 240, height: 240)
            }
            Text("CSS Vision").font(.system(size: 40, weight: .black, design: .rounded))
            ProgressView().controlSize(.large)
        }
        .frame(width: 560, height: 560)
        .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 44))
    }

    private var mainView: some View {
        VStack(spacing: 16) {
            // W1075 — 大厅 logo 真分层 + 纯白底(不再用会溢出辉光盖住环的 3D RealityView; 改 2D 旋转金球图,
            //   环+尖角必清晰可见)。白圆底(像图标)衬出环。凝视 → 金球浮出(.hoverEffect)。
            ZStack {
                Image("MirrorRing")                   // 环+四尖角(透明背景, 衬玻璃窗; 圣殿大门 logo 用透明)
                    .resizable().scaledToFit()
                // 随机色脉冲光晕(在金球后面, 随色相循环 + 脉动呼吸, 散发光芒)
                Circle()
                    .fill(Color(hue: orbHue, saturation: 0.95, brightness: 1.0))
                    .frame(width: 58, height: 58)
                    .offset(x: -0.4, y: -3.1)
                    .blur(radius: 16)
                    .opacity(0.30 + 0.45 * orbGlow)
                    .blendMode(.plusLighter)
                Image("MirrorOrb")                    // 金球(紧裁无边图, 填满环内孔, 2D 自转); 凝视触发源
                    .resizable().scaledToFit()
                    .frame(width: 60, height: 60)     // 撑满内圆
                    .rotationEffect(.degrees(orbSpin)) // ① 先绕自身中心自转(修正轴心: 旋转必须在平移之前)
                    .offset(x: -0.4, y: -3.1)         // 再平移进环孔(透明环孔心 509,491 /1024)
                    .offset(z: 8)                     // 分层: 金球向观者轻微凸出
                    .contentShape(.hoverEffect, Circle())
                    .hoverEffect(in: HoverEffectGroup(orbNS, behavior: .activatesGroup)) { effect, isActive, _ in
                        effect.scaleEffect(isActive ? 1.06 : 1.0)            // 凝视金球→激活组
                    }
                // (光束不在窗口里做 —— 捏金球进沉浸空间, 头部锚点光束真飞进眼睛, 见 GateView)
            }
            .frame(width: 150, height: 150)
            .contentShape(.circle)
            .onTapGesture { if !signedIn { onSignIn() } }   // 凝视这枚金球+捏合 → 进沉浸, 光束真射进眼睛 → Optic ID
            .onAppear {
                withAnimation(.linear(duration: 9).repeatForever(autoreverses: false)) { orbSpin = 360 }
                withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) { orbGlow = 1.0 }
                withAnimation(.linear(duration: 7).repeatForever(autoreverses: false)) { orbHue = 1.0 }
                withAnimation(.linear(duration: 1.1).repeatForever(autoreverses: false)) { beamPhase = 1.0 }
            }
            Text("CSS Vision").font(.system(size: 30, weight: .black, design: .rounded))
            Text(signedIn ? L("Gaze a cover · pinch to enter", "凝视封面 · 捏合进入影院")
                          : L("Gaze the orb · pinch to sign in with Optic ID", "凝视魔镜球 · 捏合用 Optic ID 登录"))
                .font(.footnote).foregroundStyle(.secondary)

            if !signedIn {
                Button { onSignIn() } label: {   // 备用入口(也可直接捏合上面的金球)
                    Label(L("Sign in with Apple to create", "用 Apple 登录以创作"), systemImage: "applelogo")
                }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small)
            }

            HStack(spacing: 8) {
                ForEach(shelves, id: \.0) { key, en, zh in
                    Button(L(en, zh)) { shelf = key; Task { await load() } }
                        .tint(shelf == key ? .green : nil)
                }
            }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)

            if loading {
                ProgressView().frame(height: 260)
            } else if filtered.isEmpty {
                Text(L("Nothing here yet — try Create or Surprise me.", "这里暂时空空 —— 试试创作或随便来一首。"))
                    .foregroundStyle(.secondary).frame(height: 260)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 18) {                    // Lazy: 只渲染可见卡, 不一次性触发全部分页
                        ForEach(filtered) { it in coverCard(it) }
                        if query.isEmpty, canLoadMore {          // 末尾哨兵: 滑到才出现 → 触发再加载一批
                            Color.clear.frame(width: 1, height: 210)
                                .onAppear { Task { await loadMore() } }
                        }
                        if loadingMore { ProgressView().frame(width: 60, height: 210) }
                    }.padding(.horizontal, 30).padding(.vertical, 8)
                }.frame(height: 270)
            }

            if voice.isListening {
                Text(voice.transcript.isEmpty ? L("Listening…", "聆听中…") : "“\(voice.transcript)”")
                    .font(.headline).foregroundStyle(.yellow).lineLimit(1).frame(maxWidth: 600)
            }
            HStack(spacing: 12) {
                Button { voice.toggle() } label: {
                    Label(voice.isListening ? L("Tap to stop", "点这停") : L("Say what to play or create", "说出想听/想创作的"),
                          systemImage: voice.isListening ? "waveform" : "mic.fill").foregroundStyle(.black)
                }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large).tint(.yellow)
                Button { searching = true } label: {
                    Image(systemName: "keyboard")
                }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)
                    .help(L("Type instead", "改用打字"))
                Button {
                    if let r = (filtered.randomElement() ?? items.randomElement()) { onEnter(r.toWork()) }
                } label: {
                    Label(L("Surprise me", "随便来一首"), systemImage: "dice.5")
                }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)
                Button { onCreate() } label: {
                    Label(L("Create", "创作"), systemImage: "sparkles").foregroundStyle(.white)
                }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large).tint(.purple)
            }
        }
        .padding(34)
        .frame(width: 860)
        .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 44))
    }

    // 语音终判:
    //   ① 咒语词 "CSS" 开头(平台口号 "Just say CSS, witness the miracle")→ 剥掉 CSS, 余下当创作提示 → onSpell。
    //   ② 否则命中作品标题 → 进影院播; ③ 都不是 → 也当创作咒语。
    private func handleSpoken(_ text: String) {
        var t = text.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        // 剥掉开头的 "CSS"(允许 "CSS, 创作…" / "CSS 唐伯虎" / "css create …")。
        let lower = t.lowercased()
        if lower == "css" || lower.hasPrefix("css ") || lower.hasPrefix("css,") || lower.hasPrefix("css，") || lower.hasPrefix("css।") {
            let stripped = String(t.dropFirst(3)).trimmingCharacters(in: CharacterSet(charactersIn: " ,，、:：。.\t"))
            query = ""
            if stripped.isEmpty {
                if let r = (items.randomElement()) { onEnter(r.toWork()) }   // 只喊 "CSS" → 惊喜一首
            } else {
                onSpell(stripped)   // "CSS 创作唐伯虎三部曲" → 创作
            }
            return
        }
        if let hit = items.first(where: {
            $0.title.localizedCaseInsensitiveContains(t) || t.localizedCaseInsensitiveContains($0.title)
        }) {
            query = ""
            onEnter(hit.toWork())
        } else {
            query = ""
            onSpell(t)
        }
    }

    private func coverCard(_ it: CSSBackend.LobbyItem) -> some View {
        CoverCardView(it: it, orbGlow: orbGlow, onEnter: onEnter)
    }

    // 第二行: 时长 · 输出日期(不再显示 work_type/style)。
    private func durationLine(_ it: CSSBackend.LobbyItem) -> String {
        var parts: [String] = []
        if it.durSecs > 0 { parts.append("♪ \(it.durSecs / 60):" + String(format: "%02d", it.durSecs % 60)) }
        if !it.createdAt.isEmpty { parts.append(it.createdAt) }
        return parts.joined(separator: " · ")
    }

    private var searchSheet: some View {
        VStack(spacing: 16) {
            Text(L("Search or dictate a title", "搜索或听写标题")).font(.title3)
            Text(L("Tip: tap the mic on the keyboard to speak.", "提示:点键盘上的麦克风即可说话听写。"))
                .font(.footnote).foregroundStyle(.secondary)
            TextField(L("e.g. 唐伯虎 · epic · 混沌", "如 唐伯虎 · epic · 混沌"), text: $query)
                .textFieldStyle(.roundedBorder).frame(width: 440)
            HStack(spacing: 10) {
                Button(L("Clear", "清空")) { query = "" }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                Button(L("Done", "完成")) { searching = false }
                    .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
            }
        }.padding(44)
    }

    private func load() async {
        loading = true
        pageLimit = 5
        canLoadMore = true
        items = await CSSBackend.fetchShelf(shelf, limit: pageLimit)
        canLoadMore = items.count >= pageLimit
        loading = false
    }

    // 左滑到末张 → 多取 10 条(market 接口 ?limit 返回前 N, 直接替换列表)。
    private func loadMore() async {
        guard canLoadMore, !loadingMore, query.isEmpty else { return }
        loadingMore = true
        let next = pageLimit + 10
        let more = await CSSBackend.fetchShelf(shelf, limit: next)
        if more.count > items.count {
            items = more; pageLimit = next; canLoadMore = more.count >= next
        } else {
            canLoadMore = false
        }
        loadingMore = false
    }
}

// 作品卡片(独立 View, 自带 @Namespace 给 HoverEffectGroup 用)。
// 凝视封面 → 整组激活 → 绿色脉冲大光环亮(移开即灭)。捏合点按进影院。
private struct CoverCardView: View {
    let it: CSSBackend.LobbyItem
    let orbGlow: Double
    let onEnter: (CSSWork) -> Void
    @Namespace private var ns

    private var durationLine: String {
        var parts: [String] = []
        if it.durSecs > 0 { parts.append("♪ \(it.durSecs / 60):" + String(format: "%02d", it.durSecs % 60)) }
        if !it.createdAt.isEmpty { parts.append(it.createdAt) }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        let group = HoverEffectGroup(ns, behavior: .activatesGroup)
        let brandGreen = Color(red: 0, green: 245.0/255.0, blue: 160.0/255.0)   // 平台绿 #00f5a0
        // W1387 — 卡片捏不动真凶: 卡片在横向 ScrollView 里, .onTapGesture 抢不过滚动手势(被当成滚动吃掉)。
        //   改成 Button(.plain 保持卡片外观)= 系统级可点目标, 与滚动正确分流(捏=进影院、拖=滚动)。
        Button {
            onEnter(it.toWork())
        } label: {
        VStack(alignment: .leading, spacing: 6) {
            ZStack {
                if let u = URL(string: it.coverURL), !it.coverURL.isEmpty {
                    AsyncImage(url: u) { img in img.resizable().scaledToFill() }
                    placeholder: { Color.black.opacity(0.3) }
                } else {
                    LinearGradient(colors: [.teal.opacity(0.4), .black], startPoint: .top, endPoint: .bottom)
                }
            }
            .frame(width: 170, height: 210)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay {                                                       // 凝视才显的绿色脉冲大光环
                RoundedRectangle(cornerRadius: 18)
                    .stroke(brandGreen, lineWidth: 5)
                    .blur(radius: 9)
                    .opacity(0.5 + 0.5 * orbGlow)                            // 脉动呼吸
                    .hoverEffect(in: group) { effect, isActive, _ in
                        effect.opacity(isActive ? 1 : 0)                     // 组激活(凝视封面)→亮, 否则灭
                    }
                    .allowsHitTesting(false)
            }
            .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 18))
            .hoverEffect(in: group) { effect, isActive, _ in                 // 封面=触发源(凝视它→激活整组)
                effect.scaleEffect(isActive ? 1.03 : 1.0)
            }
            Text(it.title).font(.headline).lineLimit(1).frame(width: 170, alignment: .leading)
            Text(durationLine).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                .frame(width: 170, alignment: .leading)
        }
        .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }
}
