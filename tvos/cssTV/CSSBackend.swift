// CSSOS_WAVE_1172 — 后端桥接(复用现有 cssOS API)。骨架阶段: 拉一批公开作品 + 开箱即播旗舰。
// 只读公开接口, 无需鉴权。真机/模拟器都可直连。

import Foundation

enum CSSBackend {
    /// 线上后端。
    static let baseURL = "https://cssstudio.app"
    // W1575 — App Group 共享容器: app 主体(网络正常)把 Top Shelf 精选写进来, 扩展【直接读、零网络】。
    static let appGroupID = "group.CSSStudio.cssTV"
    /// 把前 10 个精选(id/title/cover/video)写进共享容器, 供 Top Shelf 扩展读取(绕开扩展进程网络限制)。
    /* CSSOS_WAVE_2222 20260927 — Jing:「顶排 App 上方会出现横幅广告…其实一直都还没有实现。」
     *
     * 【为什么以前没实现】三处各缺一块, 缺一块就全盘不成立:
     *   ① 扩展的 entitlements 是【空的】—— 没有 App Group 权限, 读也读不到(已补)。
     *   ② 扩展里写死了三张随包的《时间帝国》JPG, 根本没去读这份缓存(已改)。
     *   ③ 这份缓存只存了封面【URL】, 而扩展进程【没有网络】(本文件原注释自己写着
     *      「扩展直接读、零网络」)—— 给 URL 等于没给。
     *
     * ③ 才是真正的活: 封面必须【下成文件】放进 App Group 的共享【文件容器】,
     * 扩展拿到的是本地 file:// 路径, 零网络也能渲染。UserDefaults 只存清单(路径 + 标题 + id)。
     *
     * 顺带: 每次只保留本轮用到的图, 旧图删掉 —— 顶排就 10 张, 不清理迟早堆成垃圾场。
     */
    static func writeTopShelfCache(_ works: [CSSWork]) {
        Task.detached(priority: .utility) { await writeTopShelfCacheAsync(works) }
    }

    /// 真正干活的那一半(下载要时间, 绝不能卡住首页)。
    static func writeTopShelfCacheAsync(_ works: [CSSWork]) async {
        guard let ud = UserDefaults(suiteName: appGroupID),
              let container = FileManager.default
                .containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else { return }
        /* CSSOS_WAVE_2224 20260927 — 路径必须在 Library/Caches 之下, 不能直接挂容器根目录。
         * tvOS 不允许 App 往 App Group 容器【根目录】写 —— 真机实测:
         *   NSCocoaErrorDomain 513 "You don't have permission to save the file "topshelf""
         *   / NSPOSIXErrorDomain 1 "Operation not permitted"
         * 苹果对 Apple TV 的本地持久存储有硬限制, 容器里可写的只有 Library/Caches
         * (拉回来的真机容器里也确实只有 Library/Preferences 与 Library/Caches 两处)。
         *
         * 【模拟器完全没有这条限制, 一路绿灯】—— 所以这个洞只有真机会暴露出来。
         *
         * Caches 可能被系统回收, 这里是可以接受的: App 每次拉完 feed 都会重写一遍,
         * 而且苹果本来就是让 tvOS 把这类可再生数据放 Caches。 */
        let dir = container
            .appendingPathComponent("Library/Caches", isDirectory: true)
            .appendingPathComponent("topshelf", isDirectory: true)
        /* CSSOS_WAVE_2224 20260927 — 这一段原来通篇 try?, 把每个错误都吞了。
         * 结果真机上出现了一个【本来不可能】的组合: 清单写成了 10 条, 而 topshelf 目录
         * 根本不存在 —— 因为 createDirectory 失败被吞、data.write 失败也被吞, 条目照样 append。
         * 排查时一点线索都没有。凡是"失败了还继续往下走"的地方, 必须把失败说出来。 */
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            print("[topshelf] 建目录失败 \(dir.path): \(error)")
            return
        }

