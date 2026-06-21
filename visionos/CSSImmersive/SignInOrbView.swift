// CSSOS_WAVE_1063 — 科幻登录门户:凝视魔镜球 → 球向你射出多束随机色光 → 触发 Optic ID(视网膜)/
//   Apple 登录。像科幻片里"扫描眼睛"的桥段。Optic ID 本身是 visionOS 系统弹窗(LocalAuthentication),
//   我们的光束是登录前的仪式感铺垫。首次无账号→Apple 网页登录; 已有账号→Optic ID 解锁复用会话。

import SwiftUI

struct SignInOrbView: View {
    var returning: Bool                 // 已有账号 → Optic ID; 否则 Apple 登录
    var onActivate: () -> Void          // 光束放完后触发(ContentView 决定 Apple / Optic)
    var onCancel: () -> Void

    @State private var bursting = false
    @State private var armed = true
    @State private var speedRef = MagicMirrorOrb.SpeedRef()
    @State private var beamColors: [Color] = []
    private let beamCount = 16

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
                .onTapGesture { if armed { onCancel() } }   // 点空白取消

            VStack(spacing: 28) {
                Text(returning ? L("Look into the orb to unlock", "凝视魔镜球解锁")
                               : L("Look into the orb to sign in", "凝视魔镜球登录"))
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.92))

                ZStack {
                    // 射向用户的随机色光束(放射状)
                    ForEach(0..<beamCount, id: \.self) { i in
                        Capsule()
                            .fill(beamColors.indices.contains(i) ? beamColors[i] : .white)
                            .frame(width: 5, height: 130)
                            .offset(y: -120)
                            .rotationEffect(.degrees(Double(i) / Double(beamCount) * 360))
                            .scaleEffect(bursting ? 1.0 : 0.0, anchor: .bottom)
                            .opacity(bursting ? 0.0 : 0.9)   // 触发前 scale=0 隐形; 触发时射出并淡灭
                            .blur(radius: 1.5)
                    }
                    // 活的魔镜球(凝视/捏合触发)
                    MagicMirrorOrbView(size: 0.5, sphere: true, speedRef: speedRef)
                        .frame(width: 240, height: 240)
                        .hoverEffect(.lift)
                        .onTapGesture { activate() }
                }
                .frame(width: 320, height: 320)

                Text(L("Tap the orb · Optic ID does the rest", "轻点魔镜球 · 余下交给 Optic ID"))
                    .font(.footnote).foregroundStyle(.white.opacity(0.5))

                Button(L("Cancel", "取消")) { onCancel() }
                    .buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            .padding(40)
        }
        .onAppear {
            beamColors = (0..<beamCount).map { _ in
                Color(hue: Double.random(in: 0...1), saturation: 0.92, brightness: 1.0)
            }
        }
    }

    private func activate() {
        guard armed else { return }
        armed = false
        speedRef.mult = 4.0                       // 球瞬间狂转
        // 光束炸射(随机色向四周/向你射出), 0.6s 后交给系统 Optic ID / Apple 登录。
        withAnimation(.easeOut(duration: 0.6)) { bursting = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.62) {
            onActivate()
        }
    }
}
