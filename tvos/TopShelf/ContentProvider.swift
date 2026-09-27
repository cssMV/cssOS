// CSSOS_WAVE_2222 20260927 — 顶排横幅(Top Shelf)真正接上平台内容。
//
// Jing:「就是那个什么 Top Shelf, 就是用户选中顶排 App 的时候, 顶排 App 上方会出现
//        横幅广告…我们却早早就在 6 社交平台发文说已经实现了。其实一直都还没有实现。」
//
// 确实没有。以前这里是【三张随包的《时间帝国》JPG】—— 跟平台有什么新作品、
// 用户在看什么, 一点关系都没有。真正缺的是三块, 缺一块就全盘不成立:
//   ① 本扩展的 entitlements 是【空的】, 没有 App Group 权限 → 读也读不到。(W2222 已补)
//   ② 本文件写死了三张图, 根本没去读 App 写的缓存。(就是现在改的这份)
//   ③ App 侧缓存里只存封面【URL】, 而扩展进程【没有网络】 → 给 URL 等于没给。
//      (W2222 改成把封面【下成文件】放进 App Group 的共享文件容器)
//
// 现在: App 每次拉完 feed 就把前 10 个作品的封面下成本地文件 + 写一份清单;
// 本扩展零网络读清单, 渲染成 carousel, 每项带 csstv://work/<id> 深链 ——
// 选中即开那一首, 而不是把 App 拉起来扔在首页让用户自己再找一遍。
//
// 拿不到清单时【不再回落到写死的图】: 宁可让顶排什么都不显示, 也不要再拿三张
// 与内容无关的图冒充"已实现" —— 那正是这次要修的事。

import TVServices
import os
import Foundation

private let tslog = Logger(subsystem: "CSSStudio.cssTV.TopShelf", category: "topshelf")
private let appGroupID = "group.CSSStudio.cssTV"

final class ContentProvider: TVTopShelfContentProvider {

    override func loadTopShelfContent() async -> (any TVTopShelfContent)? {
        let entries = readCache()
        tslog.info("loadTopShelfContent: \(entries.count) entries from app group")
        guard !entries.isEmpty else { return nil }   // 没内容就不显示, 不拿假图顶上

        var items: [TVTopShelfCarouselItem] = []
        for e in entries {
            // 图必须是【本地文件】: 扩展没有网络, 远程 URL 在这里是渲染不出来的。
            let fileURL = URL(fileURLWithPath: e.file)
            guard FileManager.default.fileExists(atPath: e.file) else { continue }
            let item = TVTopShelfCarouselItem(identifier: e.id)
            item.title = e.title
            item.setImageURL(fileURL, for: [.screenScale1x, .screenScale2x])
            if let deep = URL(string: "csstv://work/\(e.id)") {
                let action = TVTopShelfAction(url: deep)
                item.displayAction = action
                item.playAction = action     // 选中/播放都落到同一首
            }
            items.append(item)
        }
        guard !items.isEmpty else { return nil }
        tslog.info("returning CAROUSEL with \(items.count) items")
        return TVTopShelfCarouselContent(style: .details, items: items)
    }

    private struct Entry { let id: String; let title: String; let file: String }

    /// 零网络读 App 写进 App Group 的清单。
    private func readCache() -> [Entry] {
        guard let ud = UserDefaults(suiteName: appGroupID),
              let data = ud.data(forKey: "topshelf_items"),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] else { return [] }
        return arr.compactMap { d in
            guard let id = d["id"], let file = d["file"], !id.isEmpty, !file.isEmpty else { return nil }
            return Entry(id: id, title: d["title"] ?? "cssTV", file: file)
        }
    }
}
