import AVFoundation
import PhotosUI
import SwiftUI

struct ProfileScreen: View {
  @Environment(AppState.self) private var state

  private let interests = ["Food markets", "Coastal walks", "Galleries", "Live music", "Gardens"]

  var body: some View {
    LargeTitlePage(title: "Your profile") {
      HeaderIconButton(systemName: "gearshape", label: "Settings") { state.push(.settings) }
    } content: {
      VStack(alignment: .leading, spacing: 0) {
        meCard
        finishCard.padding(.top, 14)

        HStack {
          Text("Interests").font(.heading(24)).foregroundStyle(Palette.ink)
          Spacer()
          Button("Edit") {}.buttonStyle(TextButtonStyle(weight: .medium))
        }
        .padding(.top, 24)
        FlowLayout(spacing: 8, lineSpacing: 8) {
          ForEach(interests, id: \.self) { interest in
            Text(interest)
              .font(.figtree(16))
              .foregroundStyle(Palette.ink)
              .padding(.horizontal, 14)
              .frame(minHeight: 40)
              .background(Capsule().fill(Palette.card))
              .overlay(Capsule().strokeBorder(Palette.line, lineWidth: 1))
          }
        }
        .padding(.top, 8)

        RowsCard {
          Button { state.push(.settings) } label: { ListRow(icon: "gearshape", title: "Settings") }
          RowDivider(inset: 60)
          Button { state.push(.privacy) } label: { ListRow(icon: "lock", title: "Privacy choices") }
          RowDivider(inset: 60)
          Button {} label: { ListRow(icon: "nosign", title: "Blocked members") }
        }
        .buttonStyle(.plain)
        .padding(.top, 24)

        Text("Safety guides").font(.heading(24)).foregroundStyle(Palette.ink).padding(.top, 24)
        RowsCard {
          Button { state.push(.meetingSafely) } label: { safetyRow("checkmark.shield", "Meeting up safely") }
          RowDivider(inset: 60)
          Button { state.push(.tellSomeone) } label: { safetyRow("person.2", "Tell someone you trust") }
          RowDivider(inset: 60)
          Button { state.push(.communityRules) } label: { safetyRow("heart", "Community rules") }
          RowDivider(inset: 60)
          Button { state.sheet = .report("someone") } label: { safetyRow("flag", "Report someone") }
          RowDivider(inset: 60)
          Button { state.push(.help) } label: { safetyRow("questionmark.circle", "Help") }
        }
        .buttonStyle(.plain)
        .padding(.top, 10)

        VStack(spacing: 10) {
          PrimaryLogo(height: 56)
          Button("How the Collective works") { state.push(.help) }.buttonStyle(TextButtonStyle(weight: .medium))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 28)
      }
    }
  }

  private func safetyRow(_ icon: String, _ title: String) -> some View {
    ListRow(icon: icon, iconFill: Palette.blush, iconTint: Palette.burgundy, title: title)
  }

  private var meCard: some View {
    HStack(spacing: 16) {
      Button { state.cover = .allowPhotos } label: {
        Avatar(size: 76, tones: SampleData.me.tones.colors)
          .overlay(alignment: .bottomTrailing) {
            Image(systemName: "camera.fill")
              .font(.system(size: 11))
              .foregroundStyle(.white)
              .frame(width: 24, height: 24)
              .background(Circle().fill(Palette.burgundy))
              .overlay(Circle().strokeBorder(Palette.card, lineWidth: 2))
          }
      }
      .accessibilityLabel("Change your photo")
      VStack(alignment: .leading, spacing: 3) {
        Text(SampleData.me.name).font(.heading(24)).foregroundStyle(Palette.ink)
        Text("\(SampleData.me.age) · \(SampleData.me.town)").font(.figtree(15)).foregroundStyle(Palette.muted)
        Button("See your card as others do") { state.push(.member(SampleData.me.name)) }
          .buttonStyle(TextButtonStyle(weight: .semibold))
      }
      Spacer(minLength: 0)
    }
    .card(padding: 14)
  }

