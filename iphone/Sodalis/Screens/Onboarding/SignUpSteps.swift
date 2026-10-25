import SwiftUI

/// Step 2: interests and travel style.
struct SignUpStep2: View {
  @Environment(AppState.self) private var state
  @State private var interests: Set<String> = ["Food markets", "Coastal walks", "Galleries", "Live music", "Gardens"]
  @State private var budget = "Comfort"
  @State private var pace = "Slow"
  @State private var daysOut: String? = "Love them"
  @State private var often: String? = "A few times a year"
  @State private var groupSize: String? = "Small group, 3–4"
  @State private var twin: String? = "No, my own room"

  private var minimum: Int { Rules.shared.int("interests", "min", default: 5) }
  private var maximum: Int { Rules.shared.int("interests", "pick", default: 8) }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        StepProgress(step: 2, of: 3).padding(.top, 10)
        PageHeader(title: "How do you like to travel?", text: "This helps you find people who'd enjoy the same trip. Change it any time.")
          .padding(.top, 20)

        FieldLabel("Interests", trailing: "\(interests.count) picked").padding(.top, 22)
        FlowLayout(spacing: 8, lineSpacing: 8) {
          ForEach(SampleData.interests, id: \.self) { interest in
            Chip(title: interest, isSelected: interests.contains(interest)) {
              if interests.contains(interest) {
                interests.remove(interest)
              } else if interests.count < maximum {
                interests.insert(interest)
              }
            }
          }
        }
        .padding(.top, 10)
        HelperText("Pick \(minimum) to \(maximum).").padding(.top, 8)

        Text("Your travel style").font(.heading(22)).foregroundStyle(Palette.ink).padding(.top, 26)
        FieldLabel("Budget").padding(.top, 12)
        SegmentedPicker(options: [("Budget", "Budget"), ("Comfort", "Comfort"), ("Luxury", "Luxury")], selection: $budget).padding(.top, 8)
        FieldLabel("Pace").padding(.top, 16)
        SegmentedPicker(options: [("Slow", "Slow"), ("Balanced", "Balanced"), ("Packed", "Packed")], selection: $pace).padding(.top, 8)
        question("Days out from your base", ["Love them", "Now and then", "Rather stay put"], $daysOut)
        question("How often you travel", ["Once or twice a year", "A few times a year", "Most months"], $often)
        question("Group size", ["Just two of us", "Small group, 3–4", "Bigger group, 5+", "No preference"], $groupSize)
        question("Happy to share a twin room?", ["Yes, happy to", "Maybe, once we've met", "No, my own room"], $twin)
      }
      .padding(.horizontal, 16)
      .padding(.bottom, 24)
    }
    .demoScrolled()
    .background(Palette.paper)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        Button("Continue") { state.onboarding.append(.signUp3) }
          .buttonStyle(.primary)
          .disabled(interests.count < minimum)
      }
    }
    .innerTopBar(back: "Back", title: "Step 2 of 3")
  }

  private func question(_ title: String, _ options: [String], _ selection: Binding<String?>) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      FieldLabel(title)
      ChipPicker(options: options, selection: selection)
    }
    .padding(.top, 18)
  }
}

/// Step 3: places you'd love to go and a card answer.
struct SignUpStep3: View {
  @Environment(AppState.self) private var state
  @State private var search = ""
  @State private var places = ["Madeira", "Puglia", "Norwegian fjords", "Kyoto"]
  @State private var answer = "An early walk, a long lunch somewhere local, and a nap I won't apologise for."

