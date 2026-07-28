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
    var onChange: (String) -> Void = { _ in }

    @FocusState private var focused: String?
    private let h: CGFloat = 52
    private var r: CGFloat { h / 2 }
    // CSSOS_PILL_HUES(12 步谱系)。
    private static let hues: [Double] = [155, 192, 235, 268, 310, 342, 22, 48, 82, 118, 168, 210]
    private func hue(_ i: Int) -> Double { mono ? 155 : Self.hues[i % Self.hues.count] }
    private var activeIndex: Int { items.firstIndex { $0.id == selected } ?? 0 }

    var body: some View {
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
