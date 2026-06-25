// CSSOS_WAVE_1172 / W1227 / W1231 / W1232 — 首页: HBO Max 风格。
// 左侧 = 分类侧栏(Home/MV/歌剧/三部曲/短剧/电视剧/电影); 右侧主区:
//   顶部 = featured hero(~5 部精选, 2.39 大幅, 方向键左右可切 + 6s 自动轮播 + 圆点);
//   下面 = 多行 rails。选一首 → 进影院播放。

import SwiftUI
import Combine
import UIKit   // W1251 — UIApplication.isIdleTimerDisabled(禁屏保)

/// W1232 — 左侧分类(映射 work_type)。
enum HomeCategory: String, CaseIterable, Identifiable {
    case all, mv, opera, trilogy, shortplay, series, film
    var id: String { rawValue }
    /// LocalizedStringKey: SwiftUI Text 自动按 .strings 本地化, 英文默认, 绝不中文硬编码。
    var title: LocalizedStringKey {
        switch self {
        case .all: return "Home"
        case .mv: return "MV"
        case .opera: return "Opera"
        case .trilogy: return "Trilogy"
        case .shortplay: return "Short Drama"
        case .series: return "Series"
        case .film: return "Film"
        }
    }
    /// rail 标题用(纯英文 String, 供 CSSRail.title)。
    var railTitle: String {
        switch self {
        case .all: return "Home"
        case .mv: return "MV"
        case .opera: return "Operas"
        case .trilogy: return "Trilogies"
        case .shortplay: return "Short Dramas"
        case .series: return "Series"
        case .film: return "Films"
        }
    }
    var icon: String {
        switch self {
        case .all: return "house.fill"
        case .mv: return "music.note"
        case .opera: return "theatermasks.fill"
        case .trilogy: return "books.vertical.fill"
        case .shortplay: return "film.fill"
        case .series: return "tv.fill"
        case .film: return "film.stack.fill"
        }
    }
    /// 命中的 work_type(all = 不过滤)。
    var matches: [String] {
        switch self {
        case .all: return []
        case .mv: return ["single", "song", "mv"]
        case .opera: return ["opera"]
        case .trilogy: return ["triptych", "trilogy"]
        case .shortplay: return ["shortplay", "short-play", "drama"]
        case .series: return ["series"]
        case .film: return ["film", "movie"]
        }
    }
}

struct ContentView: View {
    @State private var allWorks: [CSSWork] = []
    // W1260 — Home 不再默认选中: pickedCategory=nil 时侧栏不高亮任何项, 内容仍按 .all(For You…)。
    @State private var pickedCategory: HomeCategory? = nil
    private var category: HomeCategory { pickedCategory ?? .all }
    @State private var loading = true
    @State private var selected: CSSWork?
    @StateObject private var auth = CSSAuth()           // W1249 登录
    @State private var showLogin = false
    @State private var gateWork: CSSWork?               // 收费且未拥有 → 弹门
    @State private var showCreate = false               // W1259 创作台
    @Namespace private var focusNS

    // W1249/1259 — 创作尾卡 → 创作台; 否则 gating(免费/已拥有直接播; 收费未拥有 → 弹门)。
    private func choose(_ w: CSSWork) {
        if w.isCreateCard { showCreate = true; return }
        Task {
            let h = await CSSBackend.hydrate(w)
            if h.canPlayFree { selected = h } else { gateWork = h }
        }
    }

    /// 当前分类下的作品。
    private func works(for cat: HomeCategory) -> [CSSWork] {
        if cat == .all { return allWorks }
        return allWorks.filter { cat.matches.contains(($0.workType ?? "").lowercased()) }
    }
    // W1259 — hero 末尾追加一张创作卡(「Want an MV like this?」)。
    private var featured: [CSSWork] {
        let real = Array(works(for: category).prefix(5))
        return real.isEmpty ? [] : real + [CSSWork.createCard]
    }
    private var rails: [CSSRail] {
        if category == .all { return CSSBackend.buildRails(allWorks) }
        let f = works(for: category)
        return f.isEmpty ? [] : [CSSRail(id: category.rawValue, title: category.railTitle, works: f)]
    }

