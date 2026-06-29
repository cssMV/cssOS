// CSSOS_WAVE_1483 — M1: 3D 多线程互动电影 visionOS 客户端(自包含, 零侵入锁定的 GateSpace)。
// 后端基座: /api/ifilm/:id/{constitution,next,touch,avatar,threads,beat-video}(见 IFILM_3D_SPEC.md)。
// 哲学: 后端出逻辑+素材, 这里纯表演。用户像"神"有限参与, 改不了结局(铁律在后端护栏)。
import SwiftUI
import RealityKit
import AVFoundation

// MARK: - 后端模型(对齐 src/index.ts WAVE_1474..1482)
struct IFilmCharacter: Codable, Identifiable {
    var name: String; var role: String
    var gender: String?; var voice_id: String?; var model_hint: String?; var model_url: String?
    var id: String { name }
}
struct IFilmEnding: Codable { var id: String; var label: String; var synopsis: String }
struct IFilmConstitution: Codable {
    var title: String; var premise: String
    var characters: [IFilmCharacter]; var rails: [String]
    var endings: [IFilmEnding]; var max_beats: Int
}
struct IFilmBeat: Codable { var thread: String; var speaker: String; var line: String; var synopsis: String; var video_prompt: String }
struct IFilmSubToken: Codable { var char: String; var t_start: Int; var t_end: Int; var emotion: String?; var emotion_intensity: Double? }
struct IFilmSubLine: Codable { var text: String; var t_start: Int; var t_end: Int; var tokens: [IFilmSubToken] }
struct IFilmSession: Codable { var beats: [String]; var step: Int; var tension: Double; var seed: Int }
struct IFilmBeatVideo: Codable { var status: String; var video_url: String? }
struct IFilmNextResponse: Codable {
    var ok: Bool; var beat: IFilmBeat; var voice_url: String?; var subtitle: IFilmSubLine?
    var reaction: String?; var tension: Double; var rail_enforced: Bool; var converged: Bool
    var ending_label: String?; var beat_video: IFilmBeatVideo?; var session: IFilmSession
}
struct IFilmTouchResponse: Codable { var ok: Bool; var character: String; var line: String; var motion: String; var emotion: String; var voice_url: String? }
struct IFilmAvatarResponse: Codable { var ok: Bool; var character: String; var status: String; var model_url: String? }

// MARK: - 客户端
enum IFilmClient {
    static let base = "https://cssstudio.app"   // 同 CSSBackend.baseURL
    private static func post<T: Decodable>(_ path: String, body: [String: Any]) async -> T? {
        guard let url = URL(string: base + path) else { return nil }
        var req = URLRequest(url: url); req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do { let (d, _) = try await URLSession.shared.data(for: req); return try JSONDecoder().decode(T.self, from: d) }
        catch { print("[ifilm] POST \(path) failed:", error); return nil }
    }
    struct ConstWrap: Codable { var ok: Bool; var constitution: IFilmConstitution }
    static func constitution(_ id: String) async -> IFilmConstitution? {
        guard let url = URL(string: "\(base)/api/ifilm/\(id)/constitution") else { return nil }
        do { let (d, _) = try await URLSession.shared.data(from: url); return try JSONDecoder().decode(ConstWrap.self, from: d).constitution }
        catch { print("[ifilm] constitution failed:", error); return nil }
    }
    static func next(_ id: String, session: IFilmSession?, gaze: String? = nil, gesture: String? = nil, utterance: String? = nil) async -> IFilmNextResponse? {
        var body: [String: Any] = [:]
        if let s = session { body["beats"] = s.beats; body["step"] = s.step; body["tension"] = s.tension; body["seed"] = s.seed }
        if let g = gaze { body["gaze"] = g }; if let g = gesture { body["gesture"] = g }; if let u = utterance { body["utterance"] = u }
        return await post("/api/ifilm/\(id)/next", body: body)
    }
    static func touch(_ id: String, character: String, touch: String) async -> IFilmTouchResponse? {
        await post("/api/ifilm/\(id)/touch", body: ["character": character, "touch": touch])
    }
    static func avatar(_ id: String, character: String) async -> IFilmAvatarResponse? {
        await post("/api/ifilm/\(id)/avatar", body: ["character": character])
    }
}