        var items: [[String: String]] = []
        var keep = Set<String>()
        for w in works.prefix(10) {
            guard let cover = w.coverURL, !cover.isEmpty, let curl = URL(string: cover) else { continue }
            // 文件名用封面 URL 的哈希 —— 同一张图不重复下载, 不同图必不同名。
            let name = "ts-\(stableHash(cover)).img"
            keep.insert(name)
            let dest = dir.appendingPathComponent(name)
            if !FileManager.default.fileExists(atPath: dest.path) {
                guard let (data, _) = try? await URLSession.shared.data(from: curl), !data.isEmpty else {
                    print("[topshelf] 下载失败 \(cover)")
                    continue
                }
                do { try data.write(to: dest, options: .atomic) }
                catch { print("[topshelf] 落盘失败 \(dest.path): \(error)"); continue }
            }
            /* 清单里【只准出现真的存在的文件】。原来写失败也照样 append, 扩展拿到的就是
             * 一条死路径 —— 顶排那边只会静静地什么都不显示, 查不出所以然。 */
            guard FileManager.default.fileExists(atPath: dest.path) else {
                print("[topshelf] 落盘后文件仍不存在, 跳过: \(dest.path)")
                continue
            }
            var d: [String: String] = ["id": w.id, "title": w.title ?? "cssTV", "file": dest.path]
            if let v = w.bestVideo, !v.isEmpty { d["video"] = v }
            items.append(d)
        }
        // 清掉本轮没用到的旧图。
        if let old = try? FileManager.default.contentsOfDirectory(atPath: dir.path) {
            for f in old where f.hasPrefix("ts-") && !keep.contains(f) {
                try? FileManager.default.removeItem(at: dir.appendingPathComponent(f))
            }
        }
        if let data = try? JSONSerialization.data(withJSONObject: items) {
            ud.set(data, forKey: "topshelf_items")
        }
        print("[topshelf] 写入完成: 清单 \(items.count) 条, 目录 \(dir.path)")
    }

    /// 稳定哈希(Swift 的 hashValue 每次进程启动都变种子, 不能用来当文件名)。
    private static func stableHash(_ s: String) -> String {
        var h: UInt64 = 5381
        for b in s.utf8 { h = (h &* 33) &+ UInt64(b) }
        return String(h, radix: 36)
    }

    // MARK: - 开箱即播的旗舰样本(与 visionOS 骨架同一首《混沌の海》, 真实可播放地址)。
    static let flagship = CSSWork(
        id: "100fee69-4d74-4744-a4c0-f3dc88a4ea52",
        title: "混沌の海 · The Sea of Chaos",
        videoURL: "https://cdn.cssstudio.app/artifacts/mv/mv_1777776785412.mp4",
        audioURL: "https://cdn.cssstudio.app/artifacts/audio/aud_100fee69-4d74-4744-a4c0-f3dc88a4ea52.a1.m4a",
        coverURL: "https://cssstudio.app/api/cover-webp/898cabba840c128c6517821a233ac19b.webp",
        durationSecs: 307
    )

    /// 拉「为你创作 / 市场」一批公开作品做大屏网格。失败则退回旗舰单卡, 保证骨架永远有东西播。
    static func fetchFeed(limit: Int = 48) async -> [CSSWork] {   // W1287 — 拉多点, 确保新作(三部曲等)进来供 For You 按时间排
        guard let url = URL(string: "\(baseURL)/api/works/market?limit=\(limit)") else { return [flagship] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoder = JSONDecoder()
            // 后端容错: { works: [...] } / { data: { works: [...] } } / 顶层数组。
            if let env = try? decoder.decode(FeedEnvelope.self, from: data), let list = env.resolved, !list.isEmpty {
                return list
            }
            if let arr = try? decoder.decode([CSSWork].self, from: data), !arr.isEmpty {
                return arr
            }
        } catch {
            print("[CSSBackend] fetchFeed failed:", error)
        }
        return [flagship]
    }

    // CSSOS_WAVE_1560 — 数字演员目录(套用桌面 /api/actors)。origin: synthetic(Original)/civilization(Legends)/real_person;
    //   premium=只看付费; owned=只看我建; archetype=戏路大类; search=名字/文明/人设。gender 在客户端过滤(后端无此参)。
    private struct ActorsEnvelope: Decodable {
        let data: Payload?
        struct Payload: Decodable { let actors: [CSSActor]? }
    }
    static func fetchActors(origin: String = "", premium: Bool = false, owned: Bool = false,
                            archetype: String = "", search: String = "", limit: Int = 200) async -> [CSSActor] {
        var comps = URLComponents(string: "\(baseURL)/api/actors")
        var items: [URLQueryItem] = [URLQueryItem(name: "limit", value: String(limit))]
        if !origin.isEmpty { items.append(URLQueryItem(name: "origin", value: origin)) }
        if premium { items.append(URLQueryItem(name: "premium", value: "1")) }
        if owned { items.append(URLQueryItem(name: "owned", value: "1")) }
        if !archetype.isEmpty { items.append(URLQueryItem(name: "archetype", value: archetype)) }
        if !search.isEmpty { items.append(URLQueryItem(name: "search", value: search)) }
        comps?.queryItems = items
        guard let url = comps?.url else { return [] }
        do {
            // URLSession.shared 的 HTTPCookieStorage 自动带上 cssos_session cookie(owned=1 才需登录; 公开浏览无需)。
            let (data, _) = try await URLSession.shared.data(from: url)
            if let env = try? JSONDecoder().decode(ActorsEnvelope.self, from: data), let list = env.data?.actors {
                return list
            }
        } catch { print("[CSSBackend] fetchActors failed:", error) }
        return []
    }

    // CSSOS_WAVE_1560 — 导演入口(套用桌面端): ✨起草标题+梗概 / 系统荐角。
    struct DirectorDraft: Decodable { let title: String?; let synopsis: String? }
    /// POST /api/director/synopsis {title,civilization} → {title,synopsis}(需登录)。
    static func directorDraft(title: String, civ: String) async -> DirectorDraft? {
        guard let url = URL(string: "\(baseURL)/api/director/synopsis") else { return nil }
        var req = URLRequest(url: url); req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["title": title, "civilization": civ])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return try? JSONDecoder().decode(DirectorDraft.self, from: data)
        } catch { print("[CSSBackend] directorDraft failed:", error); return nil }
    }

    struct CastSlot: Decodable, Identifiable {
        let role: String
        let alignment: String?
        let candidates: [CSSActor]
        var id: String { role }
    }
    private struct RecommendEnvelope: Decodable { let results: [CastSlot]? }
    /// POST /api/cast/recommend {format,civilization} → 每个角色槽的候选(同文明/戏路优先)。
    static func castRecommend(format: String, civ: String, needed: [[String: String]] = []) async -> [CastSlot] {
        guard let url = URL(string: "\(baseURL)/api/cast/recommend") else { return [] }
        var req = URLRequest(url: url); req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // W1578 — 照搬桌面端: 明确告知每个待荐槽的 role+alignment(反派=evil, 配角=neutral), 否则后端返回通用池、反派荐成庄子。
        var body: [String: Any] = ["format": format, "civilization": civ]
        if !needed.isEmpty { body["needed"] = needed }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return (try? JSONDecoder().decode(RecommendEnvelope.self, from: data))?.results ?? []
        } catch { print("[CSSBackend] castRecommend failed:", error); return [] }
    }

    /// W1279 — 全库搜索(后端 /api/works/market?q= 已支持: 标题/作者/风格/歌词 ILIKE)。
    static func searchWorks(_ q: String, limit: Int = 40) async -> [CSSWork] {
        let trimmed = q.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let enc = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(baseURL)/api/works/market?q=\(enc)&limit=\(limit)") else { return [] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoder = JSONDecoder()
            if let env = try? decoder.decode(FeedEnvelope.self, from: data), let list = env.resolved { return list }
            if let arr = try? decoder.decode([CSSWork].self, from: data) { return arr }
        } catch { print("[CSSBackend] searchWorks failed:", error) }
        return []
    }

    /// CSSOS_WAVE_1227 — 把一批作品分成 Apple TV 标准多行 rails(不再一堵扁平卡片墙)。
    /// For You(全部)/ Fresh(最新)/ 按 work_type(歌剧/电影/剧集/三部曲, 每类≥3才出)。
    static func buildRails(_ works: [CSSWork]) -> [CSSRail] {
        guard !works.isEmpty else { return [] }
        var rails: [CSSRail] = []
        // W1274 — Jing: Today's Picks 第一、For You 第二; 每栏标题带 SF Symbol 图标; 末尾追加创作尾卡。
        // W1561 — Jing「找回栏尾创作卡 + 联动」: 每栏末尾追加一张创作尾卡; 通用栏=自由选戏路,
        //   类型栏=锁定该栏戏路(在哪栏创作即该类型, 成品自动归入该栏)。
        func rail(_ id: String, _ title: String, _ icon: String, _ items: [CSSWork], min: Int = 1, create: String = "") {
            guard items.count >= min else { return }
            rails.append(CSSRail(id: id, title: title, works: items + [CSSWork.createCard(create)], icon: icon))
        }
        // ① Today's Picks = 系统推荐: 用后端原生序(置顶/活媒体/curation 在前), 这才是"算法推荐"。
        rail("today", "Today's Picks", "sparkles", works)
        // ② For You — 真视频优先, 其余从新到旧。
        //   CSSOS_WAVE_1984d 20260826 — Jing:「TV 版还是旧数据, 没有《李清照·声声慢三部曲》。」
        //   数据是新的(cache-control: no-store, 每次启动 .task 重拉) —— 是这里把它埋了:
        //   原来一律按 created_at 倒序重排, 把后端排好的【真视频优先 → 置顶】整个丢掉。
        //   三部曲 06-28, 在 48 条里被所有更新的作品压到下面, 大屏上根本翻不到。
        //   W1281 当初这么排是对的(后端"媒体优先"档会把老成品顶到真正最新前面), 但那是
        //   在后端还没有显式档位的年代; 现在后端有 is_real_video_mv 了, 只需把这一档抬出来,
        //   其余仍旧从新到旧 —— W1281 的初衷一个字没丢。
        //   同一个教训在 Web 端也栽过两次(buildWorkTree / mktFlat): 服务端排好的顺序,
        //   客户端不要再无条件重排一遍。
        rail("foryou", "For You", "flame.fill", works.sorted {
            let a = ($0.isRealVideoMV ?? false), b = ($1.isRealVideoMV ?? false)
            if a != b { return a }                                    // 真视频永远在前
            return ($0.createdAt ?? "") > ($1.createdAt ?? "")        // 同档内最新优先
        })
        // ③ Most Played — 占位排序(后端暂无播放数; TODO 接 play_count)。
        rail("most-played", "Most Played", "chart.bar.fill", works.sorted { $0.id.hashValue > $1.id.hashValue })
        // CSSOS_WAVE_1560 — Jing「右栏 1:1 映射侧栏所有分类(除 Home), 哪怕只有一个预告片; 空分类
        //   也显示占位卡, 绝不隐藏」。侧栏顺序: 收藏 / MV / Opera / Trilogy / Short Drama / Series / Film。
        //   type-栏尾卡锁定该栏戏路(format); 空栏也带尾卡 → 可创作出该栏第一个作品。
        func categoryRail(_ key: String, _ title: String, _ icon: String, _ items: [CSSWork], format: String, empty: String) {
            let base = items.isEmpty ? [CSSWork.comingSoon(empty)] : items
            rails.append(CSSRail(id: "cat-\(key)", title: title, works: base + [CSSWork.createCard(format)], icon: icon))
        }
        func ofType(_ types: [String]) -> [CSSWork] {
            works.filter { types.contains(($0.workType ?? "").lowercased()) }
        }
        categoryRail("favorites", "My Favorites", "heart.fill",
                     works.filter { $0.isOwned }, format: "", empty: "Tap ♥ on any work to save it here")
        categoryRail("mv",        "MV",           "music.note",
                     ofType(["single", "song", "mv"]), format: "single", empty: "More coming soon")
        categoryRail("trilogy",   "Trilogies",    "books.vertical.fill",
                     ofType(["triptych", "trilogy"]), format: "triptych", empty: "More coming soon")
        categoryRail("opera",     "Operas",       "theatermasks.fill",
                     ofType(["opera"]), format: "opera", empty: "More coming soon")
        categoryRail("shortplay", "Short Dramas", "film.fill",
                     ofType(["shortplay", "short-play", "drama"]), format: "shortplay", empty: "More coming soon")
        categoryRail("series",    "Series",       "tv.fill",
                     ofType(["series"]), format: "series", empty: "More coming soon")
        categoryRail("film",      "Movies",       "film.stack.fill",
                     ofType(["film", "movie"]), format: "film", empty: "More coming soon")
        return rails
    }

    /// 拉单首作品的可播放地址(市场卡片常不带 final_mv_url → 用此端点补全)。失败则原样返回。
    static func hydrate(_ work: CSSWork) async -> CSSWork {
        guard work.videoURL == nil || work.audioURL == nil,
              let url = URL(string: "\(baseURL)/api/works/\(work.id)") else { return work }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoder = JSONDecoder()
            if let env = try? decoder.decode(WorkEnvelope.self, from: data), let w = env.resolved {
                var merged = work
                merged.videoURL = merged.videoURL ?? w.videoURL
                merged.audioURL = merged.audioURL ?? w.audioURL
                merged.coverURL = merged.coverURL ?? w.coverURL
                merged.durationSecs = merged.durationSecs ?? w.durationSecs
                return merged
            }
        } catch {
            print("[CSSBackend] hydrate failed:", error)
        }
        return work
    }

    // MARK: - W1247 逐字情绪字幕
    /// 选定语言的字幕(扁平到行)+ 主题 emoji。
    struct CSSSubtitleData {
        let lang: String
        let lines: [CSSSubLine]
        let themeEmoji: [String]
    }

    /// 拉某作品的逐字情绪字幕。language-tracks → subtitle JSON → 选语言(母语优先, 否则 token 最多的)。
    static func fetchSubtitles(workId: String) async -> CSSSubtitleData? {
        // 1) language-tracks 拿 subtitle JSON URL + 母语。
        guard let ltURL = URL(string: "\(baseURL)/api/works/\(workId)/language-tracks") else { return nil }
        var jsonURLStr: String?
        var originLang: String?
        do {
            let (data, _) = try await URLSession.shared.data(from: ltURL)
            let lt = try JSONDecoder().decode(LanguageTracksEnvelope.self, from: data)
            originLang = lt.origin_voice
            jsonURLStr = lt.tracks?.first(where: { $0.subtitle_take1_json_url != nil })?.subtitle_take1_json_url
        } catch { print("[CSSBackend] language-tracks failed:", error) }
        // 兜底: 直接拼 CDN 路径。
        let urlStr = jsonURLStr ?? "https://cdn.cssstudio.app/works/\(workId)/subtitle-take1.json"
        guard let jsonURL = URL(string: urlStr) else { return nil }
        // 2) 拉字幕 JSON。
        do {
            let (data, _) = try await URLSession.shared.data(from: jsonURL)
            let doc = try JSONDecoder().decode(CSSSubtitleDoc.self, from: data)
            guard !doc.languages.isEmpty else { return nil }
            // 3) 选语言: 母语优先, 否则 token 最多的那门。
            func tokenCount(_ l: CSSSubLanguage) -> Int {
                l.sections.reduce(0) { $0 + $1.lines.reduce(0) { $0 + ($1.tokens?.count ?? 0) } }
            }
            let chosen = doc.languages.first(where: { $0.lang == originLang })
                ?? doc.languages.max(by: { tokenCount($0) < tokenCount($1) })
                ?? doc.languages[0]
            // 扁平到行(带 tokens 的)。
            let lines = chosen.sections.flatMap { $0.lines }
            return CSSSubtitleData(lang: chosen.lang, lines: lines, themeEmoji: doc.themeEmoji ?? [])
        } catch { print("[CSSBackend] subtitle JSON failed:", error) }
        return nil
    }

    private struct LanguageTracksEnvelope: Codable {
        let origin_voice: String?
        let tracks: [Track]?
        struct Track: Codable { let lang: String?; let subtitle_take1_json_url: String? }
    }

    // MARK: - W1364 多语言/多声线
    /// 一条可播的语言×声线轨(只取 ready 且有音频的)。
    /// CSSOS_WAVE_2219 — 一条轨里的一个 ♪N。字幕/封面按版本走(W2175: 切到 ♪3 换第 3 张画面),
    /// 为 null 时回退作品级 —— 与桌面端同一套语义, 不另造。
    struct CSSTake: Identifiable {
        let take: Int             // 1-based, 就是 ♪N 的 N
        let label: String         // 给用户看的名字; 缺省 "♪N"
        let url: String
        let durationSecs: Double?
        let subtitleURL: String?
        let coverURL: String?
        var id: Int { take }
    }

    struct CSSLangTrack: Identifiable {
        let lang: String          // orig / zh / ja / en …
        let voice: String         // auto / 具体声线
        let audioURL: String
        let subtitleURL: String?
        let isDefault: Bool
        /// W2219 — 这条轨的全部 ♪N(后端已按 take 升序给)。空数组 = 后端没给, 回退 audioURL 单版。
        var takes: [CSSTake] = []
        var id: String { "\(lang)|\(voice)" }
        /// 胶囊显示名(母语锁定时给🔒)。i18n: 英文/语言原生缩写。
        var label: String {
            let base: String
            switch lang.lowercased() {
            case "orig": base = "Original"
            case "zh", "zh-cn", "zh-hans": base = "中文"
            case "ja": base = "日本語"
            case "en": base = "English"
            case "ko": base = "한국어"
            case "fr": base = "Français"
            case "es": base = "Español"
            case "de": base = "Deutsch"
            default: base = lang.uppercased()
            }
            return base
        }
    }

    private struct LangTracksFull: Codable {
        let origin_voice: String?
        let tracks: [T]?
        struct T: Codable {
            let lang: String?; let voice: String?; let status: String?
            let is_default: Bool?; let audio_url: String?; let subtitle_take1_json_url: String?
            // CSSOS_WAVE_2219 20260926 — ♪N。后端 /api/works/:id/language-tracks 从
            // W2116 起就【每条轨都挂 takes 数组】了(src/index.ts: loadWorkTakes),
            // 注释里还点名说"TV / Watch / Vision 仍在读老字段 audio_url, 所以老字段一个不动"。
            // TV 一直没解它 —— 于是一首歌只认 ♪1, 放完就跳下一首。这里把它解出来。
            let takes: [TK]?
            let n_takes: Int?
            struct TK: Codable {
                let take: Int?; let label: String?; let url: String?
                let duration_secs: Double?; let subtitle_url: String?; let cover_url: String?
            }
        }
    }

    /// 拉作品的全部可播语言×声线轨(给影院语言胶囊)。
    static func fetchLanguageTracks(workId: String) async -> [CSSLangTrack] {
        guard let url = URL(string: "\(baseURL)/api/works/\(workId)/language-tracks") else { return [] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let env = try? JSONDecoder().decode(LangTracksFull.self, from: data),
              let ts = env.tracks else { return [] }
        return ts.compactMap { t in
            guard let lang = t.lang, let audio = t.audio_url, !audio.isEmpty,
                  (t.status ?? "ready") == "ready" else { return nil }
            // W2219 — 把 takes 解成结构; 没有 url 的条目丢掉(后端出口挂了也不能让播放端拿不到轨)。
            let tks: [CSSTake] = (t.takes ?? []).compactMap { k in
                guard let u = k.url, !u.isEmpty else { return nil }
                let n = k.take ?? 0
                return CSSTake(take: n, label: (k.label?.isEmpty == false ? k.label! : "\u{266A}\(n)"),
                               url: u, durationSecs: k.duration_secs,
                               subtitleURL: k.subtitle_url, coverURL: k.cover_url)
            }.sorted { $0.take < $1.take }
            return CSSLangTrack(lang: lang, voice: t.voice ?? "auto", audioURL: audio,
                                subtitleURL: t.subtitle_take1_json_url,
                                isDefault: t.is_default ?? false,
                                takes: tks)
        }
    }

    /// 按指定字幕 JSON URL + 语言码取该语言的逐字字幕(语言切换用)。
    static func fetchSubtitle(jsonURL urlStr: String?, lang: String) async -> CSSSubtitleData? {
        let s = urlStr ?? ""
        guard let url = URL(string: s.isEmpty ? "x" : s) else { return nil }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let doc = try? JSONDecoder().decode(CSSSubtitleDoc.self, from: data),
              !doc.languages.isEmpty else { return nil }
        let chosen = doc.languages.first(where: { $0.lang == lang })
            ?? doc.languages[0]
        let lines = chosen.sections.flatMap { $0.lines }
        return CSSSubtitleData(lang: chosen.lang, lines: lines, themeEmoji: doc.themeEmoji ?? [])
    }

    // W1259 — 创作台: 把提示词发给后端 AI 助理(开始创作)。返回是否成功送达。
    /// W1548 — 创作意念 → agent。返回 { ok, intent }。intent=="ifilm" → 打开互动电影播放屏(Slice 3)。
    struct CastResult { let ok: Bool; let intent: String?; let ifilmId: String?; let reply: String? }
    static func castMV(prompt: String, cast: [[String: String]] = []) async -> CastResult {
        guard let url = URL(string: "\(baseURL)/api/agent/chat") else { return CastResult(ok: false, intent: nil, ifilmId: nil, reply: nil) }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // W1578 — 从数字演员选角进来时带上 cast → 后端 create_work 封面锁脸(演员本人形象)。空则不影响。
        var payload: [String: Any] = ["message": prompt, "source": "csstv"]
        if !cast.isEmpty { payload["cast"] = cast }
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let ok = (resp as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? false
            let j = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            return CastResult(ok: ok,
                              intent: j?["intent"] as? String,
                              ifilmId: j?["ifilm_id"] as? String,
                              reply: j?["reply"] as? String)
        } catch { print("[CSSBackend] castMV failed:", error) }
        return CastResult(ok: false, intent: nil, ifilmId: nil, reply: nil)
    }

    // MARK: - W1549 Slice 3 — 互动多线程电影(ifilm)客户端
    // 只读/公开(ifilm 端点无鉴权); /next 会触发生成(LLM 写 beat + TTS 声音 + seedance 视频备料),
    // 故播放屏用「▶ 开拍」显式起头, 用户按了才开始花钱(尊重「先不开拍」)。

    struct IFilmSession: Codable {
        var beats: [String]; var step: Int; var tension: Double; var seed: Int
        static let start = IFilmSession(beats: [], step: 0, tension: 0, seed: 0)
    }
    struct IFilmBeatOut: Codable { let thread: String?; let speaker: String?; let line: String?; let synopsis: String?; let video_prompt: String? }
    struct IFilmBeatVideo: Codable { let status: String?; let video_url: String? }
    struct IFilmNext: Codable {
        let ok: Bool?
        let beat: IFilmBeatOut?
        let reaction: String?
        let tension: Double?
        let converged: Bool?
        let ending_id: String?
        let ending_label: String?
        let voice_url: String?
        let beat_video: IFilmBeatVideo?
        let session: IFilmSession?
    }

    /// 推进一拍。gaze/gesture/utterance = 用户此刻的【微影响】(遥控方向/语音)。分钟级 → 长超时。
    static func ifilmNext(id: String, session: IFilmSession,
                          gaze: String? = nil, gesture: String? = nil, utterance: String? = nil) async -> IFilmNext? {
        guard let url = URL(string: "\(baseURL)/api/ifilm/\(id)/next") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 300
        var payload: [String: Any] = ["beats": session.beats, "step": session.step, "tension": session.tension, "seed": session.seed]
        if let g = gaze { payload["gaze"] = g }
        if let ge = gesture { payload["gesture"] = ge }
        if let u = utterance { payload["utterance"] = u }
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return try? JSONDecoder().decode(IFilmNext.self, from: data)
        } catch { print("[CSSBackend] ifilmNext failed:", error); return nil }
    }

    /// 轮询 beat 视频到 ready(懒渲染, seedance 分钟级)。返回可播 video_url;超时返回 nil(用封面/台词兜底)。
    static func ifilmBeatVideoReady(id: String, videoPrompt: String, tries: Int = 45) async -> String? {
        guard !videoPrompt.isEmpty, let url = URL(string: "\(baseURL)/api/ifilm/\(id)/beat-video") else { return nil }
        for _ in 0..<tries {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["video_prompt": videoPrompt])
            if let (data, _) = try? await URLSession.shared.data(for: req),
               let v = try? JSONDecoder().decode(IFilmBeatVideo.self, from: data),
               (v.status ?? "") == "ready", let u = v.video_url, !u.isEmpty {
                return u
            }
            try? await Task.sleep(nanoseconds: 4_000_000_000)  // 4s
        }
        return nil
    }

    private struct FeedEnvelope: Codable {
        let works: [CSSWork]?
        let data: DataField?
        struct DataField: Codable { let works: [CSSWork]? }
        var resolved: [CSSWork]? { works ?? data?.works }
    }
    private struct WorkEnvelope: Codable {
        let work: CSSWork?
        let data: DataField?
        struct DataField: Codable { let work: CSSWork? }
        var resolved: CSSWork? { work ?? data?.work }
    }
}

