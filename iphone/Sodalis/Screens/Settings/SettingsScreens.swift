import SwiftUI
import UserNotifications

// MARK: Settings

struct SettingsScreen: View {
  let back: String
  @Environment(AppState.self) private var state
  @Environment(\.openURL) private var openURL
  @State private var requests = true
  @State private var messages = true
  @State private var goingYourWay = true
  @State private var news = false
  @State private var reduceMotion = false

  var body: some View {
    @Bindable var state = state
    InnerScroll {
      SectionCaption("Notifications")
      RowsCard {
        ToggleRow(icon: "person.badge.plus", title: "Connection requests", isOn: $requests)
        RowDivider(inset: 60)
        ToggleRow(icon: "bubble.left", title: "New messages", isOn: $messages)
        RowDivider(inset: 60)
        ToggleRow(icon: "point.topleft.down.to.point.bottomright.curvepath", title: "Members going your way", subtitle: "When someone adds a trip like yours", isOn: $goingYourWay)
        RowDivider(inset: 60)
        ToggleRow(icon: "envelope", title: "News from the Collective", subtitle: "A short email now and then", isOn: $news)
      }
      .padding(.top, 6)
      HelperText("You can also change these in iPhone Settings.").padding(.top, 8).padding(.leading, 4)

      SectionCaption("Reading").padding(.top, 14)
      RowsCard {
        Button { openSettings() } label: { ListRow(icon: "textformat.size", title: "Text size", value: "Larger") }
          .buttonStyle(.plain)
        RowDivider(inset: 60)
        greyToggle(icon: "waveform.path", title: "Reduce motion", isOn: $reduceMotion)
      }
      .padding(.top, 6)
      HelperText("\(Brand.shared.shortName) follows your iPhone text size, so Larger Text works everywhere.").padding(.top, 8).padding(.leading, 4)

      SectionCaption("You").padding(.top, 14)
      RowsCard {
        Button { state.push(.account) } label: { ListRow(icon: "person", title: "Account") }
        RowDivider(inset: 60)
        Button { state.push(.privacy) } label: { ListRow(icon: "lock", title: "Privacy choices") }
        RowDivider(inset: 60)
        Button { state.push(.blockedMembers) } label: { ListRow(icon: "nosign", title: "Blocked members", value: "2") }
        RowDivider(inset: 60)
        greyToggle(icon: "faceid", title: "Face ID", subtitle: "Unlock \(Brand.shared.shortName) with your face", isOn: $state.faceIDOn)
      }
      .buttonStyle(.plain)
      .padding(.top, 6)

      Button("Sign out") { state.signOut() }
        .font(.figtree(17, .semibold))
        .foregroundStyle(Palette.error)
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
        .padding(.top, 22)
    }
    .innerTopBar(back: back, title: "Settings")
  }

  private func openSettings() {
    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
  }
}

/// A switch row with a grey icon, as in Reading and You.
func greyToggle(icon: String, title: String, subtitle: String? = nil, isOn: Binding<Bool>) -> some View {
  Toggle(isOn: isOn) {
    HStack(spacing: 14) {
      IconBadge(systemName: icon)
      VStack(alignment: .leading, spacing: 2) {
        Text(title).font(.figtree(17)).foregroundStyle(Palette.ink)
        if let subtitle { Text(subtitle).font(.figtree(14)).foregroundStyle(Palette.muted) }
      }
    }
  }
  .tint(Palette.burgundy)
  .padding(.horizontal, 14)
  .frame(minHeight: 52)
}

// MARK: Privacy choices

struct PrivacyChoicesScreen: View {
  let back: String
  @State private var age = true
  @State private var town = true
  @State private var lastActive = false
  @State private var inWhosGoing = true
  @State private var trips = true
  @State private var nearHome = true

