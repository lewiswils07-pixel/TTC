import SwiftUI

// Sample content for the first look, matching the designs. The next step
// swaps these for the live Supabase data the web app already uses.

struct Trip: Identifiable, Hashable {
  var id: String { code }
  let code: String
  let place: String
  let country: String
  let short: String
  let dates: String
  let fullDates: String
  let flexibility: String
  let whenAway: String
  let going: Int
  let goingInitials: [String]
  let isPrivate: Bool
  let tones: [UInt32]
}

struct Member: Identifiable, Hashable {
  var id: String { name }
  let name: String
  let age: Int
  let town: String
  let county: String
  let tones: [UInt32]
  var tripDates = ""
  var hereFor = "a travel friend and small-group trips"
  var lotsInCommon = false
  var nearYou = false
  var budget = "Mid-range"
  var planning = "A loose plan"
  var pace = "Slow and steady"
  var daysOut = "Love them"
  var groupSize = "2–4 people"
  var twinRoom = "Own room"
  var answers: [(String, String)] = []
  var wishlist: [(String, Bool)] = []

  static func == (a: Member, b: Member) -> Bool { a.name == b.name }
  func hash(into h: inout Hasher) { h.combine(name) }

  var pronoun: String { ["David", "Graham", "Colin", "Paul", "Rob"].contains(name) ? "he" : "she" }
  var possessive: String { pronoun == "he" ? "his" : "her" }
}

struct MemberCard: Identifiable {
  var id: String { member.name }
  let member: Member
  let reason: String
  let overlap: String
  let interests: String
  let places: String
  let travelStyle: String
}

struct ChatMessage: Identifiable {
  enum Kind {
    case incoming(String)
    case outgoing(String)
    case planNote(code: String, who: String, board: String, item: String)
  }

  let id = UUID()
  let kind: Kind
}

struct Conversation: Identifiable {
  var id: String { name }
  let name: String
  let tag: String
  let last: String
  let time: String
  let unread: Bool
  let tones: [UInt32]
}

struct ConnectionRequest: Identifiable {
  var id: String { member.name }
  let member: Member
  let heading: String
  let detail: String
  let message: String
}

struct TravelGroup: Identifiable {
  let id: String
  let code: String
  let name: String
  let detail: String
  let tags: [String]
  let tone: UInt32
}

struct PlanIdea: Identifiable {
  var id: String { title }
  let title: String
  let detail: String
  let people: [String]
  let joined: Bool
}

struct Tip: Identifiable {
  var id: String { title }
  let category: String
  let title: String
  let text: String
  let by: String
}

enum SampleData {
  static let me = Member(name: "Margaret", age: 58, town: "Harrogate", county: "North Yorkshire", tones: [0xE8CBA9, 0xC9996C])

  static let trips = [
    Trip(code: "LIS", place: "Lisbon", country: "Portugal", short: "May", dates: "12–19 May", fullDates: "12–19 May 2027", flexibility: "1 week either way", whenAway: "In 7 months", going: 9, goingInitials: ["M", "D", "P"], isPrivate: false, tones: [0xF2B48C, 0xB4523E]),
    Trip(code: "EDI", place: "Edinburgh", country: "Scotland", short: "Aug", dates: "8–12 Aug", fullDates: "8–12 August 2027", flexibility: "exact dates", whenAway: "In 10 months", going: 14, goingInitials: ["J", "R", "A"], isPrivate: false, tones: [0xA9B5C4, 0x56637A]),
    Trip(code: "ROM", place: "Rome", country: "Italy", short: "Sep", dates: "20–27 Sep", fullDates: "20–27 September 2027", flexibility: "exact dates", whenAway: "In 11 months", going: 0, goingInitials: [], isPrivate: true, tones: [0xE9C98E, 0x9C7440]),
  ]

  static func trip(_ code: String) -> Trip? { trips.first { $0.code == code } }

