import SwiftUI

/// The sticky "Share where you're meeting" button used on the safety pages.
private struct ShareMeetingBar: View {
  @Environment(AppState.self) private var state

  var body: some View {
    StickyActionBar {
      Button { state.sheet = .shareMeeting(with: SampleData.chatWith.name) } label: {
        Label("Share where you're meeting", systemImage: "mappin")
      }
      .buttonStyle(.primary)
    }
  }
}

// MARK: Meeting up safely

struct MeetingSafelyScreen: View {
  let back: String
  @Environment(AppState.self) private var state

  private let steps = [
    ("Video call first", "A quick call helps you both feel at ease before you meet."),
    ("Meet somewhere busy, in daylight", "A café, a museum or a market. Not a hotel room or someone's home."),
    ("Tell someone you trust", "Share where you're going and when, and check in afterwards."),
    ("Make your own way there and back", "Keep your own plans for travel and where you're staying."),
    ("Never send money", "No member should ever ask. If they do, report them."),
    ("Trust your instincts", "If something feels off, leave. You can block or report from any chat."),
  ]

  var body: some View {
    InnerScroll(bottomPadding: 24) {
      PageHeader(eyebrow: "Safety guide", title: "Meeting up safely", text: "Most meet-ups are lovely. These simple habits help keep them that way.")
      NumberedSteps(steps: steps).padding(.top, 18)
      Button("Tell someone you trust") { state.push(.tellSomeone) }
        .buttonStyle(.text)
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) { ShareMeetingBar() }
    .innerTopBar(back: back) { EmptyView() } trailing: { EmptyView() }
    .hidesTabBar("safety", in: state)
  }
}

// MARK: Tell someone you trust

struct TellSomeoneScreen: View {
  let back: String
  @Environment(AppState.self) private var state

  var body: some View {
    InnerScroll(bottomPadding: 24) {
      PageHeader(eyebrow: "Safety", title: "Tell someone you trust", text: "A friend who knows your plans is the best safety net there is.")

      HStack(alignment: .top, spacing: 12) {
        IconBadge(systemName: "checkmark.shield", fill: Palette.blush, tint: Palette.burgundy)
        VStack(alignment: .leading, spacing: 4) {
          Text("Before every meet-up").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text("Share where and when with someone you trust. They'll get the details by email, and nothing else from your account.")
            .font(.figtree(15)).foregroundStyle(Palette.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
        Spacer(minLength: 0)
      }
      .card(padding: 14)
      .padding(.top, 18)

      SectionCaption("People you trust").padding(.top, 14)
      RowsCard {
        HStack(spacing: 12) {
          Avatar(size: 40, tones: [Color(hex: 0xF0D9A0), Color(hex: 0xC9A55E)])
          VStack(alignment: .leading, spacing: 2) {
            Text("Anne (sister)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
            Text("anne.w@example.com").font(.figtree(14)).foregroundStyle(Palette.muted)
          }
          Spacer()
          Button("Edit") {}.buttonStyle(TextButtonStyle(weight: .medium))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        RowDivider(inset: 66)
        Button {} label: {
          HStack(spacing: 12) {
            Image(systemName: "plus")
              .font(.system(size: 18))
              .foregroundStyle(Palette.burgundy)
              .frame(width: 40, height: 40)
              .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.blush))
            VStack(alignment: .leading, spacing: 2) {
              Text("Add someone you trust").font(.figtree(17, .medium)).foregroundStyle(Palette.burgundy)
              Text("Pick from your iPhone contacts").font(.figtree(14)).foregroundStyle(Palette.muted)
            }
            Spacer()
          }
          .padding(.horizontal, 14)
          .padding(.vertical, 10)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
      .padding(.top, 6)

      HStack(spacing: 12) {
        Image(systemName: "iphone")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.white)
          .frame(width: 34, height: 34)
          .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Palette.error))
        (Text("In an emergency, always call ") + Text("999").bold() + Text(" in the UK or ") + Text("112").bold() + Text(" abroad."))
          .font(.figtree(16)).foregroundStyle(Palette.ink)
        Spacer(minLength: 0)
      }
      .padding(14)
      .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(hex: 0xFBE6E8)))
      .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0xF0C2C8), lineWidth: 1))
      .padding(.top, 18)
      .accessibilityElement(children: .combine)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) { ShareMeetingBar() }
    .innerTopBar(back: back) { EmptyView() } trailing: { EmptyView() }
    .hidesTabBar("tell-someone", in: state)
  }
}

