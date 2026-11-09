import AVFoundation
import AVKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

// What you've picked for a post, before it's uploaded: up to 4 photos, or 1 video (the database's rule).
enum Picked: Identifiable {
  case photo(id: UUID, image: UIImage)
  case video(id: UUID, url: URL)
  var id: UUID { switch self { case .photo(let id, _), .video(let id, _): id } }
  var isVideo: Bool { if case .video = self { true } else { false } }
}

// A video from the photo library, copied somewhere we can read it.
struct PickedMovie: Transferable {
  let url: URL
  static var transferRepresentation: some TransferRepresentation {
    FileRepresentation(contentType: .movie) { SentTransferredFile($0.url) } importing: { received in
      let copy = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).\(received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension)")
      try FileManager.default.copyItem(at: received.file, to: copy)
      return Self(url: copy)
    }
  }
}

enum MediaPrep {
  // Photos: at most 2000 px on the long side, re-encoded as JPEG. Re-drawing drops the original's
  // metadata (including where it was taken), like the web's WebP conversion.
  static func photo(_ image: UIImage) -> (data: Data, w: Double, h: Double)? {
    let scale = min(1, 2000 / max(image.size.width, image.size.height))
    let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
    let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
    let out = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    guard let data = out.jpegData(compressionQuality: 0.85) else { return nil }
    return (data, size.width, size.height)
  }

  // Video: exported as H.264 MP4 at up to 1080p, so it plays in every browser (iPhone's HEVC .mov doesn't).
  static func video(_ url: URL) async throws -> (data: Data, w: Double, h: Double) {
    let asset = AVURLAsset(url: url)
    var w = 0.0, h = 0.0
    if let track = try await asset.loadTracks(withMediaType: .video).first {
      let (size, t) = try await track.load(.naturalSize, .preferredTransform)
      let r = size.applying(t)
      w = abs(r.width); h = abs(r.height)
    }
    let out = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1920x1080) else { throw MediaError.unreadable }
    try await session.export(to: out, as: .mp4)
    let data = try Data(contentsOf: out)
    try? FileManager.default.removeItem(at: out)
    guard data.count <= API.maxUploadBytes else { throw MediaError.tooBig }
    return (data, w, h)
  }
}

// The picked media in the composer: photos as tiles, a video you can play before posting.
struct PickedStrip: View {
  @Binding var items: [Picked]
  @Environment(\.palette) private var p

  var body: some View {
    if let video = items.first(where: \.isVideo), case .video(_, let url) = video {
      ZStack(alignment: .topTrailing) {
        VideoPlayer(player: AVPlayer(url: url))
          .aspectRatio(16 / 9, contentMode: .fit)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          .accessibilityLabel("Preview your video")
        remove(video.id)
      }
    } else if !items.isEmpty {
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(items) { item in
            if case .photo(_, let image) = item {
              ZStack(alignment: .topTrailing) {
                Image(uiImage: image).resizable().scaledToFill().frame(width: 120, height: 120).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                remove(item.id)
              }
            }
          }
        }
      }
    }
  }

  private func remove(_ id: UUID) -> some View {
    Button { withAnimation(.snappy) { items.removeAll { $0.id == id } } } label: {
      Image(systemName: "xmark").font(.caption.weight(.bold)).foregroundStyle(.white).frame(width: 28, height: 28).background(.black.opacity(0.6), in: Circle())
    }
    .padding(6)
    .accessibilityLabel("Remove")
  }
}
