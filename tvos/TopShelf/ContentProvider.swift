// W1361/W1566 — cssTV Top Shelf 内容扩展(HBO/Apple 式): Apple TV 主屏焦点划到 cssTV 图标(顶行)时,
//   顶部展示【与 App 内 hero 同源】的精选大幅轮播。独立扩展进程, 自带拉市场 API, 不依赖主 app 文件。
// W1566 — Jing「用 hero 做 Top Shelf」: 取市场首屏精选(= hero 的 featured 同一份数据、同一顺序),
//   只保留【有封面】的作品(无图的 carousel item 会让整条 shelf 不渲染), 加拉取超时(Top Shelf 有时限预算)。
import TVServices
import Foundation

final class ContentProvider: TVTopShelfContentProvider {

    override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
        Task {
            // hero 同源: 市场首屏精选(后端原生序=置顶/活媒体在前), 只取【有封面】的前 8 首做大幅轮播。
            let works = (await fetchWorks()).filter { ($0.cover ?? "").isEmpty == false }.prefix(8)
            guard !works.isEmpty else { completionHandler(nil); return }   // 无内容→不渲染(系统回退静态 Top Shelf 图)

            let items: [TVTopShelfCarouselItem] = works.map { w in
                let item = TVTopShelfCarouselItem(identifier: w.id)
                item.title = w.title
                if let s = w.style, !s.isEmpty { item.summary = s }        // 风格当简介
                if let c = w.cover, let url = URL(string: c) {
                    item.setImageURL(url, for: [.screenScale1x, .screenScale2x])   // 大幅宽银幕封面(与 hero 同图)
                }
                if let deep = URL(string: "csstv://play/\(w.id)") {
                    item.displayAction = TVTopShelfAction(url: deep)
                    item.playAction = TVTopShelfAction(url: deep)
                }
                return item
            }

            // .details = 大图 + 标题/简介的英雄式轮播(与 App 内 hero 观感一致)。
            completionHandler(TVTopShelfCarouselContent(style: .details, items: items))
        }
    }

    // 极简模型 + 拉取(JSONSerialization, 零依赖)。
    private struct W { let id: String; let title: String?; let cover: String?; let style: String? }

    private func fetchWorks() async -> [W] {
        guard let url = URL(string: "https://cssstudio.app/api/works/market?limit=12") else { return [] }
        // W1566 — Top Shelf 加载有时限预算: 6s 超时, 免慢网把整条 shelf 拖到不显示。
        var req = URLRequest(url: url)
        req.timeoutInterval = 6
        req.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, _) = try? await URLSession.shared.data(for: req) else { return [] }
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        let works = ((root["data"] as? [String: Any])?["works"] as? [[String: Any]])
            ?? (root["works"] as? [[String: Any]]) ?? []
        return works.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return W(id: id, title: d["title"] as? String, cover: d["cover_image"] as? String, style: d["style"] as? String)
        }
    }
}
