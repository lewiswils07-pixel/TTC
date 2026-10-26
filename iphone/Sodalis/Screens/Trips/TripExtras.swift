import SwiftUI

// MARK: Going when you are (Sodalis+)

struct GoingWhenYouAreScreen: View {
  let code: String
  let back: String
  @Environment(AppState.self) private var state
  @State private var tripCode: String
  @State private var sent: Set<String> = []

  init(code: String, back: String) {
    self.code = code
    self.back = back
    _tripCode = State(initialValue: code)
  }

  private struct Overlap: Identifiable {
    let name: String
    let there: String
    let together: ClosedRange<Int>
    var id: String { name }
  }

  /// Days of the Lisbon trip, 12–19 May 2027 (12 May is a Wednesday).
  private let days = Array(12...19)
  private let letters = ["W", "T", "F", "S", "S", "M", "T", "W"]

  private var overlaps: [Overlap] {
    tripCode == "EDI"
      ? [Overlap(name: "Jean", there: "8–12 Aug", together: 12...19), Overlap(name: "Graham", there: "9–14 Aug", together: 13...19)]
      : [
        Overlap(name: "Margaret", there: "10–18 May", together: 12...18),
        Overlap(name: "Sue", there: "11–16 May", together: 12...16),
        Overlap(name: "Colin", there: "13–17 May", together: 13...17),
        Overlap(name: "David", there: "15–22 May", together: 15...19),
      ]
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        PlusBadge()
        PageHeader(title: "Going when you are", text: "Members going to the same place as you, at the same time.")
          .padding(.top, 10)
        SegmentedPicker(options: [("LIS", "Lisbon · 12–19 May"), ("EDI", "Edinburgh · Aug")], selection: $tripCode)
          .padding(.top, 18)
        HStack {
          Text("\(overlaps.count) members overlap").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Spacer()
          legend(Palette.blush, "Together")
          legend(Palette.tint, "Apart")
        }
        .padding(.top, 18)

        VStack(spacing: 12) {
          ForEach(overlaps) { overlap in card(overlap) }
        }
        .padding(.top, 10)
      }
      .padding(.horizontal, 16)
      .padding(.top, 16)
      .padding(.bottom, 120)
    }
    .demoScrolled()
    .scrollIndicators(.hidden)
    .background(Palette.paper)
    .innerTopBar(back: back) { EmptyView() } trailing: { EmptyView() }
  }

  private func legend(_ color: Color, _ text: String) -> some View {
    HStack(spacing: 5) {
      RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 12, height: 12)
        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Palette.line, lineWidth: 0.5))
      Text(text).font(.figtree(14)).foregroundStyle(Palette.muted)
    }
    .padding(.leading, 8)
  }

  private func card(_ overlap: Overlap) -> some View {
    let member = SampleData.member(overlap.name)
    let count = overlap.together.count
    let isSent = sent.contains(overlap.name)
    return VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 12) {
        Avatar(size: 48, tones: member.tones.colors)
        VStack(alignment: .leading, spacing: 2) {
          Text("\(member.name), \(member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text("\(member.town) · there \(overlap.there)").font(.figtree(14)).foregroundStyle(Palette.muted)
        }
        Spacer(minLength: 8)
        Button(isSent ? "Sent" : "Connect") {
          UIImpactFeedbackGenerator(style: .light).impactOccurred()
          sent.insert(overlap.name)
          state.show("Request sent to \(member.name)", detail: "We'll let you know when \(member.pronoun) replies.") { sent.remove(overlap.name) }
        }
        .buttonStyle(SmallButtonStyle(kind: isSent ? .secondary : .primary))
        .disabled(isSent)
      }
      Text("Together \(overlap.together.lowerBound)–\(overlap.together.upperBound) \(tripCode == "EDI" ? "Aug" : "May") · \(count) days")
        .font(.figtree(15, .semibold))
        .foregroundStyle(Palette.burgundy)
      HStack(spacing: 5) {
        ForEach(Array(days.enumerated()), id: \.offset) { index, day in
          let on = overlap.together.contains(day)
          VStack(spacing: 2) {
            Text(letters[index]).font(.figtree(14, .medium))
            Text("\(day)").font(.figtree(16, .semibold))
          }
          .foregroundStyle(on ? Palette.burgundy : Palette.muted.opacity(0.8))
          .frame(maxWidth: .infinity, minHeight: 50)
          .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(on ? Palette.blush : Palette.tint.opacity(0.5)))
        }
      }
      .accessibilityElement()
      .accessibilityLabel("Together for \(count) days")
    }
    .card(padding: 14)
  }
}

