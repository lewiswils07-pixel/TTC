import CoreText
import SwiftUI

// Newsreader (weight 500) for titles and headings, Figtree for everything else.
// Every size scales with the reader's text size setting (Dynamic Type).
enum Typography {
  /// Registers the fonts bundled in Resources/Fonts. Called once at launch.
  static func registerFonts() {
    guard let items = FileManager.default.enumerator(at: Bundle.main.bundleURL, includingPropertiesForKeys: nil) else { return }
    for case let url as URL in items where url.pathExtension == "ttf" {
      CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }
  }
}

enum FigtreeWeight: String {
  case regular = "Figtree-Regular"
  case medium = "Figtree-Medium"
  case semibold = "Figtree-SemiBold"
  case bold = "Figtree-Bold"
}

extension Font {
  /// Newsreader 500, for titles.
  static func heading(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> Font {
    .custom("Newsreader-Medium", size: size, relativeTo: style)
  }

  /// Figtree, for everything else. Body text is 17, nothing goes below 14.
  static func figtree(_ size: CGFloat = 17, _ weight: FigtreeWeight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
    .custom(weight.rawValue, size: max(size, 14), relativeTo: style)
  }

  static let largeTitleSerif = Font.heading(34, relativeTo: .largeTitle)
  static let body17 = Font.figtree(17)
  static let bodySemibold = Font.figtree(17, .semibold)
  static let small = Font.figtree(14, relativeTo: .footnote)
  static let smallSemibold = Font.figtree(14, .semibold, relativeTo: .footnote)
}

extension View {
  /// Small grey capitals used for section labels such as "YOUR TRIPS".
  func sectionCaps() -> some View {
    font(.figtree(15, .semibold, relativeTo: .footnote))
      .tracking(1.2)
      .textCase(.uppercase)
      .foregroundStyle(Palette.muted)
  }
}
