import SwiftUI

/// Scrolling body for an inner page: 16pt sides and room for the tab bar.
struct InnerScroll<Content: View>: View {
  var bottomPadding: CGFloat = 120
  @ViewBuilder var content: Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) { content }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, bottomPadding)
    }
    .demoScrolled()
    .scrollIndicators(.hidden)
    .background(Palette.paper)
  }
}

/// A Newsreader section heading, e.g. "Invites for you".
struct SectionHeading: View {
  let text: String
  var trailing: String? = nil
  init(_ text: String, trailing: String? = nil) {
    self.text = text
    self.trailing = trailing
  }

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(text).font(.heading(24)).foregroundStyle(Palette.ink).accessibilityAddTraits(.isHeader)
      Spacer()
      if let trailing { Text(trailing).font(.figtree(14)).foregroundStyle(Palette.muted) }
    }
  }
}

// MARK: Travel groups

struct TravelGroupsScreen: View {
  let back: String
  @Environment(AppState.self) private var state
  @State private var inviteOpen = true
  @State private var asked: Set<String> = []

  private var empty: Bool { Demo.is(.emptyGroups) }

  var body: some View {
    Group {
      if empty {
        EmptyStateView(
          title: "No groups yet",
          text: "Join a small group for one of your trips, or start your own.",
          primary: ("Start a group", nil, { state.sheet = .startGroup }),
          secondary: ("Browse groups", {})
        )
        .padding(.top, 40)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Palette.paper)
      } else {
        InnerScroll {
          Text("Small groups heading the same way, at the same time.")
            .font(.figtree(17)).foregroundStyle(Palette.muted)

          if inviteOpen {
            SectionHeading("Invites for you").padding(.top, 18)
            invite.padding(.top, 10)
          }

          SectionHeading("Your groups").padding(.top, 22)
          Button { state.push(.group("lisbon-food")) } label: {
            groupRow(SampleData.group("lisbon-food"))
          }
          .buttonStyle(.plain)
          .padding(.top, 10)

          SectionHeading("Groups you can join").padding(.top, 22)
          VStack(spacing: 12) {
            ForEach(["lisbon-days", "algarve", "rome"], id: \.self) { id in joinCard(SampleData.group(id)) }
          }
          .padding(.top, 10)
        }
      }
    }
    .innerTopBar(back: back) {
      Text("Travel groups").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
    } trailing: {
      Button("Start") { state.sheet = .startGroup }.buttonStyle(.text)
    }
  }

  private var invite: some View {
    let group = SampleData.group("edinburgh")
    return VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        PlaceTile(code: group.code, tone: Color(hex: group.tone))
        VStack(alignment: .leading, spacing: 2) {
          Text(group.name).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(group.detail).font(.figtree(14)).foregroundStyle(Palette.muted)
        }
      }
      HStack(spacing: 10) {
        Button("Not now") { withAnimation { inviteOpen = false } }.buttonStyle(.secondary)
        Button("Join group") {
          withAnimation { inviteOpen = false }
          state.show("You've joined \(group.name)", detail: "Say hello in the group chat.")
        }
        .buttonStyle(.primary)
      }
    }
    .card(padding: 14)
  }

  private func groupRow(_ group: TravelGroup) -> some View {
    HStack(spacing: 12) {
      PlaceTile(code: group.code, tone: Color(hex: group.tone))
      VStack(alignment: .leading, spacing: 2) {
        Text(group.name).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
        Text(group.detail).font(.figtree(14)).foregroundStyle(Palette.muted)
      }
      Spacer()
      Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.7))
    }
    .card(padding: 14)
    .accessibilityElement(children: .combine)
  }

  private func joinCard(_ group: TravelGroup) -> some View {
    let isAsked = asked.contains(group.id)
    return VStack(alignment: .leading, spacing: 10) {
      Button { state.push(.group(group.id)) } label: {
        HStack(spacing: 12) {
          PlaceTile(code: group.code, tone: Color(hex: group.tone))
          VStack(alignment: .leading, spacing: 2) {
            Text(group.name).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
            Text(group.detail).font(.figtree(14)).foregroundStyle(Palette.muted)
          }
          Spacer()
        }
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      FlowLayout(spacing: 8, lineSpacing: 8) {
        ForEach(group.tags, id: \.self) { tag in Pill(text: tag) }
      }
      HStack {
        Spacer()
        Button(isAsked ? "Asked" : "Ask to join") {
          asked.insert(group.id)
          state.show("Asked to join", detail: "The organiser will let you know.") { asked.remove(group.id) }
        }
        .buttonStyle(SmallButtonStyle(kind: .secondary))
        .disabled(isAsked)
      }
    }
    .card(padding: 14)
  }
}

