import SwiftUI

// Sample content for the first look. The next step swaps these for the live
// Supabase data the web app already uses.

struct Trip: Identifiable, Hashable {
  let id = UUID()
  let place: String
  let dates: String
  let tones: [UInt32]
}

struct MemberCard: Identifiable {
  let id = UUID()
  let name: String
  let age: Int
  let town: String
  let reason: String
  let overlap: String
  let interests: String
  let places: String
  let travelStyle: String
  let lotsInCommon: Bool
  let nearYou: Bool
  let photoTones: [UInt32]
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

enum SampleData {
  static let trips = [
    Trip(place: "Lisbon", dates: "12–19 May", tones: [0xE9A07A, 0x8E4A3A]),
    Trip(place: "Edinburgh", dates: "8–12 Aug", tones: [0xA9B5C4, 0x4D5868]),
  ]

  static let members = [
    MemberCard(
      name: "Margaret", age: 58, town: "Harrogate",
      reason: "Also going to Lisbon in May", overlap: "Your dates overlap 12–18 May",
      interests: "food markets, fado nights, coastal walks",
      places: "you both loved Porto and want to see Madeira",
      travelStyle: "slow pace, mid-range, a loose plan",
      lotsInCommon: true, nearYou: true, photoTones: [0xE8CBA9, 0xC9996C]
    ),
    MemberCard(
      name: "Helen", age: 64, town: "York",
      reason: "Also going to Lisbon in May", overlap: "Your dates overlap 14–19 May",
      interests: "galleries, coastal walks, wine",
      places: "you both want to see the Douro Valley",
      travelStyle: "balanced pace, comfort, some plans",
      lotsInCommon: false, nearYou: true, photoTones: [0xD9C2D6, 0x9C7EA0]
    ),
  ]

  static let travelGroups = [
    ("Lisbon in spring", "38 members"),
    ("Walking the Highlands", "112 members"),
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

  static let towns = [
    ("Harrogate", "North Yorkshire"), ("Harrow", "Greater London"), ("Hartlepool", "County Durham"),
    ("Bath", "Somerset"), ("York", "North Yorkshire"), ("Edinburgh", "City of Edinburgh"),
  ]
}

extension Array where Element == UInt32 {
  var colors: [Color] { map { Color(hex: $0) } }
}
