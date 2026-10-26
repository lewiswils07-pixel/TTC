import SwiftUI

/// Primary logo "1a": SODALIS in capitals with "Collective" in script.
/// Drawn from the same outline as the web app's logo (app/src/lib/logo.ts).
/// Give `scriptColor` to colour "Collective" differently (gold on burgundy).
struct PrimaryLogo: View {
  var height: CGFloat = 52
  var color: Color = Palette.burgundy
  var scriptColor: Color? = nil

  var body: some View {
    ZStack {
      part("LogoWord", color)
      part("LogoScript", scriptColor ?? color)
    }
    .frame(height: height)
    .accessibilityElement()
    .accessibilityLabel(Brand.shared.name)
  }

  private func part(_ name: String, _ tint: Color) -> some View {
    Image(name)
      .resizable()
      .renderingMode(.template)
      .scaledToFit()
      .foregroundStyle(tint)
  }
}

/// The SC monogram, for small marks.
struct Monogram: View {
  var size: CGFloat = 28
  var color: Color = Palette.burgundy

  var body: some View {
    Image("Monogram")
      .resizable()
      .renderingMode(.template)
      .scaledToFit()
      .frame(width: size, height: size)
      .foregroundStyle(color)
      .accessibilityHidden(true)
  }
}

/// Stand-in member photo: warm gradient with a soft silhouette.
/// Real photos come from the members' profiles once the app is connected.
struct PhotoPlaceholder: View {
  var tones: [Color] = [Color(hex: 0xE8C9A8), Color(hex: 0xC99A6E)]

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      let h = geo.size.height
      ZStack {
        LinearGradient(colors: tones, startPoint: .topLeading, endPoint: .bottomTrailing)
        Circle()
          .fill(Color.white.opacity(0.72))
          .frame(width: h * 0.39, height: h * 0.39)
          .position(x: w / 2, y: h * 0.42)
        Ellipse()
          .fill(Color.white.opacity(0.72))
          .frame(width: h * 0.78, height: h * 0.7)
          .position(x: w / 2, y: h * 1.04)
      }
    }
    .clipped()
    .accessibilityHidden(true)
  }
}

/// Round avatar stand-in.
struct Avatar: View {
  var size: CGFloat = 40
  var tones: [Color] = [Color(hex: 0xE7B8B2), Color(hex: 0xC98B86)]

  var body: some View {
    PhotoPlaceholder(tones: tones)
      .frame(width: size, height: size)
      .clipShape(Circle())
  }
}

/// Small trip thumbnail: a gradient with soft hills.
struct PlaceThumb: View {
  var tones: [Color]
  var size: CGFloat = 44

  var body: some View {
    ZStack(alignment: .bottom) {
      LinearGradient(colors: tones, startPoint: .top, endPoint: .bottom)
      HillShape()
        .fill(Color.black.opacity(0.22))
        .frame(height: size * 0.42)
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    .accessibilityHidden(true)
  }
}

private struct HillShape: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: r.minX, y: r.maxY))
    p.addLine(to: CGPoint(x: r.minX, y: r.minY + r.height * 0.6))
    p.addLine(to: CGPoint(x: r.width * 0.22, y: r.minY + r.height * 0.15))
    p.addLine(to: CGPoint(x: r.width * 0.42, y: r.minY + r.height * 0.55))
    p.addLine(to: CGPoint(x: r.width * 0.62, y: r.minY))
    p.addLine(to: CGPoint(x: r.width * 0.85, y: r.minY + r.height * 0.5))
    p.addLine(to: CGPoint(x: r.maxX, y: r.minY + r.height * 0.3))
    p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
    p.closeSubpath()
    return p
  }
}
