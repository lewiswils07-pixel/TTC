import SwiftUI
import UIKit

/// Pages pushed inside a tab.
enum Route: Hashable {
  case member(String)
  case chat(String)
  case trip(String)
  case goingWhenYouAre(String)
  case travelGroups
  case group(String)
  case settings
  case privacy
  case account
  case meetingSafely
  case tellSomeone
  case communityRules
  case help
  case editProfile
  case blockedMembers

  /// Name used on the next page's back button.
  var shortTitle: String {
    switch self {
    case .member(let name): name
    case .chat: "Chat"
    case .trip(let code): SampleData.trip(code)?.place ?? "Trip"
    case .goingWhenYouAre: "Going when you are"
    case .travelGroups: "Groups"
    case .group: "Group"
    case .settings: "Settings"
    case .privacy: "Privacy"
    case .account: "Account"
    case .meetingSafely: "Safety"
    case .tellSomeone: "Safety"
    case .communityRules: "Rules"
    case .help: "Help"
    case .editProfile: "Profile"
    case .blockedMembers: "Blocked"
    }
  }
}

extension AppTab {
  var backTitle: String {
    switch self {
    case .whosGoing: "Back"
    case .trips: "Trips"
    case .chat: "Chat"
    case .profile: "Profile"
    }
  }
}

/// Bottom sheets opened from anywhere.
enum SheetRoute: Identifiable {
  case addTrip(editing: String?)
  case startGroup
  case planTrip(with: String)
  case shareMeeting(with: String)
  case report(String)

  var id: String {
    switch self {
    case .addTrip(let code): "addTrip-\(code ?? "new")"
    case .startGroup: "startGroup"
    case .planTrip(let name): "plan-\(name)"
    case .shareMeeting(let name): "meet-\(name)"
    case .report(let name): "report-\(name)"
    }
  }
}

/// Full-screen pages: Sodalis+, the friendly "Allow" screens and the photo crop.
enum CoverRoute: Identifiable {
  case plus
  case allowPhotos
  case allowCamera
  case allowNotifications
  case crop(UIImage?)

  var id: String {
    switch self {
    case .plus: "plus"
    case .allowPhotos: "photos"
    case .allowCamera: "camera"
    case .allowNotifications: "notifications"
    case .crop: "crop"
    }
  }
}

extension View {
  /// Every page a tab can push.
  func withRoutes() -> some View {
    navigationDestination(for: Route.self) { route in
      RouteView(route: route)
    }
  }
}

private struct RouteView: View {
  let route: Route
  @Environment(AppState.self) private var state

  var body: some View {
    let back = state.backTitle(for: route)
    switch route {
    case .member(let name): MemberProfileScreen(name: name, back: back)
    case .chat(let name): ChatScreen(name: name, back: back)
    case .trip(let code): TripScreen(code: code, back: back)
    case .goingWhenYouAre(let code): GoingWhenYouAreScreen(code: code, back: back)
    case .travelGroups: TravelGroupsScreen(back: back)
    case .group(let id): GroupScreen(id: id, back: back)
    case .settings: SettingsScreen(back: back)
    case .privacy: PrivacyChoicesScreen(back: back)
    case .account: AccountScreen(back: back)
    case .meetingSafely: MeetingSafelyScreen(back: back)
    case .tellSomeone: TellSomeoneScreen(back: back)
    case .communityRules: CommunityRulesScreen(back: back)
    case .help: HelpScreen(back: back)
    case .editProfile: EditProfileScreen(back: back)
    case .blockedMembers: BlockedMembersScreen(back: back)
    }
  }
}
