import SwiftUI

/// Layout shared by the form sheets: Cancel, a title, an optional action on
/// the right, scrolling content and a sticky main button.
struct FormSheet<Trailing: View, Content: View>: View {
  let title: String
  let button: String
  var buttonIcon: String? = nil
  var buttonDisabled = false
  let action: () -> Void
  @ViewBuilder var trailing: Trailing
  @ViewBuilder var content: Content
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: 0) {
      SheetHeader(title: title) {
        Button("Cancel") { dismiss() }.buttonStyle(TextButtonStyle(weight: .regular))
      } trailing: {
        trailing
      }
      .padding(.top, 8)
      Rectangle().fill(Palette.line).frame(height: 0.5)
      ScrollView {
        VStack(alignment: .leading, spacing: 0) { content }
          .padding(.horizontal, 16)
          .padding(.top, 16)
          .padding(.bottom, 24)
      }
      .demoScrolled()
      .scrollDismissesKeyboard(.interactively)
    }
    .background(Palette.paper)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      StickyActionBar {
        Button(action: action) {
          if let buttonIcon { Label(button, systemImage: buttonIcon) } else { Text(button) }
        }
        .buttonStyle(.primary)
        .disabled(buttonDisabled)
        .opacity(buttonDisabled ? 0.5 : 1)
      }
    }
  }
}

extension FormSheet where Trailing == EmptyView {
  init(title: String, button: String, buttonIcon: String? = nil, buttonDisabled: Bool = false, action: @escaping () -> Void, @ViewBuilder content: () -> Content) {
    self.title = title
    self.button = button
    self.buttonIcon = buttonIcon
    self.buttonDisabled = buttonDisabled
    self.action = action
    self.trailing = EmptyView()
    self.content = content()
  }
}

/// A row with a title and a blush value pill, e.g. "Date   Fri 14 May".
struct PillRow: View {
  let title: String
  let value: String
  var action: () -> Void = {}

  var body: some View {
    Button(action: action) {
      HStack {
        Text(title).font(.figtree(17)).foregroundStyle(Palette.ink)
        Spacer()
        ValuePill(text: value)
      }
      .padding(.horizontal, 14)
      .frame(minHeight: 52)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}

/// Round tick used by single-choice lists.
struct RadioMark: View {
  let isOn: Bool

  var body: some View {
    ZStack {
      Circle().strokeBorder(isOn ? Palette.burgundy : Palette.line, lineWidth: 1.5)
      if isOn {
        Circle().fill(Palette.burgundy)
        Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
      }
    }
    .frame(width: 24, height: 24)
    .accessibilityHidden(true)
  }
}

/// A multi-line text box with a character count.
struct NoteBox: View {
  let placeholder: String
  @Binding var text: String
  var limit: Int? = nil
  var minLines = 3

  var body: some View {
    VStack(alignment: .trailing, spacing: 6) {
      FieldBox(minHeight: 52) {
        TextField(placeholder, text: $text, axis: .vertical)
          .lineLimit(minLines...8)
          .padding(.vertical, 14)
          .onChange(of: text) { _, new in
            if let limit, new.count > limit { text = String(new.prefix(limit)) }
          }
      }
      if let limit {
        Text("\(text.count) / \(limit)").font(.figtree(14)).foregroundStyle(Palette.muted)
      }
    }
  }
}

/// A date pill that opens a calendar sheet when tapped.
struct DateSheet: View {
  let title: String
  @Binding var date: Date
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: 0) {
      SheetHeader(title: title) {
        Button("Cancel") { dismiss() }.buttonStyle(TextButtonStyle(weight: .regular))
      } trailing: {
        Button("Done") { dismiss() }.buttonStyle(.text)
      }
      .padding(.top, 8)
      DatePicker(title, selection: $date, displayedComponents: .date)
        .datePickerStyle(.graphical)
        .tint(Palette.burgundy)
        .labelsHidden()
        .padding(.horizontal, 16)
      Spacer(minLength: 0)
    }
    .background(Palette.paper)
    .sodalisSheet(detents: [.height(470)])
  }
}

/// Hour and minute wheels in five-minute steps.
struct TimeWheelSheet: View {
  @Binding var hour: Int
  @Binding var minute: Int
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: 0) {
      SheetHeader(title: "Time") {
        Button("Cancel") { dismiss() }.buttonStyle(TextButtonStyle(weight: .regular))
      } trailing: {
        Button("Done") { dismiss() }.buttonStyle(.text)
      }
      .padding(.top, 8)
      HStack(spacing: 0) {
        Picker("Hour", selection: $hour) {
          ForEach(0..<24, id: \.self) { Text("\($0)").font(.figtree(21)).tag($0) }
        }
        Picker("Minute", selection: $minute) {
          ForEach(Array(stride(from: 0, to: 60, by: 5)), id: \.self) { Text(String(format: "%02d", $0)).font(.figtree(21)).tag($0) }
        }
      }
      .pickerStyle(.wheel)
      .padding(.horizontal, 40)
      Spacer(minLength: 0)
    }
    .background(Palette.paper)
    .sodalisSheet(detents: [.height(330)])
  }
}

