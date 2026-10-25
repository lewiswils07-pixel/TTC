import SwiftUI

// Chips: 44pt tall, radius 22. Selected = blush fill with a 1.5pt burgundy outline.

struct Chip: View {
  let title: String
  let isSelected: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(.figtree(17, isSelected ? .semibold : .regular))
        .foregroundStyle(isSelected ? Palette.burgundy : Palette.ink)
        .padding(.horizontal, 15)
        .frame(minHeight: 44)
        .background(Capsule().fill(isSelected ? Palette.blush : Palette.card))
        .overlay(
          Capsule().strokeBorder(isSelected ? Palette.burgundy : Palette.line, lineWidth: isSelected ? 1.5 : 1)
        )
        .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }
}

/// Lays chips out left to right, wrapping onto new lines.
struct FlowLayout: Layout {
  var spacing: CGFloat = 10
  var lineSpacing: CGFloat = 10

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? .infinity
    var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, widest: CGFloat = 0
    for view in subviews {
      let size = view.sizeThatFits(.unspecified)
      if x > 0, x + size.width > width {
        y += lineHeight + lineSpacing
        x = 0
        lineHeight = 0
      }
      x += size.width + spacing
      widest = max(widest, x - spacing)
      lineHeight = max(lineHeight, size.height)
    }
    return CGSize(width: proposal.width ?? widest, height: y + lineHeight)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
    for view in subviews {
      let size = view.sizeThatFits(.unspecified)
      if x > bounds.minX, x + size.width > bounds.maxX {
        y += lineHeight + lineSpacing
        x = bounds.minX
        lineHeight = 0
      }
      view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
      x += size.width + spacing
      lineHeight = max(lineHeight, size.height)
    }
  }
}

/// A row of chips where one can be picked.
struct ChipPicker: View {
  let options: [String]
  @Binding var selection: String?

  var body: some View {
    FlowLayout {
      ForEach(options, id: \.self) { option in
        Chip(title: option, isSelected: selection == option) {
          selection = selection == option ? nil : option
        }
      }
    }
  }
}

/// A row of chips where several can be picked.
struct MultiChipPicker: View {
  let options: [String]
  @Binding var selection: Set<String>

  var body: some View {
    FlowLayout {
      ForEach(options, id: \.self) { option in
        Chip(title: option, isSelected: selection.contains(option)) {
          if selection.contains(option) { selection.remove(option) } else { selection.insert(option) }
        }
      }
    }
  }
}