  static let members: [Member] = [
    Member(
      name: "Margaret", age: 58, town: "Harrogate", county: "North Yorkshire", tones: [0xE8CBA9, 0xC9996C], tripDates: "10–18 May",
      lotsInCommon: true, nearYou: true,
      answers: [("My ideal travel day…", "An early walk, a long lunch somewhere local, and a nap I won't apologise for."), ("Ask me about…", "Thirty years of teaching geography, and my first trip to Rome.")],
      wishlist: [("Madeira", true), ("Puglia", false), ("Norwegian fjords", false)]
    ),
    Member(name: "David", age: 63, town: "Bath", county: "Somerset", tones: [0xE7B8B2, 0xC98B86], tripDates: "15–22 May", lotsInCommon: true),
    Member(name: "Priya", age: 47, town: "Leeds", county: "West Yorkshire", tones: [0xC9D3B8, 0x8FA27E], tripDates: "17–24 May"),
    Member(
      name: "Sue", age: 61, town: "Norwich", county: "Norfolk", tones: [0xC9CEE3, 0x8E95B8], tripDates: "11–16 May",
      hereFor: "travel friends and day trips", lotsInCommon: true,
      budget: "Comfort", planning: "Spontaneous", pace: "Balanced", groupSize: "Small group, 3–4", twinRoom: "Maybe, once we've met",
      answers: [("My ideal travel day…", "A long coastal walk, fish and chips somewhere with a view, and an early night."), ("Ask me about…", "The time I took the night train to Inverness with a bicycle.")],
      wishlist: [("Puglia", true), ("Croatian coast", false), ("Seville", false), ("Lake District", false)]
    ),
    Member(name: "Ann", age: 66, town: "Ripon", county: "North Yorkshire", tones: [0xF0D9A0, 0xC9A55E], tripDates: "13–18 May"),
    Member(name: "Graham", age: 59, town: "York", county: "North Yorkshire", tones: [0xCFDCC2, 0x93A88A]),
    Member(name: "Jean", age: 64, town: "Durham", county: "County Durham", tones: [0xD5DCC0, 0x9BA884]),
    Member(name: "Colin", age: 58, town: "Durham", county: "County Durham", tones: [0xD9C3B0, 0xA7876E], tripDates: "13–17 May"),
    Member(name: "Paul", age: 55, town: "Leeds", county: "West Yorkshire", tones: [0xD6C2B0, 0x9E8470]),
  ]

  static func member(_ name: String) -> Member {
    members.first { $0.name == name } ?? me
  }

  static let cards = [
    MemberCard(
      member: member("Margaret"), reason: "Also going to Lisbon in May", overlap: "Your dates overlap 12–18 May",
      interests: "food markets, fado nights, coastal walks", places: "you both loved Porto and want to see Madeira",
      travelStyle: "slow pace, mid-range, a loose plan"
    ),
    MemberCard(
      member: member("Sue"), reason: "Also going to Lisbon in May", overlap: "Your dates overlap 12–16 May",
      interests: "galleries, coastal walks, wine tasting", places: "you both want to see Puglia",
      travelStyle: "balanced pace, comfort, spontaneous"
    ),
  ]

  static let chatWith = (name: "David", age: 63, home: "Bath", trip: "Lisbon", dates: "15–22 May")

  static let messages: [ChatMessage] = [
    ChatMessage(kind: .incoming("Hello Margaret! Lovely to see someone else in Lisbon that week.")),
    ChatMessage(kind: .outgoing("Hello David! It's my first time. Have you been before?")),
    ChatMessage(kind: .incoming("Twice. There's a fado night in Alfama on the Friday. Fancy it?")),
    ChatMessage(kind: .outgoing("I'd love that. Shall we put it on the plan board?")),
    ChatMessage(kind: .planNote(code: "LIS", who: "David", board: "Lisbon", item: "Fado night in Alfama · Fri 14 May")),
    ChatMessage(kind: .incoming("Done! Fado on Friday works for me.")),
  ]

  static let conversations = [
    Conversation(name: "David", tag: "Lisbon", last: "Fado on Friday works for me!", time: "10:42", unread: true, tones: [0xE7B8B2, 0xC98B86]),
    Conversation(name: "Margaret", tag: "Lisbon", last: "Lovely to meet you. I see you like markets too!", time: "Yesterday", unread: false, tones: [0xE8CBA9, 0xC9996C]),
    Conversation(name: "Sue", tag: "Lisbon", last: "You: Thanks for the Sintra tip", time: "Mon", unread: false, tones: [0xC9CEE3, 0x8E95B8]),
    Conversation(name: "Jean", tag: "Edinburgh", last: "Have you been to the Festival before?", time: "3 Oct", unread: false, tones: [0xD5DCC0, 0x9BA884]),
  ]

  static let groupChats = [
    ("Lisbon slow-food walkers", "Priya: I have booked a table for six", "9:15"),
    ("Edinburgh Festival friends", "Rob: Fringe tickets go on sale in June", "Tue"),
  ]

