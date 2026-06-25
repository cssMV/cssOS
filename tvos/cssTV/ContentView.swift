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
    var title: String {
        switch self {
        case .all: return "Home"
        case .mv: return "MV"
        case .opera: return "歌剧"
        case .trilogy: return "三部曲"
        case .shortplay: return "短剧"
        case .series: return "电视剧"
        case .film: return "电影"
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
        return f.isEmpty ? [] : [CSSRail(id: category.rawValue, title: category.title, works: f)]
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
                        Text("暂无该类型作品 · Nothing here yet")
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

/// W1232 — 左侧分类侧栏(HBO 左导航)。每项 = 图标 + 标签, 选中高亮; 上下移动切换。
struct CategorySidebar: View {
    @Binding var selected: HomeCategory

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // W1234 — logo 与头像合体: 转动的魔镜 logo ↔ 用户头像周期切换, 点 = 登录(待接)。
            Button { } label: {
                HStack(spacing: 14) {
                    LogoAvatarBadge()
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text("css").font(.system(size: 26, weight: .heavy)).foregroundStyle(.white)
                            Text("TV").font(.system(size: 26, weight: .heavy)).foregroundStyle(.green)
                        }
                        Text("Sign in · 登录").font(.system(size: 17, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    Spacer()
                }
                .padding(.vertical, 10).padding(.horizontal, 12)
                .frame(width: 240, alignment: .leading)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 14)
            Button { } label: {
                HStack(spacing: 16) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 22)).frame(width: 30)
                    Text("收藏 · Favorites").font(.system(size: 22, weight: .medium))
                    Spacer()
                }
                .foregroundStyle(Color.white.opacity(0.85))
                .padding(.vertical, 12).padding(.horizontal, 18)
                .frame(width: 240, alignment: .leading)
            }
            .buttonStyle(.plain)

            // W1234 — 头像/收藏 与 搜索/分类 之间留一个空行。
            Spacer().frame(height: 28)

            // 搜索入口(后端待接, 先占位)。
            Button { } label: {
                HStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 22, weight: .semibold)).frame(width: 30)
                    Text("搜索 · Search").font(.system(size: 22, weight: .medium))
                    Spacer()
                }
                .foregroundStyle(Color.white.opacity(0.85))
                .padding(.vertical, 12).padding(.horizontal, 18)
                .frame(width: 240, alignment: .leading)
            }
            .buttonStyle(.plain)

            ForEach(HomeCategory.allCases) { cat in
                Button { selected = cat } label: {
                    HStack(spacing: 16) {
                        Image(systemName: cat.icon)
                            .font(.system(size: 22, weight: .semibold))
                            .frame(width: 30)
                        Text(cat.title)
                            .font(.system(size: 22, weight: selected == cat ? .bold : .medium))
                        Spacer()
                    }
                    .foregroundStyle(selected == cat ? Color.green : Color.white.opacity(0.85))
                    .padding(.vertical, 12)
                    .padding(.horizontal, 18)
                    .frame(width: 240, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(selected == cat ? Color.white.opacity(0.10) : Color.clear)
                    )
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.top, 60)
        .padding(.horizontal, 28)
        .frame(width: 320)
        .frame(maxHeight: .infinity)
        .background(Color.black)
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
            // 外环: 恒定自转。
            Image("MirrorRing")
                .resizable().scaledToFit()
                .rotationEffect(.degrees(ringAngle))
            // 中心: 金球, 或(登录后)与头像轮换。
            Group {
                if !loggedIn || showOrb {
                    Image("MirrorOrb")
                        .resizable().scaledToFit()
                        .transition(.opacity)
                } else {
                    Image(systemName: "person.crop.circle.fill")
                        .resizable().scaledToFit()
                        .padding(18)
                        .foregroundStyle(.white)
                        .transition(.opacity)
                }
            }
        }
        .frame(width: 76, height: 76)
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

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // 背景: 当前精选封面, 2.39 满宽; 切换淡入淡出。
            Group {
                if let c = current.coverURL, let url = URL(string: c) {
                    AsyncImage(url: url) { img in
                        img.resizable().scaledToFill()
                    } placeholder: { Color.white.opacity(0.06) }
                } else {
                    Color.white.opacity(0.06)
                }
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
                // W1233 — 胶囊指示器(替代圆点, 套胶囊宪法): 每枚 = 缩略图 + 标题, 宽度自适应标题;
                // 激活胶囊两头圆 + 品牌绿填充, 其余半透明。
                HStack(spacing: 12) {
                    ForEach(works.indices, id: \.self) { i in
                        HStack(spacing: 10) {
                            Group {
                                if let c = works[i].coverURL, let url = URL(string: c) {
                                    AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                                        placeholder: { Color.white.opacity(0.12) }
                                } else { Color.white.opacity(0.12) }
                            }
                            .frame(width: 30, height: 30)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                            Text(works[i].title ?? "Untitled")
                                .font(.system(size: 18, weight: i == index ? .bold : .medium))
                                .lineLimit(1)
                                .foregroundStyle(i == index ? Color.white : Color.white.opacity(0.7))
                        }
                        .padding(.vertical, 7)
                        .padding(.horizontal, 14)
                        .background(
                            Capsule().fill(i == index ? Color.green.opacity(0.85) : Color.white.opacity(0.12))
                        )
                        .overlay(
                            Capsule().stroke(Color.white.opacity(i == index ? 0 : 0.18), lineWidth: 1)
                        )
                    }
                }
            }
            .padding(60)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 720)
        .clipped()
        .animation(.easeInOut(duration: 0.6), value: index)
        .onReceive(timer) { _ in go(1) }
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