// MARK: - CSSOS_WAVE_2220 《问道》 — 与数字演员第一人称对话(tvOS 原生)
/*
 * 契约照搬桌面端 app.actor-gallery.js 的 wireWendao, 一个字段都不改:
 *
 *   POST /api/actors/:id/ask      Accept: text/event-stream
 *     body { mode, uiLocale, messages:[{role,content}], summary, want_summary }
 *     mode: "native" = 母语古风 / "modern" = 现代 + UI 语言
 *   SSE 帧(每帧 "data: {...}\n\n"):
 *     { delta: "…" }   逐块追加 —— 平台视觉签名一「流流流」就是它
 *     { reset: true }  上游静默/失败, 四级兜底链重来 → 把已显示的全部清掉重新流
 *     { error: "…" }   失败
 *     { done: true, full, emotion, summary, lang, name, billing }
 *
 *   POST /api/actors/:id/say  { text, emotion } → { data: { voice_url, tokens, billing } }
 *     或 { code: "RATE_LIMIT" } —— 每小时成本闸命中, 桌面端的做法是【关掉自动朗读】并提示一次。
 *
 * 为什么不自己造一套精简协议: 抄一份就是造一份。这条流后端有四级引擎兜底 + reset 语义,
 * 自拟协议等于把那些兜底全丢掉(W1828 记过一次「回复 0 字节」的账)。
 */