// MARK: - 引擎(编排: 宪法→循环 next→播语音→触碰)
@MainActor
final class IFilmEngine: ObservableObject {
    let workId: String
    @Published var constitution: IFilmConstitution?
    @Published var beat: IFilmBeat?
    @Published var subtitle: IFilmSubLine?
    @Published var reaction: String = ""
    @Published var ended: Bool = false
    @Published var endingLabel: String = ""
    @Published var railBlocked: Bool = false
    private var session: IFilmSession?
    private let audio = AVPlayer()
    private var endObserver: NSObjectProtocol?

    init(workId: String) { self.workId = workId }

    func start() async {
        constitution = await IFilmClient.constitution(workId)
        await advance(gaze: nil, gesture: nil, utterance: nil)
    }

    // 推进一个 beat: 播语音 → 语音结束自动接下一个(直到收束)。
    func advance(gaze: String?, gesture: String?, utterance: String?) async {
        guard !ended else { return }
        guard let r = await IFilmClient.next(workId, session: session, gaze: gaze, gesture: gesture, utterance: utterance) else { return }
        session = r.session
        beat = r.beat; subtitle = r.subtitle; reaction = r.reaction ?? ""; railBlocked = r.rail_enforced
        if let v = r.voice_url, let url = URL(string: v) { playVoice(url) { Task { await self.advance(gaze: nil, gesture: nil, utterance: nil) } } }
        else { try? await Task.sleep(nanoseconds: 2_500_000_000); await advance(gaze: nil, gesture: nil, utterance: nil) }
        if r.converged { ended = true; endingLabel = r.ending_label ?? "结局" }
    }

    // 触碰角色 → 即时微反应(不推进剧情)。
    func touch(_ character: String, _ how: String) async {
        guard let r = await IFilmClient.touch(workId, character: character, touch: how) else { return }
        reaction = [r.motion, r.line].filter { !$0.isEmpty }.joined(separator: " · ")
        if let v = r.voice_url, let url = URL(string: v) { playVoice(url) {} }
    }

    private func playVoice(_ url: URL, onEnd: @escaping () -> Void) {
        if let o = endObserver { NotificationCenter.default.removeObserver(o) }
        let item = AVPlayerItem(url: url)
        endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { _ in onEnd() }
        audio.replaceCurrentItem(with: item); audio.play()
    }
}

// MARK: - 远程 USDZ 加载(下载到临时文件 → ModelEntity)
enum IFilmModelLoader {
    static func load(_ urlStr: String) async -> ModelEntity? {
        guard let url = URL(string: urlStr) else { return nil }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".usdz")
            try data.write(to: tmp)
            let entity = try await ModelEntity(contentsOf: tmp)
            entity.generateCollisionShapes(recursive: true)        // 触碰命中需要碰撞体
            return entity
        } catch { print("[ifilm] usdz load failed:", error); return nil }
    }
}

// MARK: - 沉浸视图(M1: 单主角 USDZ + 字幕 + 触碰)
struct IFilmImmersiveView: View {
    @StateObject var engine: IFilmEngine
    @State private var heroName = ""

