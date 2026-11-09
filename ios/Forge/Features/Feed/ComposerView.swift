import PhotosUI
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
  @State private var picked: [Picked] = []
  @State private var selection: [PhotosPickerItem] = []
  @State private var status = ""
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
        PickedStrip(items: $picked)
        if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
        if !status.isEmpty { Label(status, systemImage: "arrow.up.circle").font(.footnote).foregroundStyle(p.muted) }
        Spacer()
        HStack {
          PhotosPicker(selection: $selection, maxSelectionCount: 4, matching: .any(of: [.images, .videos]), photoLibrary: .shared()) {
            Image(systemName: "photo.on.rectangle.angled").font(.title3).foregroundStyle(p.text2).frame(width: 44, height: 44)
          }
          .accessibilityLabel("Add photos or a video")
          .disabled(posting)
          Text(picked.contains(where: \.isVideo) ? "1 video" : picked.isEmpty ? "Up to 4 photos or 1 video" : "\(picked.count) of 4 photos").font(.caption).foregroundStyle(p.faint)
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
      .onChange(of: selection) { Task { await load(selection) } }
      #if DEBUG
      .task {
        // For screenshots: FORGE_TEST_ATTACH=/path/to/photo.jpg preloads a photo.
        if let path = ProcessInfo.processInfo.environment["FORGE_TEST_ATTACH"], let img = UIImage(contentsOfFile: path) { picked = [.photo(id: UUID(), image: img)] }
      }
      #endif
    }
  }

  private var placeholder: String {
    switch kind {
    case "question": "What are you stuck on?"
    case "result": "What did you get working?"
    default: "What are you building?"
    }
  }

  // Photos and videos from the library. A video goes alone (one per post), as on the web.
  private func load(_ items: [PhotosPickerItem]) async {
    guard !items.isEmpty else { return }
    error = nil
    var out: [Picked] = []
    for item in items {
      if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
        if let movie = try? await item.loadTransferable(type: PickedMovie.self) { out = [.video(id: UUID(), url: movie.url)]; break }
      } else if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) {
        out.append(.photo(id: UUID(), image: img))
      }
    }
    if out.isEmpty { error = "Couldn't open that. Try another photo or video." }
    if items.count > 1 && out.contains(where: \.isVideo) { error = "A post can have one video, or up to 4 photos." }
    picked = out
    selection = []
  }

  private func post() async {
    guard let me = session.userId else { return }
    posting = true; error = nil
    defer { posting = false; status = "" }
    var uploaded: [MediaItem] = []
    do {
      for (i, item) in picked.enumerated() {
        status = picked.count > 1 ? "Uploading \(i + 1) of \(picked.count)…" : item.isVideo ? "Preparing your video…" : "Uploading…"
        switch item {
        case .photo(_, let image):
          guard let jpg = MediaPrep.photo(image) else { throw MediaError.unreadable }
          let path = try await API.upload(jpg.data, contentType: "image/jpeg", ext: "jpg", me: me)
          uploaded.append(MediaItem(type: "image", path: path, w: jpg.w, h: jpg.h))
        case .video(_, let url):
          let mp4 = try await MediaPrep.video(url)
          status = "Uploading video…"
          let path = try await API.upload(mp4.data, contentType: "video/mp4", ext: "mp4", me: me)
          uploaded.append(MediaItem(type: "video", path: path, w: mp4.w > 0 ? mp4.w : nil, h: mp4.h > 0 ? mp4.h : nil))
        }
      }
      status = ""
      try await API.createPost(body: trimmed, kind: kind, media: uploaded)
      onPosted(); dismiss()
    } catch {
      // Tidy up files that won't be used.
      for m in uploaded { await API.removeUpload(m.path) }
      self.error = friendly(error)
    }
  }
}