extension CSSBackend {

    struct AskMessage: Codable { let role: String; let content: String }

    /// 一次问道。逐块回调在主线程上;调用方只管把 delta 追加到屏幕上。
    /// - onReset: 必须把【已经显示的全部内容】清空重来 —— 不是"再来一段"。
    @MainActor
    static func askStream(actorId: String,
                          mode: String,
                          uiLocale: String,
                          messages: [AskMessage],
                          summary: String,
                          wantSummary: Bool,
                          onDelta: @escaping (String) -> Void,
                          onReset: @escaping () -> Void,
                          onDone: @escaping (_ full: String, _ emotion: String, _ summary: String) -> Void,
                          onError: @escaping (String) -> Void) async {
        guard let url = URL(string: "\(baseURL)/api/actors/\(actorId)/ask") else { onError("bad_url"); return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        // W2220 — 实测首块要等 43-53s(问道走的是慢档 LLM)。90s 太紧: 一次慢一点就被
        // 客户端自己掐断, 用户看到的是"失败", 其实答案正在路上。
        req.timeoutInterval = 120
        let body: [String: Any] = [
            "mode": mode, "uiLocale": uiLocale,
            "messages": messages.map { ["role": $0.role, "content": $0.content] },
            "summary": summary, "want_summary": wantSummary,
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (bytes, resp) = try await URLSession.shared.bytes(for: req)
            if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
                onError("http_\(http.statusCode)"); return
            }
            var sawDone = false
            // SSE: 一帧一行 "data: {...}"。URLSession.bytes.lines 已按行切好, 空行即帧边界。
            for try await line in bytes.lines {
                guard line.hasPrefix("data:") else { continue }
                let js = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                guard !js.isEmpty, let d = js.data(using: .utf8),
                      let ev = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { continue }
                if let delta = ev["delta"] as? String, !delta.isEmpty { onDelta(delta); continue }
                if (ev["reset"] as? Bool) == true { onReset(); continue }
                if let err = ev["error"] as? String { onError(err); return }
                if (ev["done"] as? Bool) == true {
                    sawDone = true
                    onDone(String(describing: ev["full"] as? String ?? ""),
                           (ev["emotion"] as? String) ?? "",
                           (ev["summary"] as? String) ?? "")
                    return
                }
            }
            // 流断了却没见 done —— 后端明写「绝不发空 done」, 所以走到这里就是真断了。
            if !sawDone { onError("stream_ended") }
        } catch {
            onError(String(describing: error).prefix(120).description)
        }
    }

