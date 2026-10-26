import SwiftUI

// Buttons: 52pt tall, radius 14. Primary is burgundy with white text,
// secondary is a card with a hairline border, text buttons are burgundy.

struct PrimaryButtonStyle: ButtonStyle {
  var fullWidth = true

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.figtree(19, .semibold))
      .foregroundStyle(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
      .padding(.horizontal, 20)
      .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 52)
      .background(
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .fill(LinearGradient(colors: [Palette.burgundy, Color(hex: 0x962536)], startPoint: .top, endPoint: .bottom))
      )
      .shadow(color: Palette.burgundy.opacity(0.28), radius: 12, y: 6)
      .opacity(configuration.isPressed ? 0.85 : 1)
      .scaleEffect(configuration.isPressed ? 0.98 : 1)
      .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
  }
}

struct SecondaryButtonStyle: ButtonStyle {
  var fullWidth = true

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.figtree(19, .medium))
      .foregroundStyle(Palette.ink)
      .lineLimit(1)
      .padding(.horizontal, 20)
      .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 52)
      .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
      .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line, lineWidth: 1))
      .opacity(configuration.isPressed ? 0.7 : 1)
  }
}

struct TextButtonStyle: ButtonStyle {
  var weight: FigtreeWeight = .semibold

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.figtree(17, weight))
      .foregroundStyle(Palette.burgundy)
      .frame(minHeight: 44)
      .contentShape(Rectangle())
      .opacity(configuration.isPressed ? 0.5 : 1)
  }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
  static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
}

extension ButtonStyle where Self == SecondaryButtonStyle {
  static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() }
}

extension ButtonStyle where Self == TextButtonStyle {
  static var text: TextButtonStyle { TextButtonStyle() }
}

/// The paper strip with a hairline on top that holds a sticky main button
/// (Continue, Save, Show members). It sits just above the home bar, and just
/// above the keyboard when one is open.
struct StickyActionBar<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    VStack(spacing: 0) {
      Rectangle().fill(Palette.line).frame(height: 0.5)
      content
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }
    .background(Palette.paper.opacity(0.97))
  }
}

/// A round 44pt icon button, used for close (✕) and ⋯ buttons.
struct CircleIconButton: View {
  let systemName: String
  var filled = true
  var label: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(Palette.softInk)
        .frame(width: 30, height: 30)
        .background(Circle().fill(filled ? Palette.tint : .clear))
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
    }
    .accessibilityLabel(label)
  }
}
