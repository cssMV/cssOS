// W1562 — Jing「hero 轮播: 轮到的才加载, 没轮到/已过去的及时清理内存」。
// 根因: 旧 AsyncImage 把每张封面按【原始分辨率】解码 —— hero 大图 + 5 枚胶囊小缩略图各解一张
//   全尺寸位图(每张可达数十 MB)。改为: 按显示尺寸【降采样】解码(ImageIO 生成缩略图),
//   存入【有上限的 NSCache】(超限即按 LRU 逐出 = 没轮到/已过去的自动清理; 收到内存警告也清空)。

import SwiftUI
import ImageIO
import UIKit

enum CSSImageCache {
    // 解码后位图缓存。上限 32 张 / 64MB —— 轮播过去的封面超限即被逐出, 不无限堆积。
    static let shared: NSCache<NSURL, UIImage> = {
        let c = NSCache<NSURL, UIImage>()
        c.countLimit = 32
        c.totalCostLimit = 64 * 1024 * 1024
        return c
    }()
    /// 收到系统内存警告 → 立刻清空解码缓存(只留当前正在显示的, 由各视图 @State 持有)。
    static func startMemoryWatch() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main
        ) { _ in shared.removeAllObjects() }
    }
    static func downsample(_ data: Data, maxPixel: CGFloat) -> UIImage? {
        let srcOpts = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let src = CGImageSourceCreateWithData(data as CFData, srcOpts) else { return UIImage(data: data) }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(1, maxPixel),
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return UIImage(data: data) }
        return UIImage(cgImage: cg)
    }
}

private extension UIImage {
    var byteCost: Int { Int(size.width * scale * size.height * scale * 4) }
}

/// 降采样封面视图。按 targetSize 解码, 命中缓存直出; url 变(轮播换枝)→ .task(id:) 取消旧加载、换新图,
/// 旧解码图由视图释放(缓存里超限自动逐出)。scaledToFill 填满, 由调用方 clip。
struct CSSPosterImage: View {
    let urlString: String?
    var targetSize: CGSize
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Color.white.opacity(0.06)
            }
        }
        .task(id: urlString) { await load() }
    }

    private func load() async {
        image = nil
        guard let s = urlString, let url = URL(string: s) else { return }
        let key = url as NSURL
        if let cached = CSSImageCache.shared.object(forKey: key) { image = cached; return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if Task.isCancelled { return }
            let maxPx = max(targetSize.width, targetSize.height) * UIScreen.main.scale
            guard let img = CSSImageCache.downsample(data, maxPixel: maxPx) else { return }
            CSSImageCache.shared.setObject(img, forKey: key, cost: img.byteCost)
            if !Task.isCancelled { image = img }
        } catch { /* 网络失败: 保持占位 */ }
    }
}