    struct SayResult { let voiceURL: String?; let rateLimited: Bool }

    /// 朗读一段回复。RATE_LIMIT = 每小时成本闸命中(桌面端据此关掉自动朗读)。
    static func say(actorId: String, text: String, emotion: String) async -> SayResult {
        guard let url = URL(string: "\(baseURL)/api/actors/\(actorId)/say") else { return SayResult(voiceURL: nil, rateLimited: false) }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 60
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["text": text, "emotion": emotion])
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return SayResult(voiceURL: nil, rateLimited: false)
        }
        if (j["code"] as? String) == "RATE_LIMIT" { return SayResult(voiceURL: nil, rateLimited: true) }
        let d = j["data"] as? [String: Any]
        let u = d?["voice_url"] as? String
        return SayResult(voiceURL: (u?.isEmpty == false) ? u : nil, rateLimited: false)
    }
}

// MARK: - CSSOS_WAVE_2221 三段试戏(自我介绍 / 正派 / 反派)
/*
 * 契约: GET /api/actors/:id/showcase
 *   → { ok, data: { showcase: { lang, voice_gender, generated_at,
 *                               clips: { intro|hero|villain: {text, text_en, voice_url, subtitle{tokens[]}} } } } }
 *
 * 【与直觉不同的一点, 写在这里免得以后有人按错的前提改】——
 * 这三段【不是视频】。实测抽查 12 位演员: 已生成试戏的 5 位共 15 段,
 * 有 voice_url 的 15 段, 有 video_url 的【0 段】。
 * 桌面端注释也写着「不再每点必烧对口型视频(omnihuman 不稳/贵): 视频=已生成缓存才播」。
 * 所以试戏屏的主体是【母语配音 + 逐字卡拉OK字幕 + 英文译文】, 视频只是将来有了就用的分支。
 *
 * subtitle.tokens 的字段与平台情绪字幕【完全同形】(char / t_start / t_end 毫秒 /
 * emotion / emotion_intensity), 所以直接复用 CSSSubToken, 不另造一套 ——
 * 字幕 JSON 的字段名不许猜, 这是查出来的。
 */
