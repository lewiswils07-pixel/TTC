import SwiftUI

@main
struct SodalisApp: App {
  @State private var state = AppState()

  init() {
    Typography.registerFonts()
  }

  var body: some Scene {
    WindowGroup {
      AppRoot()
        .environment(state)
        .preferredColorScheme(.light)
        .tint(Palette.burgundy)
        .onAppear { Demo.apply(to: state) }
    }
  }
}

/// Launch → welcome and sign-up → the four tabs.
struct AppRoot: View {
  @Environment(AppState.self) private var state

  var body: some View {
    ZStack {
      switch state.phase {
      case .launch:
        LaunchScreen()
          .transition(.opacity)
          .task {
            guard Demo.current == nil else { return }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            withAnimation(.easeInOut(duration: 0.4)) { state.phase = .welcome }
          }
      case .welcome:
        OnboardingFlow().transition(.opacity)
      case .faceIDUnlock:
        FaceIDUnlockScreen().transition(.opacity)
      case .main:
        RootView().transition(.opacity)
      }
    }
  }
}

struct RootView: View {
  @Environment(AppState.self) private var state

  var body: some View {
    @Bindable var state = state
    GeometryReader { geo in
      let metrics = TabBarMetrics(safeBottom: geo.safeAreaInsets.bottom)
      ZStack(alignment: .bottom) {
        ZStack {
          ForEach(AppTab.allCases) { tab in
            TabRoot(tab: tab)
              .opacity(state.tab == tab ? 1 : 0)
              .allowsHitTesting(state.tab == tab)
              .accessibilityHidden(state.tab != tab)
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
            .padding(.top, 6)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
      }
      .ignoresSafeArea(.keyboard)
    }
    .background(Palette.paper.ignoresSafeArea())
    .sheet(item: $state.sheet) { sheet in
      SheetView(route: sheet)
    }
    .fullScreenCover(item: $state.cover) { cover in
      CoverView(route: cover)
    }
  }
}

private struct TabRoot: View {
  let tab: AppTab
  @Environment(AppState.self) private var state

  var body: some View {
    NavigationStack(path: state.path(for: tab)) {
      Group {
        switch tab {
        case .whosGoing: WhosGoingScreen()
        case .trips: TripsScreen()
        case .chat: ChatListScreen()
        case .profile: ProfileScreen()
        }
      }
      .withRoutes()
    }
  }
}

private struct SheetView: View {
  let route: SheetRoute

  var body: some View {
    Group {
      switch route {
      case .addTrip(let code): AddTripSheet(editing: code)
      case .startGroup: StartGroupSheet()
      case .planTrip(let name): PlanTripSheet(name: name)
      case .shareMeeting(let name): ShareMeetingSheet(name: name)
      case .report(let name): ReportSheet(name: name)
      }
    }
    .sodalisSheet(detents: [.large])
  }
}

private struct CoverView: View {
  let route: CoverRoute

  var body: some View {
    switch route {
    case .plus: PlusScreen()
    case .allowPhotos: AllowPhotosScreen()
    case .allowCamera: AllowCameraScreen()
    case .allowNotifications: AllowNotificationsScreen()
    case .crop(let image): CropScreen(image: image)
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
