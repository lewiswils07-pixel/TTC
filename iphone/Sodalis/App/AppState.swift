import Observation
import SwiftUI

@Observable
final class AppState {
  enum Phase { case launch, welcome, faceIDUnlock, main }

  var phase: Phase = .launch
  var tab: AppTab = .whosGoing
  var paths: [AppTab: [Route]] = [:]
  var onboarding: [OnboardingRoute] = []
  var sheet: SheetRoute?
  var cover: CoverRoute?

  var unreadChats = 2
  var isPlus = false
  var faceIDOn = true
  var memberName = SampleData.me.name
  /// Your chosen profile photo (kept on the device until the app is connected).
  var myPhoto: UIImage?
  var myInterests = ["Food markets", "Coastal walks", "Galleries", "Live music", "Gardens"]

  /// Pages that hide the floating tab bar (a chat, someone's profile) add their name here while open.
  var tabBarHiders: Set<String> = []
  var banner: Banner?

  var showsTabBar: Bool { tabBarHiders.isEmpty }

  // MARK: Navigation

  func path(for tab: AppTab) -> Binding<[Route]> {
    Binding(get: { self.paths[tab] ?? [] }, set: { self.paths[tab] = $0 })
  }

  func push(_ route: Route) {
    paths[tab, default: []].append(route)
  }

  func open(_ route: Route, in tab: AppTab) {
    self.tab = tab
    paths[tab] = [route]
  }

  /// The label for a page's back button: the screen it came from.
  func backTitle(for route: Route) -> String {
    let path = paths[tab] ?? []
    guard let index = path.lastIndex(of: route) else { return tab.backTitle }
    return index == 0 ? tab.backTitle : path[index - 1].shortTitle
  }

  func signOut() {
    paths = [:]
    tab = .whosGoing
    withAnimation { phase = .welcome }
  }

  // MARK: Banner

  struct Banner: Identifiable, Equatable {
    let id = UUID()
    let message: String
    var detail: String?
    var undo: (() -> Void)?

    static func == (a: Banner, b: Banner) -> Bool { a.id == b.id }
  }

  func show(_ message: String, detail: String? = nil, undo: (() -> Void)? = nil) {
    let banner = Banner(message: message, detail: detail, undo: undo)
    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { self.banner = banner }
    guard Demo.current == nil else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
      guard self?.banner?.id == banner.id else { return }
      withAnimation(.easeOut(duration: 0.25)) { self?.banner = nil }
    }
  }
}

extension View {
  /// Hides the floating tab bar while this page is on screen.
  func hidesTabBar(_ name: String, in state: AppState) -> some View {
    onAppear { state.tabBarHiders.insert(name) }
      .onDisappear { state.tabBarHiders.remove(name) }
  }
}

/// Confirmation banner with Undo, e.g. after Connect.
struct BannerView: View {
  let banner: AppState.Banner
  let dismiss: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "checkmark")
        .font(.system(size: 15, weight: .bold))
        .foregroundStyle(.white)
        .frame(width: 32, height: 32)
        .background(Circle().fill(Palette.success))
      VStack(alignment: .leading, spacing: 1) {
        Text(banner.message).font(.figtree(17, .semibold)).foregroundStyle(.white)
        if let detail = banner.detail {
          Text(detail).font(.figtree(15, relativeTo: .footnote)).foregroundStyle(.white.opacity(0.75))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      if let undo = banner.undo {
        Button("Undo") {
          undo()
          dismiss()
        }
        .font(.figtree(17, .semibold))
        .foregroundStyle(Palette.brightGold)
        .frame(minWidth: 44, minHeight: 44)
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 8)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.ink.opacity(0.95)))
    .shadow(color: .black.opacity(0.2), radius: 14, y: 6)
    .padding(.horizontal, 12)
    .accessibilityElement(children: .contain)
  }
}