extension CSSBackend {

    struct CSSClip {
        let key: String              // intro / hero / villain
        let text: String             // 母语台词
        let textEn: String           // 英文译文
        let voiceURL: String
        let videoURL: String?        // 目前全库为空; 有了就地放, 不用改别处
        let tokens: [CSSSubToken]
    }
    struct CSSShowcase {
        let lang: String             // 母语码(如 de)
        let voiceGender: String
        let clips: [CSSClip]         // 按 intro → hero → villain 排好
    }

    private struct ShowcaseEnvelope: Codable {
        let ok: Bool?
        let data: D?
        struct D: Codable { let showcase: S? }
        struct S: Codable {
            let lang: String?; let voice_gender: String?
            let clips: [String: C]?
            struct C: Codable {
                let text: String?; let text_en: String?
                let voice_url: String?; let video_url: String?
                let subtitle: Sub?
                struct Sub: Codable { let tokens: [CSSSubToken]? }
            }
        }
    }

    /// 拉某演员的三段试戏。没生成过 → nil(调用方显示"尚未试戏")。
    static func fetchShowcase(actorId: String) async -> CSSShowcase? {
        guard let url = URL(string: "\(baseURL)/api/actors/\(actorId)/showcase") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 60
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let env = try? JSONDecoder().decode(ShowcaseEnvelope.self, from: data),
              let s = env.data?.showcase, let raw = s.clips, !raw.isEmpty else { return nil }
        // 顺序固定 intro → hero → villain(桌面端按钮顺序), 而不是字典的随机序。
        let order = ["intro", "hero", "villain"]
        let clips: [CSSClip] = order.compactMap { k in
            guard let c = raw[k], let v = c.voice_url, !v.isEmpty else { return nil }
            return CSSClip(key: k,
                           text: c.text ?? "",
                           textEn: c.text_en ?? "",
                           voiceURL: v,
                           videoURL: (c.video_url?.isEmpty == false) ? c.video_url : nil,
                           tokens: c.subtitle?.tokens ?? [])
        }
        guard !clips.isEmpty else { return nil }
        return CSSShowcase(lang: s.lang ?? "", voiceGender: s.voice_gender ?? "", clips: clips)
    }
}