  private let ideas = ["Seville", "Lake Como", "Vienna", "Iceland"]
  private var answerMax: Int { Rules.shared.int("card", "maxChars", default: 200) }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        StepProgress(step: 3, of: 3).padding(.top, 10)
        PageHeader(title: "Where would you love to go?", text: "Add a few places. Members who dream of the same ones will see you share them.")
          .padding(.top, 20)
        FieldLabel("Places you'd love to go").padding(.top, 20)
        InputField(placeholder: "Search places", text: $search, icon: "magnifyingglass", submit: .search).padding(.top, 8)
        FlowLayout(spacing: 8, lineSpacing: 8) {
          ForEach(places, id: \.self) { place in
            Button { places.removeAll { $0 == place } } label: {
              HStack(spacing: 6) {
                Text(place)
                Image(systemName: "xmark").font(.system(size: 12, weight: .bold))
              }
              .font(.figtree(16, .semibold))
              .foregroundStyle(Palette.burgundy)
              .padding(.horizontal, 14)
              .frame(minHeight: 44)
              .background(Capsule().fill(Palette.blush))
              .overlay(Capsule().strokeBorder(Palette.burgundy, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(place)")
          }
        }
        .padding(.top, 12)

        Text("Ideas to add").sectionCaps().padding(.top, 18)
        FlowLayout(spacing: 8, lineSpacing: 8) {
          ForEach(ideas.filter { !places.contains($0) }, id: \.self) { idea in
            Button { places.append(idea) } label: {
              HStack(spacing: 6) {
                Text(idea)
                Image(systemName: "plus").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.burgundy)
              }
              .font(.figtree(16))
              .foregroundStyle(Palette.ink)
              .padding(.horizontal, 14)
              .frame(minHeight: 44)
              .background(Capsule().fill(Palette.card))
              .overlay(Capsule().strokeBorder(Palette.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add \(idea)")
          }
        }
        .padding(.top, 10)

        FieldLabel("In your own words", trailing: "Optional · shown on your card").padding(.top, 22)
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text("My ideal travel day…").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
            Spacer()
            Button("Change question") {}.buttonStyle(TextButtonStyle(weight: .medium))
          }
          TextField("Write a short answer", text: $answer, axis: .vertical)
            .font(.figtree(17))
            .lineLimit(2...5)
            .onChange(of: answer) { _, new in if new.count > answerMax { answer = String(new.prefix(answerMax)) } }
          Text("\(answer.count) / \(answerMax)")
            .font(.figtree(14))
            .foregroundStyle(Palette.muted)
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .card(padding: 14)
        .padding(.top, 8)
      }
      .padding(.horizontal, 16)
      .padding(.bottom, 24)
    }
    .demoScrolled()
    .scrollDismissesKeyboard(.interactively)
    .background(Palette.paper)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        Button("Finish") { state.onboarding.append(.youreIn) }.buttonStyle(.primary)
      }
    }
    .innerTopBar(back: "Back") {
      Text("Step 3 of 3").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
    } trailing: {
      Button("Skip") { state.onboarding.append(.youreIn) }.buttonStyle(TextButtonStyle(weight: .regular))
    }
  }
}

/// The welcome moment, with the member card.
struct YoureInScreen: View {
  @Environment(AppState.self) private var state

  var body: some View {
    VStack(spacing: 14) {
      MemberPass(name: "Margaret H.", since: "Since Oct 2026")
        .padding(.top, 28)
      Text("You're in, \(state.memberName)")
        .font(.heading(32, relativeTo: .largeTitle))
        .foregroundStyle(Palette.ink)
        .padding(.top, 10)
      Text("Welcome to the Collective. Add your first trip to see who's going your way.")
        .font(.figtree(17))
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
      HStack(alignment: .top, spacing: 12) {
        IconBadge(systemName: "heart", fill: Palette.blush, tint: Palette.burgundy, size: 34)
        VStack(alignment: .leading, spacing: 4) {
          Text("Here for friendship and travel").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text("Be kind, meet somewhere public first, and keep it friendly.").font(.figtree(15)).foregroundStyle(Palette.muted)
          Button("Read the community rules") {
            enter(.profile)
            state.paths[.profile] = [.communityRules]
          }
          .buttonStyle(.text)
        }
        Spacer(minLength: 0)
      }
      .card(padding: 14)
      .padding(.top, 8)
      Spacer()
    }
    .padding(.horizontal, 16)
    .background(Palette.paper)
    .toolbar(.hidden, for: .navigationBar)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        VStack(spacing: 4) {
          Button("Add your first trip") {
            enter(.trips)
            state.sheet = .addTrip(editing: nil)
          }
          .buttonStyle(.primary)
          Button("See who's going") { enter(.whosGoing) }.buttonStyle(.text)
        }
      }
    }
  }

  private func enter(_ tab: AppTab) {
    state.tab = tab
    state.onboarding = []
    withAnimation { state.phase = .main }
  }
}

/// The burgundy member card shown on "You're in".
struct MemberPass: View {
  let name: String
  let since: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .top) {
        PrimaryLogo(height: 48, color: .white, scriptColor: Palette.brightGold)
        Spacer()
        Text("Member")
          .font(.figtree(14, .semibold))
          .foregroundStyle(Palette.brightGold)
          .padding(.horizontal, 10)
          .padding(.vertical, 4)
          .background(Capsule().fill(Color.white.opacity(0.14)))
      }
      Spacer(minLength: 16)
      Text(name).font(.heading(28)).foregroundStyle(.white)
      Text(since).font(.figtree(14)).foregroundStyle(.white.opacity(0.8))
    }
    .padding(18)
    .frame(width: 268, height: 160)
    .background(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(LinearGradient(colors: [Color(hex: 0x9E2234), Palette.deepBurgundy], startPoint: .topLeading, endPoint: .bottomTrailing))
    )
    .shadow(color: Palette.burgundy.opacity(0.35), radius: 18, y: 10)
    .accessibilityElement(children: .combine)
  }
}