// MARK: Community rules

struct CommunityRulesScreen: View {
  let back: String
  @Environment(AppState.self) private var state

  private let rules = [
    ("Friendship, not dating", "The Collective is for travel friends. Keep it that way."),
    ("Be yourself", "Use your real first name and a recent photo of just you."),
    ("Be kind and respectful", "Everyone is welcome, whatever their age, background or beliefs."),
    ("Take no for an answer", "“Not now” means not now. Don't keep asking."),
    ("Never ask for money", "Not for tickets, emergencies or anything else."),
    ("Keep each other safe", "Meet in public first, and look out for one another on the road."),
    ("Speak up", "If someone breaks these rules, tell us. We read every report."),
  ]

  var body: some View {
    InnerScroll(bottomPadding: 40) {
      PageHeader(eyebrow: "Community", title: "Community rules", text: "Seven simple rules that keep the Collective warm, friendly and safe.")
      NumberedSteps(steps: rules).padding(.top, 18)
      VStack(spacing: 4) {
        Text("Breaking these rules can mean losing your membership.")
        Text("Seen something wrong? Use Report on their profile or in your chat.")
      }
      .font(.figtree(15))
      .foregroundStyle(Palette.muted)
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .padding(.top, 16)
    }
    .innerTopBar(back: back) { EmptyView() } trailing: { EmptyView() }
    .hidesTabBar("rules", in: state)
  }
}

// MARK: Help

struct HelpScreen: View {
  let back: String
  @Environment(AppState.self) private var state
  @State private var search = ""
  @State private var open: String? = "Is \(Brand.shared.shortName) a dating app?"

  private var questions: [(String, String)] {
    let free = Rules.shared.int("requests", "perWeekFree", default: 5)
    return [
      ("Is \(Brand.shared.shortName) a dating app?", "No. The Collective is only for friendship and travel. Members who use it for dating are asked to leave."),
      ("How do connection requests work?", "Tap Connect on someone's card and say hello. If they accept, you can chat. Free members can send \(free) a week."),
      ("Who can see my trips?", "Members going to the same place at the same time. You can hide any trip, or all of them in Privacy choices."),
      ("How do I cancel \(Brand.shared.plusName)?", "Open iPhone Settings, tap your name, then Subscriptions. You keep \(Brand.shared.plusName) until the end of the month you've paid for."),
      ("How do I delete my account?", "Go to Profile, Settings, Account, then Delete my account. Everything goes straight away."),
    ]
  }

  private var shown: [(String, String)] {
    let q = search.trimmingCharacters(in: .whitespaces).lowercased()
    return q.isEmpty ? questions : questions.filter { $0.0.lowercased().contains(q) || $0.1.lowercased().contains(q) }
  }

  var body: some View {
    InnerScroll(bottomPadding: 24) {
      PageHeader(title: "How can we help?", text: "Answers to common questions, or talk to us.")
      InputField(placeholder: "Search help", text: $search, icon: "magnifyingglass", submit: .search).padding(.top, 16)

      SectionCaption("Common questions").padding(.top, 14)
      RowsCard {
        ForEach(Array(shown.enumerated()), id: \.offset) { index, item in
          if index > 0 { RowDivider() }
          let isOpen = open == item.0
          Button { withAnimation(.easeInOut(duration: 0.2)) { open = isOpen ? nil : item.0 } } label: {
            VStack(alignment: .leading, spacing: 8) {
              HStack {
                Text(item.0).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
                Spacer()
                Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                  .font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted)
              }
              if isOpen {
                Text(item.1).font(.figtree(15)).foregroundStyle(Palette.softInk)
                  .fixedSize(horizontal: false, vertical: true)
              }
            }
            .padding(14)
            .frame(minHeight: 50)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityHint(isOpen ? "Hides the answer" : "Shows the answer")
        }
      }
      .padding(.top, 6)

      VStack(alignment: .leading, spacing: 6) {
        Text("Still need a hand?").font(.heading(22)).foregroundStyle(Palette.ink)
        Text("Send us a message and a real person from the Collective will reply.")
          .font(.figtree(15)).foregroundStyle(Palette.muted)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .card(padding: 14)
      .padding(.top, 18)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        Button { state.show("Thanks, message noted", detail: "Talking to the team arrives in the next version.") } label: {
          Label("Talk to us", systemImage: "bubble.left")
        }
        .buttonStyle(.primary)
      }
    }
    .innerTopBar(back: back, title: "Help")
    .hidesTabBar("help", in: state)
  }
}
