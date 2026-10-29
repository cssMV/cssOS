// CSSOS_WAVE_2257 20261029 — 分享(二维码) · 数字演员移植第三波。
//
// 为什么是二维码而不是「复制链接」: 电视上没有剪贴板可用的去处, 也没法发消息。
// 唯一能把一个链接从客厅带走的办法, 就是让手机扫一下。
//
// 二维码用 CoreImage 的 CIQRCodeGenerator 本地生成 —— 不引第三方库, 也不请求任何
// 远程生码服务(那等于把用户看了谁告诉第三方)。
import SwiftUI
import CoreImage.CIFilterBuiltins

struct ActorShareView: View {
    @ObservedObject var i18n = I18n.shared
    let actor: CSSActor
    @Environment(\.dismiss) private var dismiss
    @FocusState private var closeFocused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    private var link: String { CSSBackend.actorShareURL(actor.id) }

    var body: some View {
        ZStack {
            Color.black.opacity(0.92).ignoresSafeArea()
            VStack(spacing: 34) {
                Text(tr("Scan to open on your phone"))
                    .font(.system(size: 44, weight: .heavy)).foregroundStyle(.white)

                Text(actor.displayName)      // 演员名是【内容】, 不翻译
                    .font(.system(size: 28)).foregroundStyle(brandGreen)

                if let img = Self.qr(link) {
                    Image(uiImage: img)
                        .interpolation(.none)            // 二维码必须最近邻, 插值会把码糊掉扫不出来
                        .resizable()
                        .frame(width: 420, height: 420)
                        .padding(26)
                        .background(RoundedRectangle(cornerRadius: 22).fill(.white))
                } else {
                    // 生码失败也要给出可手敲的地址, 不留死路
                    Text(link).font(.system(size: 22)).foregroundStyle(.white.opacity(0.8))
                }

                Text(link)
                    .font(.system(size: 20)).foregroundStyle(.white.opacity(0.45))
                    .lineLimit(1)

                Button(tr("Close")) { dismiss() }
                    .font(.system(size: 26, weight: .semibold))
                    .focused($closeFocused)
            }
            .padding(60)
        }
        .task {
            await CSSBackend.pingActorShare(actor.id)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { closeFocused = true }
        }
    }

    /// 本地生成二维码。放大用 CGAffineTransform 而不是让 SwiftUI 拉伸 ——
    /// CIQRCodeGenerator 出的原图只有几十像素, 直接拉到 420 会糊成一团扫不出来。
    private static func qr(_ text: String) -> UIImage? {
        let ctx = CIContext()
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let out = f.outputImage else { return nil }
        let scaled = out.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cg = ctx.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
