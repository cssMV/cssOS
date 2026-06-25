// CSSOS_WAVE_1172 / W1227 / W1231 / W1232 — 首页: HBO Max 风格。
// 左侧 = 分类侧栏(Home/MV/歌剧/三部曲/短剧/电视剧/电影); 右侧主区:
//   顶部 = featured hero(~5 部精选, 2.39 大幅, 方向键左右可切 + 6s 自动轮播 + 圆点);
//   下面 = 多行 rails。选一首 → 进影院播放。

import SwiftUI
import Combine

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
    @State private var category: HomeCategory = .all
    @State private var loading = true
    @State private var selected: CSSWork?
    @Namespace private var focusNS

    /// 当前分类下的作品。
    private func works(for cat: HomeCategory) -> [CSSWork] {
        if cat == .all { return allWorks }
        return allWorks.filter { cat.matches.contains(($0.workType ?? "").lowercased()) }
    }
    private var featured: [CSSWork] { Array(works(for: category).prefix(5)) }
    private var rails: [CSSRail] {
        if category == .all { return CSSBackend.buildRails(allWorks) }
        let f = works(for: category)
        return f.isEmpty ? [] : [CSSRail(id: category.rawValue, title: category.railTitle, works: f)]
    }

    var body: some View {
        HStack(spacing: 0) {
            CategorySidebar(selected: $category)
                .focusSection()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if loading {
                        ProgressView().scaleEffect(1.6).frame(maxWidth: .infinity, minHeight: 500)
                    } else if featured.isEmpty && rails.isEmpty {
                        Text("Nothing here yet")
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity, minHeight: 500)
                    } else {
                        if !featured.isEmpty {
                            FeaturedHero(works: featured) { w in
                                Task { selected = await CSSBackend.hydrate(w) }
                            }
                            .prefersDefaultFocus(in: focusNS)
                        }
                        ForEach(rails) { rail in
                            RailRow(rail: rail) { w in
                                Task { selected = await CSSBackend.hydrate(w) }
                            }
                        }
                    }
                }
                .padding(.bottom, 80)
            }
            .focusSection()
        }
        .focusScope(focusNS)
        .background(Color.black.ignoresSafeArea())
        .fullScreenCover(item: $selected) { w in
            PlayerView(work: w)
        }
        .task {
            allWorks = await CSSBackend.fetchFeed()
            loading = false
        }
    }
}

/// W1235 — 侧栏焦点项(用于折叠/展开判定)。
enum SidebarItem: Hashable {
    case avatar, favorites, search, category(HomeCategory)
}

/// W1232 / W1235 — 左侧分类侧栏(HBO 左导航), 可折叠/展开:
///   收起 = 只显图标(窄); 焦点进入侧栏任一项 = 展开显图标+标签(宽)。标签全英文(i18n)。
struct CategorySidebar: View {
    @Binding var selected: HomeCategory
    @FocusState private var focus: SidebarItem?
    @State private var expanded = false        // W1236 — 防抖: 焦点项间跳动的 nil 闪烁不立即收起

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // logo/头像合体徽章(整套 logo)。点 = 登录(待接)。
            Button { } label: {
                HStack { LogoAvatarBadge(); if expanded { Spacer() } }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .focused($focus, equals: .avatar)
            .padding(.bottom, 10)

            row(icon: "heart.fill", label: "Favorites", item: .favorites) { }
            Spacer().frame(height: 22)
            row(icon: "magnifyingglass", label: "Search", item: .search) { }

            ForEach(HomeCategory.allCases) { cat in
                row(icon: cat.icon, label: cat.title, item: .category(cat), active: selected == cat) {
                    selected = cat
                }
            }
            Spacer()
        }
        .padding(.top, 56)
        .padding(.horizontal, expanded ? 24 : 18)
        .frame(width: expanded ? 330 : 130)
        .frame(maxHeight: .infinity)
        .background(Color.black.opacity(0.98))
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

    @ViewBuilder
    private func row(icon: String, label: LocalizedStringKey, item: SidebarItem,
                     active: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .semibold))
                    .frame(width: 34)
                if expanded {
                    Text(label)
                        .font(.system(size: 22, weight: active ? .bold : .medium))
                        .lineLimit(1)
                    Spacer()
                }
            }
            // W1237 — 取消白底框: 聚焦/选中都【变颜色】(品牌绿), 像 Home。其余半透白。
            .foregroundStyle((active || focus == item) ? Color.green : Color.white.opacity(0.72))
            .padding(.vertical, 12).padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .focused($focus, equals: item)
    }
}

/// W1234c — 魔镜合体徽章(环 + 中心金球 两层, 分离图)。
///  · 未登录 = 完整 logo: 自转的环 + 中心金球。
///  · 登录后 = 环照常自转; 中心【金球 ↔ 用户头像】每 8s 淡入淡出切换。
/// 切换周期 = orbAvatarFlipSeconds(8s, 沉稳)。环自转 14s/圈。
struct LogoAvatarBadge: View {
    var loggedIn: Bool = false                       // 第③步接登录后传 true
    private let orbAvatarFlipSeconds = 8.0

