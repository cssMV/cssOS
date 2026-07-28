import TVServices
import os
import Foundation

private let tslog = Logger(subsystem: "CSSStudio.cssTV.TopShelf", category: "topshelf")

// 苹果原始模板(TV Top Shelf Extension.xctemplate) + 我们的三张 16:9 图。
// build 18 追加: 「心跳」—— 运行时往扩展自己的容器写时间戳/条数, 供 devicectl 从真机拉回验证
// (真机唯一能确认「扩展到底跑没跑」的手段; 上架前会移除)。
final class ContentProvider: TVTopShelfContentProvider {

    override func loadTopShelfContent() async -> (any TVTopShelfContent)? {
        tslog.info("loadTopShelfContent CALLED")
        heartbeat(stage: "CALLED", items: 0)

        let covers = [
            ("Empire of Time: The Gambit",     "ts-gambit"),
            ("Empire of Time: Constellations", "ts-constellations"),
            ("Empire of Time",                 "ts-feature"),
        ]
        var items: [TVTopShelfCarouselItem] = []
        for (title, res) in covers {
            guard let url = Bundle(for: ContentProvider.self).url(forResource: res, withExtension: "jpg") else { continue }
            let item = TVTopShelfCarouselItem(identifier: res)
            item.title = title
            item.setImageURL(url, for: [.screenScale1x, .screenScale2x])
            items.append(item)
        }
        tslog.info("returning CAROUSEL with \(items.count) items")
        heartbeat(stage: "RETURNING_CAROUSEL", items: items.count)
        return TVTopShelfCarouselContent(style: .details, items: items)
    }

    /// 往扩展容器 Documents 写一行心跳 JSON。devicectl device copy from --domain-type appDataContainer 可拉。
    private func heartbeat(stage: String, items: Int) {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        let line = #"{"stage":"\#(stage)","items":\#(items),"epoch":\#(Date().timeIntervalSince1970)}"#
        try? line.write(to: dir.appendingPathComponent("topshelf-heartbeat.json"), atomically: true, encoding: .utf8)
    }
}
