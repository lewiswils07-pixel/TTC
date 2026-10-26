import SwiftUI

struct SignUpStep1: View {
  @Environment(AppState.self) private var state
  private let demo = Demo.current

  enum Field: Hashable { case name, town, about }

  @State private var firstName = ""
  @State private var birthDate: Date?
  @State private var gender: String?
  @State private var townQuery = ""
  @State private var town: String?
  @State private var about = ""
  @State private var showDatePicker = false
  @FocusState private var focus: Field?

  private let genders = ["Woman", "Man", "Non-binary", "Prefer to describe"]

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          progress.padding(.top, 12)
          intro.padding(.top, 22)
          nameField.padding(.top, 28)
          dateField.padding(.top, 24)
          genderField.padding(.top, 24)
          townField.padding(.top, 28).id("town")
          photoField.padding(.top, 28)
          aboutField.padding(.top, 28)
          Button("Already a member? Sign in") { state.onboarding = [.signIn] }
            .buttonStyle(TextButtonStyle(weight: .medium))
            .frame(maxWidth: .infinity)
            .padding(.top, 16)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 24)
      }
      .scrollDismissesKeyboard(.interactively)
      .background(Palette.paper)
      .safeAreaInset(edge: .bottom, spacing: 0) {
        StickyActionBar {
          Button("Continue") {
            focus = nil
            state.onboarding.append(.signUp2)
          }
          .buttonStyle(.primary)
        }
      }
      .onAppear {
        switch demo {
        case .signUpScrolled:
          gender = "Woman"
          townQuery = "Harro"
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { proxy.scrollTo("town", anchor: .top) }
        case .signUpDateWheel:
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { showDatePicker = true }
        case .signUp:
          gender = "Woman"
        default:
          break
        }
      }
    }
    .innerTopBar(back: "Back") {
      Text("Step 1 of 3").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
    } trailing: {
      Button("Sign in") { state.onboarding = [.signIn] }
        .buttonStyle(TextButtonStyle(weight: .regular))
        .font(.figtree(19))
    }
    .sheet(isPresented: $showDatePicker) {
      DateOfBirthSheet(date: $birthDate) { showDatePicker = false }
        .sodalisSheet(detents: [.height(440)])
    }
  }

  // MARK: Parts

  private var progress: some View {
    HStack(spacing: 6) {
      ForEach(0..<3) { step in
        Capsule()
          .fill(step == 0 ? Palette.burgundy : Palette.line)
          .frame(height: 4)
      }
    }
    .accessibilityElement()
    .accessibilityLabel("Step 1 of 3")
  }

  private var intro: some View {
    VStack(alignment: .leading, spacing: 14) {
      Label("Friendship and travel · not dating", systemImage: "heart")
        .font(.smallSemibold)
        .foregroundStyle(Palette.burgundy)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Capsule().fill(Palette.blush))
      Text("Welcome to the Collective")
        .font(.largeTitleSerif)
        .foregroundStyle(Palette.ink)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityAddTraits(.isHeader)
      Text("Meet people going where you're going, and find good company for the trip. Let's start with the basics.")
        .font(.figtree(18))
        .foregroundStyle(Palette.muted)
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  private func label(_ text: String) -> some View {
    Text(text).font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
  }

  private func helper(_ text: String) -> some View {
    Text(text).font(.figtree(15, relativeTo: .footnote)).foregroundStyle(Palette.muted)
  }

  private var nameField: some View {
    VStack(alignment: .leading, spacing: 10) {
      label("First name")
      FieldBox(focused: focus == .name) {
        TextField("Your first name", text: $firstName)
          .textContentType(.givenName)
          .textInputAutocapitalization(.words)
          .submitLabel(.next)
          .focused($focus, equals: .name)
          .onSubmit { showDatePicker = true }
      }
      helper("This is the name members will see.")
    }
  }

  private var dateField: some View {
    VStack(alignment: .leading, spacing: 10) {
      label("Date of birth")
      Button {
        focus = nil
        showDatePicker = true
      } label: {
        FieldBox {
          HStack {
            if let birthDate {
              Text(birthDate.formatted(date: .long, time: .omitted)).foregroundStyle(Palette.ink)
            } else {
              Text("Choose your date of birth").foregroundStyle(Palette.muted.opacity(0.8))
            }
            Spacer()
            Image(systemName: "calendar").foregroundStyle(Palette.burgundy)
          }
        }
      }
      .buttonStyle(.plain)
      .accessibilityLabel(birthDate.map { "Date of birth, \($0.formatted(date: .long, time: .omitted))" } ?? "Choose your date of birth")
      helper("Members only ever see your age.")
    }
  }

  private var genderField: some View {
    VStack(alignment: .leading, spacing: 12) {
      label("Gender")
      ChipPicker(options: genders, selection: $gender)
      (Text("Used for who you see. Change it any time in ") + Text("Filters").foregroundColor(Palette.burgundy).bold() + Text("."))
        .font(.figtree(15, relativeTo: .footnote))
        .foregroundStyle(Palette.muted)
    }
  }

  private var townMatches: [(String, String)] {
    let q = townQuery.trimmingCharacters(in: .whitespaces)
    guard q.count >= 2, town == nil else { return [] }
    return SampleData.towns.filter { $0.0.lowercased().hasPrefix(q.lowercased()) }
  }

  private var townField: some View {
    VStack(alignment: .leading, spacing: 10) {
      label("Home town")
      FieldBox(focused: focus == .town) {
        HStack(spacing: 10) {
          Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
          TextField("Search for your town", text: $townQuery)
            .textContentType(.addressCity)
            .submitLabel(.search)
            .autocorrectionDisabled()
            .focused($focus, equals: .town)
            .onChange(of: townQuery) { _, new in if new != town { town = nil } }
        }
      }
      if !townMatches.isEmpty {
        GroupedList(items: townMatches.map { TownRow(name: $0.0, area: $0.1) }, separatorInset: 16) { row in
          Button {
            town = row.name
            townQuery = row.name
            focus = nil
          } label: {
            HStack(spacing: 14) {
              PinIcon(size: 19).foregroundStyle(Palette.softInk)
              highlighted(row.name, row.area)
              Spacer()
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
        }
      }
    }
  }

  private func highlighted(_ name: String, _ area: String) -> Text {
    let n = min(townQuery.count, name.count)
    let head = String(name.prefix(n))
    let tail = String(name.dropFirst(n))
    return (Text(head).font(.figtree(18, .semibold)) + Text(tail + ", " + area).font(.figtree(18)))
      .foregroundColor(Palette.ink)
  }

  private var photoField: some View {
    VStack(alignment: .leading, spacing: 10) {
      label("Add a photo")
      HStack(spacing: 18) {
        Button {} label: {
          VStack(spacing: 4) {
            Image(systemName: "camera").font(.system(size: 20, weight: .medium))
            Text("Add").font(.figtree(17, .semibold))
          }
          .foregroundStyle(Palette.burgundy)
          .frame(width: 68, height: 84)
          .background(Ellipse().strokeBorder(Palette.muted.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a photo")
        VStack(alignment: .leading, spacing: 4) {
          Text("For a great first impression:").font(.figtree(17, .semibold)).foregroundStyle(Palette.ink)
          Text("Just you · face clearly visible · recent · good light").font(.body17).foregroundStyle(Palette.muted)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .card(padding: 14)
    }
  }

  private var aboutField: some View {
    let limit = Rules.shared.bioMax
    return VStack(alignment: .leading, spacing: 10) {
      label("A few words about you (optional)")
      ZStack(alignment: .topLeading) {
        if about.isEmpty {
          Text("What makes a good travel day for you?")
            .font(.body17)
            .foregroundStyle(Palette.muted.opacity(0.8))
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .allowsHitTesting(false)
        }
        TextEditor(text: $about)
          .font(.body17)
          .foregroundStyle(Palette.ink)
          .scrollContentBackground(.hidden)
          .focused($focus, equals: .about)
          .padding(.horizontal, 11)
          .padding(.vertical, 8)
          .onChange(of: about) { _, new in if new.count > limit { about = String(new.prefix(limit)) } }
          .accessibilityLabel("A few words about you")
      }
      .frame(minHeight: 110)
      .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
      .overlay(
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .strokeBorder(focus == .about ? Palette.burgundy : Palette.line, lineWidth: focus == .about ? 1.5 : 1)
      )
      Text("\(about.count) / \(limit)")
        .font(.figtree(15, relativeTo: .footnote))
        .foregroundStyle(Palette.muted)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
  }
}

private struct TownRow: Identifiable {
  let name: String
  let area: String
  var id: String { name + area }
}

/// Wheel picker for date of birth, in a short bottom sheet.
struct DateOfBirthSheet: View {
  @Binding var date: Date?
  let close: () -> Void
  @State private var picked: Date

  private let range: ClosedRange<Date>

  init(date: Binding<Date?>, close: @escaping () -> Void) {
    _date = date
    self.close = close
    let calendar = Calendar.current
    let now = Date()
    let latest = calendar.date(byAdding: .year, value: -Rules.shared.minAge, to: now) ?? now
    let earliest = calendar.date(byAdding: .year, value: -110, to: now) ?? now
    range = earliest...latest
    let start = calendar.date(from: DateComponents(year: 1966, month: 6, day: 14)) ?? latest
    _picked = State(initialValue: date.wrappedValue ?? min(start, latest))
  }

  var body: some View {
    VStack(spacing: 0) {
      SheetHeader(title: "Date of birth") {
        Button("Cancel", action: close).buttonStyle(TextButtonStyle(weight: .regular)).font(.figtree(19))
      } trailing: {
        Button("Done") {
          date = picked
          close()
        }
        .buttonStyle(.text)
        .font(.figtree(19, .semibold))
      }
      .padding(.top, 18)
      DatePicker("Date of birth", selection: $picked, in: range, displayedComponents: .date)
        .datePickerStyle(.wheel)
        .labelsHidden()
        .environment(\.locale, Locale(identifier: "en_GB"))
        .padding(.horizontal, 16)
      Text("Members only ever see your age.")
        .font(.figtree(15, relativeTo: .footnote))
        .foregroundStyle(Palette.muted)
        .padding(.top, 8)
      Spacer(minLength: 0)
    }
    .background(Palette.paper)
  }
}
