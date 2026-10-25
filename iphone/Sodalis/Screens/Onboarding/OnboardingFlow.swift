import LocalAuthentication
import SwiftUI

enum OnboardingRoute: Hashable {
  case joinEmail, joinCode, joinPassword
  case signIn, forgot, faceIDOffer
  case signUp1, signUp2, signUp3, youreIn
}

/// Welcome, join, sign in and sign-up, before the tabs.
struct OnboardingFlow: View {
  @Environment(AppState.self) private var state

  var body: some View {
    @Bindable var state = state
    NavigationStack(path: $state.onboarding) {
      WelcomeScreen()
        .navigationDestination(for: OnboardingRoute.self) { route in
          switch route {
          case .joinEmail: JoinEmailScreen()
          case .joinCode: JoinCodeScreen()
          case .joinPassword: JoinPasswordScreen()
          case .signIn: SignInScreen()
          case .forgot: ForgotPasswordScreen()
          case .faceIDOffer: FaceIDOfferScreen()
          case .signUp1: SignUpStep1()
          case .signUp2: SignUpStep2()
          case .signUp3: SignUpStep3()
          case .youreIn: YoureInScreen()
          }
        }
    }
  }
}

/// Thin progress bar split into steps.
struct StepProgress: View {
  let step: Int
  let of: Int

  var body: some View {
    HStack(spacing: 6) {
      ForEach(0..<of, id: \.self) { index in
        Capsule().fill(index < step ? Palette.burgundy : Palette.line).frame(height: 4)
      }
    }
    .accessibilityElement()
    .accessibilityLabel("Step \(step) of \(of)")
  }
}

// MARK: Launch and welcome

struct LaunchScreen: View {
  var body: some View {
    ZStack {
      LinearGradient(colors: [Palette.burgundy, Color(hex: 0x7A1624)], startPoint: .top, endPoint: .bottom)
        .ignoresSafeArea()
      PrimaryLogo(height: 104, color: .white, scriptColor: Palette.brightGold)
    }
  }
}

struct WelcomeScreen: View {
  @Environment(AppState.self) private var state

  private let steps = [
    ("Add your trips", "Where you're going, and when."),
    ("See who's going", "Members heading to the same places at the same time."),
    ("Connect and plan", "Say hello, chat, and plan days out together."),
  ]

  var body: some View {
    ScrollView {
      VStack(spacing: 14) {
        PrimaryLogo(height: 88).padding(.top, 20)
        Text("Find friends to travel with")
          .font(.heading(30, relativeTo: .largeTitle))
          .foregroundStyle(Palette.ink)
          .multilineTextAlignment(.center)
          .padding(.top, 10)
        Text("A members' club for solo travellers. Good company for the trip: friendship, never dating.")
          .font(.figtree(17))
          .foregroundStyle(Palette.muted)
          .multilineTextAlignment(.center)
        VStack(alignment: .leading, spacing: 14) {
          Text("How it works").sectionCaps()
          ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
            HStack(alignment: .top, spacing: 12) {
              Text("\(index + 1)")
                .font(.figtree(15, .bold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(Circle().fill(Palette.burgundy))
                .accessibilityHidden(true)
              VStack(alignment: .leading, spacing: 2) {
                Text(step.0).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
                Text(step.1).font(.figtree(15)).foregroundStyle(Palette.muted)
              }
            }
            .accessibilityElement(children: .combine)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: 16)
        .padding(.top, 8)
      }
      .padding(.horizontal, 20)
      .padding(.bottom, 20)
    }
    .background(Palette.paper)
    .toolbar(.hidden, for: .navigationBar)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        VStack(spacing: 8) {
          Text("Free to join. Once you're in, you stay signed in.")
            .font(.figtree(14))
            .foregroundStyle(Palette.muted)
          Button("Join") { state.onboarding.append(.joinEmail) }.buttonStyle(.primary)
          Button("Sign in") { state.onboarding.append(.signIn) }.buttonStyle(.text)
        }
      }
    }
  }
}

// MARK: Join

/// Shared layout for the short join and sign-in pages.
struct AuthPage<Content: View, Footer: View>: View {
  let back: String
  let title: String
  var step: Int? = nil
  @ViewBuilder var content: Content
  @ViewBuilder var footer: Footer

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        if let step { StepProgress(step: step, of: 3).padding(.top, 10) }
        content.padding(.top, step == nil ? 14 : 22)
      }
      .padding(.horizontal, 16)
      .padding(.bottom, 24)
    }
    .scrollDismissesKeyboard(.interactively)
    .background(Palette.paper)
    .safeAreaInset(edge: .bottom, spacing: 0) { StickyActionBar { footer } }
    .innerTopBar(back: back, title: title)
  }
}

struct JoinEmailScreen: View {
  @Environment(AppState.self) private var state
  @State private var email = Demo.current == .joinEmail ? "margaret.h@example" : ""

