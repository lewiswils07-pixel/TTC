import SwiftUI

/// The Chat tab: connections, group chats and connection requests.
struct ChatListScreen: View {
  @Environment(AppState.self) private var state

  enum Section: Hashable { case connections, groups, requests }

  @State private var section: Section = Demo.is(.chatGroups) ? .groups : Demo.is(.chatRequests, .emptyRequests) ? .requests : .connections
  @State private var requests = Demo.is(.emptyRequests, .emptyChats) ? [] : SampleData.requests

  private var conversations: [Conversation] { Demo.is(.emptyChats) ? [] : SampleData.conversations }
  private var requestsLeft: Int { Rules.shared.int("requests", "perWeekFree", default: 5) - 2 }

  var body: some View {
    LargeTitlePage(title: "Chat") {
      HeaderIconButton(systemName: "magnifyingglass", label: "Search chats") {}
    } content: {
      VStack(alignment: .leading, spacing: 14) {
        SegmentedPicker(
          options: [(Section.connections, "Connections"), (.groups, "Groups"), (.requests, "Requests")],
          selection: $section,
          badges: [.requests: requests.count]
        )
        switch section {
        case .connections: connections
        case .groups: groups
        case .requests: requestList
        }
      }
    }
    .refreshable { try? await Task.sleep(nanoseconds: 700_000_000) }
  }

  // MARK: Connections

  @ViewBuilder private var connections: some View {
    if conversations.isEmpty {
      EmptyStateView(
        title: "No chats yet",
        text: "When you connect with someone, your conversation will appear here.",
        primary: ("See who's going", nil, { state.tab = .whosGoing })
      )
      .padding(.top, 40)
    } else {
      GroupedList(items: conversations, separatorInset: 76) { chat in
        Button { state.push(.chat(chat.name)) } label: { ConversationRow(chat: chat) }
          .buttonStyle(.plain)
      }
    }
  }

  // MARK: Groups

  private var groups: some View {
    VStack(spacing: 14) {
      RowsCard {
        ForEach(Array(SampleData.groupChats.enumerated()), id: \.offset) { index, chat in
          if index > 0 { RowDivider(inset: 76) }
          Button { state.push(.group(index == 0 ? "lisbon-food" : "edinburgh")) } label: {
            HStack(spacing: 14) {
              Image(systemName: "person.2")
                .font(.system(size: 18))
                .foregroundStyle(Palette.goldText)
                .frame(width: 48, height: 48)
                .background(Circle().fill(Color(hex: 0xF6E7B6)))
              VStack(alignment: .leading, spacing: 3) {
                HStack {
                  Text(chat.0).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink).lineLimit(1)
                  Spacer()
                  Text(chat.2).font(.figtree(14)).foregroundStyle(Palette.muted)
                }
                Text(chat.1).font(.figtree(16)).foregroundStyle(Palette.softInk).lineLimit(1)
              }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
        }
      }
      Button { state.push(.travelGroups) } label: {
        Label("Find or start a group", systemImage: "magnifyingglass")
      }
      .buttonStyle(.secondary)
    }
  }

  // MARK: Requests

  @ViewBuilder private var requestList: some View {
    if requests.isEmpty {
      EmptyStateView(
        title: "No requests right now",
        text: "When a member asks to connect, you'll see it here. Adding a trip helps people find you.",
        primary: ("Add a trip", nil, { state.tab = .trips; state.sheet = .addTrip(editing: nil) }),
        secondary: ("Back to your chats", { section = .connections })
      )
      .padding(.top, 40)
    } else {
      Text("Members who'd like to connect with you.")
        .font(.figtree(16))
        .foregroundStyle(Palette.muted)
      ForEach(requests) { request in
        RequestCard(request: request) {
          state.push(.member(request.member.name))
        } notNow: {
          remove(request)
        } accept: {
          UIImpactFeedbackGenerator(style: .light).impactOccurred()
          remove(request)
          state.show("You're connected with \(request.member.name)", detail: "Say hello in Chat.") {
            withAnimation { requests.insert(request, at: 0) }
          }
        }
      }
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: "sparkle").foregroundStyle(Palette.goldText)
        (Text("You can send \(requestsLeft) more connection requests this week. ") + Text("\(Brand.shared.plusName) members have no limit.").bold())
          .font(.figtree(15))
          .foregroundStyle(Palette.softInk)
      }
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.goldWash))
      .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.goldLine, lineWidth: 1))
      .onTapGesture { state.cover = .plus }
    }
  }

  private func remove(_ request: ConnectionRequest) {
    withAnimation { requests.removeAll { $0.id == request.id } }
  }
}

private struct ConversationRow: View {
  let chat: Conversation

  var body: some View {
    HStack(spacing: 14) {
      Avatar(size: 48, tones: chat.tones.colors)
      VStack(alignment: .leading, spacing: 3) {
        HStack(spacing: 8) {
          Text(chat.name).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(chat.tag)
            .font(.figtree(14))
            .foregroundStyle(Palette.softInk)
            .padding(.horizontal, 9)
            .padding(.vertical, 2)
            .background(Capsule().fill(Palette.tint))
          Spacer()
          Text(chat.time).font(.figtree(14)).foregroundStyle(Palette.muted)
        }
        HStack {
          Text(chat.last)
            .font(.figtree(16, chat.unread ? .medium : .regular))
            .foregroundStyle(chat.unread ? Palette.ink : Palette.softInk)
            .lineLimit(1)
          Spacer()
          if chat.unread {
            Circle().fill(Palette.burgundy).frame(width: 9, height: 9).accessibilityLabel("Unread")
          }
        }
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
  }
}

private struct RequestCard: View {
  let request: ConnectionRequest
  let seeCard: () -> Void
  let notNow: () -> Void
  let accept: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Eyebrow(text: request.heading)
      HStack(spacing: 12) {
        Avatar(size: 48, tones: request.member.tones.colors)
        VStack(alignment: .leading, spacing: 2) {
          Text("\(request.member.name), \(request.member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(request.detail).font(.figtree(14)).foregroundStyle(Palette.muted)
        }
        Spacer()
        Button("See card", action: seeCard).buttonStyle(TextButtonStyle(weight: .medium))
      }
      Text("“\(request.message)”")
        .font(.figtree(16))
        .foregroundStyle(Palette.softInk)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.tint.opacity(0.6)))
      HStack(spacing: 10) {
        Button("Not now", action: notNow).buttonStyle(.secondary)
        Button(action: accept) { Label("Accept", systemImage: "checkmark") }.buttonStyle(.primary)
      }
    }
    .card(padding: 14)
  }
}