    @State private var ringAngle: Double = 0
    @State private var showOrb = true
    private let flip = Timer.publish(every: 8, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            // 整套 logo 自转: 未登录(或金球态)= MirrorFull(环+金球); 登录后头像态 = 只 MirrorRing。
            Group {
                if !loggedIn || showOrb {
                    Image("MirrorFull").resizable().scaledToFit().transition(.opacity)
                } else {
                    Image("MirrorRing").resizable().scaledToFit().transition(.opacity)
                }
            }
            .rotationEffect(.degrees(ringAngle))

            // 中心叠加(不随环转, 保持正): 金球态印 cssTV; 头像态放用户头像(嵌环孔)。
            if !loggedIn || showOrb {
                HStack(spacing: 1) {
                    Text("css").foregroundStyle(Color(red: 0.05, green: 0.12, blue: 0.07))
                    Text("TV").foregroundStyle(Color(red: 0.0, green: 0.32, blue: 0.18))
                }
                .font(.system(size: 16, weight: .heavy))
                .transition(.opacity)
            } else {
                Image(systemName: "person.crop.circle.fill")
                    .resizable().scaledToFit()
                    .frame(width: 44, height: 44)
                    .foregroundStyle(.white)
                    .transition(.opacity)
            }
        }
        .frame(width: 92, height: 92)
        .onAppear {
            withAnimation(.linear(duration: 14).repeatForever(autoreverses: false)) { ringAngle = 360 }
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
    private let timer = Timer.publish(every: 6, on: .main, in: .common).autoconnect()

    private var current: CSSWork { works[min(index, works.count - 1)] }
    private var n: Int { max(works.count, 1) }
    private func go(_ delta: Int) { withAnimation { index = (index + delta + n) % n } }

    private let capH: CGFloat = 46
    private var capR: CGFloat { capH / 2 }

    // 胶囊宪法【凹凸镶嵌】: 激活段两端圆(凸); 未激活段朝激活方向那端【半圆凹】, 与邻段圆头咬合。
    //   位置序不变(不重排); 负间距 = 凹凸互嵌; 越靠近激活 zIndex 越高(凸盖凹)。
    private var capsuleTrack: some View {
        HStack(spacing: -capR) {
            ForEach(works.indices, id: \.self) { i in
                capsuleSegment(i)
                    .zIndex(Double(works.count - abs(i - index)))
            }
        }
        .frame(height: capH)
        .fixedSize(horizontal: true, vertical: false)
    }

    @ViewBuilder
    private func capsuleSegment(_ i: Int) -> some View {
        let active = (i == index)
        // 未激活: 凹在【朝向激活】的那侧。激活左边的 → 凹右; 激活右边的 → 凹左。
        let side: ConcavePill.Side = active ? .none : (i < index ? .right : .left)
        HStack(spacing: 7) {
            thumb(works[i].coverURL)
                .frame(width: 26, height: 26)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            Text(works[i].title ?? "Untitled")
                .font(.system(size: 16, weight: active ? .bold : .medium))
                .lineLimit(1)
        }
        .foregroundStyle(active ? Color.white : Color.white.opacity(0.72))
        // 凹侧多留 padding 给咬合区(凹侧 ~ r+8, 凸侧 16)。
        .padding(.leading, side == .left ? capR + 8 : 16)
        .padding(.trailing, side == .right ? capR + 8 : 16)
        .frame(height: capH)
        .background(ConcavePill(side: side).fill(active ? Color.green.opacity(0.95) : Color.white.opacity(0.12)))
        .overlay(ConcavePill(side: side).stroke(Color.white.opacity(0.38), lineWidth: 1.5))
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

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // W1236 — hero 框死成固定尺寸: 用 Color 占位定尺寸, 封面只在框内 overlay+裁切。
            //   根因(Jing): 封面图有 2.39 有 16:9, 之前 AsyncImage 直接参与布局 → 不同比例撑得
            //   hero 忽大忽小"动来动去"。Color 锚定尺寸后, 任何比例的图都只裁切填充, 框恒定。
            GeometryReader { geo in
                Group {
                    if let c = current.coverURL, let url = URL(string: c) {
                        AsyncImage(url: url) { img in
                            img.resizable().scaledToFill()
                        } placeholder: { Color.white.opacity(0.06) }
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

            VStack(alignment: .leading, spacing: 18) {
                Spacer()
                Text(current.title ?? "Untitled")
                    .font(.system(size: 56, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .shadow(radius: 12)
                HStack(spacing: 24) {
                    // ▶Play: 焦点目标。Select 播; 其上 ←→ 切精选。
                    Button { onSelect(current) } label: {
                        Label("Play", systemImage: "play.fill")
                            .font(.system(size: 24, weight: .bold))
                            .padding(.vertical, 14).padding(.horizontal, 30)
                    }
                    .buttonStyle(.card)
                    .onMoveCommand { dir in
                        if dir == .left { go(-1) } else if dir == .right { go(1) }
                    }
                    if !current.durationLabel.isEmpty {
                        Text(current.durationLabel)
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                }
                capsuleTrack    // W1238 — 胶囊宪法全 4 条
            }
            .padding(60)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 720)
        .clipped()
        .ignoresSafeArea(.container, edges: .horizontal)   // W1239 — 满铺到边, 和 For You 一样宽(消右侧黑缝)
        .animation(.easeInOut(duration: 0.6), value: index)
        .onReceive(timer) { _ in go(1) }
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
        VStack(alignment: .leading, spacing: 14) {
            Text(rail.title)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white.opacity(0.95))
                .padding(.horizontal, 80)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 36) {
                    ForEach(rail.works) { w in
                        Button { onSelect(w) } label: { WorkCard(work: w) }
                            .buttonStyle(.card)
                    }
                }
                .padding(.horizontal, 80)
                .padding(.vertical, 24)   // 给焦点放大留出空间, 不被相邻行裁切
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

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                if let c = work.coverURL, let url = URL(string: c) {
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

            Text(work.title ?? "Untitled")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
            if !work.durationLabel.isEmpty {
                Text(work.durationLabel)
                    .font(.system(size: 19, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
            }
        }
        .frame(width: cardWidth, alignment: .leading)
    }
}