    // W1240 — 通栏: 内容(hero+rails)铺满整屏, 侧栏浮在其上。收起态侧栏宽度, 给 rails 让位。
    private let sidebarCollapsedW: CGFloat = 130

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if loading {
                        ProgressView().scaleEffect(1.6).frame(maxWidth: .infinity, minHeight: 500)
                    } else if featured.isEmpty && rails.isEmpty {
                        Text("Nothing here yet")
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity, minHeight: 500)
                    } else {
                        if !featured.isEmpty {
                            FeaturedHero(works: featured) { choose($0) }
                            .prefersDefaultFocus(in: focusNS)   // hero 通栏(满铺左右)
                        }
                        VStack(alignment: .leading, spacing: 24) {
                            ForEach(rails) { rail in
                                RailRow(rail: rail) { choose($0) }
                            }
                        }
                        .padding(.leading, FeaturedHero.contentLeading)   // W1245 — 和 hero 同 leading + 同满铺基准 → 对齐
                        .padding(.top, 28)
                        .ignoresSafeArea(.container, edges: .horizontal)
                    }
                }
                .padding(.bottom, 80)
            }
            .focusSection()
            // W1245 — ScrollView 正常遵守安全区: hero 内容与 For You 同基准(safe+leading)→ 对齐;
            //   hero 背景图在 .background{} 内单独 ignoresSafeArea 满铺通栏。

            // 侧栏浮层(压在 hero 之上)。
            CategorySidebar(selected: $pickedCategory, auth: auth, onLoginTap: { showLogin = true }, onCreate: { showCreate = true })
                .focusSection()
        }
        .focusScope(focusNS)
        .background(Color.black.ignoresSafeArea())
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }   // W1251 — cssTV 运行时禁屏保
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .fullScreenCover(item: $selected) { w in
            PlayerView(work: w)
        }
        .fullScreenCover(isPresented: $showLogin) {
            LoginView(auth: auth)
        }
        .fullScreenCover(isPresented: $showCreate) {
            CreateView(auth: auth)
        }
        .alert("Paid work", isPresented: Binding(get: { gateWork != nil }, set: { if !$0 { gateWork = nil } })) {
            Button("OK", role: .cancel) { gateWork = nil }
        } message: {
            Text("To listen to “\(gateWork?.title ?? "")”\(gateWork.map { $0.listenPriceLabel.isEmpty ? "" : " (\($0.listenPriceLabel))" } ?? ""), purchase it at cssstudio.app. Purchases aren’t available on Apple TV.")
        }
        .task {
            await auth.restore()
            allWorks = await CSSBackend.fetchFeed()
            loading = false
        }
        .onChange(of: auth.isSignedIn) { _, signed in
            if signed { Task { allWorks = await CSSBackend.fetchFeed() } }  // 登录后重拉 → 带 viewer_orders 解锁已购
        }
    }
}

/// W1240 — 扁平按钮风格: 去掉 tvOS 默认白色焦点底。焦点态由我们自己用品牌绿变色表达。
struct FlatButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}

/// W1252 — 平台招牌【选中爆 emoji】效果(可复用): 选中元素背后随机大 emoji + 字心不断爆小 emoji 烟花。
///   用于侧栏选中项、激活胶囊。active=false 时完全不渲染(零开销)。
struct EmojiBurstEffect: View {
    var active: Bool
    var seed: Int = 0
    var bigEmojiSize: CGFloat = 80     // 背景大 emoji(比小图标/字大)
    var bigPeriod: Double = 4.0        // 大 emoji 每隔多久【弹一次】(桌面: 爆一次即停留, 不脉动)
    var smallSize: CGFloat = 22
    var smallSpread: CGFloat = 72      // 小 emoji 最大行进距离(pt) —— 飞远一点
    var smallN: Int = 12
    var continuousSmall: Bool = true   // 小 emoji: true=一直爆; false=只在大爆窗口(定期情绪字幕)
    var rightBias: Bool = false        // W1262 — 往右爆: 粒子偏向右半边(盖过右侧名字/标题)
    var immediate: Bool = false        // W1268 — true=选中即爆(菜单/胶囊); false=按 seed 错相(常驻不同时爆)
    private let pool = CSSFx.petals
    private let bigLife: Double = 1.8  // 一次大爆的生命(弹入+停留+淡出, 对齐桌面 dwell)
    @State private var startT: Double = -1   // W1267 — 激活时刻起点: elapsed=0 立即爆一次, 之后每 bigPeriod

