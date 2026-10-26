import SwiftUI

// Brand colours. The shared ones come from app/brand.json (the same file the web app uses),
// so a colour change there reaches both apps. The rest are iPhone-only shades.
enum Palette {
  private static let brand = Brand.shared.colors

  static let burgundy = brand.color("accent", fallback: 0x8E1B2B)
  static let deepBurgundy = brand.color("accentDeep", fallback: 0x6C1320)
  static let wine = Color(hex: 0x4E0E18)
  static let gold = brand.color("gold", fallback: 0xD9A92E)
  static let brightGold = brand.color("brandGold", fallback: 0xE3B53C)
  static let goldText = brand.color("goldInk", fallback: 0x7D5C0B)
  static let ink = brand.color("ink", fallback: 0x241F1E)
  static let softInk = brand.color("inkSoft", fallback: 0x4A4240)
  static let muted = brand.color("muted", fallback: 0x5E5550)
  static let paper = brand.color("paper", fallback: 0xF5F0E6)
  static let tint = brand.color("paperTint", fallback: 0xECE5D7)
  static let card = brand.color("card", fallback: 0xFFFDF8)
  static let line = brand.color("line", fallback: 0xDCD2C0)
  static let blush = Color(hex: 0xF5E4E1)
  static let error = brand.color("danger", fallback: 0xA3122A)
  static let success = brand.color("success", fallback: 0x2E7D4F)

  // Shades used by the designs for the gold "Sodalis+" and safety panels.
  static let goldWash = Color(hex: 0xF6E9C8)
  static let goldLine = Color(hex: 0xE9D396)
  static let tabInk = Color(hex: 0x3F3735)
  static let sendIdle = Color(hex: 0xCFC6B8)
}

extension Color {
  init(hex: UInt32, opacity: Double = 1) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: opacity
    )
  }

  init?(hexString: String) {
    var s = hexString.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
    self.init(hex: v)
  }
}
