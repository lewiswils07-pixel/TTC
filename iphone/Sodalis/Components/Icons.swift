import SwiftUI

/// Outline map pin (a teardrop with a dot), drawn to match the designs.
struct PinIcon: View {
  var size: CGFloat = 18
  var lineWidth: CGFloat = 1.6

  var body: some View {
    ZStack {
      PinShape().stroke(style: StrokeStyle(lineWidth: lineWidth, lineJoin: .round))
      Circle().stroke(lineWidth: lineWidth)
        .frame(width: size * 0.3, height: size * 0.3)
        .offset(y: -size * 0.1)
    }
    .frame(width: size * 0.8, height: size)
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

private struct PinShape: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path()
    let cx = r.midX
    let radius = r.width / 2
    let cy = r.minY + radius
    p.move(to: CGPoint(x: cx, y: r.maxY))
    p.addCurve(
      to: CGPoint(x: r.minX, y: cy),
      control1: CGPoint(x: cx - radius * 0.35, y: r.maxY - r.height * 0.18),
      control2: CGPoint(x: r.minX, y: cy + radius * 0.75)
    )
    p.addArc(center: CGPoint(x: cx, y: cy), radius: radius, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
    p.addCurve(
      to: CGPoint(x: cx, y: r.maxY),
      control1: CGPoint(x: r.maxX, y: cy + radius * 0.75),
      control2: CGPoint(x: cx + radius * 0.35, y: r.maxY - r.height * 0.18)
    )
    return p
  }
}

/// Route mark (two stops joined by an S-shaped path), used for "going your way" and travel style.
struct RouteIcon: View {
  var size: CGFloat = 18
  var lineWidth: CGFloat = 1.7

  var body: some View {
    Canvas { ctx, sz in
      let w = sz.width, h = sz.height
      let r = w * 0.15
      let top = CGPoint(x: w - r - lineWidth, y: r + lineWidth)
      let bottom = CGPoint(x: r + lineWidth, y: h - r - lineWidth)
      var path = Path()
      path.move(to: CGPoint(x: top.x - r, y: top.y))
      path.addLine(to: CGPoint(x: w * 0.32, y: top.y))
      path.addArc(center: CGPoint(x: w * 0.32, y: h * 0.38), radius: h * 0.38 - top.y, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: true)
      path.addLine(to: CGPoint(x: w * 0.68, y: h * 0.38 + (h * 0.38 - top.y)))
      path.addArc(center: CGPoint(x: w * 0.68, y: (h * 0.38 + (h * 0.38 - top.y) + bottom.y) / 2), radius: (bottom.y - (h * 0.38 + (h * 0.38 - top.y))) / 2, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: false)
      path.addLine(to: CGPoint(x: bottom.x + r, y: bottom.y))
      ctx.stroke(path, with: .foreground, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))
      ctx.stroke(Path(ellipseIn: CGRect(x: top.x - r, y: top.y - r, width: r * 2, height: r * 2)), with: .foreground, lineWidth: lineWidth)
      ctx.stroke(Path(ellipseIn: CGRect(x: bottom.x - r, y: bottom.y - r, width: r * 2, height: r * 2)), with: .foreground, lineWidth: lineWidth)
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}
