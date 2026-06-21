// CSSOS_WAVE_1060 — Vision 创作进度:极简未来感。
//   桌面端是 6 胶囊进度条; Vision 端【不照搬】—— 改成一颗【活的魔镜球】: 用户说出咒语后,
//   金球悬浮自转 + 随阶段呼吸发光, 外环一圈细进度弧, 球上方回显咒语, 下方一行流动的阶段词
//   (吟词→绘封面→谱曲→成像→合成)。一个有生命的对象, 而非一排盒子 = 极简未来感。
//   阶段/进度由创作管线驱动(stage/progress 外部传入); 完成即淡出, 进影院欣赏 MV。

import SwiftUI

struct CreationOrbView: View {
    let spell: String          // 用户说的咒语(回显)
    var stage: String          // 当前阶段词
    var progress: Double       // 0…1

    // W1061 — 进度↔自转联动: 进度越靠后, mult 越大 → 球转越快(临近完成狂转, 高潮感)。
    @State private var speedRef = MagicMirrorOrb.SpeedRef()

    var body: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()

            VStack(spacing: 26) {
                Text("“\(spell)”")
                    .font(.system(size: 26, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.92))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .frame(maxWidth: 560)

                ZStack {
                    // 细进度弧(环绕金球)
                    Circle()
                        .stroke(Color.white.opacity(0.12), lineWidth: 3)
                        .frame(width: 260, height: 260)
                    Circle()
                        .trim(from: 0, to: max(0.02, min(1, progress)))
                        .stroke(
                            LinearGradient(colors: [Color(red: 1, green: 0.86, blue: 0.45), Color(red: 0.36, green: 0.95, blue: 0.8)],
                                           startPoint: .topLeading, endPoint: .bottomTrailing),
                            style: StrokeStyle(lineWidth: 4, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .frame(width: 260, height: 260)
                        .animation(.easeInOut(duration: 0.6), value: progress)
                    // 活的魔镜球(自转 + 脉动), 转速随进度
                    MagicMirrorOrbView(size: 0.5, sphere: true, speedRef: speedRef)
                        .frame(width: 220, height: 220)
                }
                .onChange(of: progress) { _, p in
                    speedRef.mult = 0.6 + Float(p) * 3.4   // 0% 慢悠悠 → 100% 狂转
                }
                .onAppear { speedRef.mult = 0.6 + Float(progress) * 3.4 }

                // 流动阶段词(crossfade)
                Text(stage)
                    .font(.system(size: 18, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.8))
                    .id(stage)
                    .transition(.opacity)
                    .animation(.easeInOut(duration: 0.4), value: stage)

                Text(L("Witness the miracle", "见证奇迹"))
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(40)
        }
    }
}
