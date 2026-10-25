import SwiftUI

struct ChatTab: View {
  @State private var path: [String] = []
  @State private var section = 0

  var body: some View {
    NavigationStack(path: $path) {
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          SegmentedPicker(options: [(0, "Connections"), (1, "Groups"), (2, "Requests")], selection: $section)
          GroupedList(items: [ChatRow(name: "David", last: "Done! Fado on Friday works for me.", time: "10:42")], separatorInset: 76) { row in
            NavigationLink(value: row.name) {
              HStack(spacing: 14) {
                Avatar(size: 48)
                VStack(alignment: .leading, spacing: 2) {
                  HStack {
                    Text(row.name).font(.bodySemibold).foregroundStyle(Palette.ink)
                    Spacer()
                    Text(row.time).font(.small).foregroundStyle(Palette.muted)
                  }
                  Text(row.last).font(.body17).foregroundStyle(Palette.muted).lineLimit(1)
                }
              }
              .padding(.horizontal, 14)
              .frame(minHeight: 72)
            }
            .buttonStyle(.plain)
          }
        }
        .padding(16)
      }
      .background(Palette.paper)
      .navigationTitle("Chat")
      .navigationDestination(for: String.self) { _ in ChatScreen() }
    }
    .onAppear {
      if let screen = DemoScreen.fromLaunchArguments, [.chat, .chatMenu].contains(screen), path.isEmpty {
        path = ["David"]
      }
    }
  }
}

private struct ChatRow: Identifiable {
  let name: String
  let last: String
  let time: String
  var id: String { name }
}