    var body: some View {
        if active {
            // 10fps: 跑在可聚焦菜单/胶囊里, 高帧会饿死遥控器输入(W1258 教训)。
            TimelineView(.periodic(from: .now, by: 0.1)) { ctx in
                let elapsed = startT >= 0 ? max(0, ctx.date.timeIntervalSinceReferenceDate - startT) : 0
                ZStack {
                    bigPop(elapsed)
                    smallSparks(elapsed)
                }
                .allowsHitTesting(false)
            }
            // W1268 — immediate(菜单/胶囊): 选中即爆(offset 0); 常驻(logo/创作卡): 按 seed 错相(0~7.9s)→ 不再同时爆。
            .onAppear {
                let off = immediate ? 0.0 : Double(abs(seed) % 80) / 10.0
                startT = Date().timeIntervalSinceReferenceDate - off
            }
        }
    }

    /// 大 emoji: 每 bigPeriod 弹一次(过冲弹入→停留→淡出, 然后消失), 不是不停脉动。每次换一个随机 emoji。
    @ViewBuilder
    private func bigPop(_ t: Double) -> some View {
        let bcyc = Int(floor(t / bigPeriod))
        let since = t - Double(bcyc) * bigPeriod
        if since < bigLife {
            let s = CSSFx.centerPop(since / bigLife)
            let emoji = pool[Int(CSSFx.rnd(bcyc, seed) * Double(pool.count)) % pool.count]
            Text(emoji)
                .font(.system(size: bigEmojiSize))
                .scaleEffect(CGFloat(s.scale))
                .opacity(s.opacity * 0.82)
        }
    }

    @ViewBuilder
    private func smallSparks(_ t: Double) -> some View {
        let bcyc = Int(floor(t / bigPeriod))
        let since = t - Double(bcyc) * bigPeriod
        if continuousSmall || since < bigLife {
            ForEach(0..<smallN, id: \.self) { i in
                spark(i, t: t, bcyc: bcyc, since: since)
            }
        }
    }

    private func spark(_ i: Int, t: Double, bcyc: Int, since: Double) -> some View {
        let cyc: Int
        let p: Double
        if continuousSmall {
            let dur = 1.7 + CSSFx.rnd(i, seed) * 1.3                     // 桌面 1.7~3.0s
            let off = CSSFx.rnd(i, seed &+ 1)
            let prog = t / dur + off
            cyc = Int(floor(prog)); p = prog - floor(prog)
        } else {
            cyc = bcyc; p = min(1.0, since / bigLife)                    // 与大爆同相位, 一次
        }
        let r1 = CSSFx.rnd(i &+ cyc &* 31, seed)
        let r2 = CSSFx.rnd(i &+ cyc &* 31, seed &+ 5)
        let r3 = CSSFx.rnd(i &+ cyc &* 31, seed &+ 9)
        let r4 = CSSFx.rnd(i, seed &+ 13)
        // W1262 — rightBias: 角度收到右半边(-80°~+80°), 粒子往右飞盖过名字/标题; 否则全向。
        let ang: Double = rightBias ? (r1 * 1.55 - 0.775) * .pi : r1 * 2 * .pi
        let dist: CGFloat = CGFloat((7 + r2 * 22) / 29) * smallSpread    // 桌面 7~29vmin → smallSpread
        let emoji = pool[Int(r3 * Double(pool.count)) % pool.count]
        let fontVar: CGFloat = 0.6 + CGFloat(r4) * 0.9                   // 桌面 0.6~1.5em
        let s = CSSFx.sparkOut(p)
        let halo = CSSFx.haloColor(i &+ cyc &* 7 &+ seed)
        return Text(emoji)
            .font(.system(size: smallSize * fontVar))
            .scaleEffect(CGFloat(s.scale))
            .offset(x: CGFloat(cos(ang)) * dist * CGFloat(s.travel),
                    y: CGFloat(sin(ang)) * dist * CGFloat(s.travel))
            .shadow(color: halo.opacity(0.85), radius: 7)
            .opacity(s.opacity)
    }
}

/// W1235 — 侧栏焦点项(用于折叠/展开判定)。
enum SidebarItem: Hashable {
    case avatar, favorites, search, create, category(HomeCategory)
}