  var body: some View {
    AuthPage(back: "Back", title: "Join · 1 of 3", step: 1) {
      VStack(alignment: .leading, spacing: 10) {
        PageHeader(title: "What's your email?", text: "We'll send you a 6-digit code to check it's you.")
        FieldLabel("Email address").padding(.top, 14)
        InputField(placeholder: "you@example.com", text: $email, icon: "envelope", keyboard: .emailAddress, content: .emailAddress)
        HelperText("Never shown to other members.")
        Button("Already a member? Sign in") { state.onboarding = [.signIn] }
          .buttonStyle(TextButtonStyle(weight: .medium))
          .frame(maxWidth: .infinity)
          .padding(.top, 8)
      }
    } footer: {
      Button("Send my code") { state.onboarding.append(.joinCode) }.buttonStyle(.primary)
    }
  }
}

struct JoinCodeScreen: View {
  @Environment(AppState.self) private var state
  @State private var code = Demo.current == .joinCode ? "482" : ""
  @FocusState private var focused: Bool
  private let length = Rules.shared.int("signIn", "codeLength", default: 6)

  var body: some View {
    AuthPage(back: "Back", title: "Join · 2 of 3", step: 2) {
      VStack(alignment: .leading, spacing: 10) {
        PageHeader(title: "Check your email")
        (Text("We've sent a \(length)-digit code to\n") + Text("margaret.h@example.com").bold())
          .font(.figtree(17)).foregroundStyle(Palette.muted)
        FieldLabel("Your code").padding(.top, 14)
        ZStack {
          TextField("", text: $code)
            .keyboardType(.numberPad)
            .textContentType(.oneTimeCode)
            .focused($focused)
            .opacity(0.02)
            .onChange(of: code) { _, new in code = String(new.filter(\.isNumber).prefix(length)) }
            .accessibilityLabel("\(length)-digit code")
          HStack(spacing: 8) {
            ForEach(0..<length, id: \.self) { index in
              let digits = Array(code)
              let active = index == digits.count && focused
              Text(index < digits.count ? String(digits[index]) : "")
                .font(.figtree(26, .semibold))
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.card))
                .overlay(
                  RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(active ? Palette.burgundy : Palette.line, lineWidth: active ? 1.5 : 1)
                )
            }
          }
          .allowsHitTesting(false)
          .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        HelperText("It can take a minute to arrive. Check your junk folder too.")
        HStack {
          Button("Send a new code") {}
          Spacer()
          Button("Change email") { state.onboarding.removeLast() }
        }
        .buttonStyle(TextButtonStyle(weight: .medium))
      }
    } footer: {
      Button("Continue") { state.onboarding.append(.joinPassword) }.buttonStyle(.primary)
    }
    .onAppear { focused = true }
  }
}

struct JoinPasswordScreen: View {
  @Environment(AppState.self) private var state
  @State private var password = Demo.current == .joinPassword ? "travelss" : ""
  private let minimum = Rules.shared.int("signIn", "passwordMin", default: 8)

  var body: some View {
    AuthPage(back: "Back", title: "Join · 3 of 3", step: 3) {
      VStack(alignment: .leading, spacing: 10) {
        PageHeader(title: "Choose a password", text: "You'll only need it if you sign in on a new phone.")
        FieldLabel("Password").padding(.top, 14)
        InputField(placeholder: "At least \(minimum) characters", text: $password, content: .newPassword, secure: true, submit: .go)
        check("At least \(minimum) characters", password.count >= minimum)
        check("Includes a number", password.contains { $0.isNumber })
        HelperText("Once you're in, you stay signed in.")
      }
    } footer: {
      Button("Create my account") { state.onboarding.append(.signUp1) }.buttonStyle(.primary)
    }
  }

  private func check(_ text: String, _ ok: Bool) -> some View {
    Label(text, systemImage: ok ? "checkmark" : "xmark")
      .font(.figtree(15))
      .foregroundStyle(ok ? Palette.success : Palette.muted)
  }
}

// MARK: Sign in

struct SignInScreen: View {
  @Environment(AppState.self) private var state
  @State private var email = "margaret.h@example.com"
  @State private var password = ""

  var body: some View {
    AuthPage(back: "Back", title: "Sign in") {
      VStack(alignment: .leading, spacing: 10) {
        PageHeader(title: "Welcome back", text: "Sign in to see who's going your way.")
        FieldLabel("Email address").padding(.top, 12)
        InputField(placeholder: "you@example.com", text: $email, icon: "envelope", keyboard: .emailAddress, content: .username)
        FieldLabel("Password").padding(.top, 8)
        InputField(placeholder: "Your password", text: $password, content: .password, secure: true, submit: .go)
        Button("Forgotten password?") { state.onboarding.append(.forgot) }
          .buttonStyle(TextButtonStyle(weight: .medium))
        Button { state.phase = .faceIDUnlock } label: {
          HStack(spacing: 12) {
            IconBadge(systemName: "faceid", fill: Palette.blush, tint: Palette.burgundy, size: 36)
            VStack(alignment: .leading, spacing: 1) {
              Text("Sign in with Face ID").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
              Text("Next time, just look at your phone").font(.figtree(14)).foregroundStyle(Palette.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Palette.muted)
          }
          .card(padding: 12)
        }
        .buttonStyle(.plain)
        .padding(.top, 6)
        Button("New here? Join, it's free") { state.onboarding = [.joinEmail] }
          .buttonStyle(TextButtonStyle(weight: .medium))
          .frame(maxWidth: .infinity)
      }
    } footer: {
      Button("Sign in") { state.onboarding.append(.faceIDOffer) }.buttonStyle(.primary)
    }
  }
}

struct ForgotPasswordScreen: View {
  @Environment(AppState.self) private var state
  @State private var email = "margaret.h@example.com"

