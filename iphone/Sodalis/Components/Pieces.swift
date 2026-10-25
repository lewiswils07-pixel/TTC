import SwiftUI

// Small shared pieces used across many screens.

/// Three-letter place tile, e.g. "LIS" in gold on wine.
struct PlaceTile: View {
  let code: String
  var tone: Color = Palette.wine
  var size: CGFloat = 44

  var body: some View {
    Text(code)
      .font(.heading(size * 0.4))
      .foregroundStyle(Palette.brightGold)
      .minimumScaleFactor(0.6)
      .frame(width: size, height: size)
      .background(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous).fill(tone))
      .accessibilityHidden(true)
  }
}

/// Overlapping initial circles, e.g. who is going or who is in.
struct AvatarStack: View {
  let initials: [String]
  var size: CGFloat = 30

  private let tones: [UInt32] = [0x8E1B2B, 0x8A6A12, 0x3E6B4F, 0x4A4E7A, 0x7A3E5E]

  var body: some View {
    HStack(spacing: -size * 0.28) {
      ForEach(Array(initials.enumerated()), id: \.offset) { index, letter in
        Text(letter)
          .font(.figtree(14, .semibold, relativeTo: .caption))
          .foregroundStyle(.white)
          .frame(width: size, height: size)
          .background(Circle().fill(Color(hex: tones[index % tones.count])))
          .overlay(Circle().strokeBorder(Palette.card, lineWidth: 2))
      }
    }
    .accessibilityHidden(true)
  }
}

/// Blush pill used to show a picked value, e.g. a date in a form.
struct ValuePill: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.figtree(17, .medium))
      .foregroundStyle(Palette.burgundy)
      .padding(.horizontal, 12)
      .padding(.vertical, 6)
      .background(Capsule().fill(Palette.blush))
  }
}

/// A rounded square holding a small icon, as used at the start of list rows.
struct IconBadge: View {
  let systemName: String
  var fill: Color = Palette.tint
  var tint: Color = Palette.softInk
  var size: CGFloat = 32

  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: size * 0.48, weight: .regular))
      .foregroundStyle(tint)
      .frame(width: size, height: size)
      .background(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(fill))
      .accessibilityHidden(true)
  }
}

/// Gold "✦ Sodalis+" badge used as a heading label.
struct PlusBadge: View {
  var body: some View {
    Label(Brand.shared.plusName, systemImage: "sparkle")
      .font(.smallSemibold)
      .foregroundStyle(Palette.brightGold)
      .padding(.horizontal, 10)
      .padding(.vertical, 5)
      .background(Capsule().fill(Palette.ink))
  }
}

/// Small caps label in gold, e.g. "SAFETY GUIDE".
struct Eyebrow: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.figtree(14, .bold, relativeTo: .caption))
      .tracking(1.2)
      .textCase(.uppercase)
      .foregroundStyle(Palette.goldText)
  }
}