  var body: some View {
    InnerScroll {
      Text("You decide what other members can see.").font(.figtree(17)).foregroundStyle(Palette.muted)
      SectionCaption("On your card").padding(.top, 10)
      RowsCard {
        ToggleRow(title: "Show my age", isOn: $age)
        RowDivider()
        ToggleRow(title: "Show my home town", subtitle: "Your town only, never your address", isOn: $town)
        RowDivider()
        ToggleRow(title: "Show when I was last active", isOn: $lastActive)
      }
      .padding(.top, 6)

      SectionCaption("Being found").padding(.top, 14)
      RowsCard {
        ToggleRow(title: "Show me in Who's going", subtitle: "Turn off to take a break", isOn: $inWhosGoing)
        RowDivider()
        ToggleRow(title: "Let members see my trips", subtitle: "You can also hide single trips", isOn: $trips)
        RowDivider()
        ToggleRow(title: "Show me to members near home", isOn: $nearHome)
      }
      .padding(.top, 6)

      SectionCaption("Messages").padding(.top, 14)
      RowsCard {
        ListRow(title: "Who can message me", subtitle: "Connections only · members must connect first")
      }
      .padding(.top, 6)
    }
    .innerTopBar(back: back, title: "Privacy choices")
  }
}

// MARK: Account

struct AccountScreen: View {
  let back: String
  @Environment(AppState.self) private var state
  @State private var confirmDelete = false

  var body: some View {
    InnerScroll {
      SectionCaption("Signing in")
      RowsCard {
        ListRow(title: "Email", value: "margaret.h@example.com", chevron: false)
        RowDivider()
        Button {} label: { ListRow(title: "Password", value: "Change") }
        RowDivider()
        Button {} label: { ListRow(title: "Face ID", value: state.faceIDOn ? "On" : "Off") }
      }
      .buttonStyle(.plain)
      .padding(.top, 6)

      SectionCaption("Membership").padding(.top, 14)
      RowsCard {
        Button { state.cover = .plus } label: { ListRow(title: Brand.shared.plusName, value: state.isPlus ? "Member" : "Not a member") }
        RowDivider()
        Button {} label: { ListRow(title: "Manage subscription", subtitle: "Through your Apple ID") }
      }
      .buttonStyle(.plain)
      .padding(.top, 6)

      SectionCaption("Your data").padding(.top, 14)
      RowsCard {
        Button { state.show("We're preparing your data", detail: "It'll arrive by email within a day.") } label: {
          ListRow(icon: "arrow.down.to.line", title: "Download my data", subtitle: "We'll email you a copy of everything on your account")
        }
      }
      .buttonStyle(.plain)
      .padding(.top, 6)

      SectionCaption("Delete my account").padding(.top, 14)
      VStack(alignment: .leading, spacing: 10) {
        Text("This permanently deletes your profile, trips, chats, groups and connections. It can't be undone.")
          .font(.figtree(17)).foregroundStyle(Palette.ink)
        Text("If you have \(Brand.shared.plusName), cancel it first so you're not charged again.")
          .font(.figtree(14)).foregroundStyle(Palette.muted)
        Button { confirmDelete = true } label: {
          Label("Delete my account", systemImage: "trash")
            .font(.figtree(17, .semibold))
            .foregroundStyle(Palette.error)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.blush))
        }
        .padding(.top, 4)
      }
      .card(radius: 14, padding: 14)
      .padding(.top, 6)
    }
    .innerTopBar(back: back, title: "Account")
    .confirmationDialog("Delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
      Button("Delete my account", role: .destructive) { state.signOut() }
    } message: {
      Text("Everything goes straight away. This can't be undone.")
    }
  }
}

// MARK: Notifications

struct AllowNotificationsScreen: View {
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    AllowScreen(
      icon: "bell",
      title: "Know when someone says hello",
      text: "Turn on notifications and we'll tell you about the things that matter. Nothing else, and never at night.",
      points: [
        ("person.badge.plus", "New connection requests"),
        ("bubble.left", "Messages from people you're connected with"),
        ("point.topleft.down.to.point.bottomright.curvepath", "Someone going where you are, when you are"),
      ],
      primary: "Turn on notifications",
      badge: 3
    ) {
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
        DispatchQueue.main.async { dismiss() }
      }
    }
  }
}
