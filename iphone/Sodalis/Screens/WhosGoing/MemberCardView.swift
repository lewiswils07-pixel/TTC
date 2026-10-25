import SwiftUI

/// One member at a time, with what you share.
struct MemberCardView: View {
  let member: MemberCard

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
      Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
        .font(.system(size: 18, weight: .semibold))
        .foregroundStyle(.white)
        .frame(width: 36, height: 36)
        .background(Circle().fill(Palette.burgundy))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 1) {
        Text(member.reason).font(.figtree(18, .semibold)).foregroundStyle(Palette.ink)
        Text(member.overlap).font(.body17).foregroundStyle(Palette.softInk)
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
    PhotoPlaceholder(tones: member.photoTones.colors)
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
          if member.lotsInCommon {
            badge("Lots in common", icon: "person.2", fill: Color(hex: 0xF6E7B6), ink: Palette.goldText)
          }
          if member.nearYou {
            badge("Near you", icon: "mappin", fill: Palette.card, ink: Palette.ink)
          }
        }
        .padding(12)
      }
  }

  private func badge(_ text: String, icon: String, fill: Color, ink: Color) -> some View {
    Label(text, systemImage: icon)
      .font(.figtree(15, .medium, relativeTo: .footnote))
      .foregroundStyle(ink)
      .padding(.horizontal, 12)
      .frame(minHeight: 28)
      .background(Capsule().fill(fill))
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
        shareRow(icon: "tag", label: "Interests", text: member.interests)
        shareRow(icon: "mappin", label: "Places", text: member.places)
        shareRow(icon: "point.topleft.down.to.point.bottomright.curvepath", label: "Travel style", text: member.travelStyle)
      }
      .padding(.top, 14)

      Button {} label: {
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

  private func shareRow(icon: String, label: String, text: String) -> some View {
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: icon)
        .font(.system(size: 17))
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
