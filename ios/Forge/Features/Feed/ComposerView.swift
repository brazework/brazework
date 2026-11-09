import SwiftUI

struct ComposerView: View {
  var onPosted: () -> Void
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @Environment(Session.self) private var session
  @State private var text = ""
  @State private var kind = "update"
  @State private var posting = false
  @State private var error: String?
  @FocusState private var focused: Bool

  private let kinds = [("update", "Update"), ("question", "Question"), ("result", "Result")]
  private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 14) {
        HStack(spacing: 8) {
          ForEach(kinds, id: \.0) { k in
            Button { kind = k.0 } label: { Chip(text: k.1, selected: kind == k.0) }.buttonStyle(.plain)
          }
        }
        HStack(alignment: .top, spacing: 10) {
          Avatar(first: session.profile?.firstName ?? "", last: session.profile?.lastName ?? "", path: session.profile?.avatarPath, size: 36)
          TextField(placeholder, text: $text, axis: .vertical)
            .font(.body)
            .lineLimit(4...14)
            .focused($focused)
        }
        if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
        Spacer()
        HStack {
          Text("Photos and video: post them from the web for now.").font(.caption).foregroundStyle(p.faint)
          Spacer()
          Text("\(3000 - text.count)").font(.caption.monospacedDigit()).foregroundStyle(text.count > 3000 ? p.danger : p.faint)
        }
      }
      .padding(16)
      .background(p.bg)
      .navigationTitle("New post")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button { Task { await post() } } label: { if posting { ProgressView() } else { Text("Post").bold() } }
            .disabled(trimmed.isEmpty || text.count > 3000 || posting)
        }
      }
      .onAppear { focused = true }
    }
  }

  private var placeholder: String {
    switch kind {
    case "question": "What are you stuck on?"
    case "result": "What did you get working?"
    default: "What are you building?"
    }
  }

  private func post() async {
    posting = true; error = nil
    defer { posting = false }
    do {
      try await API.createPost(body: trimmed, kind: kind)
      onPosted(); dismiss()
    } catch { self.error = friendly(error) }
  }
}