// MARK: Add or edit a trip

struct AddTripSheet: View {
  let editing: String?
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss

  @State private var search = ""
  @State private var place: (name: String, country: String, tones: [UInt32])?
  @State private var start: Date?
  @State private var end: Date?
  @State private var flexible = true
  @State private var visible = true
  @State private var note = ""
  @State private var month = Date.on(1, 5)
  @FocusState private var searching: Bool

  init(editing: String?) {
    self.editing = editing
    if let code = editing, let trip = SampleData.trip(code) {
      _place = State(initialValue: (name: trip.place, country: trip.country, tones: trip.tones))
      _start = State(initialValue: .on(12, 5))
      _end = State(initialValue: .on(19, 5))
    } else if Demo.is(.addTrip) {
      _search = State(initialValue: "Lis")
    }
  }

  private var noteMax: Int { Rules.shared.int("trips", "noteMax", default: 280) }
  private var results: [(String, String, [UInt32])] {
    let q = search.trimmingCharacters(in: .whitespaces).lowercased()
    guard !q.isEmpty else { return [] }
    return SampleData.places.filter { $0.0.lowercased().hasPrefix(q) || $0.0.lowercased().contains(q) }
  }

  var body: some View {
    VStack(spacing: 0) {
      SheetHeader(title: editing == nil ? "Add a trip" : "Edit trip") {
        Button("Cancel") { dismiss() }.buttonStyle(TextButtonStyle(weight: .regular))
      } trailing: {
        if place != nil { Button("Save") { save() }.buttonStyle(.text) }
      }
      .padding(.top, 8)
      Rectangle().fill(Palette.line).frame(height: 0.5)
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          FieldLabel("Where are you going?")
          if let place {
            FieldBox {
              HStack(spacing: 12) {
                PlaceTile(code: String(place.name.prefix(3)).uppercased(), size: 34)
                Text("\(place.name), \(place.country)").font(.figtree(17)).foregroundStyle(Palette.ink)
                Spacer()
                Button { self.place = nil; search = "" } label: {
                  Image(systemName: "xmark").foregroundStyle(Palette.muted).frame(width: 44, height: 44)
                }
                .accessibilityLabel("Change place")
              }
            }
            .padding(.top, 8)
            dates
          } else {
            FieldBox(focused: true) {
              HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
                TextField("Search towns, cities and regions", text: $search)
                  .focused($searching)
                  .submitLabel(.search)
                if !search.isEmpty {
                  Button { search = "" } label: { Image(systemName: "xmark").foregroundStyle(Palette.muted).frame(width: 44, height: 44) }
                    .accessibilityLabel("Clear")
                }
              }
            }
            .padding(.top, 8)
            if !results.isEmpty {
              RowsCard {
                ForEach(Array(results.enumerated()), id: \.offset) { index, result in
                  if index > 0 { RowDivider(inset: 62) }
                  Button {
                    let parts = result.1.components(separatedBy: " · ")
                    withAnimation { place = (name: result.0.components(separatedBy: " (").first ?? result.0, country: parts[0], tones: result.2) }
                  } label: {
                    HStack(spacing: 12) {
                      PlaceThumb(tones: result.2.colors, size: 36)
                      VStack(alignment: .leading, spacing: 1) {
                        highlighted(result.0)
                        Text(result.1).font(.figtree(14)).foregroundStyle(Palette.muted)
                      }
                      Spacer()
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                  }
                  .buttonStyle(.plain)
                }
              }
              .padding(.top, 10)
            }
          }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 24)
      }
      .scrollDismissesKeyboard(.interactively)
    }
    .background(Palette.paper)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      if place != nil {
        StickyActionBar { Button("Save trip") { save() }.buttonStyle(.primary) }
      }
    }
    .onAppear { if place == nil, Demo.current == nil || Demo.is(.addTrip) { searching = true } }
  }

  private func highlighted(_ name: String) -> Text {
    let q = search.trimmingCharacters(in: .whitespaces)
    guard !q.isEmpty, name.lowercased().hasPrefix(q.lowercased()) else {
      return Text(name).font(.figtree(17)).foregroundColor(Palette.ink)
    }
    return Text(String(name.prefix(q.count))).font(.figtree(17, .semibold)).foregroundColor(Palette.ink)
      + Text(String(name.dropFirst(q.count))).font(.figtree(17)).foregroundColor(Palette.ink)
  }

  @ViewBuilder private var dates: some View {
    FieldLabel("Dates").padding(.top, 22)
    RowsCard {
      PillRow(title: "From", value: start?.dayMonthYear ?? "Choose")
      RowDivider()
      PillRow(title: "To", value: end?.dayMonthYear ?? "Choose")
    }
    .padding(.top, 8)

    CalendarRangePicker(month: $month, start: $start, end: $end)
      .card(padding: 14)
      .padding(.top, 12)

    RowsCard {
      ToggleRow(title: "1 week either way", subtitle: "Also meet members going up to a week before or after", isOn: $flexible)
      RowDivider()
      ToggleRow(title: "Let other members see this trip", subtitle: "So people going at the same time can say hello", isOn: $visible)
    }
    .padding(.top, 16)

    FieldLabel("A note for other members (optional)").padding(.top, 22)
    NoteBox(placeholder: "Anything you'd like to do there?", text: $note, limit: noteMax).padding(.top, 8)

    if editing != nil {
      Button("Delete this trip", role: .destructive) {
        dismiss()
        state.show("Trip deleted") {}
      }
      .font(.figtree(17, .semibold))
      .foregroundStyle(Palette.error)
      .frame(maxWidth: .infinity, minHeight: 44)
      .padding(.top, 14)
    }
  }

  private func save() {
    dismiss()
    state.show(editing == nil ? "Trip added" : "Trip saved", detail: "We'll show you who's going.")
  }
}

