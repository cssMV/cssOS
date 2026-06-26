// W1361 — cssTV Top Shelf 内容扩展(HBO/Apple 式): Apple TV 主屏焦点划到 cssTV 图标时,
//   顶部展示我们的作品轮播。独立扩展进程, 自带拉市场 API, 不依赖主 app 文件。
import TVServices
import Foundation

final class ContentProvider: TVTopShelfContentProvider {

    override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
        Task {
            let works = await fetchWorks()
            guard !works.isEmpty else { completionHandler(nil); return }

            let items: [TVTopShelfSectionedItem] = works.map { w in
                let item = TVTopShelfSectionedItem(identifier: w.id)
                item.title = w.title
                item.imageShape = .hdtv   // 16:9 大幅(影院感)
                if let c = w.cover, let url = URL(string: c) {
                    item.setImageURL(url, for: [.screenScale1x, .screenScale2x])
                }
                // 点击 → 深链打开 app 直接播该作品(主 app 注册了 csstv:// scheme 并处理)。
                if let deep = URL(string: "csstv://play/\(w.id)") {
                    item.displayAction = TVTopShelfAction(url: deep)
                    item.playAction = TVTopShelfAction(url: deep)
                }
                return item
            }

            let collection = TVTopShelfItemCollection(items: items)
            collection.title = "cssOS — For You"
            let content = TVTopShelfSectionedContent(sections: [collection])
            completionHandler(content)
        }
    }

    // 极简模型 + 拉取(JSONSerialization, 零依赖)。
    private struct W { let id: String; let title: String?; let cover: String? }

    private func fetchWorks() async -> [W] {
        guard let url = URL(string: "https://cssstudio.app/api/works/market?limit=12") else { return [] }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return [] }
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        let works = ((root["data"] as? [String: Any])?["works"] as? [[String: Any]])
            ?? (root["works"] as? [[String: Any]]) ?? []
        return works.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return W(id: id, title: d["title"] as? String, cover: d["cover_image"] as? String)
        }
    }
}