  static let requests = [
    ConnectionRequest(member: member("Ann"), heading: "Also going to Lisbon in May", detail: "Ripon · 4 miles away", message: "Hello! We are both in Lisbon that week. Would you fancy the tile museum one morning?"),
    ConnectionRequest(member: member("Graham"), heading: "Also going to Edinburgh in August", detail: "York", message: "Hi Margaret, first Festival for me too. Happy to compare shows!"),
  ]

  static let groups = [
    TravelGroup(id: "lisbon-food", code: "LIS", name: "Lisbon slow-food walkers", detail: "13–17 May · 6 members · you organise", tags: [], tone: 0x6C1320),
    TravelGroup(id: "lisbon-days", code: "LIS", name: "Lisbon day trips", detail: "12–18 May · 4 of 6 places", tags: ["Ages 55–70", "Twin rooms OK"], tone: 0x6C1320),
    TravelGroup(id: "algarve", code: "FAO", name: "Women walking the Algarve", detail: "20–24 May · 5 of 8 places", tags: ["Women only", "Ages 50–75"], tone: 0x8A6A12),
    TravelGroup(id: "rome", code: "ROM", name: "Rome for first-timers", detail: "21–26 Sep · 3 of 6 places", tags: ["Ages 45–65"], tone: 0x5A1424),
    TravelGroup(id: "edinburgh", code: "EDI", name: "Edinburgh Festival friends", detail: "Jean invited you · 8–12 Aug · 11 members", tags: [], tone: 0x3E4A5E),
  ]

  static func group(_ id: String) -> TravelGroup { groups.first { $0.id == id } ?? groups[0] }

  static let planIdeas = [
    PlanIdea(title: "Fado night in Alfama", detail: "Fri 14 May · added by David", people: ["Y", "D", "S"], joined: true),
    PlanIdea(title: "Day out to Sintra by train", detail: "Sat 15 May · added by Sue", people: ["S", "M"], joined: false),
    PlanIdea(title: "Custard tarts at Manteigaria", detail: "Any day · added by Margaret", people: ["M", "Y", "D", "P"], joined: true),
    PlanIdea(title: "Sunset at a miradouro", detail: "Any day · added by Priya", people: ["P"], joined: false),
  ]

  static let tipCategories = ["All", "Food", "Drink", "Museums", "Sights", "Walks", "Getting around"]

  static let tips = [
    Tip(category: "Food", title: "Taberna da Rua das Flores", text: "Tiny, and no bookings. Arrive at 6pm and order from the chalkboard.", by: "Sue · Norwich"),
    Tip(category: "Drink", title: "Park rooftop bar", text: "On top of a car park, and better than it sounds. Go for sunset.", by: "Priya · Leeds"),
    Tip(category: "Museums", title: "Gulbenkian Museum", text: "Calm and world-class, with lovely gardens for a sit down.", by: "Margaret · Harrogate"),
    Tip(category: "Walks", title: "Alfama, early morning", text: "Go before the tour groups, in proper shoes: the cobbles are slippery.", by: "Sue · Norwich"),
    Tip(category: "Getting around", title: "Tram 28", text: "Board at Martim Moniz to get a seat, and keep bags zipped.", by: "David · Bath"),
  ]

  static let interests = [
    "Food markets", "Coastal walks", "Wine tasting", "Galleries", "Live music", "Gardens", "History", "Photography",
    "Hiking", "Theatre", "Beaches", "Architecture", "Cooking classes", "Wildlife",
  ]

  static let places = [
    ("Lisbon", "Portugal · 9 members going in May", [UInt32(0xF2B48C), 0xB4523E]),
    ("Lisbon Coast (Cascais)", "Portugal", [UInt32(0xB9D2B4), 0x6E9A72]),
    ("Lisieux", "Normandy, France", [UInt32(0xEBC48E), 0xB98A4E]),
    ("Edinburgh", "Scotland", [UInt32(0xA9B5C4), 0x56637A]),
    ("Rome", "Italy", [UInt32(0xE9C98E), 0x9C7440]),
    ("Seville", "Spain", [UInt32(0xF0C08A), 0xC0703E]),
  ]

  static let towns = [
    ("Harrogate", "North Yorkshire"), ("Harrow", "Greater London"), ("Hartlepool", "County Durham"),
    ("Bath", "Somerset"), ("York", "North Yorkshire"), ("Edinburgh", "City of Edinburgh"),
  ]
}

extension Array where Element == UInt32 {
  var colors: [Color] { map { Color(hex: $0) } }
}
