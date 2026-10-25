import SwiftUI

/// Opens the app straight to one screen, for screenshots and for checking a
/// screen quickly in Xcode: launch with `-screen <name>` (Product › Scheme ›
/// Edit Scheme › Arguments). Names are the raw values below.
enum DemoScreen: String, CaseIterable {
  // Getting started
  case launch, welcome
  case joinEmail = "join-email", joinCode = "join-code", joinPassword = "join-password"
  case signIn = "sign-in", forgot, faceIDOffer = "faceid-offer", faceIDUnlock = "faceid-unlock"
  case signUp = "signup", signUpScrolled = "signup-scrolled", signUpDateWheel = "signup-date"
  case signUp2 = "signup2", signUp2Scrolled = "signup2-scrolled", signUp3 = "signup3", signUp3Scrolled = "signup3-scrolled"
  case youreIn = "youre-in"
  // Who's going and profile
  case whosGoing = "whos-going", whosGoingScrolled = "whos-going-scrolled", filters, filtersLarge = "filters-large"
  case readMore = "read-more", readMoreScrolled = "read-more-scrolled", whosGoingEmpty = "whos-going-empty"
  case connectBanner = "connect-banner", loading, error
  case profile, profileScrolled = "profile-scrolled", allowPhotos = "allow-photos", crop, allowCamera = "allow-camera"
  // Trips
  case trips, tripsScrolled = "trips-scrolled", addTrip = "add-trip", addTripCalendar = "add-trip-calendar"
  case tripPeople = "trip-people", tripPlan = "trip-plan", tripTips = "trip-tips"
  case goingWhen = "going-when", goingWhenScrolled = "going-when-scrolled"
  // Chat
  case chatList = "chat-list", chatGroups = "chat-groups", chatRequests = "chat-requests"
  case chat, chatMenu = "chat-menu", planTrip = "plan-trip", shareMeeting = "share-meeting", meetingTime = "meeting-time"
  case memberProfile = "member-profile"
  // Groups, Sodalis+ and settings
  case travelGroups = "travel-groups", startGroup = "start-group", group, plus, plusScrolled = "plus-scrolled"
  case settings, settingsScrolled = "settings-scrolled", privacy, account, accountScrolled = "account-scrolled"
  // Safety
  case safety, tellSomeone = "tell-someone", rules, report, help
  // Empty states and notifications
  case emptyTrips = "empty-trips", emptyChats = "empty-chats", emptyRequests = "empty-requests", emptyGroups = "empty-groups"
  case allowNotifications = "allow-notifications"

  var isScrolled: Bool { rawValue.hasSuffix("-scrolled") }
}

enum Demo {
  static let current: DemoScreen? = UserDefaults.standard.string(forKey: "screen").flatMap(DemoScreen.init(rawValue:))

  static func `is`(_ screens: DemoScreen...) -> Bool {
    guard let current else { return false }
    return screens.contains(current)
  }

  static var isScrolled: Bool { current?.isScrolled ?? false }

  /// Sets up the app's state for the chosen screen.
  static func apply(to state: AppState) {
    guard let screen = current else { return }
    state.phase = .main
    switch screen {
    case .launch: state.phase = .launch
    case .welcome: state.phase = .welcome
    case .joinEmail: onboarding(state, [.joinEmail])
    case .joinCode: onboarding(state, [.joinEmail, .joinCode])
    case .joinPassword: onboarding(state, [.joinEmail, .joinCode, .joinPassword])
    case .signIn: onboarding(state, [.signIn])
    case .forgot: onboarding(state, [.signIn, .forgot])
    case .faceIDOffer: onboarding(state, [.faceIDOffer])
    case .faceIDUnlock: state.phase = .faceIDUnlock
    case .signUp, .signUpScrolled, .signUpDateWheel: onboarding(state, [.signUp1])
    case .signUp2, .signUp2Scrolled: onboarding(state, [.signUp1, .signUp2])
    case .signUp3, .signUp3Scrolled: onboarding(state, [.signUp1, .signUp2, .signUp3])
    case .youreIn: onboarding(state, [.youreIn])

    case .whosGoing, .whosGoingScrolled, .filters, .filtersLarge, .whosGoingEmpty, .loading, .error: break
    case .connectBanner:
      state.show("Request sent to Margaret", detail: "We'll let you know when she replies.") {}
    case .readMore, .readMoreScrolled: state.open(.member("Margaret"), in: .whosGoing)
    case .profile, .profileScrolled: state.tab = .profile
    case .allowPhotos: state.tab = .profile; state.cover = .allowPhotos
    case .crop: state.tab = .profile; state.cover = .crop(nil)
    case .allowCamera: state.tab = .profile; state.cover = .allowCamera

    case .trips, .tripsScrolled: state.tab = .trips
    case .addTrip, .addTripCalendar: state.tab = .trips; state.sheet = .addTrip(editing: screen == .addTripCalendar ? "LIS" : nil)
    case .tripPeople, .tripPlan, .tripTips: state.open(.trip("LIS"), in: .trips)
    case .goingWhen, .goingWhenScrolled:
      state.tab = .trips
      state.paths[.trips] = [.trip("LIS"), .goingWhenYouAre("LIS")]

    case .chatList, .chatGroups, .chatRequests: state.tab = .chat
    case .chat, .chatMenu: state.open(.chat("David"), in: .chat)
    case .planTrip: state.open(.chat("David"), in: .chat); state.sheet = .planTrip(with: "David")
    case .shareMeeting, .meetingTime: state.open(.chat("David"), in: .chat); state.sheet = .shareMeeting(with: "David")
    case .memberProfile: state.open(.member("Sue"), in: .chat)

    case .travelGroups: state.open(.travelGroups, in: .whosGoing)
    case .startGroup: state.open(.travelGroups, in: .whosGoing); state.sheet = .startGroup
    case .group: state.tab = .whosGoing; state.paths[.whosGoing] = [.travelGroups, .group("lisbon-food")]
    case .plus, .plusScrolled: state.cover = .plus
    case .settings, .settingsScrolled: state.open(.settings, in: .profile)
    case .privacy: state.tab = .profile; state.paths[.profile] = [.settings, .privacy]
    case .account, .accountScrolled: state.tab = .profile; state.paths[.profile] = [.settings, .account]

    case .safety: state.open(.meetingSafely, in: .profile)
    case .tellSomeone: state.tab = .profile; state.paths[.profile] = [.meetingSafely, .tellSomeone]
    case .rules: state.open(.communityRules, in: .profile)
    case .report: state.open(.chat("Paul"), in: .chat); state.sheet = .report("Paul")
    case .help: state.open(.help, in: .profile)

    case .emptyTrips: state.tab = .trips
    case .emptyChats: state.tab = .chat; state.unreadChats = 0
    case .emptyRequests: state.tab = .chat
    case .emptyGroups: state.open(.travelGroups, in: .whosGoing)
    case .allowNotifications: state.cover = .allowNotifications
    }
  }

  private static func onboarding(_ state: AppState, _ path: [OnboardingRoute]) {
    state.phase = .welcome
    state.onboarding = path
  }
}

extension View {
  /// In a "-scrolled" screenshot, starts this scroll view at the bottom.
  @ViewBuilder func demoScrolled() -> some View {
    if Demo.isScrolled {
      defaultScrollAnchor(.bottom)
    } else {
      self
    }
  }
}
