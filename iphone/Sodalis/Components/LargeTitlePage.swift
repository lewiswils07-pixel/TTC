import SwiftUI

struct ScrollOffsetKey: PreferenceKey {
  static var defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

extension View {
  /// On iOS 18 and later, reads the scroll position straight from the scroll view
  /// (more reliable than the preference used on iOS 17).
  @ViewBuilder func trackScrollOffset(_ offset: Binding<CGFloat>) -> some View {
    if #available(iOS 18.0, *) {
      onScrollGeometryChange(for: CGFloat.self) { geo in
        -(geo.contentOffset.y + geo.contentInsets.top)
      } action: { _, new in
        offset.wrappedValue = new
      }
    } else {
      self
    }
  }
}

/// Main tab page: a large Newsreader title (34pt) that shrinks into the top
/// bar when you scroll. Optionally shows the primary logo above the title.
struct LargeTitlePage<Trailing: View, CompactTrailing: View, Content: View>: View {
  let title: String
  var compactTitle: String? = nil
  var showsLogo = false
  var bottomPadding: CGFloat = 120
  @ViewBuilder var trailing: Trailing
  @ViewBuilder var compactTrailing: CompactTrailing
  @ViewBuilder var content: Content

  @State private var offset: CGFloat = 0

  private var compact: Bool { offset < (showsLogo ? -110 : -50) }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        header
          .background(GeometryReader { g in
            Color.clear.preference(key: ScrollOffsetKey.self, value: g.frame(in: .named("page")).minY)
          })
        content
      }
      .padding(.horizontal, 16)
      .padding(.bottom, bottomPadding)
    }
    .coordinateSpace(name: "page")
    .onPreferenceChange(ScrollOffsetKey.self) { offset = $0 }
    .trackScrollOffset($offset)
    .scrollIndicators(.hidden)
    .demoScrolled()
    .background(Palette.paper)
    .overlay(alignment: .top) { compactBar }
    .overlay(alignment: .top) { StatusBarBackdrop() }
    .toolbar(.hidden, for: .navigationBar)
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        if showsLogo {
          PrimaryLogo(height: 46).padding(.top, 2)
        }
        Spacer()
        trailing
      }
      .frame(minHeight: 44)
      Text(title)
        .font(.largeTitleSerif)
        .foregroundStyle(Palette.ink)
        .accessibilityAddTraits(.isHeader)
        .padding(.top, showsLogo ? 0 : 2)
    }
    .padding(.bottom, 14)
  }

  @ViewBuilder private var compactBar: some View {
    if compact {
      VStack(spacing: 0) {
        ZStack {
          Text(compactTitle ?? title)
            .font(.figtree(17, .semibold))
            .foregroundStyle(Palette.ink)
          HStack {
            if showsLogo { PrimaryLogo(height: 34) }
            Spacer()
            compactTrailing
          }
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
        Rectangle().fill(Palette.line).frame(height: 0.5)
      }
      .background(Palette.paper.opacity(0.98))
      .transition(.opacity)
    }
  }
}

extension LargeTitlePage where CompactTrailing == EmptyView {
  init(title: String, compactTitle: String? = nil, showsLogo: Bool = false, bottomPadding: CGFloat = 120,
       @ViewBuilder trailing: () -> Trailing, @ViewBuilder content: () -> Content) {
    self.title = title
    self.compactTitle = compactTitle
    self.showsLogo = showsLogo
    self.bottomPadding = bottomPadding
    self.trailing = trailing()
    self.compactTrailing = EmptyView()
    self.content = content()
  }
}

/// A round 44pt icon button used in page headers (search, settings, add).
struct HeaderIconButton: View {
  let systemName: String
  let label: String
  var filled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(.system(size: filled ? 20 : 21, weight: filled ? .semibold : .regular))
        .foregroundStyle(filled ? .white : Palette.ink)
        .frame(width: 44, height: 44)
        .background { if filled { Circle().fill(Palette.burgundy) } }
        .contentShape(Circle())
    }
    .accessibilityLabel(label)
  }
}
