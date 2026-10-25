import SwiftUI

@main
struct SodalisApp: App {
  @State private var state = AppState()

  init() {
    Typography.registerFonts()
  }

  var body: some Scene {
    WindowGroup {
      Group {
        if let screen = DemoScreen.fromLaunchArguments, screen.isSignUp {
          SignUpFlowPreview(screen: screen)
        } else {
          RootView()
        }
      }
      .environment(state)
      .preferredColorScheme(.light)
      .tint(Palette.burgundy)
    }
  }
}

/// Lets the screenshot script open a given screen: launch with `-screen <name>`.
enum DemoScreen: String {
  case whosGoing = "whos-going"
  case whosGoingScrolled = "whos-going-scrolled"
  case filters
  case filtersLarge = "filters-large"
  case chat
  case chatMenu = "chat-menu"
  case signUp = "signup"
  case signUpScrolled = "signup-scrolled"
  case signUpDateWheel = "signup-date"

  static var fromLaunchArguments: DemoScreen? {
    UserDefaults.standard.string(forKey: "screen").flatMap(DemoScreen.init(rawValue:))
  }

  var isSignUp: Bool { [.signUp, .signUpScrolled, .signUpDateWheel].contains(self) }
}

struct RootView: View {
  @Environment(AppState.self) private var state

  var body: some View {
    @Bindable var state = state
    GeometryReader { geo in
      let metrics = TabBarMetrics(safeBottom: geo.safeAreaInsets.bottom)
      ZStack(alignment: .bottom) {
        Group {
          switch state.tab {
          case .whosGoing: WhosGoingTab()
          case .trips: PlaceholderTab(title: "Trips")
          case .chat: ChatTab()
          case .profile: PlaceholderTab(title: "Profile")
          }
        }
        .environment(\.tabBarMetrics, metrics)

        if state.showsTabBar {
          FloatingTabBar(selection: $state.tab, unread: state.unreadChats, metrics: metrics)
            .padding(.bottom, metrics.bottomGap - (metrics.isSmallPhone ? 0 : geo.safeAreaInsets.bottom))
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }

        if let banner = state.banner {
          BannerView(banner: banner) { state.banner = nil }
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
      }
      .ignoresSafeArea(.keyboard)
    }
    .background(Palette.paper.ignoresSafeArea())
    .onAppear {
      if let screen = DemoScreen.fromLaunchArguments, [.chat, .chatMenu].contains(screen) {
        state.tab = .chat
      }
    }
  }
}

private struct TabBarMetricsKey: EnvironmentKey {
  static let defaultValue = TabBarMetrics(safeBottom: 34)
}

extension EnvironmentValues {
  var tabBarMetrics: TabBarMetrics {
    get { self[TabBarMetricsKey.self] }
    set { self[TabBarMetricsKey.self] = newValue }
  }
}

struct PlaceholderTab: View {
  let title: String

  var body: some View {
    NavigationStack {
      VStack(spacing: 12) {
        Monogram(size: 56)
        Text("\(title) comes in the next batch.")
          .font(.body17)
          .foregroundStyle(Palette.muted)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Palette.paper)
      .navigationTitle(title)
    }
  }
}
