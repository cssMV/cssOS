// CSSOS_WAVE_1068 — Vision 首版「无内购」边界(规避 App Store 3.1.1)。
//   visionOS 首版不在 App 内售卖任何数字内容/服务(打赏 tip / 买断 buyout / 充值 topup):
//   数字购买必须走 StoreKit IAP, 而 IAP 尚未接 → 首版一律隐藏付费入口。
//   欣赏 + 用已登录账户既有积分创作不受影响; 充值/买断/打赏请到 iOS App 或网页。
//   日后接好 StoreKit 后, 把 visionPurchasesEnabled 改回 true 即恢复全部入口。
enum CSSPayments {
    static let visionPurchasesEnabled = false
}
