import SwiftUI

struct WhosGoingTab: View {
  var body: some View {
    NavigationStack {
      WhosGoingScreen()
    }
  }
}

private struct ScrollOffsetKey: PreferenceKey {
  static var defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

struct WhosGoingScreen: View {
  @Environment(AppState.self) private var state
  @Environment(\.tabBarMetrics) private var metrics

  @State private var selectedTrip = SampleData.trips[0]
  @State private var memberIndex = 0
  @State private var scrollOffset: CGFloat = 0
  @State private var showFilters = false
  @State private var filterDetent: PresentationDetent = .fraction(0.62)
  @State private var filters = MemberFilters()

  private var member: MemberCard? {
    SampleData.members.indices.contains(memberIndex) ? SampleData.members[memberIndex] : nil
  }

  private var compact: Bool { scrollOffset < -120 }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          header
            .background(GeometryReader { g in
              Color.clear.preference(key: ScrollOffsetKey.self, value: g.frame(in: .named("scroll")).minY)
            })
          tripsSection.padding(.top, 22)
          goingYourWay.padding(.top, 30)
          if let member {
            MemberCardView(member: member).padding(.top, 16)
          } else {
            EmptyWhosGoing().padding(.top, 16)
          }
          travelGroups.padding(.top, 36)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, metrics.stickyPadding + 90)
      }
      .coordinateSpace(name: "scroll")
      .onPreferenceChange(ScrollOffsetKey.self) { scrollOffset = $0 }
      .trackScrollOffset($scrollOffset)
      .scrollIndicators(.hidden)
      .refreshable { try? await Task.sleep(nanoseconds: 600_000_000) }
      .background(Palette.paper)
      .overlay(alignment: .top) { compactBar }
      .overlay(alignment: .bottom) { actionButtons }
      .toolbar(.hidden, for: .navigationBar)
      .sheet(isPresented: $showFilters) {
        FiltersSheet(filters: $filters, town: "Harrogate", count: 12) { showFilters = false }
          .sodalisSheet(detents: [.fraction(0.62), .large], selection: $filterDetent)
      }
      .onAppear { applyDemo(proxy) }
    }
  }

  // MARK: Top

  private var header: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        PrimaryLogo(height: 46)
          .padding(.top, 2)
        Spacer()
        Button { showFilters = true } label: {
          Label("Filters", systemImage: "slider.horizontal.3")
            .font(.figtree(17, .medium))
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(Capsule().fill(Palette.card))
            .overlay(Capsule().strokeBorder(Palette.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
      }
      Text("Who's going")
        .font(.largeTitleSerif)
        .foregroundStyle(Palette.ink)
        .accessibilityAddTraits(.isHeader)
    }
  }

  @ViewBuilder private var compactBar: some View {
    if compact {
      VStack(spacing: 0) {
        ZStack {
          Text("Who's going")
            .font(.figtree(19, .semibold))
            .foregroundStyle(Palette.ink)
          HStack {
            PrimaryLogo(height: 36)
            Spacer()
            Button { showFilters = true } label: {
              Image(systemName: "slider.horizontal.3")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(Palette.ink)
                .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Filters")
          }
        }
        .padding(.horizontal, 16)
        .frame(height: 50)
        Rectangle().fill(Palette.line).frame(height: 0.5)
      }
      .background(Palette.paper.opacity(0.97).ignoresSafeArea(edges: .top))
      .transition(.opacity)
    }
  }

  // MARK: Sections

  private var tripsSection: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Text("Your trips").sectionCaps()
        Spacer()
        Button {} label: {
          Label("Add a trip", systemImage: "plus")
        }
        .buttonStyle(.text)
        .font(.figtree(17, .medium))
      }
      ScrollView(.horizontal) {
        HStack(spacing: 10) {
          ForEach(SampleData.trips) { trip in
            TripChip(trip: trip, selected: trip == selectedTrip) { selectedTrip = trip }
          }
        }
        .padding(.vertical, 2)
      }
      .scrollIndicators(.hidden)
    }
  }

  private var goingYourWay: some View {
    HStack(alignment: .bottom) {
      VStack(alignment: .leading, spacing: 6) {
        Text("Going your way")
          .font(.heading(26))
          .foregroundStyle(Palette.ink)
          .accessibilityAddTraits(.isHeader)
        Text("Members on your trips, at the same time.")
          .font(.body17)
          .foregroundStyle(Palette.muted)
      }
      Spacer(minLength: 12)
      Pill(text: "12 to meet")
    }
  }

  private var travelGroups: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .firstTextBaseline) {
        Text("Travel groups")
          .font(.heading(26))
          .foregroundStyle(Palette.ink)
        Spacer()
        Button("See all") {}.buttonStyle(.text)
      }
      GroupedList(items: SampleData.travelGroups.map { GroupRow(name: $0.0, detail: $0.1) }, separatorInset: 72) { row in
        HStack(spacing: 14) {
          PlaceThumb(tones: [0xC9A27E, 0x7A5A44].colors, size: 44)
          VStack(alignment: .leading, spacing: 2) {
            Text(row.name).font(.bodySemibold).foregroundStyle(Palette.ink)
            Text(row.detail).font(.small).foregroundStyle(Palette.muted)
          }
          Spacer()
          Image(systemName: "chevron.right").foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 68)
      }
    }
  }

  // MARK: Sticky buttons

  @ViewBuilder private var actionButtons: some View {
    if let member {
      HStack(spacing: 12) {
        Button("Not now") { next() }
          .buttonStyle(SecondaryButtonStyle(fullWidth: false))
        Button { connect(member) } label: {
          Label("Connect with \(member.name)", systemImage: "person.badge.plus")
        }
        .buttonStyle(.primary)
      }
      .padding(.horizontal, 16)
      .padding(.top, 24)
      .padding(.bottom, metrics.stickyPadding)
      .background(
        LinearGradient(colors: [Palette.paper.opacity(0), Palette.paper.opacity(0.9), Palette.paper], startPoint: .top, endPoint: .bottom)
          .ignoresSafeArea(edges: .bottom)
          .allowsHitTesting(false)
      )
    }
  }

  private func connect(_ member: MemberCard) {
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    let previous = memberIndex
    state.show("Request sent to \(member.name)") {
      withAnimation { memberIndex = previous }
    }
    next()
  }

  private func next() {
    withAnimation(.easeInOut(duration: 0.25)) { memberIndex += 1 }
  }

  private func applyDemo(_ proxy: ScrollViewProxy) {
    switch DemoScreen.fromLaunchArguments {
    case .whosGoingScrolled:
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { proxy.scrollTo("memberPhoto", anchor: .top) }
    case .filters:
      showFilters = true
    case .filtersLarge:
      filterDetent = .large
      showFilters = true
    default:
      break
    }
  }
}

private struct GroupRow: Identifiable {
  let name: String
  let detail: String
  var id: String { name }
}

struct TripChip: View {
  let trip: Trip
  let selected: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        PlaceThumb(tones: trip.tones.colors, size: 44)
        VStack(alignment: .leading, spacing: 0) {
          Text(trip.place).font(.figtree(19, .medium)).foregroundStyle(Palette.ink)
          Text(trip.dates).font(.body17).foregroundStyle(Palette.muted)
        }
      }
      .padding(.leading, 8)
      .padding(.trailing, 16)
      .padding(.vertical, 8)
      .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.card))
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .strokeBorder(selected ? Palette.burgundy : Palette.line, lineWidth: selected ? 2 : 1)
      )
    }
    .buttonStyle(.plain)
    .accessibilityLabel("\(trip.place), \(trip.dates)")
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

struct EmptyWhosGoing: View {
  var body: some View {
    VStack(spacing: 10) {
      Monogram(size: 44)
      Text("You've seen everyone for now")
        .font(.heading(22))
        .foregroundStyle(Palette.ink)
      Text("New members join every day. Pull down to check again.")
        .font(.body17)
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .card(padding: 24)
  }
}

private extension View {
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