  var body: some View {
    AuthPage(back: "Sign in", title: "Reset password") {
      VStack(alignment: .leading, spacing: 10) {
        PageHeader(title: "Forgotten your password?", text: "No problem. Enter your email and we'll send a 6-digit code so you can choose a new one.")
        FieldLabel("Email address").padding(.top, 12)
        InputField(placeholder: "you@example.com", text: $email, icon: "envelope", keyboard: .emailAddress, content: .emailAddress, submit: .send)
        Button("Back to sign in") { state.onboarding.removeLast() }
          .buttonStyle(TextButtonStyle(weight: .medium))
          .frame(maxWidth: .infinity)
      }
    } footer: {
      Button("Send my code") { state.onboarding.append(.joinCode) }.buttonStyle(.primary)
    }
  }
}

// MARK: Face ID

struct FaceIDOfferScreen: View {
  @Environment(AppState.self) private var state

  var body: some View {
    VStack(spacing: 14) {
      HStack {
        Spacer()
        CircleIconButton(systemName: "xmark", label: "Close") { finish(false) }
      }
      Image(systemName: "faceid")
        .font(.system(size: 56, weight: .light))
        .foregroundStyle(Palette.burgundy)
        .frame(width: 118, height: 118)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Palette.card))
        .shadow(color: Palette.ink.opacity(0.08), radius: 12, y: 4)
        .padding(.top, 4)
      Text("Unlock with a glance")
        .font(.heading(30, relativeTo: .largeTitle))
        .foregroundStyle(Palette.ink)
        .padding(.top, 14)
      Text("Next time you open \(Brand.shared.shortName), just look at your phone. No password to remember.")
        .font(.figtree(17))
        .foregroundStyle(Palette.muted)
        .multilineTextAlignment(.center)
      VStack(alignment: .leading, spacing: 14) {
        Label { Text("Your face data stays on your iPhone") } icon: { IconBadge(systemName: "lock", fill: Palette.blush, tint: Palette.burgundy) }
        Label { Text("You can still use your password any time") } icon: { IconBadge(systemName: "key", fill: Palette.blush, tint: Palette.burgundy) }
      }
      .font(.figtree(17))
      .foregroundStyle(Palette.ink)
      .frame(maxWidth: .infinity, alignment: .leading)
      .card(padding: 14)
      HelperText("You can change this any time in iPhone Settings.")
      Spacer()
      Button("Use Face ID") { finish(true) }.buttonStyle(.primary)
      Button("Not now") { finish(false) }.buttonStyle(.text)
    }
    .padding(.horizontal, 16)
    .padding(.bottom, 8)
    .background(Palette.paper)
    .toolbar(.hidden, for: .navigationBar)
  }

  private func finish(_ useFaceID: Bool) {
    state.faceIDOn = useFaceID
    state.onboarding = []
    withAnimation { state.phase = .main }
  }
}

struct FaceIDUnlockScreen: View {
  @Environment(AppState.self) private var state

  var body: some View {
    ZStack {
      LinearGradient(colors: [Palette.burgundy, Color(hex: 0x6E1422)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
      VStack(spacing: 10) {
        PrimaryLogo(height: 96, color: .white, scriptColor: Palette.brightGold).padding(.top, 40)
        Text("Welcome back, \(state.memberName)").font(.heading(28)).foregroundStyle(.white).padding(.top, 8)
        Text("Unlocking with Face ID").font(.figtree(16)).foregroundStyle(.white.opacity(0.8))
        Spacer()
        Button(action: unlock) {
          VStack(spacing: 10) {
            Image(systemName: "faceid").font(.system(size: 44, weight: .light))
            Text("Face ID").font(.figtree(17, .medium))
          }
          .foregroundStyle(.white)
          .frame(width: 140, height: 140)
          .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.black.opacity(0.28)))
        }
        .accessibilityLabel("Unlock with Face ID")
        Spacer()
        Button("Use password instead") {
          state.phase = .welcome
          state.onboarding = [.signIn]
        }
        .font(.figtree(17, .medium))
        .foregroundStyle(.white)
        .frame(minHeight: 44)
        .padding(.bottom, 12)
      }
      .padding(.horizontal, 24)
    }
    .task {
      guard Demo.current == nil else { return }
      unlock()
    }
  }

  private func unlock() {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
      // No Face ID here (for example the simulator): go straight in.
      withAnimation { state.phase = .main }
      return
    }
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock \(Brand.shared.shortName)") { ok, _ in
      DispatchQueue.main.async {
        if ok { withAnimation { state.phase = .main } }
      }
    }
  }
}