/// Heading + optional body used at the top of inner pages.
struct PageHeader: View {
  var eyebrow: String?
  let title: String
  var text: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if let eyebrow { Eyebrow(text: eyebrow) }
      Text(title)
        .font(.heading(32, relativeTo: .largeTitle))
        .foregroundStyle(Palette.ink)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityAddTraits(.isHeader)
      if let text {
        Text(text)
          .font(.figtree(17))
          .foregroundStyle(Palette.muted)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// A card listing numbered steps, as in the safety guide and community rules.
struct NumberedSteps: View {
  let steps: [(String, String)]

  var body: some View {
    GroupedList(items: steps.enumerated().map { NumberedItem(number: $0.offset + 1, title: $0.element.0, text: $0.element.1) }, separatorInset: 16) { item in
      HStack(alignment: .top, spacing: 14) {
        Text("\(item.number)")
          .font(.figtree(15, .bold))
          .foregroundStyle(.white)
          .frame(width: 30, height: 30)
          .background(Circle().fill(Palette.burgundy))
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 3) {
          Text(item.title).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(item.text).font(.figtree(15, relativeTo: .subheadline)).foregroundStyle(Palette.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
        Spacer(minLength: 0)
      }
      .padding(14)
      .accessibilityElement(children: .combine)
    }
  }
}

private struct NumberedItem: Identifiable {
  let number: Int
  let title: String
  let text: String
  var id: Int { number }
}

/// The SC mark in a white circle, used by empty states.
struct MonogramDisc: View {
  var size: CGFloat = 76

  var body: some View {
    Monogram(size: size * 0.6)
      .frame(width: size, height: size)
      .background(Circle().fill(Palette.card))
      .overlay(Circle().strokeBorder(Palette.line.opacity(0.7), lineWidth: 0.5))
  }
}

/// Friendly empty state: mark, title, text and up to two actions.
struct EmptyStateView: View {
  let title: String
  let text: String
  var primary: (title: String, icon: String?, action: () -> Void)?
  var secondary: (title: String, action: () -> Void)?
  var icon: AnyView? = nil

  var body: some View {
    VStack(spacing: 12) {
      if let icon { icon } else { MonogramDisc() }
      Text(title)
        .font(.heading(24))
        .foregroundStyle(Palette.ink)
        .multilineTextAlignment(.center)
        .padding(.top, 4)
      Text(text)
        .font(.figtree(17))
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
      if let primary {
        Button(action: primary.action) {
          if let icon = primary.icon {
            Label(primary.title, systemImage: icon)
          } else {
            Text(primary.title)
          }
        }
        .buttonStyle(.primary)
        .padding(.top, 8)
      }
      if let secondary {
        Button(secondary.title, action: secondary.action).buttonStyle(.text)
      }
    }
    .padding(.horizontal, 12)
    .frame(maxWidth: .infinity)
  }
}

/// Hero band with soft hills, used for trips and groups.
struct HillsBanner: View {
  let tones: [Color]
  var code: String?

  var body: some View {
    ZStack(alignment: .bottomLeading) {
      LinearGradient(colors: tones, startPoint: .top, endPoint: .bottom)
      HillsLayer(height: 0.55, opacity: 0.18, phase: 0)
      HillsLayer(height: 0.4, opacity: 0.22, phase: 1)
      if let code {
        Text(code)
          .font(.heading(26))
          .foregroundStyle(.white)
          .padding(14)
          .accessibilityHidden(true)
      }
    }
    .clipped()
  }
}

private struct HillsLayer: View {
  let height: CGFloat
  let opacity: Double
  let phase: Int

  var body: some View {
    GeometryReader { geo in
      Path { p in
        let w = geo.size.width, h = geo.size.height
        let top = h * (1 - height)
        p.move(to: CGPoint(x: 0, y: h))
        p.addLine(to: CGPoint(x: 0, y: top + h * 0.12))
        let peaks: [(CGFloat, CGFloat)] = phase == 0
          ? [(0.18, 0.0), (0.35, 0.1), (0.55, -0.02), (0.78, 0.12), (1.0, 0.04)]
          : [(0.12, 0.08), (0.3, 0.0), (0.5, 0.12), (0.7, 0.02), (0.9, 0.1), (1.0, 0.06)]
        for (x, y) in peaks {
          p.addQuadCurve(to: CGPoint(x: w * x, y: top + h * y), control: CGPoint(x: w * (x - 0.08), y: top + h * (y + 0.1)))
        }
        p.addLine(to: CGPoint(x: w, y: h))
        p.closeSubpath()
      }
      .fill(Color.black.opacity(opacity))
    }
  }
}

/// Paper behind the status bar, so content scrolling underneath doesn't show.
struct StatusBarBackdrop: View {
  var body: some View {
    GeometryReader { geo in
      Palette.paper
        .frame(height: geo.safeAreaInsets.top)
        .offset(y: -geo.safeAreaInsets.top)
    }
    .frame(height: 0)
    .allowsHitTesting(false)
  }
}

/// A form label in semibold, e.g. "Email address".
struct FieldLabel: View {
  let text: String
  var trailing: String? = nil

  init(_ text: String, trailing: String? = nil) {
    self.text = text
    self.trailing = trailing
  }

  var body: some View {
    HStack {
      Text(text).font(.figtree(16, .semibold, relativeTo: .subheadline)).foregroundStyle(Palette.ink)
      Spacer()
      if let trailing {
        Text(trailing).font(.figtree(14, relativeTo: .caption)).foregroundStyle(Palette.muted)
      }
    }
  }
}

/// Helper text under a field.
struct HelperText: View {
  let text: String
  init(_ text: String) { self.text = text }

  var body: some View {
    Text(text).font(.figtree(14, relativeTo: .footnote)).foregroundStyle(Palette.muted)
      .fixedSize(horizontal: false, vertical: true)
  }
}

/// Text field in a FieldBox with an optional leading icon.
struct InputField: View {
  let placeholder: String
  @Binding var text: String
  var icon: String? = nil
  var keyboard: UIKeyboardType = .default
  var content: UITextContentType? = nil
  var secure = false
  var submit: SubmitLabel = .next
  @FocusState private var focused: Bool
  @State private var reveal = false

  var body: some View {
    FieldBox(focused: focused) {
      HStack(spacing: 10) {
        if let icon {
          Image(systemName: icon).foregroundStyle(Palette.muted).accessibilityHidden(true)
        }
        Group {
          if secure && !reveal {
            SecureField(placeholder, text: $text)
          } else {
            TextField(placeholder, text: $text)
          }
        }
        .keyboardType(keyboard)
        .textContentType(content)
        .textInputAutocapitalization(keyboard == .emailAddress || secure ? .never : .sentences)
        .autocorrectionDisabled(keyboard == .emailAddress || secure)
        .submitLabel(submit)
        .focused($focused)
        if secure {
          Button { reveal.toggle() } label: {
            Image(systemName: reveal ? "eye.slash" : "eye").foregroundStyle(Palette.muted).frame(width: 44, height: 44)
          }
          .accessibilityLabel(reveal ? "Hide password" : "Show password")
        }
      }
    }
  }
}

/// A row in a grouped list: optional icon, title, optional subtitle and value, and a chevron.
struct ListRow: View {
  var icon: String? = nil
  var iconFill: Color = Palette.tint
  var iconTint: Color = Palette.softInk
  let title: String
  var subtitle: String? = nil
  var value: String? = nil
  var titleColor: Color = Palette.ink
  var chevron = true

  var body: some View {
    HStack(spacing: 14) {
      if let icon { IconBadge(systemName: icon, fill: iconFill, tint: iconTint) }
      VStack(alignment: .leading, spacing: 2) {
        Text(title).font(.figtree(17)).foregroundStyle(titleColor)
        if let subtitle {
          Text(subtitle).font(.figtree(14, relativeTo: .footnote)).foregroundStyle(Palette.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      Spacer(minLength: 8)
      if let value { Text(value).font(.figtree(17)).foregroundStyle(Palette.muted).lineLimit(1) }
      if chevron {
        Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.7))
      }
    }
    .padding(.horizontal, 14)
    .frame(minHeight: 52)
    .contentShape(Rectangle())
  }
}

/// A row with a burgundy switch.
struct ToggleRow: View {
  var icon: String? = nil
  let title: String
  var subtitle: String? = nil
  @Binding var isOn: Bool

  var body: some View {
    Toggle(isOn: $isOn) {
      HStack(spacing: 14) {
        if let icon { IconBadge(systemName: icon, fill: Palette.blush, tint: Palette.burgundy) }
        VStack(alignment: .leading, spacing: 2) {
          Text(title).font(.figtree(17)).foregroundStyle(Palette.ink)
          if let subtitle {
            Text(subtitle).font(.figtree(14, relativeTo: .footnote)).foregroundStyle(Palette.muted)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
    }
    .tint(Palette.burgundy)
    .padding(.horizontal, 14)
    .frame(minHeight: 52)
  }
}

/// A vertical stack of rows in a rounded card. Put a RowDivider between rows.
struct RowsCard<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    VStack(spacing: 0) { content }
      .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
      .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
  }
}

/// Inset hairline between rows in a RowsCard.
struct RowDivider: View {
  var inset: CGFloat = 14

  var body: some View {
    Rectangle().fill(Palette.line).frame(height: 0.5).padding(.leading, inset)
  }
}

/// Section caption above a grouped list, e.g. "NOTIFICATIONS".
struct SectionCaption: View {
  let text: String
  init(_ text: String) { self.text = text }

  var body: some View {
    Text(text).sectionCaps()
      .padding(.leading, 4)
      .padding(.top, 8)
      .frame(maxWidth: .infinity, alignment: .leading)
  }
}
