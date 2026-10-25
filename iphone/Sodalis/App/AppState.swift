import Observation
import SwiftUI

@Observable
final class AppState {
  var tab: AppTab = .whosGoing
  var unreadChats = 2
  /// Pages that hide the floating tab bar (a chat, sign-up) add their name here while open.
  var tabBarHiders: Set<String> = []
  var banner: Banner?

  var showsTabBar: Bool { tabBarHiders.isEmpty }

  struct Banner: Identifiable, Equatable {
    let id = UUID()
    let message: String
    var undo: (() -> Void)?

    static func == (a: Banner, b: Banner) -> Bool { a.id == b.id }
  }

  func show(_ message: String, undo: (() -> Void)? = nil) {
    let banner = Banner(message: message, undo: undo)
    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { self.banner = banner }
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

/// Confirmation banner with Undo, shown after Connect.
struct BannerView: View {
  let banner: AppState.Banner
  let dismiss: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 22))
        .foregroundStyle(Palette.brightGold)
      Text(banner.message)
        .font(.figtree(17, .medium))
        .foregroundStyle(.white)
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
    .padding(.horizontal, 16)
    .padding(.vertical, 6)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.ink.opacity(0.94)))
    .shadow(color: .black.opacity(0.2), radius: 14, y: 6)
    .padding(.horizontal, 16)
    .accessibilityElement(children: .contain)
  }
}
