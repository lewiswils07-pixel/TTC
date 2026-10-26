import SwiftUI

/// One chat: safety card, messages, plan-board notes and a composer that
/// stays just above the keyboard.
struct ChatScreen: View {
  let name: String
  let back: String
  @Environment(AppState.self) private var state

  @State private var messages: [ChatMessage]
  @State private var draft = ""
  @State private var showSafety = true
  @State private var showMenu = false
  @FocusState private var composerFocused: Bool

  init(name: String, back: String) {
    self.name = name
    self.back = back
    _messages = State(initialValue: name == SampleData.chatWith.name ? SampleData.messages : [])
  }

  private var member: Member { SampleData.member(name) }
  private var tripLine: String { member.tripDates.isEmpty ? member.town : "Lisbon · \(member.tripDates)" }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 12) {
          if showSafety {
            SafetyCard(readGuide: { state.push(.meetingSafely) }) { withAnimation { showSafety = false } }
              .padding(.bottom, 12)
          }
          if messages.isEmpty {
            Text("Say hello to \(name). You're both going to Lisbon in May.")
              .font(.figtree(15))
              .foregroundStyle(Palette.muted)
              .multilineTextAlignment(.center)
              .frame(maxWidth: .infinity)
              .padding(.top, 20)
          } else {
            Pill(text: "Today")
              .frame(maxWidth: .infinity)
              .padding(.bottom, 4)
            ForEach(messages) { message in
              MessageRow(message: message).id(message.id)
            }
          }
          Text(messages.isEmpty ? "" : "10:42")
            .font(.small)
            .foregroundStyle(Palette.muted)
            .padding(.leading, 6)
            .id("bottom")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
      }
      .scrollDismissesKeyboard(.interactively)
      .background(Palette.paper)
      .safeAreaInset(edge: .bottom, spacing: 0) { composer(proxy) }
      .onChange(of: composerFocused) { _, focused in
        if focused {
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
        }
      }
    }
    .innerTopBar(back: back) {
      Button { state.push(.member(name)) } label: {
        HStack(spacing: 10) {
          Avatar(size: 32, tones: member.tones.colors)
          VStack(alignment: .leading, spacing: 0) {
            Text("\(member.name), \(member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
            Text(tripLine).font(.figtree(14, relativeTo: .caption)).foregroundStyle(Palette.muted)
          }
        }
      }
      .buttonStyle(.plain)
      .accessibilityElement(children: .combine)
      .accessibilityHint("Opens \(member.possessive) profile")
    } trailing: {
      Button { showMenu = true } label: {
        Image(systemName: "ellipsis")
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(Palette.burgundy)
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel("More options")
    }
    .hidesTabBar("chat-\(name)", in: state)
    .sheet(isPresented: $showMenu) {
      ChatMenuSheet(name: member.name, age: member.age, tones: member.tones.colors, detail: "\(member.town) · \(tripLine)") { choice in
        showMenu = false
        guard let choice else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { open(choice) }
      }
      .sodalisSheet(detents: [.height(560), .large])
    }
    .onAppear {
      if Demo.is(.chatMenu) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { showMenu = true }
      }
    }
  }

  private func open(_ choice: ChatMenuSheet.Choice) {
    switch choice {
    case .profile: state.push(.member(name))
    case .plan: state.sheet = .planTrip(with: name)
    case .meeting: state.sheet = .shareMeeting(with: name)
    case .trusted: state.push(.tellSomeone)
    case .block: state.show("You've blocked \(name)", detail: "\(member.pronoun.capitalized) can't message you or see your card.") {}
    case .report: state.sheet = .report(name)
    }
  }

  private func composer(_ proxy: ScrollViewProxy) -> some View {
    let empty = draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    return VStack(spacing: 0) {
      Rectangle().fill(Palette.line).frame(height: 0.5)
      HStack(alignment: .bottom, spacing: 8) {
        Button {} label: {
          Image(systemName: "plus")
            .font(.system(size: 22, weight: .regular))
            .foregroundStyle(Palette.softInk)
            .frame(width: 44, height: 44)
        }
        .accessibilityLabel("Add to chat")
        TextField("Message \(name)", text: $draft, axis: .vertical)
          .font(.body17)
          .lineLimit(1...5)
          .focused($composerFocused)
          .padding(.horizontal, 14)
          .padding(.vertical, 11)
          .frame(minHeight: 44)
          .background(Capsule().fill(Palette.card))
          .overlay(Capsule().strokeBorder(Palette.line, lineWidth: 1))
        Button {
          send(proxy)
        } label: {
          Image(systemName: "arrow.up")
            .font(.system(size: 19, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 44, height: 44)
            .background(Circle().fill(empty ? Palette.sendIdle : Palette.burgundy))
        }
        .disabled(empty)
        .accessibilityLabel("Send")
      }
      .padding(.horizontal, 8)
      .padding(.vertical, 8)
    }
    .background(Palette.paper)
  }

  private func send(_ proxy: ScrollViewProxy) {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return }
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    messages.append(ChatMessage(kind: .outgoing(text)))
    draft = ""
    withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
  }
}

