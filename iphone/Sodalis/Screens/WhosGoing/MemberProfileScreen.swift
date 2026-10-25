import SwiftUI

/// Someone else's profile (also "Read more" from Who's going).
struct MemberProfileScreen: View {
  let name: String
  let back: String
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss
  @State private var sent = false

  private var member: Member { SampleData.member(name) }
  private var trip: Trip { SampleData.trips[0] }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        hero
        VStack(alignment: .leading, spacing: 0) {
          (Text("Here for: ") + Text(member.hereFor).bold())
            .font(.figtree(17))
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card(padding: 14)

          SectionCaption("Trips you have in common").padding(.top, 18)
          Button { state.push(.trip(trip.code)) } label: {
            HStack(spacing: 12) {
              PlaceTile(code: trip.code)
              VStack(alignment: .leading, spacing: 2) {
                (Text(trip.place).bold() + Text(" · together 12–18 May")).font(.figtree(17)).foregroundStyle(Palette.ink)
                Text("\(member.possessive.capitalized) dates \(member.tripDates) · yours \(trip.dates)")
                  .font(.figtree(14, relativeTo: .footnote)).foregroundStyle(Palette.muted)
              }
              Spacer()
              Image(systemName: "chevron.right").foregroundStyle(Palette.muted)
            }
            .card(padding: 12)
          }
          .buttonStyle(.plain)
          .padding(.top, 8)

          if !member.wishlist.isEmpty {
            SectionCaption("Places \(member.pronoun)'d love to go").padding(.top, 18)
            FlowLayout(spacing: 8, lineSpacing: 8) {
              ForEach(member.wishlist.indices, id: \.self) { index in
                let place = member.wishlist[index].0
                let shared = member.wishlist[index].1
                Text(shared ? "\(place) · you too" : place)
                  .font(.figtree(16, shared ? .medium : .regular))
                  .foregroundStyle(shared ? Palette.goldText : Palette.ink)
                  .padding(.horizontal, 14)
                  .frame(minHeight: 40)
                  .background(Capsule().fill(shared ? Color(hex: 0xF6E7B6) : Palette.card))
                  .overlay(Capsule().strokeBorder(shared ? Palette.goldLine : Palette.line, lineWidth: 1))
              }
            }
            .padding(.top, 8)
          }

          SectionCaption("What you share").padding(.top, 18)
          VStack(alignment: .leading, spacing: 14) {
            ShareRow(label: "Interests", text: "food markets, fado nights, coastal walks") { Image(systemName: "tag").font(.system(size: 17)) }
            ShareRow(label: "Places", text: "you both loved Porto") { PinIcon(size: 19) }
          }
          .padding(.top, 8)
          Text("Gold ones you share").font(.figtree(14)).foregroundStyle(Palette.muted).padding(.top, 8)

          SectionCaption("How \(member.pronoun) travels").padding(.top, 18)
          RowsCard {
            detailRow("Budget", member.budget)
            RowDivider()
            detailRow("Planning", member.planning)
            RowDivider()
            detailRow("Pace", member.pace)
            RowDivider()
            detailRow("Days out", member.daysOut)
            RowDivider()
            detailRow("Group size", member.groupSize)
            RowDivider()
            detailRow("Twin room", member.twinRoom)
          }
          .padding(.top, 8)

          if !member.answers.isEmpty {
            SectionCaption("In \(member.possessive) words").padding(.top, 18)
            RowsCard {
              ForEach(Array(member.answers.enumerated()), id: \.offset) { index, answer in
                if index > 0 { RowDivider() }
                VStack(alignment: .leading, spacing: 4) {
                  Text(answer.0).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
                  Text(answer.1).font(.figtree(17)).foregroundStyle(Palette.ink)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
              }
            }
            .padding(.top, 8)
          }

          HStack(spacing: 18) {
            Button("Report \(member.name)") { state.sheet = .report(member.name) }
            Button("Block") {}
          }
          .buttonStyle(TextButtonStyle(weight: .regular))
          .frame(maxWidth: .infinity)
          .padding(.top, 20)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 110)
      }
    }
    .demoScrolled()
    .scrollIndicators(.hidden)
    .background(Palette.paper)
    .ignoresSafeArea(edges: .top)
    .overlay(alignment: .top) { floatingButtons }
    .safeAreaInset(edge: .bottom, spacing: 0) { connectBar }
    .toolbar(.hidden, for: .navigationBar)
    .navigationBarBackButtonHidden(true)
    .hidesTabBar("member-\(name)", in: state)
  }

  private var hero: some View {
    PhotoPlaceholder(tones: member.tones.colors)
      .frame(height: 350)
      .overlay {
        LinearGradient(colors: [.clear, .black.opacity(0.35)], startPoint: .center, endPoint: .bottom)
      }
      .overlay(alignment: .bottomLeading) {
        VStack(alignment: .leading, spacing: 4) {
          Text("\(member.name), \(member.age)").font(.heading(34)).foregroundStyle(.white)
          Text("\(member.town), \(member.county)").font(.figtree(17)).foregroundStyle(.white.opacity(0.9))
          if member.lotsInCommon {
            Text("Lots in common")
              .font(.figtree(14, .medium, relativeTo: .footnote))
              .foregroundStyle(Palette.goldText)
              .padding(.horizontal, 10)
              .padding(.vertical, 4)
              .background(Capsule().fill(Color(hex: 0xF6E7B6)))
              .padding(.top, 4)
          }
        }
        .padding(16)
        .accessibilityElement(children: .combine)
      }
  }

  private var floatingButtons: some View {
    HStack {
      Button { dismiss() } label: {
        Image(systemName: "chevron.left")
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(Palette.ink)
          .frame(width: 40, height: 40)
          .background(Circle().fill(.ultraThinMaterial))
          .background(Circle().fill(.white.opacity(0.6)))
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel("Back to \(back)")
      Spacer()
      Menu {
        Button("Report \(member.name)", systemImage: "flag") { state.sheet = .report(member.name) }
        Button("Block \(member.name)", systemImage: "nosign", role: .destructive) {}
      } label: {
        Image(systemName: "ellipsis")
          .font(.system(size: 17, weight: .bold))
          .foregroundStyle(Palette.ink)
          .frame(width: 40, height: 40)
          .background(Circle().fill(.ultraThinMaterial))
          .background(Circle().fill(.white.opacity(0.6)))
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel("More options")
    }
    .padding(.horizontal, 12)
  }

  private var connectBar: some View {
    VStack(spacing: 0) {
      Rectangle().fill(Palette.line).frame(height: 0.5)
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text(sent ? "Request sent" : "Connect with \(member.name)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text("Say hello and plan \(trip.place) together.").font(.figtree(14, relativeTo: .footnote)).foregroundStyle(Palette.muted)
        }
        Spacer()
        Button {
          UIImpactFeedbackGenerator(style: .light).impactOccurred()
          sent = true
          state.show("Request sent to \(member.name)", detail: "We'll let you know when \(member.pronoun) replies.") { sent = false }
        } label: {
          Label(sent ? "Sent" : "Connect", systemImage: sent ? "checkmark" : "person.badge.plus")
        }
        .buttonStyle(PrimaryButtonStyle(fullWidth: false))
        .disabled(sent)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
    }
    .background(Palette.paper.opacity(0.98))
  }

  private func detailRow(_ title: String, _ value: String) -> some View {
    HStack {
      Text(title).font(.figtree(17)).foregroundStyle(Palette.ink)
      Spacer()
      Text(value).font(.figtree(17)).foregroundStyle(Palette.muted)
    }
    .padding(.horizontal, 14)
    .frame(minHeight: 48)
    .accessibilityElement(children: .combine)
  }
}