    var body: some View {
        RealityView { content, attachments in
            // 主角放在用户前方 1.4m, 略低于视线 → 用户可绕行/触碰(WorldAnchor 不跟头)。
            let anchor = AnchorEntity(world: [0, 1.1, -1.4])
            anchor.name = "ifilm-hero"
            content.add(anchor)
            if let sub = attachments.entity(for: "subtitle") {
                sub.position = [0, 1.9, -1.4]; content.add(sub)
            }
        } update: { content, _ in
            // 主角模型就绪 → 挂到锚点(只挂一次)。
            if let hero = content.entities.first(where: { $0.name == "ifilm-hero" }) as? AnchorEntity,
               hero.children.isEmpty, let model = loadedHero {
                model.scale = [0.9, 0.9, 0.9]
                hero.addChild(model)
            }
        } attachments: {
            Attachment(id: "subtitle") { IFilmSubtitleView(engine: engine) }
        }
        .gesture(SpatialTapGesture().targetedToAnyEntity().onEnded { _ in
            Task { await engine.touch(heroName.isEmpty ? (engine.constitution?.characters.first?.name ?? "") : heroName, "伸手触碰") }
        })
        .task {
            await engine.start()
            // M1: 加载第一个角色的 3D 模型(没有 model_url 就现生成 avatar)。
            if let ch = engine.constitution?.characters.first {
                heroName = ch.name
                var url = ch.model_url
                if url == nil { url = (await IFilmClient.avatar(engine.workId, character: ch.name))?.model_url }
                if let u = url { loadedHero = await IFilmModelLoader.load(u) }
            }
        }
    }
    @State private var loadedHero: ModelEntity?
}

// MARK: - 字幕/台词浮层(M1 简版: 台词 + 触碰反应 + 结局横幅; 逐字爆字幕下一步接 SpatialSubtitleSystem)
struct IFilmSubtitleView: View {
    @ObservedObject var engine: IFilmEngine
    var body: some View {
        VStack(spacing: 10) {
            if let b = engine.beat {
                Text(b.speaker).font(.system(size: 22, weight: .medium)).foregroundStyle(.white.opacity(0.7))
                Text(b.line).font(.system(size: 40, weight: .bold)).foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.8), radius: 4)
                    .multilineTextAlignment(.center)
            }
            if !engine.reaction.isEmpty {
                Text(engine.reaction).font(.system(size: 26)).foregroundStyle(Color(red: 0.31, green: 0.78, blue: 0.64))
                    .transition(.opacity)
            }
            if engine.railBlocked {
                Text("（角色有自己的意志，未照做）").font(.system(size: 18)).foregroundStyle(.orange.opacity(0.85))
            }
            if engine.ended {
                Text("结局：\(engine.endingLabel)").font(.system(size: 30, weight: .bold))
                    .padding(.horizontal, 24).padding(.vertical, 12)
                    .background(.ultraThinMaterial, in: .capsule)
            }
        }
        .frame(width: 900).animation(.easeInOut, value: engine.reaction)
    }
}

// MARK: - 2D 启动器(选一部 film → 进互动电影沉浸空间)
struct IFilmLauncherView: View {
    @Environment(\.openImmersiveSpace) private var openSpace
    // 默认《时间的帝国》; 任意 film 作品 id 都可。
    @AppStorage("ifilm.workId") private var workId = "59578f73-7298-4aa7-b92c-38d5a649f2b8"
    var body: some View {
        VStack(spacing: 16) {
            Text("3D 互动电影").font(.system(size: 28, weight: .bold))
            Text("你是观看这个虚拟宇宙的『神』，可有限参与，但改不了结局。").font(.system(size: 16)).foregroundStyle(.secondary).multilineTextAlignment(.center)
            TextField("film 作品 id", text: $workId).textFieldStyle(.roundedBorder).frame(width: 380)
            Button("进入互动电影") { Task { _ = await openSpace(id: "IFilmSpace") } }.buttonStyle(.borderedProminent)
        }.padding(40).frame(width: 460)
    }
}

// 供 App 注册沉浸空间用(见 CSSImmersiveApp.swift 的 IFilmSpace)。
struct IFilmSpaceRoot: View {
    @AppStorage("ifilm.workId") private var workId = "59578f73-7298-4aa7-b92c-38d5a649f2b8"
    var body: some View { IFilmImmersiveView(engine: IFilmEngine(workId: workId)) }
}