// MARK: One group

struct GroupScreen: View {
  let id: String
  let back: String
  @Environment(AppState.self) private var state

  private var group: TravelGroup { SampleData.group(id) }

  private let people: [(String, String, Bool)] = [
    ("Margaret", "Harrogate · 12–19 May", true),
    ("Priya", "Leeds · 13–17 May", false),
    ("David", "Bath · 15–22 May", false),
    ("Sue", "Norwich · 11–16 May", false),
    ("Ann", "Ripon · 13–18 May", false),
    ("Colin", "Durham · 13–17 May", false),
  ]

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        HillsBanner(tones: [Color(hex: 0xE9A27E), Color(hex: 0xA9483A)]).frame(height: 136)
        VStack(alignment: .leading, spacing: 0) {
          Eyebrow(text: "Travel group")
          Text(group.name).font(.heading(32, relativeTo: .largeTitle)).foregroundStyle(Palette.ink).padding(.top, 6)
          HStack(spacing: 8) {
            Pill(text: "13–17 May 2027", background: Palette.blush, foreground: Palette.burgundy)
            Pill(text: "Ages 50–70")
          }
          .padding(.top, 10)
          Text("Markets, tascas and long lunches, at a gentle pace. Everyone books their own room.")
            .font(.figtree(17)).foregroundStyle(Palette.softInk).padding(.top, 12)

          chatCard.padding(.top, 16)

          SectionHeading("Members", trailing: "6 of 8 places").padding(.top, 22)
          members.padding(.top, 10)
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 120)
      }
    }
    .demoScrolled()
    .scrollIndicators(.hidden)
    .background(Palette.paper)
    .innerTopBar(back: back) {
      Text("Group").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
    } trailing: {
      ShareLink(item: "Join me in \(group.name) on \(Brand.shared.name)") {
        Image(systemName: "square.and.arrow.up").font(.system(size: 19)).foregroundStyle(Palette.burgundy).frame(width: 44, height: 44)
      }
      .accessibilityLabel("Share group")
    }
  }

  private var chatCard: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("Group chat").font(.heading(21)).foregroundStyle(Palette.ink)
        Spacer()
        Pill(text: "3 new", background: Palette.blush, foreground: Palette.burgundy)
      }
      (Text("Priya").bold() + Text(" · I've booked a table for six at Taberna on the Thursday."))
        .font(.figtree(16)).foregroundStyle(Palette.ink)
      (Text("David").bold() + Text(" · Perfect. Shall we meet at the Time Out Market first?"))
        .font(.figtree(16)).foregroundStyle(Palette.ink)
      Button { state.push(.chat("David")) } label: {
        Label("Open group chat", systemImage: "bubble.left")
      }
      .buttonStyle(.secondary)
      .padding(.top, 4)
    }
    .card(padding: 14)
  }

  private var members: some View {
    RowsCard {
      ForEach(Array(people.enumerated()), id: \.offset) { index, person in
        if index > 0 { RowDivider(inset: 66) }
        let member = SampleData.member(person.0)
        Button { if !person.2 { state.push(.member(person.0)) } } label: {
          HStack(spacing: 12) {
            Avatar(size: 40, tones: member.tones.colors)
            VStack(alignment: .leading, spacing: 2) {
              Text(person.2 ? "You (\(member.name))" : "\(member.name), \(member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
              Text(person.1).font(.figtree(14)).foregroundStyle(Palette.muted)
            }
            Spacer()
            if person.2 {
              Text("Organiser")
                .font(.figtree(14, .medium))
                .foregroundStyle(Palette.goldText)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color(hex: 0xF6E7B6)))
            } else {
              Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.7))
            }
          }
          .padding(.horizontal, 14)
          .padding(.vertical, 10)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
      RowDivider(inset: 66)
      Button { state.tab = .chat } label: {
        HStack(spacing: 12) {
          IconBadge(systemName: "person.badge.plus", fill: Palette.blush, tint: Palette.burgundy, size: 40)
          Text("Invite people you're connected with").font(.figtree(17, .medium)).foregroundStyle(Palette.burgundy)
          Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
    }
  }
}

