// W1563 — 平台视觉签名 2「随机色凸嵌凹胶囊」的 tvOS 原生实现(套用桌面 data-pill-bar 宪法)。
//   · 激活胶囊 = 两端凸的整胶囊, 用自己的 hue 饱和填充。
//   · 激活右侧的未激活 = 左端凹(凹向左, 朝激活咬合); 激活左侧的未激活 = 右端凹(凹向右)。
//   · 负间距让相邻胶囊【凸嵌凹】互锁(河水流向岛屿)。每枚一个 12 步谱系 hue。
//   · 凸侧 1px hue 描边 = 点击边界预览(宪法硬约束)。复用 ContentView 的 ConcavePill 形状。
// 用于: 导演台(戏路/文明)、数字演员(来源/戏路筛选)等一切分段/筛选条。tvOS 遥控左右天然切焦。

import SwiftUI

struct CSSPillItem: Identifiable, Equatable {
    let id: String
    var label: String
    var icon: String? = nil        // SF Symbol(宪法: 每枚胶囊都应有图标锚点)
}

struct CSSPillBar: View {
    let items: [CSSPillItem]
    @Binding var selected: String
    var locked: Bool = false                 // 锁定态: 只展示不可切换(导演台从某栏进入时锁戏路)
    var mono: Bool = false                   // 单色品牌绿(宪法 mono 选项)
    /* CSSOS_WAVE_2243c — hug: 按【内容宽】排, 胶囊彼此咬紧; 不铺满可用宽度。
     *
     * Jing:「多胶囊之间间隔太大, 应该咬紧。」默认那条(equalWidth)给每枚
     * maxWidth:.infinity 均分整条轨 —— 标签短的胶囊被撑得很宽, 看着就是"间隔太大"。
     * 桌面端那条一直是按内容宽咬紧的, 这里补回同一个观感。
     * 【默认仍是 false】—— 导演台/问道/试戏那几条已经在用均宽版, 不要改它们的现状。 */
    var hug: Bool = false
    /* CSSOS_WAVE_2244 — autofocus: 出现时把焦点【主动落到当前选中那枚】。
     *
     * Jing:「当多胶囊显示的时候, 焦点应该移动到多胶囊上, 这时候左右方向键应该是在多胶囊上工作,
     *        暂时不在媒体框上, 除非退出。」
     * 这条 bar 的焦点是它自己的 @FocusState, 外面设不进去 —— 播放器那边原来把焦点给的是
     * 【选项行】的胶囊, 而单语言作品的选项行根本不渲染, 焦点就落在一个不存在的视图上,
     * 结果留在舞台, ←/→ 继续在快进。所以这个口子是必需的, 不是锦上添花。
     * 【默认 false】—— 别的调用方(导演台/问道/试戏)的焦点行为一律不动。 */
    var autofocus: Bool = false
    var onChange: (String) -> Void = { _ in }

    @FocusState private var focused: String?
    private let h: CGFloat = 52
    private var r: CGFloat { h / 2 }
    // CSSOS_PILL_HUES(12 步谱系)。
    private static let hues: [Double] = [155, 192, 235, 268, 310, 342, 22, 48, 82, 118, 168, 210]
    private func hue(_ i: Int) -> Double { mono ? 155 : Self.hues[i % Self.hues.count] }
    private var activeIndex: Int { items.firstIndex { $0.id == selected } ?? 0 }

    var body: some View {
        content
            .onAppear {
                guard autofocus else { return }
                /* 晚一拍再给: 这一帧胶囊按钮还没进渲染树, 此刻写 focused 等于写给一个
                 * 不存在的视图, 静默失效 —— 表现就是"浮现了但方向键动不了"。 */
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { focused = selected }
            }
    }

