import SwiftUI

/// One member at a time, with what you share.
struct MemberCardView: View {
  let card: MemberCard
  var readMore: () -> Void = {}

  private var member: Member { card.member }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      reasonBand
      photo.id("memberPhoto")
      details
    }
    .background(Palette.card)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.line.opacity(0.6), lineWidth: 0.5))
    .shadow(color: Palette.ink.opacity(0.07), radius: 12, y: 4)
  }

  private var reasonBand: some View {
    HStack(spacing: 12) {
      RouteIcon(size: 18, lineWidth: 2)
        .foregroundStyle(.white)
        .frame(width: 36, height: 36)
        .background(Circle().fill(Palette.burgundy))
      VStack(alignment: .leading, spacing: 1) {
        Text(card.reason).font(.figtree(18, .semibold)).foregroundStyle(Palette.ink)
        Text(card.overlap).font(.body17).foregroundStyle(Palette.softInk)
      }
      Spacer(minLength: 4)
      Menu {
        Button("Hide \(member.name) for 30 days", systemImage: "eye.slash") {}
        Button("Report \(member.name)", systemImage: "flag", role: .destructive) {}
      } label: {
        Image(systemName: "ellipsis")
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(Palette.softInk)
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel("More options")
    }
    .padding(.leading, 16)
    .padding(.trailing, 6)
    .padding(.vertical, 10)
    .background(Palette.blush)
  }

  private var photo: some View {
    PhotoPlaceholder(tones: member.tones.colors)
      .frame(height: 223)
      .overlay(alignment: .topTrailing) {
        HStack(spacing: 5) {
          Capsule().fill(.white).frame(width: 18, height: 6)
          Circle().fill(.white.opacity(0.7)).frame(width: 6, height: 6)
          Circle().fill(.white.opacity(0.7)).frame(width: 6, height: 6)
        }
        .padding(14)
        .accessibilityHidden(true)
      }
      .overlay(alignment: .bottomLeading) {
        HStack(spacing: 8) {
          if member.lotsInCommon { LotsInCommonBadge() }
          if member.nearYou { NearYouBadge() }
        }
        .padding(12)
      }
  }

  private var details: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text(member.name).font(.heading(30)).foregroundStyle(Palette.ink)
        Text("\(member.age) · \(member.town)").font(.figtree(18)).foregroundStyle(Palette.muted)
      }
      .accessibilityElement(children: .combine)

      Text("What you share").sectionCaps().padding(.top, 18)

      VStack(alignment: .leading, spacing: 16) {
        ShareRow(label: "Interests", text: card.interests) { Image(systemName: "tag").font(.system(size: 17)) }
        ShareRow(label: "Places", text: card.places) { PinIcon(size: 19) }
        ShareRow(label: "Travel style", text: card.travelStyle) { RouteIcon(size: 18) }
      }
      .padding(.top, 14)

      Button(action: readMore) {
        HStack {
          Text("Read more about \(member.name)")
          Spacer()
          Image(systemName: "chevron.right")
        }
      }
      .buttonStyle(.text)
      .padding(.top, 10)
    }
    .padding(.horizontal, 16)
    .padding(.top, 14)
    .padding(.bottom, 8)
  }
}

struct ShareRow<Icon: View>: View {
  let label: String
  let text: String
  @ViewBuilder var icon: Icon

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      icon
        .foregroundStyle(Palette.softInk)
        .frame(width: 36, height: 36)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.tint))
        .accessibilityHidden(true)
      (Text(label).font(.figtree(17, .semibold)) + Text(" · \(text)").font(.body17))
        .foregroundStyle(Palette.ink)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.top, 6)
    }
  }
}

struct LotsInCommonBadge: View {
  var body: some View {
    Label("Lots in common", systemImage: "person.2")
      .font(.figtree(15, .medium, relativeTo: .footnote))
      .foregroundStyle(Palette.goldText)
      .padding(.horizontal, 12)
      .frame(minHeight: 28)
      .background(Capsule().fill(Color(hex: 0xF6E7B6)))
  }
}

struct NearYouBadge: View {
  var body: some View {
    HStack(spacing: 6) {
      PinIcon(size: 16)
      Text("Near you")
    }
    .font(.figtree(15, .medium, relativeTo: .footnote))
    .foregroundStyle(Palette.ink)
    .padding(.horizontal, 12)
    .frame(minHeight: 28)
    .background(Capsule().fill(Palette.card))
  }
}
