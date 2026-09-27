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

    /* CSSOS_WAVE_2227 20260927 — 改成【completion-handler 形式】。
     *
     * 原来重写的是 async 变体 `loadTopShelfContent() async -> (any TVTopShelfContent)?`。
     * 而 SDK 头文件里真正的方法是:
     *     - (void)loadTopShelfContentWithCompletionHandler:(void (^)(id<TVTopShelfContent>))h;
     * 系统是按这个【ObjC 选择器】来调的。实测证据: 扩展被 launchd 拉起(pid 可见)、
     * 6 毫秒后终止、我们的代码【一行日志都没有】、心跳文件也从没出现 —— 方法压根没被调到。
     *
     * 而头文件里这句正好对上我们看到的现象:
     *   "If the completion handler is not called in a timely manner or is called with
     *    empty content the system will display the static image instead."
     * 没被调到 → 没人调 completion → 系统显示【静态图】(资源目录里那张城市+时钟,
     * 就是 Jing 说的"旧的帝国时间图"——它从来不是扩展给的, 也不是缓存)。
     *
     * 日志级别一并从 .info 提到 .error: .info 默认【不落盘】, log show 不加 --info 根本看不到,
     * 这一轮我因此白查了一回。
     */
    override func loadTopShelfContent(completionHandler: @escaping ((any TVTopShelfContent)?) -> Void) {
        completionHandler(buildContent())
    }

    /// 真正干活的那一段(同步、极快: 只读 UserDefaults + 查文件存在)。
    private func buildContent() -> (any TVTopShelfContent)? {
        let entries = readCache()
        tslog.error("loadTopShelfContent: \(entries.count) entries from app group")
        /* CSSOS_WAVE_2226 20260927 — 心跳。扩展是系统【按需拉起】的进程, 平时不在进程列表里,
         * 也没法挂控制台 —— 出了问题一点证据都没有(这一轮就卡在"到底跑没跑"上)。
         * 让它把每次调用的结果写一行到 App Group, 用 devicectl 拉回来看。
         * 上架前会删(与最初那版 heartbeat 同样的用意, 但写进【可写的】Caches)。 */
        heartbeat(stage: "CALLED", entries: entries.count, existing: entries.filter {
            FileManager.default.fileExists(atPath: $0.file)
        }.count)
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
        heartbeat(stage: "BUILT", entries: entries.count, existing: items.count)
        guard !items.isEmpty else { return nil }
        tslog.error("returning CAROUSEL with \(items.count) items")
        return TVTopShelfCarouselContent(style: .details, items: items)
    }

    /* W2226(修正)— 心跳【不能写 App Group】。
     *
     * 第一版把心跳也写进 App Group, 结果拿不到心跳时我无法判断是
     *   (a) 扩展根本没被系统叫起, 还是
     *   (b) 扩展跑了, 但连 App Group 都够不着(那心跳自然也写不出来)。
     * 两种情况的现象一模一样 —— 而它们要修的东西完全不同。
     * 所以心跳改写【扩展自己的容器】(不需要 App Group), 并把「App Group 够不够得着」
     * 当成一个字段记下来。这样一条心跳就能把两种情况分开。
     * 而且不再用 try? —— 写不出去要说出来。 */
    private func heartbeat(stage: String, entries: Int, existing: Int) {
        let groupOK = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) != nil
        let defaultsOK = UserDefaults(suiteName: appGroupID) != nil
        let line = #"{"stage":"\#(stage)","entries":\#(entries),"existing":\#(existing),"groupContainer":\#(groupOK),"groupDefaults":\#(defaultsOK),"epoch":\#(Date().timeIntervalSince1970)}"#
        tslog.error("heartbeat \(line, privacy: .public)")
        guard let own = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            tslog.error("heartbeat: 扩展自己的 caches 目录都拿不到")
            return
        }
        do { try line.write(to: own.appendingPathComponent("topshelf-heartbeat.json"), atomically: true, encoding: .utf8) }
        catch { tslog.error("heartbeat 写入失败: \(String(describing: error), privacy: .public)") }
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