  private var finishCard: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("Finish your profile").font(.heading(22)).foregroundStyle(Palette.ink)
        Spacer()
        Pill(text: "3 of 6 done", background: Palette.blush, foreground: Palette.burgundy)
      }
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Palette.tint)
          Capsule().fill(Palette.burgundy).frame(width: geo.size.width * 0.5)
        }
      }
      .frame(height: 5)
      Text("A fuller profile helps members feel they already know you.")
        .font(.figtree(15)).foregroundStyle(Palette.muted)
      VStack(spacing: 0) {
        todo("bubble.left", "Answer a few questions")
        RowDivider(inset: 46)
        todo("mappin", "Add places you'd love to go")
        RowDivider(inset: 46)
        todo("person.2", "Add travel companions")
      }
      Label("Photo, first trip and interests added", systemImage: "checkmark")
        .font(.figtree(14))
        .foregroundStyle(Palette.muted)
    }
    .card(padding: 14)
  }

  private func todo(_ icon: String, _ title: String) -> some View {
    Button {} label: {
      HStack(spacing: 12) {
        IconBadge(systemName: icon, fill: Palette.blush, tint: Palette.burgundy)
        Text(title).font(.figtree(17)).foregroundStyle(Palette.ink)
        Spacer()
        Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.7))
      }
      .frame(minHeight: 50)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

// MARK: Allow screens (before iOS asks)

/// Friendly explanation shown before an iOS permission prompt.
struct AllowScreen: View {
  let icon: String
  let title: String
  let text: String
  let points: [(String, String)]
  let primary: String
  var badge: Int? = nil
  let onPrimary: () -> Void
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: 14) {
      HStack {
        Spacer()
        CircleIconButton(systemName: "xmark", label: "Close") { dismiss() }
      }
      ZStack(alignment: .topTrailing) {
        Image(systemName: icon)
          .font(.system(size: 46, weight: .regular))
          .foregroundStyle(Palette.burgundy)
          .frame(width: 168, height: 168)
          .background(Circle().fill(RadialGradient(colors: [Palette.card, Palette.blush], center: .center, startRadius: 10, endRadius: 90)))
        if let badge {
          Text("\(badge)")
            .font(.figtree(15, .bold))
            .foregroundStyle(.white)
            .frame(width: 30, height: 30)
            .background(Circle().fill(Palette.burgundy))
            .offset(x: -40, y: 38)
        }
      }
      .accessibilityHidden(true)
      Text(title)
        .font(.heading(32, relativeTo: .largeTitle))
        .foregroundStyle(Palette.ink)
        .multilineTextAlignment(.center)
        .padding(.top, 8)
      Text(text)
        .font(.figtree(17))
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
      VStack(alignment: .leading, spacing: 14) {
        ForEach(points.indices, id: \.self) { index in
          HStack(spacing: 12) {
            IconBadge(systemName: points[index].0, fill: Palette.blush, tint: Palette.burgundy)
            Text(points[index].1).font(.figtree(17)).foregroundStyle(Palette.ink)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .card(padding: 14)
      HelperText("You can change this any time in iPhone Settings.")
      Spacer(minLength: 0)
      Button(primary, action: onPrimary).buttonStyle(.primary)
      Button("Not now") { dismiss() }.buttonStyle(.text)
    }
    .padding(.horizontal, 16)
    .padding(.bottom, 8)
    .background(Palette.paper.ignoresSafeArea())
  }
}

struct AllowPhotosScreen: View {
  @Environment(AppState.self) private var state
  @State private var showPicker = false
  @State private var item: PhotosPickerItem?

  var body: some View {
    AllowScreen(
      icon: "photo",
      title: "Choose a photo of you",
      text: "We'll open your iPhone's Photos so you can pick one. You choose exactly which photos \(Brand.shared.shortName) can see.",
      points: [("person", "Only the photos you pick are shared"), ("eye", "Members see your profile photo, nothing else"), ("lock", "We never look through your library")],
      primary: "Choose from Photos"
    ) {
      showPicker = true
    }
    .photosPicker(isPresented: $showPicker, selection: $item, matching: .images)
    .onChange(of: item) { _, new in
      guard let new else { return }
      Task {
        let data = try? await new.loadTransferable(type: Data.self)
        let image = data.flatMap(UIImage.init(data:))
        await MainActor.run {
          state.cover = nil
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { state.cover = .crop(image) }
        }
      }
    }
  }
}

struct AllowCameraScreen: View {
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    AllowScreen(
      icon: "camera",
      title: "Take a new photo",
      text: "Use your camera to take a fresh, friendly photo for your card. It's only used when you tap the camera button.",
      points: [("sun.max", "Good light and just you work best"), ("face.smiling", "A recent photo helps members recognise you"), ("lock", "Nothing is recorded in the background")],
      primary: "Open the camera"
    ) {
      AVCameraAccess.request { dismiss() }
    }
  }
}

