// CSSOS_WAVE_936 — 2D 启动窗口: 选作品 + 进/出沉浸影院。
// 阶段 1 用样本作品一键进影院; 阶段 3 这里换成真实作品列表(拉 /api/works/market)。

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var player: PlayerController
    @EnvironmentObject var shareplay: SharePlayCathedral
    @EnvironmentObject var settings: CathedralSettings
    @EnvironmentObject var auth: CSSAuth
    @EnvironmentObject var router: GateRouter
    @State private var gateOpened = false       // W1093 — 沉浸大厅已开(防重复开)
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace

    @State private var inImmersive = false
    @State private var loading = false
    @State private var workIdInput = ""
    @State private var scenePrompt = ""     // W976 — AI 360 场景提示词
    @State private var sceneLoading = false
    @AppStorage("cssOrbSphere") private var orbSphere = false  // W1052 — logo 金球: 平面 vs 真 3D 球体(对比)
    @AppStorage("cssPetal3D") private var petal3D = false       // W1054 — 天女散花: emoji 卡 vs 真 3D 网格
    @AppStorage("cssPetalGlow") private var petalGlow = 1.0      // W1055 — 发光强度
    @AppStorage("cssPetalSpin") private var petalSpin = 1.0      // W1055 — 翻滚速度
    @AppStorage("cssPetalSize") private var petalSize = 1.0      // W1055 — 大小
    // W1060 — 语音/Siri 咒语创作: 进度用 CreationOrb(极简未来感)。
    @State private var creating = false
    @State private var creatingSpell = ""
    @State private var creatingStage = ""
    @State private var creatingProgress = 0.0
    @State private var showSignIn = false        // W1063 — 科幻登录门户
    @State private var pendingSpell = ""          // 登录成功后接力的咒语
    @State private var menuExpanded = false       // CSSOS_WAVE_1106 — 圣殿大门折叠: 默认只显自转魔镜, 点它才展开菜单
    @State private var consoleExpanded = false     // CSSOS_WAVE_1106 — 影院控制台折叠: 默认魔镜球, 点它才展开设置

    @Environment(\.dismissWindow) private var dismissWindow
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Group {
            if inImmersive {
                // CSSOS_WAVE_1106 — Jing「影院里的设置窗口应缩小到魔镜球, 点它才显」: 控制台也折叠。
                if consoleExpanded {
                    ScrollView { fullPanel.frame(maxWidth: 620).padding(.vertical, 20) }
                        .frame(width: 660, height: 720)
                        .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 44))
                        .overlay(alignment: .topTrailing) {
                            Button { withAnimation(.easeInOut(duration: 0.28)) { consoleExpanded = false } } label: {
                                Image(systemName: "circle.grid.cross").font(.title2)
                            }.buttonStyle(.plain).padding(18).help(L("Collapse to mirror", "折叠为魔镜"))
                        }
                } else {
                    // 折叠态: 只显自转魔镜球(浮在影院里), 点它 → 展开控制台。无白底。
                    MagicMirrorOrbView(size: 0.2, sphere: orbSphere)
                        .frame(width: 220, height: 220)
                        .contentShape(Circle())
                        .onTapGesture { withAnimation(.easeInOut(duration: 0.28)) { consoleExpanded = true } }
                        .frame(minWidth: 280, idealWidth: 300, minHeight: 280, idealHeight: 300)
                }
            } else if menuExpanded {
                // CSSOS_WAVE_1106 — Jing「两者结合」展开态: 大厅菜单在【原生窗口】里(系统自带隐藏
                //   拖拽条 + 舒适眼高), 外层 ScrollView 让内容上下滑动(不再被窗口高度切掉顶部魔镜)。
                //   右上角小魔镜按钮 → 折叠回金球。
                ScrollView {
                    LobbyView(
                        onEnter: { router.enter($0) },
                        onCreate: { router.doCreate = true },
                        onSpell: { router.spell = $0 },
                        signedIn: auth.isSignedIn,
                        onSignIn: { router.fireBeams = true }
                    )
                    .frame(maxWidth: 880)
                    .padding(.vertical, 24)
                }
                .frame(minWidth: 760, idealWidth: 900, maxWidth: 1000,
                       minHeight: 600, idealHeight: 880, maxHeight: 1100)
                .overlay(alignment: .topTrailing) {
                    Button { withAnimation(.easeInOut(duration: 0.28)) { menuExpanded = false } } label: {
                        Image(systemName: "circle.grid.cross").font(.title2)
                    }
                    .buttonStyle(.plain).padding(20).help(L("Collapse to mirror", "折叠为魔镜"))
                }
            } else {
                // CSSOS_WAVE_1106 — Jing「圣殿大门缩为魔镜, 尖角托盘不动、金球旋转, 点魔镜才显菜单」:
                //   折叠态 = 只显自转魔镜金球(浮在星空沉浸背景前), 点它 → 展开大厅菜单。窗口紧贴
                //   金球大小, 没有白底大窗。
                VStack(spacing: 14) {
                    MagicMirrorOrbView(size: 0.2, sphere: orbSphere)
                        .frame(width: 240, height: 240)
                    Text(L("Tap the mirror to enter", "点魔镜进入"))
                        .font(.callout).foregroundStyle(.secondary)
                }
                .padding(28)
                .contentShape(Circle())
                .onTapGesture { withAnimation(.easeInOut(duration: 0.28)) { menuExpanded = true } }
                .frame(minWidth: 300, idealWidth: 320, minHeight: 320, idealHeight: 340)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: inImmersive)
        // W1093 — 启动即进沉浸大厅。
        .task {
            if !gateOpened { await openGate() }
        }
        // 沉浸大厅回传: 选作品 → 进影院; 创作 → 开 AI 窗; 咒语 → 创作。
        .onChange(of: router.enterToken) { _, _ in
            if let w = router.pendingWork { Task { await enterCinema(work: w) } }
        }
        .onChange(of: router.doCreate) { _, v in
            if v { router.doCreate = false; openWindow(id: "ai") }
        }
        .onChange(of: router.spell) { _, s in
            if let s { router.spell = nil; startSpell(s) }
        }
        // W1060 — 创作进度:活的魔镜球(取代 6 胶囊), 极简未来感。
        .overlay {
            if creating {
                CreationOrbView(spell: creatingSpell, stage: creatingStage, progress: creatingProgress)
            } else if showSignIn {
                // W1063 — 凝视魔镜球 → 射光 → Apple/Optic ID 登录(visionOS 上 Apple 登录即用 Optic ID 扫眼)。
                SignInOrbView(
                    returning: UserDefaults.standard.bool(forKey: "cssHadAccount"),
                    onActivate: { auth.signIn() },
                    onCancel: { showSignIn = false; pendingSpell = "" }
                )
            }
        }
        // 登录成功 → 关门户 + 接力咒语创作。
        .onChange(of: auth.isSignedIn) { _, signed in
            if signed {
                showSignIn = false
                if !pendingSpell.isEmpty { let s = pendingSpell; pendingSpell = ""; startSpell(s) }
            }
        }
        // W1060 — Siri 咒语: "用 CSS Vision 创作…" 唤起 App 后, 在此接力启动创作。
        .onAppear {
            // W1069 — 截图展示模式(App Store 用): SIMCTL_CHILD_CSS_SHOWCASE=signin|orb|cinema
            //   直接渲染目标画面, 不需真登录/生成。仅当 env 显式设置时生效, 生产无影响。
            switch ProcessInfo.processInfo.environment["CSS_SHOWCASE"] ?? "" {
            case "signin":
                showSignIn = true
            case "orb":
                creatingSpell = L("create an epic about 唐伯虎", "创作一支唐伯虎的史诗")
                creatingStage = L("Composing the music…", "谱写旋律…")
                creatingProgress = 0.66
                creating = true
            case "cinema", "music":
                Task { await enterCinema(work: await CSSBackend.defaultWork()) }
            default:
                break
            }
            let s = UserDefaults.standard.string(forKey: "cssPendingSpell") ?? ""
            if !s.trimmingCharacters(in: .whitespaces).isEmpty {
                UserDefaults.standard.removeObject(forKey: "cssPendingSpell")
                startSpell(s)
            }
        }
    }

    // CSSOS_WAVE_1093 — 打开沉浸大厅(GateSpace): 星空 + 大厅面板 + 光束仪式。
    private func openGate() async {
        let r = await openImmersiveSpace(id: "GateSpace")
        if case .opened = r { gateOpened = true }
        // CSSOS_WAVE_1104 — 大厅现在就是这个原生窗口本身(在星空沉浸背景前), 故【不再 dismiss launch 窗】。
    }

    // W1060 — 咒语创作: 显示 CreationOrb 流动阶段词 → 调后端管线 → 出 MV 进影院。
    private func startSpell(_ spell: String) {
        let s = spell.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty, !creating else { return }
        // W1063 — 创作需登录: 未登录先走纯光束沉浸仪式(记住咒语, 登录成功后 onChange 自动接力创作)。
        guard auth.isSignedIn else { pendingSpell = s; Task { await openGate() }; return }
        creatingSpell = s
        creatingProgress = 0.05
        creatingStage = L("Reading your spell…", "解读咒语…")
        creating = true
        // 阶段词流动(纯视觉节奏, 真实 stage 接管线后可替换)。
        let stages: [(String, String, Double)] = [
            (L("Weaving the lyrics…", "吟唱歌词…"), "", 0.30),
            (L("Painting the cover…", "绘制封面…"), "", 0.50),
            (L("Composing the music…", "谱写旋律…"), "", 0.72),
            (L("Filming the visuals…", "绘制画面…"), "", 0.88),
            (L("Final mix…", "合成成片…"), "", 0.97),
        ]
        Task {
            for (label, _, p) in stages {
                try? await Task.sleep(nanoseconds: 1_400_000_000)
                if !creating { return }
                creatingStage = label
                creatingProgress = p
            }
        }
        Task {
            let work = await CSSBackend.createFromPrompt(s)
            creating = false
            if let w = work {
                await enterCinema(work: w)
            } else {
                // 管线未即时返回可播作品 → 退回大厅(后续可改成"已在后台创作, 完成通知")。
                creatingStage = ""
            }
        }
    }


    // W957 — 全胶囊风格 + i18n(英文默认, zh 区域中文)。宽度加大防掉行。
    private let menuWidth: CGFloat = 540

    @ViewBuilder
    private var fullPanel: some View {
        VStack(spacing: 22) {
            Text("CSS Vision")
                .font(.system(size: 44, weight: .black, design: .rounded))
            Text(L("Enter the CSS Cathedral", "踏入魔镜圣殿"))
                .font(.title3).foregroundStyle(.secondary)

            // W1052 — 自转金球 logo 预览 + 平面/3D 球体对比开关。
            MagicMirrorOrbView(size: 0.18, sphere: orbSphere)
                .frame(width: 170, height: 170)
                .id(orbSphere)
            Toggle(L("3D sphere logo (off = flat spin)", "3D 球体 logo(关=平面旋转)"), isOn: $orbSphere)
                .frame(width: menuWidth)
            Toggle(L("3D mesh petals (off = emoji)", "3D 网格花瓣(关=emoji)"), isOn: $petal3D)
                .frame(width: menuWidth)
            // W1055 — 天女散花实时旋钮(下一波撒落即生效)。
            VStack(alignment: .leading, spacing: 6) {
                Text(L("Glow \(String(format: "%.1f", petalGlow))×", "发光 \(String(format: "%.1f", petalGlow))×")).font(.footnote)
                Slider(value: $petalGlow, in: 0.3...2.5, step: 0.1)
                Text(L("Tumble speed \(String(format: "%.1f", petalSpin))×", "翻滚速度 \(String(format: "%.1f", petalSpin))×")).font(.footnote)
                Slider(value: $petalSpin, in: 0.3...2.5, step: 0.1)
                Text(L("Size \(String(format: "%.1f", petalSize))×", "大小 \(String(format: "%.1f", petalSize))×")).font(.footnote)
                Slider(value: $petalSize, in: 0.5...2.0, step: 0.1)
            }.frame(width: menuWidth)

            if !inImmersive {
                TextField(L("Work ID (blank = sample)", "作品 ID(留空用样本)"), text: $workIdInput)
                    .textFieldStyle(.roundedBorder).frame(width: menuWidth)
            }

            if inImmersive {
                Text(L("Surround screen (you at center)", "环绕银幕(你在圆心)"))
                    .font(.headline).foregroundStyle(.secondary)
                HStack(spacing: 10) {
                    ForEach([120, 180, 270, 320, 360], id: \.self) { deg in
                        Button("\(deg)°") { settings.arcDegrees = Double(deg); settings.bump() }
                            .tint(Int(settings.arcDegrees) == deg ? .green : nil)
                    }
                }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)

                VStack(alignment: .leading) {
                    Text(L("Arc \(Int(settings.arcDegrees))° (360 = full surround)", "弧度 \(Int(settings.arcDegrees))°(360=全包围)")).font(.footnote)
                    Slider(value: $settings.arcDegrees, in: 60...360, step: 10)
                        .onChange(of: settings.arcDegrees) { _, _ in settings.bump() }
                }.frame(width: menuWidth)

                VStack(alignment: .leading) {
                    Text(L("Radius \(String(format: "%.1f", settings.radius)) m (0.5 = near your face)", "半径 \(String(format: "%.1f", settings.radius)) m(0.5≈贴脸)")).font(.footnote)
                    Slider(value: $settings.radius, in: 0.5...6.0, step: 0.1)
                        .onChange(of: settings.radius) { _, _ in settings.bump() }
                }.frame(width: menuWidth)

                Text(L("Scene / Environment", "场景 / 环境"))
                    .font(.headline).foregroundStyle(.secondary)
                HStack(spacing: 10) {
                    ForEach(CathedralSettings.environments, id: \.key) { e in
                        Button(L(e.en, e.zh)) { settings.customEnvURL = ""; settings.environment = e.key }
                            .tint(settings.customEnvURL.isEmpty && settings.environment == e.key ? .green : nil)
                    }
                }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)

                // W954 — 开放平台: 环境也交给用户。
                HStack(spacing: 10) {
                    Button(L("Use cover as scene", "用本作品封面")) {
                        if let c = player.work?.coverURL, !c.isEmpty { settings.customEnvURL = c }
                    }.disabled((player.work?.coverURL ?? "").isEmpty)
                    if !settings.customEnvURL.isEmpty {
                        Button(L("Reset scene", "恢复内置")) { settings.customEnvURL = "" }.tint(.orange)
                    }
                }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                TextField(L("Your 360° image URL (equirectangular)", "自填 360 图 URL"), text: $settings.customEnvURL)
                    .textFieldStyle(.roundedBorder).frame(width: menuWidth)

                // W976 — ✨ AI 生成原创 360 场景(合法: 原创, 非他人 IP)。
                HStack(spacing: 10) {
                    TextField(L("Describe a scene to generate…", "描述要生成的场景…"), text: $scenePrompt)
                        .textFieldStyle(.roundedBorder).frame(width: menuWidth - 170)
                    Button {
                        let p = scenePrompt.trimmingCharacters(in: .whitespaces); guard !p.isEmpty else { return }
                        Task {
                            sceneLoading = true; defer { sceneLoading = false }
                            if let u = await CSSBackend.generateScene(prompt: p) { settings.customEnvURL = u }
                        }
                    } label: {
                        Label(sceneLoading ? L("Generating…", "生成中…") : L("AI Scene", "AI 场景"),
                              systemImage: "wand.and.stars").foregroundStyle(.white)
                    }.disabled(sceneLoading).buttonStyle(.borderedProminent).buttonBorderShape(.capsule).tint(.indigo)
                }

                // 🤖 创作支柱: 打开独立的 AI 助理窗(多行智能输入), 不再挤在控制台里。
                Divider().frame(width: menuWidth)
                Button { openWindow(id: "ai") } label: {
                    Label(L("AI Assistant · Create", "AI 助理 · 创作"), systemImage: "sparkles")
                        .foregroundStyle(.white)
                }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large).tint(.purple)
            } else {
                Button { Task { await enterCinema() } } label: {
                    Label(loading ? L("Loading…", "载入中…") : L("Enter CSS Cathedral", "进入魔镜圣殿"),
                          systemImage: "sparkles.tv.fill").font(.title2)
                }.disabled(loading).buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large)
            }

            // SharePlay 共享圣殿。
            Button {
                let id = player.work?.id ?? (workIdInput.trimmingCharacters(in: .whitespaces).isEmpty ? "sample" : workIdInput)
                shareplay.startSharing(workID: id)
            } label: {
                Label(shareplay.isConnected
                      ? L("In shared cathedral (\(shareplay.participantCount))", "已在共享圣殿(\(shareplay.participantCount) 人)")
                      : L("Watch together · SharePlay", "一起看 · 共享圣殿"),
                      systemImage: "person.2.wave.2.fill").font(.body)
            }.tint(.green).buttonStyle(.bordered).buttonBorderShape(.capsule)

            if let t = player.work?.title {
                Text(L("Now playing: \(t)", "正在准备: \(t)")).font(.footnote).foregroundStyle(.secondary)
            }

            if inImmersive {
                Divider().frame(width: menuWidth)
                Button {
                    // W1093 — 退出影院 → 回沉浸大厅(不是退 App)。
                    player.pauseAll()
                    dismissWindow(id: "controls"); dismissWindow(id: "ai")
                    Task {
                        await dismissImmersiveSpace()
                        inImmersive = false
                        await openGate()              // 回到星空大厅
                    }
                } label: {
                    Label(L("Back to Lobby", "回大厅"), systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.title2).foregroundStyle(.white)   // W960 — 红底白字(原红底红字看不见)
                }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large).tint(.red)
            }
        }
        .padding(40)
    }

    // CSSOS_WAVE_1059/1093 — 从沉浸大厅选定作品 → 先关大厅沉浸 → 开影院沉浸(同时只能开一个)。
    private func enterCinema(work: CSSWork) async {
        loading = true
        defer { loading = false }
        if gateOpened { await dismissImmersiveSpace(); gateOpened = false }
        player.load(work)
        let result = await openImmersiveSpace(id: "ImmersiveCinema")
        if case .opened = result {
            inImmersive = true
            settings.hasEnteredOnce = true
        }
    }

    private func enterCinema() async {
        loading = true
        defer { loading = false }
        let work: CSSWork
        let id = workIdInput.trimmingCharacters(in: .whitespaces)
        if id.isEmpty {
            // 第一束光: 直接拉我们自己的《混沌の海》(带真逐字情绪字幕), 拉不到再离线兜底。
            work = await CSSBackend.defaultWork()
        } else if let w = try? await CSSBackend.fetchWork(id: id) {
            work = w
        } else {
            work = CSSBackend.offlineFallback()
        }
        player.load(work)
        let result = await openImmersiveSpace(id: "ImmersiveCinema")
        if case .opened = result {
            inImmersive = true
            settings.hasEnteredOnce = true
            // W981 — 空间原生: 进殿即关大门窗 + 不再开 2D 控制窗。控制全交给空间【控制球簇】(视野下方 HUD)
            //   + ⚙设置(in-space 菜单) + 🤖AI 窗(按需)。抛弃 2D 窗口思维。
            dismissWindow(id: "launch")
        }
    }
}
