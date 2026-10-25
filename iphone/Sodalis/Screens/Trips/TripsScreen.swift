import SwiftUI

struct TripsScreen: View {
  @Environment(AppState.self) private var state
  private var trips: [Trip] { Demo.is(.emptyTrips) ? [] : SampleData.trips }

  var body: some View {
    LargeTitlePage(title: "Your trips") {
      HeaderIconButton(systemName: "plus", label: "Add a trip", filled: true) { state.sheet = .addTrip(editing: nil) }
    } content: {
      if trips.isEmpty {
        EmptyStateView(
          title: "No trips yet",
          text: "Add where you're going and when, and you'll see members heading the same way.",
          primary: ("Add your first trip", "plus", { state.sheet = .addTrip(editing: nil) })
        )
        .padding(.top, 50)
      } else {
        VStack(spacing: 16) {
          ForEach(trips) { trip in
            Button { state.push(.trip(trip.code)) } label: { TripCard(trip: trip) }
              .buttonStyle(.plain)
          }
          RowsCard {
            Button { state.open(.travelGroups, in: .whosGoing) } label: {
              ListRow(icon: "person.2", iconFill: Color(hex: 0xF6E7B6), iconTint: Palette.goldText, title: "Travel as a group", subtitle: "Join or start a small group for one of your trips")
            }
            RowDivider(inset: 60)
            Button { state.push(.goingWhenYouAre("LIS")) } label: {
              HStack(spacing: 14) {
                IconBadge(systemName: "calendar", fill: Palette.blush, tint: Palette.burgundy)
                VStack(alignment: .leading, spacing: 2) {
                  Text("Going when you are").font(.figtree(17)).foregroundStyle(Palette.ink)
                  (Text(Image(systemName: "lock")) + Text(" \(Brand.shared.plusName)").bold() + Text(" · see the exact days you overlap"))
                    .font(.figtree(14)).foregroundStyle(Palette.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.7))
              }
              .padding(.horizontal, 14)
              .frame(minHeight: 60)
              .contentShape(Rectangle())
            }
          }
          .buttonStyle(.plain)
        }
      }
    }
    .refreshable { try? await Task.sleep(nanoseconds: 600_000_000) }
  }
}

struct TripCard: View {
  let trip: Trip

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HillsBanner(tones: trip.tones.colors, code: trip.code).frame(height: 108)
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 2) {
            Text("\(trip.place), \(trip.country)").font(.heading(21)).foregroundStyle(Palette.ink)
            Text("\(trip.fullDates) · \(trip.flexibility)").font(.figtree(15)).foregroundStyle(Palette.muted)
          }
          Spacer()
          Pill(text: trip.whenAway)
        }
        if trip.isPrivate {
          Label("Only you can see this trip", systemImage: "lock")
            .font(.figtree(15)).foregroundStyle(Palette.muted)
            .padding(.top, 4)
        } else {
          HStack(spacing: 8) {
            AvatarStack(initials: trip.goingInitials, size: 28)
            Text("\(trip.going) members going").font(.figtree(17, .semibold)).foregroundStyle(Palette.burgundy)
          }
          .padding(.top, 4)
        }
      }
      .padding(14)
    }
    .background(Palette.card)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
    .shadow(color: Palette.ink.opacity(0.06), radius: 10, y: 3)
    .accessibilityElement(children: .combine)
  }
}

// MARK: Trip page

struct TripScreen: View {
  let code: String
  let back: String
  @Environment(AppState.self) private var state

  enum Section: Hashable { case people, plan, tips }

  @State private var section: Section = Demo.is(.tripPlan) ? .plan : Demo.is(.tripTips) ? .tips : .people
  @State private var idea = ""
  @State private var tipCategory = "All"
  @State private var tipSearch = ""
  @State private var sent: Set<String> = ["Priya"]

