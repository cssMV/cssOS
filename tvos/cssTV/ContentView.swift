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
    @State private var showSearch = false               // W1277 搜索
    @Namespace private var focusNS
    @Namespace private var sidebarNS   // W1283 — 侧栏独立焦点域(hero 往左 resetFocus 跳回)

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
            Color.clear.ignoresSafeArea()   // W1307 — tvOS 无 systemBackground 常量; 透明=直接显示苹果系统窗口背景色本身

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
                            FeaturedHero(works: featured, focusNS: focusNS, sidebarNS: sidebarNS) { choose($0) }
                            // W1278 — 默认焦点改由 hero 内第一个胶囊承担(.prefersDefaultFocus 在 capsuleSegment i==0)
                        }
                        VStack(alignment: .leading, spacing: 24) {
                            ForEach(rails) { rail in
                                RailRow(rail: rail) { choose($0) }
                            }
                        }
                        // W1342 — Jing: 真通栏。侧栏竖列只到 Today's Picks, 卡片在其下方不会被盖 → 内容贴到最左,
                        //   只留一点安全区(防电视过扫描切边)。
                        .padding(.leading, 60)
                        .padding(.top, 28)
                        .ignoresSafeArea(.container, edges: .horizontal)
                    }
                }
                .padding(.bottom, 80)
            }
            .focusSection()
            .ignoresSafeArea(.container, edges: .top)   // W1308 — Jing: 整个滚动内容顶到屏顶, 不留任何顶部安全区
            // W1245 — ScrollView 正常遵守安全区: hero 内容与 For You 同基准(safe+leading)→ 对齐;
            //   hero 背景图在 .background{} 内单独 ignoresSafeArea 满铺通栏。

            // 侧栏浮层(压在 hero 之上)。
            CategorySidebar(selected: $pickedCategory, auth: auth, onLoginTap: { showLogin = true }, onCreate: { showCreate = true }, onSearch: { showSearch = true }, focusNS: focusNS, sidebarNS: sidebarNS)
                .focusScope(sidebarNS)   // W1283 — 侧栏自成焦点域, 供 hero 往左 resetFocus 跳回
                .focusSection()
        }
        .focusScope(focusNS)
        .ignoresSafeArea(.container, edges: .top)   // W1309 — 第四次: 整个界面延到屏顶, 顶部零安全区(hero 真正顶到头)
        .background(Color.clear.ignoresSafeArea())   // W1307 — 透明=苹果系统窗口背景色
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
        .fullScreenCover(isPresented: $showSearch) {
            SearchView(allWorks: allWorks) { w in showSearch = false; choose(w) }
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
    var bigEmojiSize: CGFloat = 80     // 背景大 emoji
    var bigPeriod: Double = 0          // W1276 — 0 = 选中【爆一次即停】; >0 = 每隔此秒重爆(便宜 1s tick 触发)
    var smallSize: CGFloat = 22
    var smallSpread: CGFloat = 72
    var smallN: Int = 12
    var rightBias: Bool = false
    var leftBias: Bool = false   // W1314 — 向左半边爆(最后一位胶囊用, 与激活的右甩对冲)
    private let pool = CSSFx.petals
    private let bigLife: Double = 1.8
    private let window: Double = 3.6   // 一次爆总时长; 之后【停 TimelineView】→ 空闲零开销(不再每次内存爆)
    @State private var playing = false
    @State private var startT: Double = 0
    @State private var fireSeed: Int = 0
    @State private var fireToken = 0
    @State private var lastFire = -999.0
    private let tick = Timer.publish(every: 1.0, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            if active && playing {
                // 只在一次爆的 3.6s 窗口内跑(7fps); 爆完即停, 空闲不再重绘。
                TimelineView(.periodic(from: .now, by: 0.14)) { ctx in
                    let t = max(0, ctx.date.timeIntervalSinceReferenceDate - startT)
                    ZStack {
                        bigPop(t)
                        ForEach(0..<smallN, id: \.self) { spark($0, t) }
                    }
                    .allowsHitTesting(false)
                }
            }
        }
        .onAppear { if active { fire() } }
        .onChange(of: active) { _, a in if a { fire() } else { playing = false } }
        .onReceive(tick) { _ in
            guard active, bigPeriod > 0 else { return }
            if Date().timeIntervalSinceReferenceDate - lastFire >= bigPeriod { fire() }   // 周期重爆
        }
    }

    private func fire() {
        fireToken += 1
        let tok = fireToken
        startT = Date().timeIntervalSinceReferenceDate
        lastFire = startT
        fireSeed = seed &+ Int(startT.truncatingRemainder(dividingBy: 100000))   // 每次爆重随机
        playing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + window) {
            if fireToken == tok { playing = false }                              // 窗口结束 → 停
        }
    }

    /// 大 emoji: 一次弹入→停留→淡出(bigLife 内), 然后消失。
    @ViewBuilder
    private func bigPop(_ t: Double) -> some View {
        if t < bigLife {
            let s = CSSFx.centerPop(t / bigLife)
            Text(pool[abs(fireSeed) % pool.count])
                .font(.system(size: bigEmojiSize))
                .scaleEffect(CGFloat(s.scale))
                .opacity(s.opacity * 0.82)
        }
    }

    /// 小 emoji: 每颗【时长随机(1.7~3.0s)】→ 错开淡出(不同时淡); 冲出→冻结→原地淡。
    private func spark(_ i: Int, _ t: Double) -> some View {
        let dur = 1.7 + CSSFx.rnd(i, fireSeed) * 1.3
        let p = min(1.0, t / dur)
        let r1 = CSSFx.rnd(i, fireSeed &+ 3)
        let r2 = CSSFx.rnd(i, fireSeed &+ 5)
        let r3 = CSSFx.rnd(i, fireSeed &+ 9)
        let r4 = CSSFx.rnd(i, fireSeed &+ 13)
        let ang: Double = leftBias ? (r1 * 1.55 - 0.775) * .pi + .pi   // 左半边(右半镜像 180°)
            : rightBias ? (r1 * 1.55 - 0.775) * .pi                    // 右半边
            : r1 * 2 * .pi                                             // 全向
        let dist: CGFloat = CGFloat((7 + r2 * 22) / 29) * smallSpread
        let emoji = pool[Int(r3 * Double(pool.count)) % pool.count]
        let fontVar: CGFloat = 0.6 + CGFloat(r4) * 0.9
        let s = CSSFx.sparkOut(p)
        let halo = CSSFx.haloColor(i &+ fireSeed)
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
    var onSearch: () -> Void                   // W1277 搜索入口
    var focusNS: Namespace.ID                   // W1278 — 右键跳 hero 第一个胶囊用
    var sidebarNS: Namespace.ID                 // W1283 — 本侧栏焦点域(hero 往左跳回的默认目标在此)
    @Environment(\.resetFocus) private var resetFocus   // W1278 — 主动把焦点送到默认目标
    @FocusState private var focus: SidebarItem?
    @State private var expanded = false        // W1236 — 防抖: 焦点项间跳动的 nil 闪烁不立即收起
    @State private var avatarTick = 0          // W1274 — 每次聚焦头像 → 立即重爆一次

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // logo/头像合体徽章(整套 logo)。W1274: 未登录点=登录; 已登录点=【切换账号】(登出+重新登录)。
            Button {
                if auth.isSignedIn { Task { await auth.signOut(); onLoginTap() } }
                else { onLoginTap() }
            } label: {
                HStack(spacing: 12) {
                    LogoAvatarBadge(loggedIn: auth.isSignedIn, avatarURL: auth.user?.avatar, burstTick: avatarTick)
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
            .onMoveCommand { handleMove($0) }   // W1275 — 头像也接管方向键(左/右收标签, 上下导航)
            .padding(.bottom, 10)

            row(icon: "heart.fill", label: "Favorites", item: .favorites) { }
            Spacer().frame(height: 22)
            row(icon: "magnifyingglass", label: "Search", item: .search) { onSearch() }

            ForEach(HomeCategory.allCases) { cat in
                row(icon: cat.icon, label: cat.title, item: .category(cat), active: selected == cat) {
                    selected = cat
                }
                .prefersDefaultFocus(cat == .all, in: sidebarNS)   // W1283 — Home = 侧栏默认目标(hero 往左跳回它)
                // W1259 — 「✨ Create」创作入口, 放在 Trilogy 之下(Jing 指定)。
                if cat == .trilogy {
                    row(icon: "wand.and.stars", label: "Create", item: .create) { onCreate() }
                }
            }
            Spacer()
        }
        .padding(.top, 60)   // W1312 — 苹果 tvOS 标准安全区顶部 60(Jing: 96→60)
        .padding(.horizontal, expanded ? 24 : 18)
        .frame(width: expanded ? 360 : 130)   // W1277 — 加宽, 让 Short Drama 等长标签放得下(略压卡片可接受)
        .frame(maxHeight: .infinity)
        // W1245 — Jing: 内容右移对齐 For You 后不再和侧栏打架, 侧栏背景【直接透明】(无底)。
        .onChange(of: focus) { _, newValue in
            if newValue == .avatar { avatarTick += 1 }   // W1274 — 聚焦头像即重爆一次
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
                    // W1274 — 遥控器卡死根治: 菜单改回【选中(active)才爆】, 导航(聚焦)时不再每项 spin 一个
                    //   TimelineView 饿死焦点输入; 选中(按下)才爆。Home 默认不选中→不爆。
                    .background(
                        EmojiBurstEffect(active: active, seed: abs(String(describing: item).hashValue),
                                         bigEmojiSize: 64, bigPeriod: 0, smallSize: 16, smallSpread: 175,
                                         smallN: 18, rightBias: true)   // W1276 — 选中爆一次即停
                            .frame(width: 180, height: 120).allowsHitTesting(false)
                    )
                if expanded {
                    Text(label)
                        .font(.system(size: 22, weight: hot ? .bold : .medium))   // 选中: 文字加粗
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)   // W1277 — 完整显示(如 Short Drama), 不截断
                    Spacer(minLength: 0)
                }
            }
            // W1237/1240 — 无白底框: 聚焦/选中都【变品牌绿】, 像 Home; 其余半透白。
            .foregroundStyle(hot ? Color.green : Color.white.opacity(0.72))
            .padding(.vertical, 12).padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(FlatButtonStyle())
        .focused($focus, equals: item)
        .onMoveCommand { handleMove($0) }   // W1275 — 接管方向键: 左/右收标签, 上下手动导航
    }

    // W1275 — 侧栏可聚焦项的视觉顺序(手动导航用)。
    private var orderedItems: [SidebarItem] {
        var arr: [SidebarItem] = [.avatar, .favorites, .search]
        for cat in HomeCategory.allCases {
            arr.append(.category(cat))
            if cat == .trilogy { arr.append(.create) }
        }
        return arr
    }
    private func moveFocus(_ delta: Int) {
        guard let cur = focus, let idx = orderedItems.firstIndex(of: cur) else { return }
        let ni = idx + delta
        if ni >= 0 && ni < orderedItems.count { focus = orderedItems[ni] }
    }
    // W1275 — Jing 铁律: 左侧菜单【无论往左还是往右, 文字标签都收起】; 往右还离开侧栏进内容。
    private func handleMove(_ dir: MoveCommandDirection) {
        switch dir {
        case .up:    moveFocus(-1)
        case .down:  moveFocus(1)
        case .left:  withAnimation(.easeInOut(duration: 0.22)) { expanded = false }
        case .right:
            withAnimation(.easeInOut(duration: 0.22)) { expanded = false }
            focus = nil
            resetFocus(in: focusNS)   // W1278 — 主动把焦点送到 hero 第一个胶囊(光 focus=nil 跳不过去)
        @unknown default: break
        }
    }
}