// MARK: Start a group

struct StartGroupSheet: View {
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss
  @State private var name = "Lisbon slow-food walkers"
  @State private var trip = "LIS"
  @State private var womenOnly = false
  @State private var lowAge = 50
  @State private var highAge = 70

  private var minAge: Int { Rules.shared.minAge }

  var body: some View {
    FormSheet(title: "New group", button: "Start group", buttonDisabled: name.trimmingCharacters(in: .whitespaces).isEmpty) {
      dismiss()
      state.show("Group started", detail: "Invite people you're connected with.")
    } content: {
      Text("Start a group").font(.heading(32, relativeTo: .largeTitle)).foregroundStyle(Palette.ink)
      FieldLabel("Group name").padding(.top, 18)
      InputField(placeholder: "e.g. Lisbon slow-food walkers", text: $name).padding(.top, 8)

      FieldLabel("Start from one of your trips").padding(.top, 20)
      FlowLayout(spacing: 8, lineSpacing: 8) {
        ForEach(SampleData.trips.prefix(2)) { item in
          let selected = trip == item.code
          Button { trip = item.code } label: {
            HStack(spacing: 8) {
              PlaceThumb(tones: item.tones.colors, size: 26)
              Text("\(item.place) · \(item.short)").font(.figtree(17, selected ? .semibold : .regular))
            }
            .foregroundStyle(selected ? Palette.burgundy : Palette.ink)
            .padding(.leading, 9)
            .padding(.trailing, 14)
            .frame(minHeight: 44)
            .background(Capsule().fill(selected ? Palette.blush : Palette.card))
            .overlay(Capsule().strokeBorder(selected ? Palette.burgundy : Palette.line, lineWidth: selected ? 1.5 : 1))
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(selected ? .isSelected : [])
        }
      }
      .padding(.top, 8)

      FieldLabel("Destination and dates").padding(.top, 20)
      RowsCard {
        ListRow(title: "Destination", value: trip == "EDI" ? "Edinburgh" : "Lisbon", chevron: false)
        RowDivider()
        ListRow(title: "Dates", value: trip == "EDI" ? "8–12 Aug 2027" : "13–17 May 2027", chevron: false)
      }
      .padding(.top, 8)
      HelperText("Filled in from your trip. Change it if the group's plans differ.").padding(.top, 8)

      RowsCard {
        ToggleRow(title: "Women only", subtitle: "Only women members can see and join", isOn: $womenOnly)
      }
      .padding(.top, 16)

      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Text("Age range").font(.figtree(17)).foregroundStyle(Palette.ink)
          Spacer()
          Text("\(lowAge) to \(highAge == 90 ? "90+" : "\(highAge)")").font(.figtree(17, .medium)).foregroundStyle(Palette.burgundy)
        }
        RangeSlider(lower: $lowAge, upper: $highAge, bounds: minAge...90, accessibilityName: "Age range")
      }
      .card(radius: 14, padding: 14)
      .padding(.top, 16)
    }
  }
}

// MARK: Sodalis+

struct PlusScreen: View {
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss

  private let dark = Color(hex: 0x2B1E1C)
  private var months: Int { Rules.shared.int("founding", "plusMonths", default: 3) }
  private var price: String {
    let pence = Rules.shared.int("plus", "pricePencePerMonth", default: 599)
    return String(format: "£%d.%02d", pence / 100, pence % 100)
  }