private struct MessageRow: View {
  let message: ChatMessage

  var body: some View {
    switch message.kind {
    case .incoming(let text):
      bubble(text, outgoing: false)
    case .outgoing(let text):
      bubble(text, outgoing: true)
    case let .planNote(code, who, board, item):
      HStack(spacing: 12) {
        Text(code)
          .font(.heading(17))
          .foregroundStyle(Palette.brightGold)
          .frame(width: 40, height: 40)
          .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.wine))
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 2) {
          Text("\(who) added to the \(board) plan board").font(.figtree(15, relativeTo: .footnote)).foregroundStyle(Palette.muted)
          Text(item).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
        }
        Spacer(minLength: 0)
      }
      .padding(12)
      .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.card.opacity(0.6)))
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .strokeBorder(Palette.muted.opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
      )
      .accessibilityElement(children: .combine)
    }
  }

  private func bubble(_ text: String, outgoing: Bool) -> some View {
    HStack {
      if outgoing { Spacer(minLength: 48) }
      Text(text)
        .font(.body17)
        .foregroundStyle(outgoing ? .white : Palette.ink)
        .padding(.horizontal, 15)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(outgoing ? Palette.burgundy : Palette.card))
        .overlay {
          if !outgoing {
            RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.line, lineWidth: 0.75)
          }
        }
        .frame(maxWidth: 290, alignment: outgoing ? .trailing : .leading)
      if !outgoing { Spacer(minLength: 48) }
    }
  }
}

/// "Before you meet" safety card shown at the top of a new chat.
private struct SafetyCard: View {
  let readGuide: () -> Void
  let close: () -> Void

  private let tips = ["Video call first", "Meet somewhere busy, in daylight", "Tell someone you trust", "Never send money"]

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Image(systemName: "checkmark.shield")
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(Palette.brightGold)
          .frame(width: 36, height: 36)
          .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.ink))
          .accessibilityHidden(true)
        Text("Before you meet")
          .font(.heading(22))
          .foregroundStyle(Palette.ink)
          .accessibilityAddTraits(.isHeader)
        Spacer()
        CircleIconButton(systemName: "xmark", filled: false, label: "Hide safety tips", action: close)
          .padding(.trailing, -8)
      }
      LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
        ForEach(tips, id: \.self) { tip in
          Text(tip)
            .font(.body17)
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .topLeading)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
        }
      }
      Button("Read the full guide", action: readGuide)
        .font(.figtree(17, .semibold))
        .foregroundStyle(Palette.goldText)
        .frame(minHeight: 44)
    }
    .padding(14)
    .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Palette.goldWash))
    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.goldLine, lineWidth: 1))
  }
}

/// The ⋯ menu as a bottom sheet.
struct ChatMenuSheet: View {
  enum Choice { case profile, plan, meeting, trusted, block, report }

  let name: String
  let age: Int
  var tones: [Color] = [Color(hex: 0xE7B8B2), Color(hex: 0xC98B86)]
  let detail: String
  let close: (Choice?) -> Void

  private struct Item: Identifiable {
    let title: String
    let icon: String
    let choice: Choice
    var destructive = false
    var id: String { title }
  }

  private var items: [Item] {
    [
      Item(title: "View profile", icon: "person", choice: .profile),
      Item(title: "Plan a trip together", icon: "calendar", choice: .plan),
      Item(title: "Share where you're meeting", icon: "mappin", choice: .meeting),
      Item(title: "Tell someone you trust", icon: "checkmark.shield", choice: .trusted),
      Item(title: "Block \(name)", icon: "nosign", choice: .block, destructive: true),
      Item(title: "Report \(name)", icon: "flag", choice: .report, destructive: true),
    ]
  }

  var body: some View {
    VStack(spacing: 16) {
      HStack(spacing: 14) {
        Avatar(size: 48, tones: tones)
        VStack(alignment: .leading, spacing: 2) {
          Text("\(name), \(age)").font(.figtree(19, .semibold)).foregroundStyle(Palette.ink)
          Text(detail).font(.body17).foregroundStyle(Palette.muted)
        }
        Spacer()
      }
      .accessibilityElement(children: .combine)

      GroupedList(items: items, separatorInset: 50) { item in
        Button { close(item.choice) } label: {
          HStack(spacing: 14) {
            Image(systemName: item.icon)
              .font(.system(size: 19))
              .frame(width: 22)
            Text(item.title).font(.figtree(19))
            Spacer()
          }
          .foregroundStyle(item.destructive ? Palette.error : Palette.ink)
          .padding(.horizontal, 16)
          .frame(minHeight: 56)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }

      Button("Cancel") { close(nil) }.buttonStyle(.secondary)
    }
    .padding(.horizontal, 16)
    .padding(.top, 28)
    .frame(maxHeight: .infinity, alignment: .top)
    .background(Palette.paper)
  }
}
