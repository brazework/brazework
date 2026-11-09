import AVFoundation
import AVKit
import Observation
import SwiftUI

// Videos play as you scroll (like the web feed): the one most in view plays, with sound unless
// you've turned it off; the rest pause. Tap to pause and play; speed and fullscreen appear when
// you've paused it. Sound follows the ringer switch (the .ambient audio session), as iPhone
// users expect from a feed.
@MainActor @Observable
final class VideoCoordinator {
  static let shared = VideoCoordinator()
  private(set) var active: String?
  // Set while something covers the feed (the composer): nothing plays.
  var suspended = false
  private var visible: [String] = []
  var soundOn: Bool = UserDefaults.standard.object(forKey: "forge-video-sound") as? Bool ?? true {
    didSet { UserDefaults.standard.set(soundOn, forKey: "forge-video-sound") }
  }

  init() { try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .moviePlayback) }

  func appeared(_ id: String) { visible.removeAll { $0 == id }; visible.append(id); active = id }
  func disappeared(_ id: String) {
    visible.removeAll { $0 == id }
    if active == id { active = visible.last }
  }
  func claim(_ id: String) { active = id }
}

// AVPlayerLayer in SwiftUI, filling its frame.
private struct PlayerLayerView: UIViewRepresentable {
  let player: AVPlayer
  var gravity: AVLayerVideoGravity = .resizeAspect
  final class Host: UIView {
    override static var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
  }
  func makeUIView(context: Context) -> Host { let v = Host(); v.playerLayer.player = player; v.playerLayer.videoGravity = gravity; return v }
  func updateUIView(_ v: Host, context: Context) { v.playerLayer.player = player; v.playerLayer.videoGravity = gravity }
}

@MainActor @Observable
private final class LoopingPlayer {
  let player = AVQueuePlayer()
  private var looper: AVPlayerLooper?
  private var timeObserver: Any?
  var progress: Double = 0
  var ready = false

  init(url: URL) {
    let item = AVPlayerItem(url: url)
    looper = AVPlayerLooper(player: player, templateItem: item)
    player.preventsDisplaySleepDuringVideoPlayback = false
    timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 10), queue: .main) { [weak self] t in
      MainActor.assumeIsolated {
        guard let self, let d = self.player.currentItem?.duration.seconds, d.isFinite, d > 0 else { return }
        self.progress = t.seconds / d
        self.ready = true
      }
    }
  }

  func seek(to fraction: Double) {
    guard let d = player.currentItem?.duration.seconds, d.isFinite else { return }
    player.seek(to: CMTime(seconds: d * fraction, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
  }
}

struct FeedVideo: View {
  let item: MediaItem
  let playerId: String
  @State private var model: LoopingPlayer?
  @State private var held = false
  @State private var rate: Float = 1
  @State private var fullscreen = false
  @State private var coordinator = VideoCoordinator.shared
  @Environment(\.palette) private var p
  @Environment(\.scenePhase) private var phase

  private var url: URL? { mediaURL(item.path) }
  // Portrait videos are capped so one never takes more than most of the screen.
  private var aspect: Double { min(max(item.aspect ?? 16 / 9, 0.6), 2) }

  var body: some View {
    ZStack(alignment: .bottom) {
      Color.black
      if let model { PlayerLayerView(player: model.player) }
      if model?.ready != true { ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity) }
      if held {
        Image(systemName: "play.fill").font(.system(size: 26)).foregroundStyle(.white)
          .frame(width: 64, height: 64).glassEffect(.regular, in: Circle())
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .allowsHitTesting(false)
      }
      controls
    }
    .aspectRatio(aspect, contentMode: .fit)
    .frame(maxHeight: 560)
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    .contentShape(Rectangle())
    .onTapGesture { held.toggle(); if !held { coordinator.claim(playerId) }; sync() }
    .onScrollVisibilityChange(threshold: 0.6) { visible in
      if visible { if model == nil, let url { model = LoopingPlayer(url: url) }; coordinator.appeared(playerId) } else { coordinator.disappeared(playerId) }
      sync()
    }
    .onChange(of: coordinator.active) { sync() }
    .onChange(of: coordinator.suspended) { sync() }
    .onAppear { sync() }
    .onChange(of: coordinator.soundOn) { sync() }
    .onChange(of: phase) { sync() }
    .onDisappear { model?.player.pause() }
    .fullScreenCover(isPresented: $fullscreen, onDismiss: sync) {
      if let model { FullscreenVideo(player: model.player) }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(item.alt ?? "Video")
    .accessibilityHint(held ? "Double tap to play" : "Double tap to pause")
  }

  private var controls: some View {
    VStack(spacing: 8) {
      HStack(spacing: 8) {
        if held {
          Menu {
            ForEach([0.5, 1, 1.5, 2] as [Float], id: \.self) { r in Button("\(r.formatted())×") { rate = r } }
          } label: { pill("\(rate.formatted())×") }
          Button { held = true; fullscreen = true; model?.player.pause() } label: { pill(nil, icon: "arrow.up.left.and.arrow.down.right") }
            .accessibilityLabel("Full screen")
        }
        Spacer()
        Button { coordinator.soundOn.toggle() } label: { pill(nil, icon: coordinator.soundOn ? "speaker.wave.2.fill" : "speaker.slash.fill") }
          .accessibilityLabel(coordinator.soundOn ? "Mute" : "Turn sound on")
      }
      // Only the scrubber: thin, draggable.
      GeometryReader { g in
        ZStack(alignment: .leading) {
          Capsule().fill(.white.opacity(0.25))
          Capsule().fill(.white).frame(width: g.size.width * (model?.progress ?? 0))
        }
        .frame(height: 3)
        .frame(maxHeight: .infinity)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 0).onChanged { v in model?.seek(to: min(max(v.location.x / g.size.width, 0), 1)) })
      }
      .frame(height: 16)
      .accessibilityHidden(true)
    }
    .padding(.horizontal, 12).padding(.bottom, 6)
  }

  private func pill(_ text: String?, icon: String? = nil) -> some View {
    Group {
      if let icon { Image(systemName: icon).font(.footnote.weight(.semibold)) } else { Text(text ?? "").font(.footnote.weight(.semibold).monospacedDigit()) }
    }
    .foregroundStyle(.white)
    .frame(minWidth: 34, minHeight: 34)
    .padding(.horizontal, text == nil ? 0 : 6)
    .glassEffect(.regular.interactive(), in: Capsule())
  }

  private func sync() {
    guard let model else { return }
    model.player.isMuted = !coordinator.soundOn
    let shouldPlay = !held && !fullscreen && !coordinator.suspended && coordinator.active == playerId && phase == .active
    if shouldPlay { model.player.playImmediately(atRate: rate) } else { model.player.pause() }
  }
}

private struct FullscreenVideo: UIViewControllerRepresentable {
  let player: AVPlayer
  func makeUIViewController(context: Context) -> AVPlayerViewController {
    let vc = AVPlayerViewController(); vc.player = player; player.isMuted = false; player.play(); return vc
  }
  func updateUIViewController(_ vc: AVPlayerViewController, context: Context) {}
}