/// Asks iOS for camera access (the system prompt), then calls back.
enum AVCameraAccess {
  static func request(_ done: @escaping () -> Void) {
    AVCaptureDevice.requestAccess(for: .video) { _ in
      DispatchQueue.main.async(execute: done)
    }
  }
}

/// Move-and-scale crop into a circle.
struct CropScreen: View {
  let image: UIImage?
  @Environment(\.dismiss) private var dismiss
  @State private var scale: CGFloat = 1
  @State private var lastScale: CGFloat = 1
  @State private var offset: CGSize = .zero
  @State private var lastOffset: CGSize = .zero

  var body: some View {
    GeometryReader { geo in
      let diameter = geo.size.width - 40
      ZStack {
        Color.black.ignoresSafeArea()
        Group {
          if let image {
            Image(uiImage: image).resizable().scaledToFill()
          } else {
            PhotoPlaceholder(tones: [Color(hex: 0xE8CBA9), Color(hex: 0xC9996C)])
          }
        }
        .frame(width: diameter, height: diameter * 1.3)
        .scaleEffect(scale)
        .offset(offset)
        .gesture(
          SimultaneousGesture(
            MagnificationGesture()
              .onChanged { scale = max(1, lastScale * $0) }
              .onEnded { _ in lastScale = scale },
            DragGesture()
              .onChanged { offset = CGSize(width: lastOffset.width + $0.translation.width, height: lastOffset.height + $0.translation.height) }
              .onEnded { _ in lastOffset = offset }
          )
        )
        // Darken everything outside the circle.
        Rectangle()
          .fill(Color.black.opacity(0.55))
          .mask {
            Rectangle().overlay(Circle().frame(width: diameter, height: diameter).blendMode(.destinationOut)).compositingGroup()
          }
          .allowsHitTesting(false)
        Circle().strokeBorder(.white.opacity(0.8), lineWidth: 1).frame(width: diameter, height: diameter).allowsHitTesting(false)

        VStack {
          Text("Move and scale").font(.figtree(17, .semibold)).foregroundStyle(.white).padding(.top, 14)
          Spacer()
          Text("Pinch to zoom, drag to centre your face")
            .font(.figtree(14, .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.white.opacity(0.14)))
          HStack {
            Button("Cancel") { dismiss() }.foregroundStyle(.white)
            Spacer()
            Button {
              withAnimation { scale = 1; lastScale = 1; offset = .zero; lastOffset = .zero }
            } label: {
              Image(systemName: "arrow.counterclockwise").foregroundStyle(.white).frame(width: 44, height: 44)
            }
            .accessibilityLabel("Reset")
            Spacer()
            Button("Choose") { dismiss() }.foregroundStyle(Palette.brightGold).fontWeight(.semibold)
          }
          .font(.figtree(18))
          .frame(minHeight: 44)
          .padding(.horizontal, 20)
          .padding(.top, 18)
          .padding(.bottom, 8)
        }
      }
    }
  }
}