/// Month calendar for picking a date range: Monday first, burgundy ends and a blush range.
struct CalendarRangePicker: View {
  @Binding var month: Date
  @Binding var start: Date?
  @Binding var end: Date?

  private var calendar: Calendar {
    var c = Calendar(identifier: .gregorian)
    c.firstWeekday = 2
    return c
  }

  private var days: [Date?] {
    guard let range = calendar.range(of: .day, in: .month, for: month),
          let first = calendar.date(from: calendar.dateComponents([.year, .month], from: month)) else { return [] }
    let weekday = calendar.component(.weekday, from: first)
    let lead = (weekday + 5) % 7
    return Array(repeating: nil, count: lead) + range.map { calendar.date(byAdding: .day, value: $0 - 1, to: first) }
  }

  var body: some View {
    VStack(spacing: 10) {
      HStack {
        HStack(spacing: 4) {
          Text(month.formatted(.dateTime.month(.wide).year())).font(.figtree(17, .semibold))
          Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.burgundy)
        }
        .foregroundStyle(Palette.ink)
        Spacer()
        Button { shift(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
          .accessibilityLabel("Previous month")
        Button { shift(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
          .accessibilityLabel("Next month")
      }
      .font(.system(size: 19, weight: .medium))
      .foregroundStyle(Palette.burgundy)

      let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
      HStack(spacing: 0) {
        ForEach(Array(["M", "T", "W", "T", "F", "S", "S"].enumerated()), id: \.offset) { _, letter in
          Text(letter).font(.figtree(14, .medium)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
        }
      }
      .accessibilityHidden(true)
      LazyVGrid(columns: columns, spacing: 6) {
        ForEach(Array(days.enumerated()), id: \.offset) { _, day in
          if let day { dayCell(day) } else { Color.clear.frame(height: 40) }
        }
      }
    }
  }

  private func dayCell(_ day: Date) -> some View {
    let isEnd = [start, end].contains { $0.map { calendar.isDate($0, inSameDayAs: day) } ?? false }
    let inRange = start.flatMap { s in end.map { e in day > s && day < e } } ?? false
    return Button { pick(day) } label: {
      Text("\(calendar.component(.day, from: day))")
        .font(.figtree(18, isEnd || inRange ? .semibold : .regular))
        .foregroundStyle(isEnd ? .white : inRange ? Palette.burgundy : Palette.ink)
        .frame(width: 40, height: 40)
        .background(Circle().fill(isEnd ? Palette.burgundy : inRange ? Palette.blush : .clear))
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(day.formatted(date: .complete, time: .omitted))
    .accessibilityAddTraits(isEnd ? .isSelected : [])
  }

  private func pick(_ day: Date) {
    if let s = start, end == nil, day > s {
      end = day
    } else {
      start = day
      end = nil
    }
  }

  private func shift(_ months: Int) {
    withAnimation { month = calendar.date(byAdding: .month, value: months, to: month) ?? month }
  }
}
