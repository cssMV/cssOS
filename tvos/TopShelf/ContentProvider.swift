// W1361 — cssTV Top Shelf 内容扩展(HBO/Apple 式): Apple TV 主屏焦点划到 cssTV 图标时,
//   顶部展示我们的作品轮播。独立扩展进程, 自带拉市场 API, 不依赖主 app 文件。
import TVServices
import Foundation

final class ContentProvider: TVTopShelfContentProvider {

    override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
        Task {
            // W1362 — 搬 App 内 hero: 改 carousel 大幅轮播(一张大图 + 标题/风格, 自动切换),
            //   而非一排小封面。top shelf 版式由系统画, 胶囊无法搬入(系统决定 chrome)。
            let works = Array((await fetchWorks()).prefix(8))   // 一次性快照 ~8 首精选(top shelf 无滑动懒加载接口)
            guard !works.isEmpty else { completionHandler(nil); return }

            let items: [TVTopShelfCarouselItem] = works.map { w in
                let item = TVTopShelfCarouselItem(identifier: w.id)
                item.title = w.title
                if let s = w.style, !s.isEmpty { item.summary = s }   // 风格当简介
                // carousel item 大图为系统固定宽幅(无 imageShape, 自动 16:9 大幅)。
                if let c = w.cover, let url = URL(string: c) {
                    item.setImageURL(url, for: [.screenScale1x, .screenScale2x])
                }
                if let deep = URL(string: "csstv://play/\(w.id)") {
                    item.displayAction = TVTopShelfAction(url: deep)
                    item.playAction = TVTopShelfAction(url: deep)
                }
                return item
            }

            let content = TVTopShelfCarouselContent(style: .details, items: items)
            completionHandler(content)
        }
    }

    // 极简模型 + 拉取(JSONSerialization, 零依赖)。
    private struct W { let id: String; let title: String?; let cover: String?; let style: String? }

    private func fetchWorks() async -> [W] {
        guard let url = URL(string: "https://cssstudio.app/api/works/market?limit=12") else { return [] }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return [] }
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        let works = ((root["data"] as? [String: Any])?["works"] as? [[String: Any]])
            ?? (root["works"] as? [[String: Any]]) ?? []
        return works.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return W(id: id, title: d["title"] as? String, cover: d["cover_image"] as? String, style: d["style"] as? String)
        }
    }
}