extension Date {
  /// "Fri 14 May"
  var dayMonth: String { formatted(Date.FormatStyle(locale: Locale(identifier: "en_GB")).weekday(.abbreviated).day().month(.abbreviated)).replacingOccurrences(of: ",", with: "") }
  /// "4 Oct 2027"
  var dayMonthYear: String { formatted(Date.FormatStyle(locale: Locale(identifier: "en_GB")).day().month(.abbreviated).year()) }

  static func on(_ day: Int, _ month: Int, _ year: Int = 2027) -> Date {
    Calendar.current.date(from: DateComponents(year: year, month: month, day: day)) ?? .now
  }
}

// MARK: Plan a trip together

struct PlanTripSheet: View {
  let name: String
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss
  @State private var choice = "new"
  @State private var search = ""
  @State private var from = Date.on(4, 10)
  @State private var to = Date.on(9, 10)
  @State private var note = ""
  @State private var editing: String?

  private var member: Member { SampleData.member(name) }

  var body: some View {
    FormSheet(title: "New plan", button: "Send invite") {
      dismiss()
      state.show("Invite sent to \(name)", detail: "You'll both see the plan in your trips.")
    } content: {
      Text("Plan a trip together").font(.heading(32, relativeTo: .largeTitle)).foregroundStyle(Palette.ink)
      HStack(spacing: 10) {
        Avatar(size: 32, tones: member.tones.colors)
        (Text("With ") + Text(member.name).bold() + Text(", \(member.age), from \(member.town)"))
          .font(.figtree(17)).foregroundStyle(Palette.softInk)
      }
      .padding(.top, 10)

      FieldLabel("Choose a trip").padding(.top, 22)
      RowsCard {
        ForEach(Array(SampleData.trips.prefix(2).enumerated()), id: \.offset) { index, trip in
          if index > 0 { RowDivider(inset: 70) }
          tripRow(id: trip.code, title: trip.place, subtitle: "Your trip · \(trip.dates)") { PlaceThumb(tones: trip.tones.colors) }
        }
        RowDivider(inset: 70)
        tripRow(id: "new", title: "Somewhere new", subtitle: "Pick a place together") {
          IconBadge(systemName: "globe", size: 44)
        }
      }
      .padding(.top, 8)

      if choice == "new" {
        FieldLabel("Destination").padding(.top, 22)
        InputField(placeholder: "Search places", text: $search, icon: "magnifyingglass", submit: .search).padding(.top, 8)
        FieldLabel("Dates").padding(.top, 22)
        RowsCard {
          PillRow(title: "From", value: from.dayMonthYear) { editing = "From" }
          RowDivider()
          PillRow(title: "To", value: to.dayMonthYear) { editing = "To" }
        }
        .padding(.top, 8)
      }

      FieldLabel("A note for \(name) (optional)").padding(.top, 22)
      NoteBox(placeholder: "e.g. Fancy a few days walking?", text: $note, limit: Rules.shared.int("connections", "noteMax", default: 280)).padding(.top, 8)
    }
    .sheet(item: Binding(get: { editing.map { IdentifiedString(value: $0) } }, set: { editing = $0?.value })) { item in
      DateSheet(title: item.value, date: item.value == "From" ? $from : $to)
    }
  }