    @ViewBuilder private var content: some View {
        if hug {
            /* 按内容宽 —— 没有 GeometryReader, 于是这条 bar 有【固有宽度】,
             * 父级可以直接抱着它收成一条刚好的轨(播放器那条多胶囊要的就是这个)。 */
            row(equalWidth: false).frame(height: h + 14)
        } else {
            equalWidthBody
        }
    }

    private var equalWidthBody: some View {
        // W1578(修正) — 撤掉底轨(它把第一条踩烂了)。只留: 装得下→均宽; 太多→横滑。干净、无外框。
        GeometryReader { geo in
            let fits = estimatedWidth() <= geo.size.width
            Group {
                if fits {
                    row(equalWidth: true)          // 胶囊装得下 → 全部均宽填满
                } else {
                    ScrollView(.horizontal, showsIndicators: false) { row(equalWidth: false) }
                }
            }
            .frame(width: geo.size.width, height: h + 14, alignment: .leading)
        }
        .frame(height: h + 14)
    }

    // 一行胶囊。equalWidth: 每枚 maxWidth:.infinity 均分; 否则各自内容宽(横滑用)。
    @ViewBuilder private func row(equalWidth: Bool) -> some View {
        HStack(spacing: -r) {
            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                pill(idx, item)
                    .frame(maxWidth: equalWidth ? .infinity : nil)
                    // 激活最上; 越靠近激活越上 → 凸头压在邻居凹口上(咬合)。
                    .zIndex(item.id == selected ? 1000 : Double(500 - abs(idx - activeIndex)))
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 6)
    }

    // 粗估内容总宽(判断是否需要横滑): 每字≈13pt + 图标30 + 左右内衬≈48, 负间距 -r 抵扣重叠。
    private func estimatedWidth() -> CGFloat {
        var w: CGFloat = 2 * r
        for it in items { w += CGFloat(it.label.count) * 13 + (it.icon != nil ? 30 : 0) + 48 - r }
        return w
    }

    @ViewBuilder
    private func pill(_ idx: Int, _ item: CSSPillItem) -> some View {
        let isActive = item.id == selected
        let side: ConcavePill.Side = isActive ? .none : (idx > activeIndex ? .left : .right)
        let isFocused = focused == item.id
        let hh = hue(idx) / 360.0
        let fill: Color = isActive
            ? Color(hue: hh, saturation: mono ? 0.85 : 0.80, brightness: 0.50)
            : Color(hue: hh, saturation: 0.26, brightness: isFocused ? 0.30 : 0.17)
        let border = Color(hue: hh, saturation: 0.90, brightness: 0.72)
        Button {
            guard !locked else { return }
            selected = item.id; onChange(item.id)
        } label: {
            HStack(spacing: 10) {
                if let ic = item.icon {
                    Image(systemName: ic).font(.system(size: 20, weight: .semibold))
                }
                Text(item.label)
                    .font(.system(size: 21, weight: isActive ? .heavy : .semibold))
                    .lineLimit(1).fixedSize()
            }
            .foregroundStyle(isActive ? .white : .white.opacity(isFocused ? 0.95 : 0.8))
            .padding(.vertical, 11)
            // 凹侧补 r 内衬(≈桌面 padding-left:36 = 20 咬口 + 16), 文字不被咬进去。
            .padding(.leading, side == .left ? r + 16 : 22)
            .padding(.trailing, side == .right ? r + 16 : 22)
            .frame(height: h)
            .background(ConcavePill(side: side).fill(fill))
            // W1565 — Jing: 聚焦不加粗边框, 保持常规 1px; 聚焦反馈只靠放大(scaleEffect)。
            .overlay(ConcavePill(side: side).stroke(border.opacity(0.5), lineWidth: 1))
            .scaleEffect(isFocused ? 1.06 : 1.0)
            .animation(.easeInOut(duration: 0.18), value: isFocused)
            .animation(.easeInOut(duration: 0.28), value: isActive)
        }
        .buttonStyle(FlatButtonStyle())
        .focused($focused, equals: item.id)
        .disabled(locked && !isActive)
    }
}