/// W1232 / W1235 — 左侧分类侧栏(HBO 左导航), 可折叠/展开:
///   收起 = 只显图标(窄); 焦点进入侧栏任一项 = 展开显图标+标签(宽)。标签全英文(i18n)。
struct CategorySidebar: View {
    @Binding var selected: HomeCategory?       // W1260 — nil = 不高亮(Home 不默认)
    @ObservedObject var auth: CSSAuth          // W1249 登录态
    var onLoginTap: () -> Void
    var onCreate: () -> Void                   // W1259 创作入口
    @FocusState private var focus: SidebarItem?
    @State private var expanded = false        // W1236 — 防抖: 焦点项间跳动的 nil 闪烁不立即收起

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // logo/头像合体徽章(整套 logo)。未登录点 = 登录; 已登录 = 金球↔头像周期切换。
            Button { if !auth.isSignedIn { onLoginTap() } } label: {
                HStack(spacing: 12) {
                    LogoAvatarBadge(loggedIn: auth.isSignedIn, avatarURL: auth.user?.avatar)
                    if expanded {
                        Text(auth.isSignedIn ? (auth.user?.name ?? auth.user?.email ?? "Account") : "Sign in")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)   // W1252 — 完整显示, 哪怕溢出压到视频上
                            .shadow(color: .black.opacity(0.8), radius: 3)
                        Spacer()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .scaleEffect(focus == .avatar ? 1.06 : 1.0)
            }
            .buttonStyle(FlatButtonStyle())
            .focused($focus, equals: .avatar)
            .padding(.bottom, 10)

            row(icon: "heart.fill", label: "Favorites", item: .favorites) { }
            Spacer().frame(height: 22)
            row(icon: "magnifyingglass", label: "Search", item: .search) { }

            ForEach(HomeCategory.allCases) { cat in
                row(icon: cat.icon, label: cat.title, item: .category(cat), active: selected == cat) {
                    selected = cat
                }
                // W1259 — 「✨ Create」创作入口, 放在 Trilogy 之下(Jing 指定)。
                if cat == .trilogy {
                    row(icon: "wand.and.stars", label: "Create", item: .create) { onCreate() }
                }
            }
            Spacer()
        }
        .padding(.top, 56)
        .padding(.horizontal, expanded ? 24 : 18)
        .frame(width: expanded ? 330 : 130)
        .frame(maxHeight: .infinity)
        // W1245 — Jing: 内容右移对齐 For You 后不再和侧栏打架, 侧栏背景【直接透明】(无底)。
        .onChange(of: focus) { _, newValue in
            if newValue != nil {
                if !expanded { withAnimation(.easeInOut(duration: 0.22)) { expanded = true } }
            } else {
                // 焦点离开: 延迟 0.2s 再收起; 期间焦点回到侧栏任一项就不收(消除项间跳动抖动)。
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    if focus == nil { withAnimation(.easeInOut(duration: 0.22)) { expanded = false } }
                }
            }
        }
    }

    private func row(icon: String, label: LocalizedStringKey, item: SidebarItem,
                     active: Bool = false, action: @escaping () -> Void) -> some View {
        let hot = active || focus == item     // 选中或聚焦
        return Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: hot ? .heavy : .semibold))   // 选中: 图标加粗
                    .frame(width: 34)
                    // W1270 — Jing「左侧菜单请爆」: 改回【聚焦或选中(hot)即爆】, 导航每一项都爆;
                    //   Home 默认仍不爆(启动时没聚焦也没选中)。背后大固定框防裁。
                    .background(
                        EmojiBurstEffect(active: hot, seed: abs(String(describing: item).hashValue),
                                         bigEmojiSize: 64, bigPeriod: 8, smallSize: 16, smallSpread: 120,
                                         smallN: 12, continuousSmall: false, rightBias: true, immediate: true)
                            .frame(width: 180, height: 120).allowsHitTesting(false)
                    )
                if expanded {
                    Text(label)
                        .font(.system(size: 22, weight: hot ? .bold : .medium))   // 选中: 文字加粗
                        .lineLimit(1)
                    Spacer()
                }
            }
            // W1237/1240 — 无白底框: 聚焦/选中都【变品牌绿】, 像 Home; 其余半透白。
            .foregroundStyle(hot ? Color.green : Color.white.opacity(0.72))
            .padding(.vertical, 12).padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(FlatButtonStyle())
        .focused($focus, equals: item)
    }
}

/// W1234c — 魔镜合体徽章(环 + 中心金球 两层, 分离图)。
///  · 未登录 = 完整 logo: 自转的环 + 中心金球。
///  · 登录后 = 环照常自转; 中心【金球 ↔ 用户头像】每 8s 淡入淡出切换。
/// 切换周期 = orbAvatarFlipSeconds(8s, 沉稳)。环自转 14s/圈。
struct LogoAvatarBadge: View {
    var loggedIn: Bool = false                       // W1249 登录后传 true
    var avatarURL: String? = nil                     // W1249 用户头像
    private let orbAvatarFlipSeconds = 8.0

