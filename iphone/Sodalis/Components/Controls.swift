import SwiftUI

/// Segmented control for tabs inside a page (Connections / Groups / Requests, Women / Men / Everyone).
struct SegmentedPicker<Value: Hashable>: View {
  let options: [(value: Value, title: String)]
  @Binding var selection: Value
  @Namespace private var pill

  var body: some View {
    HStack(spacing: 0) {
      ForEach(options.indices, id: \.self) { index in
        let option = options[index]
        let selected = option.value == selection
        Button {
          withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { selection = option.value }
        } label: {
          Text(option.title)
            .font(.figtree(17, selected ? .medium : .regular))
            .foregroundStyle(selected ? Palette.ink : Palette.softInk)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background {
              if selected {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                  .fill(Palette.card)
                  .shadow(color: Palette.ink.opacity(0.12), radius: 3, y: 1)
                  .matchedGeometryEffect(id: "pill", in: pill)
              }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
      }
    }
    .padding(3)
    .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Color(hex: 0xE6DECF)))
  }
}

private struct SliderThumb: View {
  var body: some View {
    Circle()
      .fill(.white)
      .frame(width: 30, height: 30)
      .shadow(color: .black.opacity(0.18), radius: 3, y: 1.5)
      .overlay(Circle().strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
      .frame(width: 44, height: 44)
      .contentShape(Rectangle())
  }
}

/// Two-thumb slider for an age range.
struct RangeSlider: View {
  @Binding var lower: Int
  @Binding var upper: Int
  let bounds: ClosedRange<Int>
  var minimumGap = 1
  var accessibilityName = "Range"

  var body: some View {
    GeometryReader { geo in
      let inset: CGFloat = 22
      let width = geo.size.width - inset * 2
      let span = CGFloat(bounds.upperBound - bounds.lowerBound)
      let x = { (v: Int) in inset + CGFloat(v - bounds.lowerBound) / span * width }
      let value = { (px: CGFloat) in bounds.lowerBound + Int(((px - inset) / width * span).rounded()) }

      ZStack(alignment: .leading) {
        Capsule().fill(Palette.line).frame(height: 4).padding(.horizontal, inset)
        Capsule().fill(Palette.burgundy)
          .frame(width: max(0, x(upper) - x(lower)), height: 4)
          .offset(x: x(lower))
        SliderThumb()
          .position(x: x(lower), y: geo.size.height / 2)
          .gesture(DragGesture().onChanged { g in
            lower = min(max(value(g.location.x), bounds.lowerBound), upper - minimumGap)
          })
          .accessibilityElement()
          .accessibilityLabel("\(accessibilityName), lowest")
          .accessibilityValue("\(lower)")
          .accessibilityAdjustableAction { dir in
            if dir == .increment, lower < upper - minimumGap { lower += 1 }
            if dir == .decrement, lower > bounds.lowerBound { lower -= 1 }
          }
        SliderThumb()
          .position(x: x(upper), y: geo.size.height / 2)
          .gesture(DragGesture().onChanged { g in
            upper = max(min(value(g.location.x), bounds.upperBound), lower + minimumGap)
          })
          .accessibilityElement()
          .accessibilityLabel("\(accessibilityName), highest")
          .accessibilityValue("\(upper)")
          .accessibilityAdjustableAction { dir in
            if dir == .increment, upper < bounds.upperBound { upper += 1 }
            if dir == .decrement, upper > lower + minimumGap { upper -= 1 }
          }
      }
    }
    .frame(height: 44)
  }
}

/// One-thumb slider in the same style as the range slider.
struct ValueSlider: View {
  @Binding var value: Int
  let bounds: ClosedRange<Int>
  var step = 1
  var accessibilityName = "Value"

  var body: some View {
    GeometryReader { geo in
      let inset: CGFloat = 22
      let width = geo.size.width - inset * 2
      let span = CGFloat(bounds.upperBound - bounds.lowerBound)
      let x = inset + CGFloat(value - bounds.lowerBound) / span * width

      ZStack(alignment: .leading) {
        Capsule().fill(Palette.line).frame(height: 4).padding(.horizontal, inset)
        Capsule().fill(Palette.burgundy).frame(width: max(0, x - inset), height: 4).offset(x: inset)
        SliderThumb()
          .position(x: x, y: geo.size.height / 2)
          .gesture(DragGesture().onChanged { g in
            let raw = bounds.lowerBound + Int(((g.location.x - inset) / width * span).rounded())
            let stepped = (raw / step) * step
            value = min(max(stepped, bounds.lowerBound), bounds.upperBound)
          })
      }
    }
    .frame(height: 44)
    .accessibilityElement()
    .accessibilityLabel(accessibilityName)
    .accessibilityValue("\(value)")
    .accessibilityAdjustableAction { dir in
      if dir == .increment { value = min(value + step, bounds.upperBound) }
      if dir == .decrement { value = max(value - step, bounds.lowerBound) }
    }
  }
}

/// Text field in the app's style: 52pt tall card with a hairline, burgundy outline when focused.
struct FieldBox<Content: View>: View {
  var focused = false
  var minHeight: CGFloat = 52
  @ViewBuilder var content: Content

  var body: some View {
    content
      .font(.body17)
      .foregroundStyle(Palette.ink)
      .padding(.horizontal, 16)
      .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .leading)
      .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
      .overlay(
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .strokeBorder(focused ? Palette.burgundy : Palette.line, lineWidth: focused ? 1.5 : 1)
      )
  }
}
