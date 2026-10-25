import SwiftUI

struct MemberFilters: Equatable {
  enum ShowMe: Hashable { case women, men, everyone }

  var minAge = 50
  var maxAge = 70
  var showMe = ShowMe.everyone
  var miles = 50
  var budget: String?
  var pace: String?

  static let budgets = ["Budget", "Comfort", "Luxury"]
  static let paces = ["Slow and steady", "Balanced", "Packed days"]
}

/// Bottom sheet, half height, swipe down to close.
struct FiltersSheet: View {
  @Binding var filters: MemberFilters
  let town: String
  let count: Int
  let close: () -> Void

  /// Sodalis+ members can use travel style filters.
  var isPlus = false

  var body: some View {
    VStack(spacing: 0) {
      SheetHeader(title: "Filters") {
        Button("Reset") { filters = MemberFilters() }
          .buttonStyle(TextButtonStyle(weight: .regular))
      } trailing: {
        CircleIconButton(systemName: "xmark", label: "Close", action: close)
          .padding(.trailing, -7)
      }
      .padding(.top, 14)

      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          agesCard
          showMe
          distanceCard
          travelStyle
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 24)
      }
      .scrollIndicators(.hidden)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        Button("Show \(count) members", action: close).buttonStyle(.primary)
      }
    }
    .background(Palette.paper)
  }

  private var agesCard: some View {
    VStack(spacing: 4) {
      HStack {
        Text("Ages").font(.figtree(17, .medium)).foregroundStyle(Palette.ink)
        Spacer()
        Text("\(filters.minAge) to \(filters.maxAge)").font(.figtree(17, .medium)).foregroundStyle(Palette.burgundy)
      }
      RangeSlider(
        lower: $filters.minAge, upper: $filters.maxAge,
        bounds: Rules.shared.minAge...Rules.shared.maxAge, accessibilityName: "Ages"
      )
    }
    .card(padding: 16)
  }

  private var showMe: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Show me").font(.figtree(17, .medium)).foregroundStyle(Palette.ink)
      SegmentedPicker(
        options: [(MemberFilters.ShowMe.women, "Women"), (.men, "Men"), (.everyone, "Everyone")],
        selection: $filters.showMe
      )
    }
  }

  private var distanceCard: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .firstTextBaseline) {
        Text("Distance from \(town)").font(.figtree(17, .medium)).foregroundStyle(Palette.ink)
        Spacer(minLength: 8)
        Text("Up to \(filters.miles) miles").font(.figtree(17, .medium)).foregroundStyle(Palette.burgundy)
      }
      ValueSlider(value: $filters.miles, bounds: 5...200, step: 5, accessibilityName: "Distance in miles")
      Text("Members on your trips are shown wherever they live.")
        .font(.figtree(16, relativeTo: .footnote))
        .foregroundStyle(Palette.muted)
    }
    .card(padding: 16)
  }

  private var travelStyle: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("Travel style").font(.heading(22)).foregroundStyle(Palette.ink)
        Spacer()
        if !isPlus { PlusTag() }
      }
      Text("Budget").font(.figtree(17, .semibold)).foregroundStyle(Palette.goldText).padding(.top, 2)
      ChipPicker(options: MemberFilters.budgets, selection: $filters.budget)
      Text("Pace").font(.figtree(17, .semibold)).foregroundStyle(Palette.goldText).padding(.top, 4)
      ChipPicker(options: MemberFilters.paces, selection: $filters.pace)
    }
    .padding(16)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.goldWash))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.goldLine, lineWidth: 1))
  }
}
