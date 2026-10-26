import SwiftUI

// Reads app/brand.json and app/rules.json, the same files the web app uses,
// so names, colours and club rules have one source of truth.
struct Brand {
  static let shared = Brand()

  let name: String
  let shortName: String
  let plusName: String
  let colors: BrandColors

  private init() {
    let json = Bundle.main.jsonObject(named: "brand") ?? [:]
    name = json["name"] as? String ?? "Sodalis Collective"
    shortName = json["shortName"] as? String ?? "Sodalis"
    plusName = json["plusName"] as? String ?? "Sodalis+"
    let light = (json["colors"] as? [String: Any])?["light"] as? [String: String] ?? [:]
    colors = BrandColors(values: light)
  }
}

struct BrandColors {
  let values: [String: String]

  func color(_ key: String, fallback: UInt32) -> Color {
    values[key].flatMap(Color.init(hexString:)) ?? Color(hex: fallback)
  }
}

struct Rules {
  static let shared = Rules()

  private let json: [String: Any]

  private init() {
    json = Bundle.main.jsonObject(named: "rules") ?? [:]
  }

  func int(_ section: String, _ key: String, default value: Int) -> Int {
    (json[section] as? [String: Any])?[key] as? Int ?? value
  }

  var minAge: Int { int("age", "min", default: 18) }
  var maxAge: Int { int("age", "maxPreferred", default: 99) }
  var bioMax: Int { int("profile", "bioMax", default: 500) }
  var nameMax: Int { int("profile", "nameMax", default: 40) }
}

extension Bundle {
  func jsonObject(named name: String) -> [String: Any]? {
    guard let url = url(forResource: name, withExtension: "json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  }
}