    @State private var showOrb = true
    private let flip = Timer.publish(every: 8, on: .main, in: .common).autoconnect()

    var body: some View {
        // W1250 — 魔镜【永远转】: 用 TimelineView 按绝对时间算角度驱动旋转, 不会被登录后 flip 的
        //   withAnimation 取消(旧 ringAngle repeatForever 动画就是被它掐断 → 登录后停转的真凶)。
        //   金球/环转, 头像保持正立(在旋转层之外)。
        TimelineView(.animation) { ctx in
            let secs = ctx.date.timeIntervalSinceReferenceDate
            let angle = secs.truncatingRemainder(dividingBy: 14.0) / 14.0 * 360.0   // 14s/圈
            ZStack {
                Group {
                    if !loggedIn || showOrb {
                        Image("MirrorFull").resizable().scaledToFit().transition(.opacity)
                    } else {
                        Image("MirrorRing").resizable().scaledToFit().transition(.opacity)
                    }
                }
                .rotationEffect(.degrees(angle))

                // 登录头像态: 环孔放用户头像(正立不转)。
                if loggedIn && !showOrb {
                    Group {
                        if let a = avatarURL, let url = URL(string: a) {
                            AsyncImage(url: url) { img in
                                img.resizable().scaledToFill()
                            } placeholder: {
                                Image(systemName: "person.crop.circle.fill").resizable().scaledToFit()
                                    .foregroundStyle(.white)
                            }
                        } else {
                            Image(systemName: "person.crop.circle.fill").resizable().scaledToFit()
                                .foregroundStyle(.white)
                        }
                    }
                    .frame(width: 58, height: 58)
                    .clipShape(Circle())
                    .transition(.opacity)
                }
            }
            .frame(width: 112, height: 112)
            // W1260 — logo/头像中心定期(~10s)来一次「情绪字幕」: 大 emoji 弹一次 + 小 emoji 烟花一阵, 然后安静。
            .background(
                EmojiBurstEffect(active: true, seed: 42, bigEmojiSize: 92, bigPeriod: 8,
                                 smallSize: 22, smallSpread: 170, smallN: 12, continuousSmall: false, rightBias: true)
                    .frame(width: 200, height: 200).allowsHitTesting(false)
            )
        }
        .onReceive(flip) { _ in
            guard loggedIn else { return }            // 未登录: 永远完整 logo, 不切头像
            withAnimation(.easeInOut(duration: 0.6)) { showOrb.toggle() }
        }
    }
}

/// CSSOS_WAVE_1231 / W1232 — HBO Max 顶部 featured hero。
/// 2.39 大幅背景 + 渐变压暗 + 标题/▶Play/♪时长 + 圆点。方向键 ←→ 手动切, 6s 自动轮播。
/// ▶Play 按钮为焦点目标: Select 即播当前; 在其上 ←→ 切精选, ↓ 进下面 rails。
struct FeaturedHero: View {
    let works: [CSSWork]
    let onSelect: (CSSWork) -> Void

    @State private var index = 0
    @State private var pauseAutoUntil: Date? = nil   // W1241 — 用户干预后暂停自动轮播到此刻
    @FocusState private var playFocused: Bool        // W1244 — Play(=hero)是否聚焦
    @FocusState private var focusedCap: Int?         // W1250 — 当前聚焦的胶囊(遥控器可操作)
    private let timer = Timer.publish(every: 8, on: .main, in: .common).autoconnect()   // W1269 — 对齐 HBO ~8s + 招牌爆 8s 节拍