/// W1234c — 魔镜合体徽章(环 + 中心金球 两层, 分离图)。
///  · 未登录 = 完整 logo: 自转的环 + 中心金球。
///  · 登录后 = 环照常自转; 中心【金球 ↔ 用户头像】每 8s 淡入淡出切换。
/// 切换周期 = orbAvatarFlipSeconds(8s, 沉稳)。环自转 14s/圈。
struct LogoAvatarBadge: View {
    var loggedIn: Bool = false                       // W1249 登录后传 true
    var avatarURL: String? = nil                     // W1249 用户头像
    var burstTick: Int = 0                           // W1274 — 变化即重爆(聚焦头像时)
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
                EmojiBurstEffect(active: true, seed: 42, bigEmojiSize: 92, bigPeriod: 12,
                                 smallSize: 22, smallSpread: 240, smallN: 18, rightBias: true)   // W1276 周期 12s
                    .frame(width: 200, height: 200).allowsHitTesting(false)
                    .id(burstTick)   // W1274 — 聚焦头像 tick 变 → 重建 → 立即爆一次
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
    var focusNS: Namespace.ID                         // W1278 — 第一个胶囊 = 焦点域默认目标(侧栏右键跳来)
    var sidebarNS: Namespace.ID                       // W1283 — 往左跳回侧栏用
    let onSelect: (CSSWork) -> Void