  private let perks: [(String, String, String)] = [
    ("person.2.wave.2", "Unlimited connection requests", "Say hello to as many members as you like."),
    ("calendar", "Unlimited trip plans", "Plan as many trips together as you want."),
    ("person.2", "Going when you are", "See the exact days you overlap with other members."),
    ("star", "Popular groups", "Join the most-loved travel groups first."),
    ("magnifyingglass", "Search members' tips", "Search and filter tips for every destination."),
  ]

  var body: some View {
    ScrollView {
      VStack(spacing: 0) {
        VStack(spacing: 14) {
          PrimaryLogo(height: 86, color: .white, scriptColor: Palette.brightGold).padding(.top, 36)
          Label(Brand.shared.plusName, systemImage: "sparkle")
            .font(.figtree(17, .medium))
            .foregroundStyle(Palette.brightGold)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .overlay(Capsule().strokeBorder(Palette.brightGold.opacity(0.8), lineWidth: 1))
          Text("More ways to find good company for every trip.")
            .font(.figtree(17)).foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.center)

          VStack(spacing: 8) {
            Text("Founding members").font(.figtree(14, .bold)).tracking(1.2).textCase(.uppercase).foregroundStyle(Palette.brightGold)
            Text("\(months) months free").font(.heading(30)).foregroundStyle(.white)
            Text("Then \(price) a month. Cancel any time in Settings.")
              .font(.figtree(15)).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center)
          }
          .padding(18)
          .frame(maxWidth: .infinity)
          .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(hex: 0x3A2A1E)))
          .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.gold.opacity(0.6), lineWidth: 1))
          .padding(.top, 8)

          Text("What you get").font(.figtree(14, .bold)).tracking(1.2).textCase(.uppercase).foregroundStyle(.white.opacity(0.7))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 10)
          VStack(alignment: .leading, spacing: 16) {
            ForEach(perks.indices, id: \.self) { index in
              let perk = perks[index]
              HStack(alignment: .top, spacing: 14) {
                Image(systemName: perk.0)
                  .font(.system(size: 15))
                  .foregroundStyle(Palette.brightGold)
                  .frame(width: 32, height: 32)
                  .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color(hex: 0x4A3726)))
                VStack(alignment: .leading, spacing: 2) {
                  Text(perk.1).font(.figtree(17, .semibold)).foregroundStyle(.white)
                  Text(perk.2).font(.figtree(15)).foregroundStyle(.white.opacity(0.75))
                }
                Spacer(minLength: 0)
              }
              .accessibilityElement(children: .combine)
            }
          }
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 24)
        .background(dark)

        VStack(spacing: 8) {
          Text("No pressure. The Collective is yours to enjoy for free, whatever you decide.")
          (Text("Billed through your Apple ID. ") + Text("Restore purchases").foregroundColor(Palette.burgundy).bold() + Text(" · ") + Text("Terms").foregroundColor(Palette.burgundy).bold())
        }
        .font(.figtree(14))
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
        .background(Palette.paper)
      }
    }
    .demoScrolled()
    .scrollIndicators(.hidden)
    .background(VStack(spacing: 0) { dark; Palette.paper }.ignoresSafeArea())
    .overlay(alignment: .topTrailing) {
      Button { dismiss() } label: {
        Image(systemName: "xmark")
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(.white)
          .frame(width: 30, height: 30)
          .background(Circle().fill(.white.opacity(0.18)))
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel("Close")
      .padding(.trailing, 10)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) {
      VStack(spacing: 4) {
        Button {
          state.isPlus = true
          dismiss()
          state.show("Welcome to \(Brand.shared.plusName)", detail: "Your \(months) free months start today.")
        } label: {
          Text("Join \(Brand.shared.plusName) · \(months) months free")
            .font(.figtree(19, .semibold))
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.brightGold))
        }
        Button("Maybe later") { dismiss() }
          .font(.figtree(17, .semibold))
          .foregroundStyle(Palette.brightGold)
          .frame(minHeight: 44)
      }
      .padding(.horizontal, 16)
      .padding(.top, 12)
      .background(dark.ignoresSafeArea())
    }
    .preferredColorScheme(.light)
  }
}