    // W1244 — 聚焦 hero 时往里散发品牌绿描边辉光(参照桌面 MV 视频框绿边, 向内发光)。
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)   // #00f5a0
    private var focusGlow: some View {
        ZStack {
            Rectangle().stroke(brandGreen, lineWidth: 5)
            Rectangle().stroke(brandGreen.opacity(0.85), lineWidth: 26).blur(radius: 24)
        }
        .allowsHitTesting(false)
    }

    private var current: CSSWork { works[min(index, works.count - 1)] }
    private var n: Int { max(works.count, 1) }
    private func go(_ delta: Int) { withAnimation { index = (index + delta + n) % n } }

    private let capH: CGFloat = 46
    private var capR: CGFloat { capH / 2 }

    // W1250 — 胶囊宪法【凹凸镶嵌】+ 遥控器可操作: 固定顺序, 每段可聚焦。激活段(=index)两端圆(凸);
    //   左侧段凹右、右侧段凹左, 都朝激活咬合。聚焦哪段 → 它即激活(绿)、hero 跟着换。
    private var capsuleTrack: some View {
        HStack(spacing: -capR) {
            ForEach(works.indices, id: \.self) { i in
                capsuleSegment(i)
                    .zIndex(i == index ? Double(works.count + 1) : Double(works.count - abs(i - index)))
            }
        }
        .frame(height: capH)
        .fixedSize(horizontal: true, vertical: false)
    }

    @ViewBuilder
    private func capsuleSegment(_ i: Int) -> some View {
        let active = (i == index)
        let focused = (focusedCap == i)
        let side: ConcavePill.Side = active ? .none : (i < index ? .right : .left)
        Button { onSelect(works[i]) } label: {
            HStack(spacing: 8) {
                thumb(works[i].coverURL)
                    .frame(width: 56, height: 56 / 2.39)          // 2.39 宽银幕缩略图(长扁)
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                    // W1252 — 招牌: 激活胶囊缩略图字心爆 emoji(背景大 + 不断小烟花)。
                    .background(
                        EmojiBurstEffect(active: active, seed: i, bigEmojiSize: 60, bigPeriod: 8,
                                         smallSize: 16, smallSpread: 130, smallN: 12, continuousSmall: false, rightBias: true, immediate: true)
                            .frame(width: 140, height: 90).allowsHitTesting(false)
                    )
                Text(works[i].isCreateCard ? "✨ Create" : (works[i].title ?? "Untitled"))
                    .font(.system(size: 16, weight: active ? .bold : .medium))
                    .lineLimit(1)
            }
            .foregroundStyle(active ? Color.white : Color.white.opacity(0.72))
            .padding(.leading, active ? 16 : capR + 10)           // 凹侧留咬合区
            .padding(.trailing, side == .right ? capR + 10 : 16)
            .frame(height: capH)
            .background(ConcavePill(side: side).fill(active ? Color.green.opacity(0.95) : Color.white.opacity(0.12)))
            .overlay(active ? nil : ConcavePill(side: side).stroke(Color.white.opacity(0.10), lineWidth: 1))
            .overlay(focused ? ConcavePill(side: side).stroke(brandGreen, lineWidth: 3) : nil)  // 聚焦绿描边
            .scaleEffect(focused ? 1.08 : 1.0)
        }
        .buttonStyle(FlatButtonStyle())
        .focused($focusedCap, equals: i)
    }

    @ViewBuilder
    private func thumb(_ cover: String?) -> some View {
        if let c = cover, let url = URL(string: c) {
            AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                placeholder: { Color.white.opacity(0.12) }
        } else {
            Color.white.opacity(0.12)
        }
    }

    // W1245 — For You 用 contentLeading(safe 基准); hero 满铺基准多补偿一个安全区(~92pt)落同一左缘。
    static let contentLeading: CGFloat = 210

    var body: some View {
        // W1245 — 关键: hero 内容【遵守安全区】(和 For You 同基准 → 左缘绝对对齐);
        //   只把背景图/渐变/聚焦绿边放进 .background{} 单独【满铺】(ignoresSafeArea), 图仍通栏。
        // W1246 — Jing: 标题/Play/胶囊全部【水平居中】, 彻底不与左侧侧栏打架。
        VStack(alignment: .center, spacing: 14) {
            Spacer()
            Text(current.isCreateCard ? "Want an MV like this?" : (current.title ?? "Untitled"))
                .font(.system(size: 54, weight: .heavy))
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .shadow(radius: 12)
            HStack(spacing: 24) {
                Button { onSelect(current) } label: {
                    Label(current.isCreateCard ? "Create ✨" : "Play",
                          systemImage: current.isCreateCard ? "wand.and.stars" : "play.fill")
                        .font(.system(size: 24, weight: .bold))
                        .padding(.vertical, 14).padding(.horizontal, 30)
                }
                .buttonStyle(.card)
                .focused($playFocused)
                if !current.durationLabel.isEmpty {
                    Text(current.durationLabel)
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            capsuleTrack
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 60)
        .padding(.top, 60)
        .padding(.bottom, 14)          // W1250 — Jing: 胶囊再下来一半(30→14), 更贴底
        .frame(height: 720, alignment: .bottom)
        .background(alignment: .bottomLeading) {
            ZStack {
                GeometryReader { geo in
                    Group {
                        if current.isCreateCard {
                            // W1259 — 创作卡 hero: 品牌渐变 + 招牌大爆(中央)。
                            ZStack {
                                LinearGradient(colors: [Color(red: 0.02, green: 0.12, blue: 0.08),
                                                        Color(red: 0.0, green: 0.05, blue: 0.04)],
                                               startPoint: .top, endPoint: .bottom)
                                // W1269 — Create 卡无封面: 用一个大 emoji 当封面图(常驻), 招牌爆点缀其上。
                                Text("✨").font(.system(size: 260)).opacity(0.9)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                EmojiBurstEffect(active: true, seed: 99, bigEmojiSize: 220, bigPeriod: 8,
                                                 smallSize: 28, smallSpread: 340, smallN: 14,
                                                 continuousSmall: false).allowsHitTesting(false)
                            }
                        } else if let c = current.coverURL, let url = URL(string: c) {
                            AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                                placeholder: { Color.white.opacity(0.06) }
                        } else {
                            Color.white.opacity(0.06)
                        }
                    }
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                }
                .id(current.id)
                .transition(.opacity)

                LinearGradient(
                    colors: [.black.opacity(0.85), .black.opacity(0.25), .clear],
                    startPoint: .bottomLeading, endPoint: .topTrailing
                )

                if playFocused || focusedCap != nil { focusGlow }   // W1244/1250 — Play 或任一胶囊聚焦 → 绿辉光
            }
            .clipped()
            .ignoresSafeArea(.container, edges: .horizontal)   // 背景满铺通栏
        }
        .ignoresSafeArea(.container, edges: .horizontal)       // W1245 — hero 内容也满铺基准, 与 rails(同满铺)同 leading → 对齐
        .animation(.easeInOut(duration: 0.2), value: playFocused)
        .animation(.easeInOut(duration: 0.6), value: index)
        // W1250 — 遥控器聚焦胶囊 → index 跟随, 并暂停自动轮播 10s(用户干预最高优先级)。
        .onChange(of: focusedCap) { _, f in
            if let f {
                withAnimation(.easeInOut(duration: 0.4)) { index = f }
                pauseAutoUntil = Date().addingTimeInterval(10)
            }
        }
        .onReceive(timer) { _ in
            if focusedCap != nil { return }                           // 用户正在操作胶囊, 不自动切
            if let until = pauseAutoUntil, Date() < until { return }  // 干预后 10s 内不自动切
            pauseAutoUntil = nil
            go(1)
        }
    }
}

/// W1239 — 凹凸镶嵌胶囊形状(胶囊宪法核心)。
///   .none = 两端圆(激活/凸); .left = 右端圆、左端半圆凹; .right = 左端圆、右端半圆凹。
struct ConcavePill: Shape {
    enum Side { case none, left, right }
    var side: Side = .none

    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height, r = h / 2
        var p = Path()
        switch side {
        case .none:
            p.addRoundedRect(in: rect, cornerSize: CGSize(width: r, height: r), style: .circular)
        case .left:
            // 右端凸圆, 左端半圆凹(向 +x 内凹, 嵌邻段圆头)。
            p.move(to: CGPoint(x: 0, y: 0))
            p.addLine(to: CGPoint(x: w - r, y: 0))
            p.addArc(center: CGPoint(x: w - r, y: r), radius: r,
                     startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: false)
            p.addLine(to: CGPoint(x: 0, y: h))
            p.addArc(center: CGPoint(x: 0, y: r), radius: r,
                     startAngle: .degrees(90), endAngle: .degrees(-90), clockwise: true)
            p.closeSubpath()
        case .right:
            // 左端凸圆, 右端半圆凹(向 -x 内凹)。
            p.move(to: CGPoint(x: w, y: 0))
            p.addLine(to: CGPoint(x: r, y: 0))
            p.addArc(center: CGPoint(x: r, y: r), radius: r,
                     startAngle: .degrees(-90), endAngle: .degrees(-270), clockwise: true)
            p.addLine(to: CGPoint(x: w, y: h))
            p.addArc(center: CGPoint(x: w, y: r), radius: r,
                     startAngle: .degrees(90), endAngle: .degrees(270), clockwise: false)
            p.closeSubpath()
        }
        return p
    }
}

