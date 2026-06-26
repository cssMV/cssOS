// cssWatch — 极简 iOS 宿主(仅为 App Store 打包包裹独立手表 App; 不控制任何东西)。
import SwiftUI

@main
struct CSSWatchHostApp: App {
    var body: some Scene {
        WindowGroup { HostView() }
    }
}

struct HostView: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.04, green: 0.05, blue: 0.07),
                                    Color(red: 0.10, green: 0.11, blue: 0.14)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 22) {
                Image(systemName: "applewatch")
                    .font(.system(size: 84, weight: .thin))
                    .foregroundStyle(.white.opacity(0.92))
                Text("cssWatch")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("Emotion-subtitle music — on your wrist.")
                    .font(.system(size: 16))
                    .foregroundStyle(.white.opacity(0.7))
                Text("Open cssWatch on your Apple Watch to listen.\nNo iPhone needed.")
                    .font(.system(size: 15))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.55))
                    .padding(.top, 6)
            }
            .padding(.horizontal, 32)
        }
    }
}
