import SwiftUI

/// Edit your profile: name, about you, interests, places you'd love to go,
/// card answers and travel companions. Saved on the device for now.
struct EditProfileScreen: View {
  let back: String
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss

  @State private var name = SampleData.me.name
  @State private var about = "Retired teacher who loves markets, coastal walks and a long lunch. Happiest with good company and no rush."
  @State private var interests: Set<String> = []
  @State private var places = ["Madeira", "Puglia", "Norwegian fjords"]
  @State private var newPlace = ""
  @State private var idealDay = "An early walk, a long lunch somewhere local, and a nap I won't apologise for."
  @State private var askMeAbout = ""
  @State private var companions = ["Anne (sister)"]
  @State private var newCompanion = ""

  private var minimum: Int { Rules.shared.int("interests", "min", default: 5) }
  private var maximum: Int { Rules.shared.int("interests", "pick", default: 8) }
  private var answerMax: Int { Rules.shared.int("card", "maxChars", default: 200) }

  var body: some View {
    InnerScroll(bottomPadding: 24) {
      Button { state.cover = .allowPhotos } label: {
        HStack(spacing: 14) {
          MyPhoto(size: 64)
          VStack(alignment: .leading, spacing: 2) {
            Text("Change your photo").font(.figtree(17, .semibold)).foregroundStyle(Palette.burgundy)
            Text("Just you, face clearly visible").font(.figtree(14)).foregroundStyle(Palette.muted)
          }
          Spacer()
        }
        .card(padding: 12)
      }
      .buttonStyle(.plain)

      FieldLabel("First name").padding(.top, 20)
      InputField(placeholder: "Your first name", text: $name, content: .givenName).padding(.top, 8)
        .onChange(of: name) { _, new in if new.count > Rules.shared.nameMax { name = String(new.prefix(Rules.shared.nameMax)) } }

      FieldLabel("A few words about you").padding(.top, 20)
      NoteBox(placeholder: "What makes a good travel day for you?", text: $about, limit: Rules.shared.bioMax, minLines: 4).padding(.top, 8)

      FieldLabel("Interests", trailing: "\(interests.count) picked · \(minimum) to \(maximum)").padding(.top, 20)
      FlowLayout(spacing: 8, lineSpacing: 8) {
        ForEach(SampleData.interests, id: \.self) { interest in
          Chip(title: interest, isSelected: interests.contains(interest)) {
            if interests.contains(interest) {
              if interests.count > minimum { interests.remove(interest) }
            } else if interests.count < maximum {
              interests.insert(interest)
            }
          }
        }
      }
      .padding(.top, 10)

      FieldLabel("Places you'd love to go").padding(.top, 20)
      FlowLayout(spacing: 8, lineSpacing: 8) {
        ForEach(places, id: \.self) { place in
          Button { withAnimation { places.removeAll { $0 == place } } } label: {
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
      .padding(.top, 10)
      addRow(placeholder: "Add a place", text: $newPlace) {
        places.append($0)
      }
      .padding(.top, 10)

      FieldLabel("In your own words", trailing: "Shown on your card").padding(.top, 20)
      answer("My ideal travel day…", $idealDay).padding(.top, 8)
      answer("Ask me about…", $askMeAbout).padding(.top, 10)

      FieldLabel("Travel companions", trailing: "Optional").padding(.top, 20)
      HelperText("Someone who often travels with you. Members see their first name only.").padding(.top, 4)
      if !companions.isEmpty {
        RowsCard {
          ForEach(Array(companions.enumerated()), id: \.offset) { index, person in
            if index > 0 { RowDivider() }
            HStack {
              Text(person).font(.figtree(17)).foregroundStyle(Palette.ink)
              Spacer()
              Button("Remove") { withAnimation { _ = companions.remove(at: index) } }
                .buttonStyle(TextButtonStyle(weight: .regular))
            }
            .padding(.horizontal, 14)
          }
        }
        .padding(.top, 10)
      }
      addRow(placeholder: "e.g. Tom (husband)", text: $newCompanion) {
        companions.append($0)
      }
      .padding(.top, 10)
    }
    .scrollDismissesKeyboard(.interactively)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        Button("Save changes") {
          state.memberName = name
          state.myInterests = SampleData.interests.filter { interests.contains($0) }
          dismiss()
          state.show("Profile saved")
        }
        .buttonStyle(.primary)
      }
    }
    .onAppear {
      if interests.isEmpty { interests = Set(state.myInterests) }
      name = state.memberName
    }
    .innerTopBar(back: back, title: "Edit profile")
    .hidesTabBar("edit-profile", in: state)
  }

  private func answer(_ question: String, _ text: Binding<String>) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(question).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
      TextField("Write a short answer", text: text, axis: .vertical)
        .font(.figtree(17))
        .lineLimit(2...5)
        .onChange(of: text.wrappedValue) { _, new in if new.count > answerMax { text.wrappedValue = String(new.prefix(answerMax)) } }
      Text("\(text.wrappedValue.count) / \(answerMax)")
        .font(.figtree(14)).foregroundStyle(Palette.muted)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
    .card(padding: 14)
  }

  private func addRow(placeholder: String, text: Binding<String>, add: @escaping (String) -> Void) -> some View {
    HStack(spacing: 10) {
      InputField(placeholder: placeholder, text: text, submit: .done)
      Button {
        let value = text.wrappedValue.trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty else { return }
        withAnimation { add(value) }
        text.wrappedValue = ""
      } label: {
        Image(systemName: "plus").font(.system(size: 18, weight: .semibold))
      }
      .buttonStyle(SmallButtonStyle(kind: .primary))
      .accessibilityLabel("Add")
    }
  }
}

/// Members you've blocked, with Unblock.
struct BlockedMembersScreen: View {
  let back: String
  @Environment(AppState.self) private var state
  @State private var blocked = ["Paul", "Colin"]

  var body: some View {
    InnerScroll {
      Text("Blocked members can't see your card or trips, or message you. They aren't told you blocked them.")
        .font(.figtree(17)).foregroundStyle(Palette.muted)
      if blocked.isEmpty {
        EmptyStateView(title: "No one blocked", text: "If someone makes you uncomfortable, you can block them from their profile or your chat.")
          .padding(.top, 30)
      } else {
        RowsCard {
          ForEach(Array(blocked.enumerated()), id: \.offset) { index, name in
            if index > 0 { RowDivider(inset: 66) }
            let member = SampleData.member(name)
            HStack(spacing: 12) {
              Avatar(size: 40, tones: member.tones.colors)
              VStack(alignment: .leading, spacing: 2) {
                Text("\(member.name), \(member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
                Text(member.town).font(.figtree(14)).foregroundStyle(Palette.muted)
              }
              Spacer()
              Button("Unblock") {
                withAnimation { _ = blocked.remove(at: index) }
                state.show("\(name) unblocked")
              }
              .buttonStyle(SmallButtonStyle(kind: .secondary))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
          }
        }
        .padding(.top, 16)
      }
    }
    .innerTopBar(back: back, title: "Blocked members")
  }
}
