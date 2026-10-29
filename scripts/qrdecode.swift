// 用 macOS 自带的 CIDetector 解码截图里的二维码 —— 与手机相机同一套底层。
import Foundation
import CoreImage
let path = CommandLine.arguments[1]
guard let img = CIImage(contentsOf: URL(fileURLWithPath: path)) else { print("读图失败"); exit(2) }
let det = CIDetector(ofType: CIDetectorTypeQRCode, context: CIContext(),
                     options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let feats = det.features(in: img).compactMap { $0 as? CIQRCodeFeature }
if feats.isEmpty { print("❌ 扫不出任何二维码"); exit(1) }
for f in feats { print("✅ 解出: \(f.messageString ?? "(空)")") }
