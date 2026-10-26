import SwiftUI
import UIKit

// Inner pages use the standard iOS top bar: back chevron with the previous
// screen's name, title in the middle, one action on the right.

/// Burgundy back chevron with a label, e.g. "‹ Chat".
struct BackButton: View {
  let title: String
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    Button { dismiss() } label: {
      HStack(spacing: 6) {
        Image(systemName: "chevron.left")
          .font(.system(size: 19, weight: .medium))
        Text(title)
          .font(.figtree(17))
      }
      .foregroundStyle(Palette.burgundy)
      .frame(minHeight: 44)
      .contentShape(Rectangle())
    }
    .accessibilityLabel("Back to \(title)")
  }
}

extension View {
  /// Standard top bar for an inner page: back button named after the previous
  /// screen, a title in the middle and an optional action on the right.
  /// Drawn by the app (not the system bar) so it matches the designs exactly;
  /// swipe back from the left edge still works.
  func innerTopBar<Title: View, Trailing: View>(
    back: String,
    @ViewBuilder title: () -> Title,
    @ViewBuilder trailing: () -> Trailing
  ) -> some View {
    let bar = InnerTopBar(back: back, title: title(), trailing: trailing())
    return self
      .navigationBarBackButtonHidden(true)
      .toolbar(.hidden, for: .navigationBar)
      .safeAreaInset(edge: .top, spacing: 0) { bar }
  }

  func innerTopBar(back: String, title: String) -> some View {
    innerTopBar(back: back) {
      Text(title).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
    } trailing: {
      EmptyView()
    }
  }
}

private struct InnerTopBar<Title: View, Trailing: View>: View {
  let back: String
  let title: Title
  let trailing: Trailing

  var body: some View {
    VStack(spacing: 0) {
      ZStack {
        title
          .lineLimit(1)
          .padding(.horizontal, 96)
          .accessibilityAddTraits(.isHeader)
        HStack(spacing: 0) {
          BackButton(title: back)
          Spacer(minLength: 8)
          trailing
        }
      }
      .padding(.horizontal, 12)
      .frame(minHeight: 52)
      Rectangle().fill(Palette.line).frame(height: 0.5)
    }
    .background(Palette.paper.opacity(0.97).ignoresSafeArea(edges: .top))
  }
}

// Keeps swipe-back from the left edge working when the back button is our own.
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
  override open func viewDidLoad() {
    super.viewDidLoad()
    interactivePopGestureRecognizer?.delegate = self
  }

  public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    viewControllers.count > 1
  }
}

/// The header used by bottom sheets: an action on the left, a title, and a close or Done button.
struct SheetHeader<Leading: View, Trailing: View>: View {
  let title: String
  @ViewBuilder var leading: Leading
  @ViewBuilder var trailing: Trailing

  var body: some View {
    ZStack {
      Text(title)
        .font(.figtree(17, .semibold))
        .foregroundStyle(Palette.ink)
        .accessibilityAddTraits(.isHeader)
      HStack {
        leading
        Spacer()
        trailing
      }
    }
    .padding(.horizontal, 16)
    .frame(minHeight: 52)
  }
}

extension View {
  /// Bottom sheet styling: grab handle, paper background, rounded top, swipe down to close.
  func sodalisSheet(detents: Set<PresentationDetent> = [.medium, .large], selection: Binding<PresentationDetent>? = nil) -> some View {
    modifier(SheetStyle(detents: detents, selection: selection))
  }
}

private struct SheetStyle: ViewModifier {
  let detents: Set<PresentationDetent>
  let selection: Binding<PresentationDetent>?

  func body(content: Content) -> some View {
    Group {
      if let selection {
        content.presentationDetents(detents, selection: selection)
      } else {
        content.presentationDetents(detents)
      }
    }
    .presentationDragIndicator(.visible)
    .presentationCornerRadius(28)
    .presentationBackground(Palette.paper)
  }
}
