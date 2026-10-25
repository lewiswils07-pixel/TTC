import SwiftUI

// Cards: radius 16, #FFFDF8, soft shadow. Grouped lists: radius 14, inset separators.

struct CardModifier: ViewModifier {
  var radius: CGFloat = 16
  var padding: CGFloat? = 16

  func body(content: Content) -> some View {
    content
      .padding(padding ?? 0)
      .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Palette.card))
      .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
      .shadow(color: Palette.ink.opacity(0.06), radius: 10, y: 3)
  }
}

extension View {
  func card(radius: CGFloat = 16, padding: CGFloat? = 16) -> some View {
    modifier(CardModifier(radius: radius, padding: padding))
  }
}

/// A grouped list (radius 14) with separators inset past the icon.
struct GroupedList<Item: Identifiable, Row: View>: View {
  let items: [Item]
  var separatorInset: CGFloat = 16
  @ViewBuilder let row: (Item) -> Row

  var body: some View {
    VStack(spacing: 0) {
      ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
        row(item)
        if index < items.count - 1 {
          Rectangle().fill(Palette.line).frame(height: 0.5).padding(.leading, separatorInset)
        }
      }
    }
    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
  }
}

/// Small rounded label, e.g. "12 to meet", "Today".
struct Pill: View {
  let text: String
  var background: Color = Palette.tint
  var foreground: Color = Palette.softInk

  var body: some View {
    Text(text)
      .font(.figtree(15, .medium, relativeTo: .footnote))
      .foregroundStyle(foreground)
      .padding(.horizontal, 12)
      .padding(.vertical, 6)
      .background(Capsule().fill(background))
  }
}

/// The dark "🔒 Sodalis+" tag on paid features.
struct PlusTag: View {
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "lock")
        .font(.system(size: 13, weight: .semibold))
      Text(Brand.shared.plusName)
        .font(.smallSemibold)
    }
    .foregroundStyle(Palette.brightGold)
    .padding(.horizontal, 14)
    .padding(.vertical, 7)
    .background(Capsule().fill(Palette.ink))
    .accessibilityElement(children: .combine)
  }
}
