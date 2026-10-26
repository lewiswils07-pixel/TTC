import SwiftUI

enum AppTab: Int, CaseIterable, Identifiable {
  case whosGoing, trips, chat, profile

  var id: Int { rawValue }

  var title: String {
    switch self {
    case .whosGoing: "Who's going"
    case .trips: "Trips"
    case .chat: "Chat"
    case .profile: "Profile"
    }
  }

  var icon: String {
    switch self {
    case .whosGoing: "safari"
    case .trips: "suitcase"
    case .chat: "bubble.left"
    case .profile: "person"
    }
  }

  /// "Who's going" is about 1.3× wider so its label sits inside the pill.
  var widthShare: CGFloat { self == .whosGoing ? 1.3 : 1 }
}

/// Sizes for the floating tab bar, which change on small iPhones (SE).
struct TabBarMetrics {
  let isSmallPhone: Bool
  let safeBottom: CGFloat

  var height: CGFloat { 64 }
  var sideInset: CGFloat { isSmallPhone ? 12 : 14 }
  var bottomGap: CGFloat { isSmallPhone ? 8 : 20 }

  /// Bottom padding (inside the safe area) for sticky buttons that sit just above the bar.
  var stickyPadding: CGFloat { height + bottomGap - safeBottom + 14 }

  init(safeBottom: CGFloat) {
    self.safeBottom = safeBottom
    isSmallPhone = safeBottom < 1
  }
}

/// Floating glass capsule: 64pt tall, radius 32, content shows through blurred.
/// The selected tab gets a blush pill that slides across.
struct FloatingTabBar: View {
  @Binding var selection: AppTab
  var unread: Int
  let metrics: TabBarMetrics
  @Namespace private var pillSpace

  var body: some View {
    GeometryReader { geo in
      let inner = geo.size.width - 8
      let unit = inner / AppTab.allCases.reduce(0) { $0 + $1.widthShare }
      HStack(spacing: 0) {
        ForEach(AppTab.allCases) { tab in
          tabButton(tab, width: unit * tab.widthShare)
        }
      }
      .padding(4)
    }
    .frame(height: metrics.height)
    .background { glass }
    .padding(.horizontal, metrics.sideInset)
  }

  private func tabButton(_ tab: AppTab, width: CGFloat) -> some View {
    let selected = tab == selection
    return Button {
      if selection != tab {
        UISelectionFeedbackGenerator().selectionChanged()
        withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) { selection = tab }
      }
    } label: {
      VStack(spacing: 3) {
        Image(systemName: tab.icon)
          .font(.system(size: 22, weight: .regular))
          .frame(height: 26)
          .overlay(alignment: .topTrailing) {
            if tab == .chat, unread > 0 {
              Text("\(unread)")
                .font(.figtree(14, .semibold, relativeTo: .caption))
                .foregroundStyle(.white)
                .frame(minWidth: 22, minHeight: 22)
                .background(Circle().fill(Palette.burgundy))
                .overlay(Circle().strokeBorder(Palette.card, lineWidth: 2))
                .offset(x: 13, y: -9)
                .accessibilityHidden(true)
            }
          }
        Text(tab.title)
          .font(.figtree(14, .semibold, relativeTo: .caption))
          .lineLimit(1)
          .minimumScaleFactor(0.75)
          .dynamicTypeSize(...DynamicTypeSize.xLarge)
      }
      .foregroundStyle(selected ? Palette.burgundy : Palette.tabInk)
      .frame(width: width, height: 56)
      .background {
        if selected {
          selectedPill.matchedGeometryEffect(id: "pill", in: pillSpace)
        }
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(tab == .chat && unread > 0 ? "\(tab.title), \(unread) unread" : tab.title)
    .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
  }

  @ViewBuilder private var selectedPill: some View {
    let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
    #if compiler(>=6.2)
    if #available(iOS 26.0, *) {
      Color.clear
        .glassEffect(.regular.tint(Palette.blush.opacity(0.7)).interactive(), in: shape)
    } else {
      shape.fill(Palette.blush.opacity(0.9))
    }
    #else
    shape.fill(Palette.blush.opacity(0.9))
    #endif
  }

  @ViewBuilder private var glass: some View {
    let shape = RoundedRectangle(cornerRadius: 32, style: .continuous)
    #if compiler(>=6.2)
    if #available(iOS 26.0, *) {
      // Real iOS 26 Liquid Glass: clear, bends and blurs what's behind it.
      Color.clear
        .glassEffect(.regular.interactive(), in: shape)
        .shadow(color: Palette.ink.opacity(0.10), radius: 16, y: 6)
    } else {
      fallbackGlass(shape)
    }
    #else
    fallbackGlass(shape)
    #endif
  }

  private func fallbackGlass(_ shape: RoundedRectangle) -> some View {
    shape.fill(.ultraThinMaterial)
      .overlay(shape.fill(Palette.card.opacity(0.18)))
      .overlay(
        shape.strokeBorder(
          LinearGradient(colors: [.white.opacity(0.95), .white.opacity(0.2)], startPoint: .top, endPoint: .bottom),
          lineWidth: 1
        )
      )
      .shadow(color: Palette.ink.opacity(0.14), radius: 18, y: 8)
  }
}