/// CSSOS_WAVE_1227 — 一行 rail: 标题 + 横向滚动卡片(tvOS 焦点引擎天然处理左右选中)。
struct RailRow: View {
    let rail: CSSRail
    let onSelect: (CSSWork) -> Void

    var body: some View {
        // W1245 — rail 标题与卡片左缘由父级 contentLeading 提供, 这里不再加 horizontal padding,
        //   与 hero 标题/Play/胶囊对齐; 卡片右侧可横滑出框。
        VStack(alignment: .leading, spacing: 14) {
            Text(rail.title)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white.opacity(0.95))
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 36) {
                    ForEach(rail.works) { w in
                        Button { onSelect(w) } label: { WorkCard(work: w) }
                            .buttonStyle(.card)
                    }
                }
                .padding(.vertical, 24)   // 给焦点放大留出空间, 不被相邻行裁切
                .padding(.trailing, 80)
            }
        }
        .padding(.bottom, 18)
    }
}

struct WorkCard: View {
    let work: CSSWork
    // CSSOS_WAVE_1228 — 画幅铁律: 横屏一律 2.39:1 电影宽银幕, 绝不 16:9。卡片 480 宽 → 201 高。
    private let cardWidth: CGFloat = 480
    private let cinemaRatio: CGFloat = 2.39

    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                if work.isCreateCard {
                    // W1259 — 创作尾卡: 品牌渐变 + 招牌大爆 + ✨Create。
                    LinearGradient(colors: [Color(red: 0.03, green: 0.16, blue: 0.10),
                                            Color(red: 0.0, green: 0.06, blue: 0.05)],
                                   startPoint: .top, endPoint: .bottom)
                    // W1269 — 大 emoji 当封面图(常驻)。
                    Text("✨").font(.system(size: 110)).opacity(0.9)
                    EmojiBurstEffect(active: true, seed: abs(work.id.hashValue) % 97,
                                     bigEmojiSize: 88, bigPeriod: 8, smallSize: 18, smallSpread: 92,
                                     smallN: 11, continuousSmall: false)
                        .allowsHitTesting(false)
                    Label("Create", systemImage: "wand.and.stars")
                        .font(.system(size: 22, weight: .heavy)).foregroundStyle(brandGreen)
                        .shadow(color: .black.opacity(0.6), radius: 4)
                        .offset(y: 54)
                } else if let c = work.coverURL, let url = URL(string: c) {
                    AsyncImage(url: url) { img in
                        img.resizable().scaledToFill()
                    } placeholder: {
                        Color.white.opacity(0.08)
                    }
                } else {
                    Color.white.opacity(0.08)
                }
            }
            .frame(width: cardWidth, height: cardWidth / cinemaRatio)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(work.isCreateCard
                ? RoundedRectangle(cornerRadius: 16).stroke(brandGreen.opacity(0.5), lineWidth: 2) : nil)

            Text(work.isCreateCard ? "Want an MV like this?" : (work.title ?? "Untitled"))
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(work.isCreateCard ? brandGreen : .white)
                .lineLimit(1)
            if !work.isCreateCard && !work.durationLabel.isEmpty {
                Text(work.durationLabel)
                    .font(.system(size: 19, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
            }
        }
        .frame(width: cardWidth, alignment: .leading)
    }
}