  private func tripRow<Icon: View>(id: String, title: String, subtitle: String, @ViewBuilder icon: () -> Icon) -> some View {
    Button { withAnimation { choice = id } } label: {
      HStack(spacing: 12) {
        icon()
        VStack(alignment: .leading, spacing: 2) {
          Text(title).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text(subtitle).font(.figtree(14)).foregroundStyle(Palette.muted)
        }
        Spacer()
        RadioMark(isOn: choice == id)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(choice == id ? .isSelected : [])
  }
}

struct IdentifiedString: Identifiable {
  let value: String
  var id: String { value }
}

// MARK: Share where you're meeting

struct ShareMeetingSheet: View {
  let name: String
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss
  @State private var place = "Café A Brasileira, Chiado"
  @State private var date = Date.on(14, 5)
  @State private var hour = 11
  @State private var minute = 0
  @State private var extra = ""
  @State private var tellAnne = true
  @State private var showDate = false
  @State private var showTime = Demo.is(.meetingTime)

  var body: some View {
    FormSheet(title: "Meeting \(name)", button: "Share the details") {
      dismiss()
      state.show("Details shared", detail: tellAnne ? "Anne will get them by email." : "Saved in your chat with \(name).")
    } content: {
      Text("Share where you're meeting").font(.heading(32, relativeTo: .largeTitle)).foregroundStyle(Palette.ink)
      Text("Keep the details in one place for you and \(name), and let someone you trust see them too.")
        .font(.figtree(17)).foregroundStyle(Palette.muted).padding(.top, 10)

      FieldLabel("Where").padding(.top, 22)
      InputField(placeholder: "A café, museum or market", text: $place, icon: "mappin").padding(.top, 8)
      HelperText("A busy café or public place is best for a first meet.").padding(.top, 8)

      FieldLabel("When").padding(.top, 22)
      RowsCard {
        PillRow(title: "Date", value: date.dayMonth) { showDate = true }
        RowDivider()
        PillRow(title: "Time", value: String(format: "%d:%02d", hour, minute)) { showTime = true }
      }
      .padding(.top, 8)

      FieldLabel("Anything else (optional)").padding(.top, 22)
      InputField(placeholder: "e.g. I'll be wearing a blue scarf", text: $extra).padding(.top, 8)

      FieldLabel("Someone you trust (optional)").padding(.top, 22)
      RowsCard {
        Toggle(isOn: $tellAnne) {
          HStack(spacing: 12) {
            Avatar(size: 36, tones: [Color(hex: 0xF0D9A0), Color(hex: 0xC9A55E)])
            VStack(alignment: .leading, spacing: 2) {
              Text("Anne (sister)").font(.figtree(17)).foregroundStyle(Palette.ink)
              Text("Gets the details by email").font(.figtree(14)).foregroundStyle(Palette.muted)
            }
          }
        }
        .tint(Palette.burgundy)
        .padding(.horizontal, 14)
        .frame(minHeight: 60)
      }
      .padding(.top, 8)
    }
    .sheet(isPresented: $showDate) { DateSheet(title: "Date", date: $date) }
    .sheet(isPresented: $showTime) { TimeWheelSheet(hour: $hour, minute: $minute) }
  }
}

// MARK: Report someone

struct ReportSheet: View {
  let name: String
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss
  @State private var reason: String? = Demo.is(.report) ? "Asking for money" : nil
  @State private var details = ""
  @State private var who = ""

  private var isKnown: Bool { SampleData.members.contains { $0.name == name } }
  private let reasons = ["Making me uncomfortable", "Romantic or flirty messages", "Asking for money", "Fake profile or photos", "Rude or abusive", "Seems to be under 18", "Something else"]
  private var member: Member { SampleData.member(name) }

  var body: some View {
    FormSheet(title: "Report someone", button: "Send report", buttonDisabled: reason == nil) {
      dismiss()
      state.show("Report sent", detail: "Thank you. We'll look at it within a day.")
    } content: {
      Text("Thank you for telling us. It helps keep everyone safe.")
        .font(.figtree(15)).foregroundStyle(Palette.muted)
      if isKnown {
        HStack(spacing: 12) {
          Avatar(size: 40, tones: member.tones.colors)
          VStack(alignment: .leading, spacing: 2) {
            Text("Reporting \(member.name), \(member.age)").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
            Text(member.town).font(.figtree(14)).foregroundStyle(Palette.muted)
          }
          Spacer()
        }
        .card(padding: 12)
        .padding(.top, 12)
      } else {
        FieldLabel("Who are you reporting?").padding(.top, 16)
        InputField(placeholder: "Their first name and home town", text: $who).padding(.top, 8)
      }

      SectionCaption("What's happened?").padding(.top, 12)
      RowsCard {
        ForEach(Array(reasons.enumerated()), id: \.offset) { index, item in
          if index > 0 { RowDivider(inset: 50) }
          Button { reason = item } label: {
            HStack(spacing: 14) {
              RadioMark(isOn: reason == item)
              Text(item).font(.figtree(17)).foregroundStyle(Palette.ink)
              Spacer()
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(reason == item ? .isSelected : [])
        }
      }
      .padding(.top, 8)

      FieldLabel("Anything else we should know? (optional)").padding(.top, 20)
      NoteBox(placeholder: "What happened, and when", text: $details, limit: Rules.shared.int("safety", "reportDetailsMax", default: 1000)).padding(.top, 8)
      HelperText(isKnown ? "\(name) won't know you reported \(member.pronoun == "he" ? "him" : "her"). If you're in danger, call 999." : "They won't know you reported them. If you're in danger, call 999.").padding(.top, 8)
    }
  }
}
