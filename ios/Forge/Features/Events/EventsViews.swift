import MapKit
import SwiftUI

struct EventsList: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var events: [ForgeEvent]?
  @State private var going: Set<String> = []
  @State private var opened: ForgeEvent?

  var body: some View {
    ScrollView {
      LazyVStack(spacing: 12) {
        if events == nil { ProgressView().padding(.top, 60) }
        if events?.isEmpty == true { EmptyState(icon: "calendar", title: "No upcoming events", message: "Club build nights, talks and career fairs show up here.") }
        ForEach(events ?? []) { e in
          NavigationLink(value: e) { EventRow(event: e, going: going.contains(e.id)) }.buttonStyle(.plain)
        }
      }
      .padding(16)
    }
    .refreshable { await load() }
    .task { await load() }
    .navigationDestination(item: $opened) { EventDetailView(event: $0) }
  }

  private func load() async {
    events = (try? await API.upcomingEvents()) ?? []
    #if DEBUG
    if ProcessInfo.processInfo.environment["FORGE_TEST_EVENT"] == "first", opened == nil { opened = events?.first }
    #endif
    if let me = session.userId { going = await API.goingTo(me: me) }
  }
}

struct DateTile: View {
  let date: Date
  var size: CGFloat = 52
  @Environment(\.palette) private var p
  var body: some View {
    VStack(spacing: 0) {
      Text(date.formatted(.dateTime.month(.abbreviated)).uppercased()).font(.system(size: size * 0.2, weight: .bold)).foregroundStyle(p.onAccent).frame(maxWidth: .infinity).padding(.vertical, 2).background(p.accent)
      Text(date.formatted(.dateTime.day())).font(.system(size: size * 0.4, weight: .bold, design: .rounded)).foregroundStyle(p.text).frame(maxHeight: .infinity)
    }
    .frame(width: size, height: size)
    .background(p.surface2)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityHidden(true)
  }
}

private struct EventRow: View {
  let event: ForgeEvent
  let going: Bool
  @Environment(\.palette) private var p
  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      DateTile(date: event.startsAt)
      VStack(alignment: .leading, spacing: 4) {
        Text(event.title).font(.body.weight(.semibold)).foregroundStyle(p.text).multilineTextAlignment(.leading)
        Text(event.startsAt.formatted(.dateTime.weekday(.wide).hour().minute())).font(.subheadline).foregroundStyle(p.text2)
        Text([event.host, event.format == "Online" ? "Online" : event.location].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(p.muted).lineLimit(1)
        if going { Label("Going", systemImage: "checkmark.circle.fill").font(.caption.weight(.semibold)).foregroundStyle(Color(hex: 0x10B981)) }
      }
      Spacer(minLength: 0)
    }
    .padding(14)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }
}

struct EventDetailView: View {
  let event: ForgeEvent
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @State private var going = false
  @State private var count: Int
  @State private var place: MKMapItem?
  @State private var error: String?

  init(event: ForgeEvent) { self.event = event; _count = State(initialValue: event.rsvpCount) }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        HStack(alignment: .top, spacing: 14) {
          DateTile(date: event.startsAt, size: 60)
          VStack(alignment: .leading, spacing: 4) {
            Text(event.title).font(.title2.weight(.bold)).foregroundStyle(p.text)
            if !event.host.isEmpty { Text("Hosted by \(event.host)").font(.subheadline).foregroundStyle(p.muted) }
          }
        }
        VStack(alignment: .leading, spacing: 8) {
          Label(event.startsAt.formatted(.dateTime.weekday(.wide).month().day().hour().minute()) + " – " + event.endsAt.formatted(.dateTime.hour().minute()), systemImage: "clock")
          Label(event.format == "Online" ? "Online" : event.location, systemImage: event.format == "Online" ? "video" : "mappin.and.ellipse")
          Label("\(event.type) · \(count) going", systemImage: "person.2")
        }
        .font(.subheadline).foregroundStyle(p.text2)

        Button { Task { await toggle() } } label: { Label(going ? "You're going" : "I'm going", systemImage: going ? "checkmark.circle.fill" : "plus.circle") }
          .buttonStyle(PrimaryButtonStyle())
          .sensoryFeedback(.success, trigger: going)
        if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }

        if event.inPerson {
          map
        }
        if event.format != "In person", let url = URL(string: event.link), !event.link.isEmpty {
          Button { openURL(url) } label: { Label("Join online", systemImage: "video.fill").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.bordered)
        }
        if !event.description.isEmpty {
          Text("About").font(.headline).foregroundStyle(p.text)
          Text(event.description).font(.body).foregroundStyle(p.text2)
        }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar { ToolbarItem(placement: .primaryAction) { ShareLink(item: Env.web("events/\(event.id)")) } }
    .task {
      if let me = session.userId { going = await API.goingTo(me: me).contains(event.id) }
      if event.inPerson { place = await Self.find(event.location) }
    }
  }

  @ViewBuilder private var map: some View {
    VStack(spacing: 10) {
      if let place {
        Map(initialPosition: .region(MKCoordinateRegion(center: place.location.coordinate, latitudinalMeters: 1200, longitudinalMeters: 1200))) {
          Marker(event.title, systemImage: "flame.fill", coordinate: place.location.coordinate).tint(p.accent)
        }
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .allowsHitTesting(false)
        .accessibilityLabel("Map of \(event.location)")
        Button { place.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault]) } label: {
          Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill").frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.bordered)
      } else {
        RoundedRectangle(cornerRadius: 20, style: .continuous).fill(p.surface2).frame(height: 220).overlay(ProgressView())
      }
    }
  }

  // The event's place, from its address text.
  private static func find(_ query: String) async -> MKMapItem? {
    let req = MKLocalSearch.Request()
    req.naturalLanguageQuery = query
    return try? await MKLocalSearch(request: req).start().mapItems.first
  }

  private func toggle() async {
    guard let me = session.userId else { return }
    let on = !going
    going = on; count += on ? 1 : -1; error = nil
    do { try await API.setGoing(event.id, on, me: me) } catch { going = !on; count += on ? -1 : 1; self.error = friendly(error) }
  }
}