/// W1249 — 登录页(设备码流): 显示 cssstudio.app/tv + 6 位码, 后台轮询, 授权后自动关闭。
struct LoginView: View {
    @ObservedObject var auth: CSSAuth
    @Environment(\.dismiss) private var dismiss
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 26) {
                Image("MirrorFull").resizable().scaledToFit().frame(width: 120, height: 120)
                Text("Sign in to cssTV")
                    .font(.system(size: 46, weight: .heavy)).foregroundStyle(.white)
                Text("On your phone or computer, open")
                    .font(.system(size: 24)).foregroundStyle(.white.opacity(0.8))
                Text("cssstudio.app/tv")
                    .font(.system(size: 38, weight: .bold)).foregroundStyle(brandGreen)
                Text("and enter this code:")
                    .font(.system(size: 24)).foregroundStyle(.white.opacity(0.8))
                if let code = auth.deviceUserCode {
                    Text(code)
                        .font(.system(size: 78, weight: .black, design: .monospaced))
                        .tracking(10).foregroundStyle(.white)
                        .padding(.vertical, 10).padding(.horizontal, 40)
                        .background(RoundedRectangle(cornerRadius: 18).stroke(brandGreen.opacity(0.5), lineWidth: 2))
                } else {
                    ProgressView().scaleEffect(1.6).padding(.vertical, 30)
                }
                Button("Cancel") { auth.cancelLogin(); dismiss() }
                    .padding(.top, 18)
            }
            .padding(60)
        }
        .onAppear { Task { await auth.startDeviceLogin() } }
        .onChange(of: auth.isSignedIn) { _, signed in if signed { dismiss() } }
    }
}