  private var trip: Trip { SampleData.trip(code) ?? SampleData.trips[0] }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        hero
        VStack(alignment: .leading, spacing: 12) {
          SegmentedPicker(options: [(Section.people, "People"), (.plan, "Plan board"), (.tips, "Nice to know")], selection: $section)
          switch section {
          case .people: people
          case .plan: planBoard
          case .tips: tips
          }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 120)
      }
    }
    .scrollIndicators(.hidden)
    .background(Palette.paper)
    .innerTopBar(back: back) {
      Text(trip.place).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
    } trailing: {
      HStack(spacing: 0) {
        ShareLink(item: "My trip to \(trip.place), \(trip.fullDates) · \(Brand.shared.name)") {
          Image(systemName: "square.and.arrow.up").font(.system(size: 18)).foregroundStyle(Palette.burgundy).frame(width: 40, height: 44)
        }
        .accessibilityLabel("Share my trip")
        Button("Edit") { state.sheet = .addTrip(editing: trip.code) }.buttonStyle(TextButtonStyle(weight: .regular))
      }
    }
  }

  private var hero: some View {
    HillsBanner(tones: trip.tones.colors)
      .frame(height: 168)
      .overlay(alignment: .bottomLeading) {
        VStack(alignment: .leading, spacing: 4) {
          Text("Your trip")
            .font(.figtree(14, .semibold))
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Capsule().fill(Palette.card))
          Text(trip.place).font(.heading(34)).foregroundStyle(.white)
          Text("\(trip.fullDates) · \(trip.going) members going").font(.figtree(16)).foregroundStyle(.white.opacity(0.92))
        }
        .padding(16)
      }
  }

  // People

  private var people: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Members in \(trip.place) while you're there.").font(.figtree(15)).foregroundStyle(Palette.muted)
      Button { state.push(.goingWhenYouAre(trip.code)) } label: {
        HStack(spacing: 12) {
          IconBadge(systemName: "calendar", fill: Palette.blush, tint: Palette.burgundy, size: 36)
          VStack(alignment: .leading, spacing: 1) {
            Text("Exact days you overlap").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
            Text("Going when you are · \(Brand.shared.plusName)").font(.figtree(14)).foregroundStyle(Palette.muted)
          }
          Spacer()
          Image(systemName: "chevron.right").foregroundStyle(Palette.muted)
        }
        .card(padding: 12)
      }
      .buttonStyle(.plain)

      GroupedList(items: ["Margaret", "David", "Priya", "Sue"].map(SampleData.member), separatorInset: 74) { member in
        HStack(spacing: 12) {
          Button { state.push(.member(member.name)) } label: {
            HStack(spacing: 12) {
              Avatar(size: 48, tones: member.tones.colors)
              VStack(alignment: .leading, spacing: 3) {
                Text("\(member.name), \(member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
                Text("\(member.town) · \(member.tripDates)").font(.figtree(14)).foregroundStyle(Palette.muted)
                if member.lotsInCommon {
                  Text("Lots in common")
                    .font(.figtree(14, .medium))
                    .foregroundStyle(Palette.goldText)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color(hex: 0xF6E7B6)))
                }
              }
            }
          }
          .buttonStyle(.plain)
          Spacer()
          personAction(member)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
      }
    }
  }

  @ViewBuilder private func personAction(_ member: Member) -> some View {
    if member.name == "David" {
      Button("Message") { state.open(.chat("David"), in: .chat) }
        .buttonStyle(SmallButtonStyle(kind: .secondary))
    } else if sent.contains(member.name) {
      Label("Sent", systemImage: "checkmark")
        .font(.figtree(16, .medium))
        .foregroundStyle(Palette.muted)
        .padding(.horizontal, 14)
        .frame(minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.tint))
    } else {
      Button("Connect") {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        sent.insert(member.name)
        state.show("Request sent to \(member.name)", detail: "We'll let you know when \(member.pronoun) replies.") { sent.remove(member.name) }
      }
      .buttonStyle(SmallButtonStyle(kind: .primary))
    }
  }

  // Plan board

  private var planBoard: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Ideas shared with members you've connected with for this trip.").font(.figtree(15)).foregroundStyle(Palette.muted)
      VStack(spacing: 10) {
        FieldBox { TextField("What's the idea?", text: $idea) }
        HStack(spacing: 10) {
          FieldBox {
            HStack {
              Text("Day (optional)").foregroundStyle(Palette.muted.opacity(0.8))
              Spacer()
              Image(systemName: "calendar").foregroundStyle(Palette.burgundy)
            }
          }
          Button("Add idea") { idea = "" }.buttonStyle(PrimaryButtonStyle(fullWidth: false))
        }
      }
      .card(padding: 12)
      ForEach(SampleData.planIdeas) { item in
        VStack(alignment: .leading, spacing: 4) {
          Text(item.title).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(item.detail).font(.figtree(14)).foregroundStyle(Palette.muted)
          HStack {
            AvatarStack(initials: item.people, size: 28)
            Text("\(item.people.count) in").font(.figtree(15)).foregroundStyle(Palette.muted)
            Spacer()
            if item.joined {
              Label("You're in", systemImage: "checkmark")
                .font(.figtree(16, .medium))
                .foregroundStyle(Palette.success)
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.success.opacity(0.1)))
            } else {
              Button("I'm in") {}.buttonStyle(SmallButtonStyle(kind: .primary))
            }
          }
          .padding(.top, 4)
        }
        .card(padding: 14)
      }
    }
  }

  // Nice to know

  private var tips: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Members' tips for \(trip.place).").font(.figtree(15)).foregroundStyle(Palette.muted)
        Spacer()
        Button {} label: { Label("Share a tip", systemImage: "plus") }
          .buttonStyle(SmallButtonStyle(kind: .primary))
      }
      Button { state.cover = .plus } label: {
        HStack(spacing: 10) {
          Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
          Text("Search and filter tips").foregroundStyle(Palette.muted.opacity(0.85))
          Spacer()
          PlusTag()
        }
        .font(.figtree(17))
        .padding(.horizontal, 14)
        .frame(minHeight: 52)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line, lineWidth: 1))
      }
      .buttonStyle(.plain)
      ScrollView(.horizontal) {
        HStack(spacing: 8) {
          ForEach(SampleData.tipCategories, id: \.self) { category in
            Chip(title: category, isSelected: tipCategory == category) { tipCategory = category }
          }
        }
        .padding(.vertical, 1)
      }
      .scrollIndicators(.hidden)
      ForEach(SampleData.tips.filter { tipCategory == "All" || $0.category == tipCategory }) { tip in
        VStack(alignment: .leading, spacing: 6) {
          Pill(text: tip.category)
          Text(tip.title).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(tip.text).font(.figtree(16)).foregroundStyle(Palette.softInk).fixedSize(horizontal: false, vertical: true)
          Text(tip.by).font(.figtree(14)).foregroundStyle(Palette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: 14)
      }
    }
  }
}

/// Compact 44pt button used inside list rows (Connect, Message, I'm in).
struct SmallButtonStyle: ButtonStyle {
  enum Kind { case primary, secondary }
  let kind: Kind

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.figtree(16, .semibold))
      .foregroundStyle(kind == .primary ? .white : Palette.ink)
      .padding(.horizontal, 16)
      .frame(minHeight: 44)
      .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(kind == .primary ? Palette.burgundy : Palette.card))
      .overlay {
        if kind == .secondary {
          RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.line, lineWidth: 1)
        }
      }
      .opacity(configuration.isPressed ? 0.8 : 1)
  }
}