    @Environment(\.resetFocus) private var resetFocus // W1283 — 往左把焦点送回侧栏
    @State private var index = 0
    @State private var pauseAutoUntil: Date? = nil   // W1241 — 用户干预后暂停自动轮播到此刻
    @FocusState private var playFocused: Bool        // W1244 — Play(=hero)是否聚焦
    @FocusState private var focusedCap: Int?         // W1250 — 当前聚焦的胶囊(遥控器可操作)
    @FocusState private var bridgeFocused: Bool      // W1283 — 胶囊左侧隐形桥: 落焦即跳回侧栏
    @State private var breathe = false               // W1284 — 下一个胶囊边框呼吸
    @State private var didInitFocus = false           // W1347 — 启动只强制一次初始焦点(绝不反复踢侧栏)
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
        HStack(spacing: 0) {
            // W1283 — 胶囊最左侧隐形"桥": 从第一个胶囊按左 → 落到它 → 立刻把焦点送回侧栏 Home。
            //   不打断胶囊本身的左右/上下导航(桥只是它们的左邻居)。
            Color.clear.frame(width: 1, height: capH)
                .focusable()
                .focused($bridgeFocused)
                .onChange(of: bridgeFocused) { _, f in if f { resetFocus(in: sidebarNS) } }
            HStack(spacing: -capR) {
                // W1284 — 旋转胶囊宪法: 激活恒在第一位; 其余按原序排在右; 轮换时滑动重排(下一个边框呼吸)。
                ForEach(rotatedOrder, id: \.self) { i in
                    capsuleSegment(i)
                        .zIndex(i == index ? Double(works.count + 1) : Double(works.count - positionInOrder(i)))
                }
            }
            .animation(.easeInOut(duration: 0.5), value: index)   // 重排滑动
        }
        .frame(height: capH)
        .fixedSize(horizontal: true, vertical: false)
    }

    // W1284 — 显示顺序: 把 index(激活)转到第一位, 其后按 work 原序绕回。
    private var rotatedOrder: [Int] { (0..<n).map { (index + $0) % n } }
    private func positionInOrder(_ i: Int) -> Int { ((i - index) % n + n) % n }   // 0=第一位
    /// 下一个等待者(第二位): 边框呼吸提示"时间到我上位"。
    private func isNextWaiting(_ i: Int) -> Bool { n > 1 && positionInOrder(i) == 1 }

    @ViewBuilder
    private func capsuleSegment(_ i: Int) -> some View {
        let active = (i == index)
        let focused = (focusedCap == i)
        // W1284 — 激活恒在第一位, 其余全在它右侧 → 一律凹左(朝左咬合)。
        let side: ConcavePill.Side = active ? .none : .left
        let waiting = isNextWaiting(i)   // 第二位: 边框呼吸
        Button { onSelect(works[i]) } label: {
            capsuleLabel(i, active: active, side: side, waiting: waiting, focused: focused)
        }
        .buttonStyle(FlatButtonStyle())
        .focused($focusedCap, equals: i)
        .prefersDefaultFocus(i == 0, in: focusNS)   // W1278 — 第一个胶囊作 hero 默认焦点(侧栏右键 resetFocus 跳此)
    }

    // W1284 — 拆出胶囊内容(给编译器减负, 避免单表达式类型检查超时)。
    @ViewBuilder
    private func capsuleLabel(_ i: Int, active: Bool, side: ConcavePill.Side, waiting: Bool, focused: Bool) -> some View {
        // W1285 — 下一个等待者改【内呼吸】: 仅内部填充色在淡白↔淡绿之间轻微脉动, 不加粗边框。
        let breathingFill: Color = active
            ? Color.green.opacity(0.95)
            : (waiting && !focused ? brandGreen.opacity(breathe ? 0.26 : 0.10) : Color.white.opacity(0.12))
        HStack(spacing: 8) {
            thumb(works[i].coverURL)
                .frame(width: 56, height: 56 / 2.39)
                .clipShape(RoundedRectangle(cornerRadius: 5))
                .background(
                    // W1310(重加 W1289): 激活(第一位)的小 emoji 特别向右、铺满整条轨道(像甩向最后一位的余晖); 其余常规。
                    EmojiBurstEffect(active: active, seed: i, bigEmojiSize: 60,
                                     bigPeriod: works[i].isCreateCard ? 12 : 0,
                                     smallSize: 16,
                                     smallSpread: active ? 560 : 185,
                                     smallN: active ? 30 : 18,
                                     rightBias: true)
                        .frame(width: 140, height: 90).allowsHitTesting(false)
                )
                .background(
                    // W1313 — Jing: 被甩到【最后一位】的胶囊, 到位后再补几颗小 emoji → 错觉"从第一位带过来的余晖落在这"。
                    EmojiBurstEffect(active: n > 1 && positionInOrder(i) == n - 1,
                                     seed: i &+ 777, bigEmojiSize: 0, bigPeriod: 0,
                                     smallSize: 14, smallSpread: 95, smallN: 8, leftBias: true)   // W1314 — 反向左爆, 与右甩对冲
                        .frame(width: 120, height: 80).allowsHitTesting(false)
                )
            Text(works[i].isCreateCard ? "✨ Create" : (works[i].title ?? "Untitled"))
                .font(.system(size: 16, weight: active ? .bold : .medium))
                .lineLimit(1)
        }
        .foregroundStyle(active ? Color.white : Color.white.opacity(0.72))
        .padding(.leading, active ? 16 : capR + 10)
        .padding(.trailing, side == .right ? capR + 10 : 16)
        .frame(height: capH)
        .background(ConcavePill(side: side).fill(breathingFill))   // W1285 — 内呼吸(填充色微脉动)
        .overlay(ConcavePill(side: side).stroke(active ? Color.clear : Color.white.opacity(0.10), lineWidth: active ? 0 : 1))
        .overlay(ConcavePill(side: side).stroke(focused ? brandGreen : Color.clear, lineWidth: focused ? 3 : 0))  // 聚焦
        .scaleEffect(focused ? 1.08 : 1.0)
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
        .frame(height: UIScreen.main.bounds.width / 2.39, alignment: .bottom)   // W1311 — 画幅铁律: 严格 2.39 超宽屏(满宽到顶)
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
                                // W1272 — Jing「Create hero 卡为何要等」: 改 immediate, 轮到它当 hero 时立即爆(和它的胶囊同时), 不再按 seed 延后。
                                EmojiBurstEffect(active: true, seed: 99, bigEmojiSize: 220, bigPeriod: 12,
                                                 smallSize: 28, smallSpread: 470, smallN: 20).allowsHitTesting(false)   // W1276 周期 12s
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
            .ignoresSafeArea(.container, edges: [.horizontal, .top])   // W1306 — 大图顶到屏顶(含上边), 不留顶部跑马场
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
        // W1282 — Jing: 进入平台默认焦点 = 第一个胶囊(按确认即播放), 绝不落 logo(一按就退出/登录)。
        .defaultFocus($focusedCap, 0)
        // W1284 — 启动边框呼吸(下一个等待者), 1.1s 一呼一吸。
        .onAppear {
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { breathe = true }
            // W1347 — Jing: 进入平台默认焦点必须落在第一个激活胶囊(确认即播放), 绝不落侧栏 logo(一按就退出登录)。
            //   .defaultFocus 在多焦点域(侧栏 + hero)下被 logo 抢; 这里启动一次性强制矫正, didInitFocus 守护只跑一次, 不反复踢。
            if !didInitFocus {
                didInitFocus = true
                // W1349 — 真机开机焦点引擎就绪有时序: 单次 async 常被侧栏(leftmost)抢先 → 焦点落侧栏 →
                //   侧栏一被聚焦就展开标签。多档重试(0/0.25/0.5/0.8s)扛过时序, 把焦点稳稳钉到 hero 第一个胶囊,
                //   侧栏从而保持收起=只图标。didInitFocus 守护整体只跑一次。
                for delay in [0.0, 0.25, 0.5, 0.8] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                        focusedCap = 0
                        resetFocus(in: focusNS)
                    }
                }
            }
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
            // W1274 — 栏目标题带图标。
            Label(rail.title, systemImage: rail.icon)
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

    private var coverH: CGFloat { cardWidth / cinemaRatio }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // W1326 — 多部作品: 主封面后面垫两张错位卡 = 叠卡(一眼看出是多部) + 右上类型徽章。
            ZStack(alignment: .topTrailing) {
                if work.isMultiPart {
                    RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.12))
                        .frame(width: cardWidth, height: coverH).offset(x: 16, y: -16)
                    RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.20))
                        .frame(width: cardWidth, height: coverH).offset(x: 8, y: -8)
                }
            ZStack {
                if work.isCreateCard {
                    // W1259 — 创作尾卡: 品牌渐变 + 招牌大爆 + ✨Create。
                    LinearGradient(colors: [Color(red: 0.03, green: 0.16, blue: 0.10),
                                            Color(red: 0.0, green: 0.06, blue: 0.05)],
                                   startPoint: .top, endPoint: .bottom)
                    // W1269 — 大 emoji 当封面图(常驻)。
                    Text("✨").font(.system(size: 110)).opacity(0.9)
                    EmojiBurstEffect(active: true, seed: abs(work.id.hashValue) % 97,
                                     bigEmojiSize: 88, bigPeriod: 12, smallSize: 18, smallSpread: 135,
                                     smallN: 16)   // W1276 周期 12s
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
            .frame(width: cardWidth, height: coverH)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(work.isCreateCard
                ? RoundedRectangle(cornerRadius: 16).stroke(brandGreen.opacity(0.5), lineWidth: 2) : nil)

                // W1326 — 右上类型徽章(多部才显)。
                if work.isMultiPart {
                    Text(work.typeBadge)
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Capsule().fill(brandGreen.opacity(0.92)))
                        .padding(10)
                }
            }
            .frame(width: cardWidth, height: coverH)

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
