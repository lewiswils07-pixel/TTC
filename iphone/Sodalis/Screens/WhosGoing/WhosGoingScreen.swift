import SwiftUI

struct WhosGoingScreen: View {
  @Environment(AppState.self) private var state
  @Environment(\.tabBarMetrics) private var metrics

  enum LoadState { case loading, ready, failed }

  @State private var selectedTrip = SampleData.trips[0]
  @State private var cardIndex = Demo.is(.whosGoingEmpty) ? SampleData.cards.count : 0
  @State private var load: LoadState = Demo.is(.loading) ? .loading : Demo.is(.error) ? .failed : .ready
  @State private var showFilters = false
  @State private var filterDetent: PresentationDetent = .fraction(0.62)
  @State private var filters = MemberFilters()

  private var card: MemberCard? {
    SampleData.cards.indices.contains(cardIndex) ? SampleData.cards[cardIndex] : nil
  }

  var body: some View {
    ScrollViewReader { proxy in
      LargeTitlePage(title: "Who's going", showsLogo: true, bottomPadding: metrics.stickyPadding + 90) {
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
      } compactTrailing: {
        HeaderIconButton(systemName: "slider.horizontal.3", label: "Filters") { showFilters = true }
      } content: {
        tripsSection.padding(.top, 8)
        switch load {
        case .loading:
          LoadingCard().padding(.top, 24)
        case .failed:
          ErrorStateView { load = .ready }.padding(.top, 36)
        case .ready:
          if let card {
            goingYourWay.padding(.top, 30)
            MemberCardView(card: card) { state.push(.member(card.member.name)) }
              .padding(.top, 16)
          } else {
            noOneLeft.padding(.top, 24)
          }
          travelGroups.padding(.top, 36)
        }
      }
      .refreshable { try? await Task.sleep(nanoseconds: 600_000_000) }
      .overlay(alignment: .bottom) { actionButtons }
      .sheet(isPresented: $showFilters) {
        FiltersSheet(filters: $filters, town: SampleData.me.town, count: 12) { showFilters = false }
          .sodalisSheet(detents: [.fraction(0.62), .large], selection: $filterDetent)
      }
      .onAppear { applyDemo(proxy) }
    }
  }

  // MARK: Sections

  private var tripsSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Your trips").sectionCaps()
        Spacer()
        Button { state.sheet = .addTrip(editing: nil) } label: {
          Label("Add a trip", systemImage: "plus")
        }
        .buttonStyle(TextButtonStyle(weight: .medium))
      }
      ScrollView(.horizontal) {
        HStack(spacing: 10) {
          ForEach(SampleData.trips.filter { !$0.isPrivate }) { trip in
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

  private var noOneLeft: some View {
    VStack(spacing: 12) {
      Monogram(size: 56)
      Text("You've seen everyone for now")
        .font(.heading(24))
        .foregroundStyle(Palette.ink)
        .multilineTextAlignment(.center)
      Text("New members join every week. Widen your filters or add another trip to meet more people going your way.")
        .font(.figtree(17))
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
      Button { showFilters = true } label: { Label("Widen your filters", systemImage: "slider.horizontal.3") }
        .buttonStyle(.primary)
        .padding(.top, 6)
      Button { state.sheet = .addTrip(editing: nil) } label: { Label("Add a trip", systemImage: "plus") }
        .buttonStyle(.secondary)
    }
    .padding(.vertical, 12)
    .card(padding: 18)
  }

  private var travelGroups: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Travel groups").font(.heading(26)).foregroundStyle(Palette.ink)
          Text("Small groups on your trips.").font(.figtree(15)).foregroundStyle(Palette.muted)
        }
        Spacer()
        Button("See all") { state.push(.travelGroups) }.buttonStyle(.text)
      }
      GroupedList(items: Array(SampleData.groups.prefix(3)), separatorInset: 72) { group in
        Button { state.push(.group(group.id)) } label: {
          HStack(spacing: 14) {
            PlaceTile(code: group.code, tone: Color(hex: group.tone))
            VStack(alignment: .leading, spacing: 2) {
              Text(group.name).font(.bodySemibold).foregroundStyle(Palette.ink)
              Text(group.detail).font(.small).foregroundStyle(Palette.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Palette.muted)
          }
          .padding(.horizontal, 14)
          .frame(minHeight: 68)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
    }
  }

  // MARK: Sticky buttons

  @ViewBuilder private var actionButtons: some View {
    if let card, load == .ready {
      HStack(spacing: 12) {
        Button("Not now") { next() }
          .buttonStyle(SecondaryButtonStyle(fullWidth: false))
        Button { connect(card.member) } label: {
          Label("Connect with \(card.member.name)", systemImage: "person.badge.plus")
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

  private func connect(_ member: Member) {
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    let previous = cardIndex
    state.show("Request sent to \(member.name)", detail: "We'll let you know when \(member.pronoun) replies.") {
      withAnimation { cardIndex = previous }
    }
    next()
  }

  private func next() {
    withAnimation(.easeInOut(duration: 0.25)) { cardIndex += 1 }
  }

  private func applyDemo(_ proxy: ScrollViewProxy) {
    switch Demo.current {
    case .whosGoingScrolled, .connectBanner:
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

struct TripChip: View {
  let trip: Trip
  let selected: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        PlaceThumb(tones: trip.tones.colors, size: 44)
        VStack(alignment: .leading, spacing: 0) {
          Text(trip.place).font(.figtree(18, .medium)).foregroundStyle(Palette.ink)
          Text(trip.dates).font(.figtree(16)).foregroundStyle(Palette.muted)
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

/// Grey placeholder shapes while members load.
struct LoadingCard: View {
  @State private var pulse = false

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack(spacing: 10) {
        ProgressView().tint(Palette.muted)
        Text("Finding who's going…").font(.figtree(15)).foregroundStyle(Palette.muted)
      }
      .frame(maxWidth: .infinity)
      RoundedRectangle(cornerRadius: 8).fill(Palette.tint).frame(width: 180, height: 22)
      VStack(alignment: .leading, spacing: 12) {
        Rectangle().fill(Palette.tint).frame(height: 54)
        RoundedRectangle(cornerRadius: 12).fill(Palette.tint).frame(height: 180).padding(.horizontal, 14)
        RoundedRectangle(cornerRadius: 6).fill(Palette.tint).frame(width: 170, height: 22).padding(.horizontal, 14)
        RoundedRectangle(cornerRadius: 6).fill(Palette.tint).frame(width: 230, height: 16).padding(.horizontal, 14)
        RoundedRectangle(cornerRadius: 6).fill(Palette.tint).frame(width: 200, height: 16).padding(.horizontal, 14).padding(.bottom, 16)
      }
      .background(Palette.card)
      .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
    .opacity(pulse ? 0.6 : 1)
    .onAppear { withAnimation(.easeInOut(duration: 0.9).repeatForever()) { pulse = true } }
    .accessibilityElement()
    .accessibilityLabel("Loading members")
  }
}

/// "Something went wrong" with Try again.
struct ErrorStateView: View {
  let retry: () -> Void

  var body: some View {
    EmptyStateView(
      title: "Something went wrong",
      text: "We couldn't load this just now. Check your connection and try again.",
      primary: ("Try again", nil, retry),
      secondary: ("Talk to us", {}),
      icon: AnyView(
        Image(systemName: "arrow.clockwise")
          .font(.system(size: 26, weight: .medium))
          .foregroundStyle(Palette.softInk)
          .frame(width: 64, height: 64)
          .background(Circle().fill(Palette.tint))
      )
    )
  }
}
