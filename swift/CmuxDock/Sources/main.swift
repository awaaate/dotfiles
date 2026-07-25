import AppKit

// MARK: - State

/// Mirrors the JSON written by tools/cmux-dock-hook.sh. The hook owns the
/// schema; this must stay in sync with it.
struct AgentState: Codable {
	struct Workspace: Codable {
		var name: String
		var status: Status
	}

	enum Status: String, Codable {
		case idle, working, attention, error
	}

	var workspaces: [Workspace] = []

	var needsAttention: Int {
		workspaces.filter { $0.status == .attention || $0.status == .error }.count
	}

	var working: Int { workspaces.filter { $0.status == .working }.count }

	/// Aggregate state: worst wins.
	var worst: Status {
		if workspaces.contains(where: { $0.status == .error }) { return .error }
		if workspaces.contains(where: { $0.status == .attention }) { return .attention }
		if workspaces.contains(where: { $0.status == .working }) { return .working }
		return .idle
	}
}

// MARK: - Watcher

/// Watches the DIRECTORY, not the file.
///
/// The hook writes atomically (temp + rename). A rename swaps the inode, so a
/// descriptor opened on the original file keeps pointing at an unlinked inode
/// and never fires again — the watcher would go deaf after the first write.
/// Watching the containing directory survives that, and also covers the case
/// where the file does not exist yet at launch.
final class StateWatcher {
	private var source: DispatchSourceFileSystemObject?
	private var fd: CInt = -1
	private let url: URL
	private let onChange: (AgentState) -> Void

	init(url: URL, onChange: @escaping (AgentState) -> Void) {
		self.url = url
		self.onChange = onChange
		try? FileManager.default.createDirectory(
			at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
		start()
		reload()
	}

	private func start() {
		let dir = url.deletingLastPathComponent().path
		fd = open(dir, O_EVTONLY)
		guard fd >= 0 else {
			NSLog("CmuxDock: cannot watch \(dir) (errno \(errno))")
			return
		}
		let s = DispatchSource.makeFileSystemObjectSource(
			fileDescriptor: fd, eventMask: [.write, .rename, .delete], queue: .main)
		s.setEventHandler { [weak self] in
			guard let self else { return }
			// If the directory itself was replaced, the old descriptor is stale;
			// re-arm before reading or we silently stop receiving events.
			let flags = self.source?.data ?? []
			if flags.contains(.delete) || flags.contains(.rename) {
				self.restart()
			}
			self.scheduleReload()
		}
		s.setCancelHandler { [fd] in
			if fd >= 0 { close(fd) }
		}
		s.resume()
		source = s
	}

	private func restart() {
		source?.cancel()
		source = nil
		fd = -1
		start()
	}

	/// Writing atomically touches the directory twice — once creating the temp
	/// file, once renaming it over the target — so every update arrives as two
	/// events. Coalescing avoids redrawing the tile twice for one change.
	private var pending: DispatchWorkItem?

	private func scheduleReload() {
		pending?.cancel()
		let work = DispatchWorkItem { [weak self] in self?.reload() }
		pending = work
		DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: work)
	}

	private func reload() {
		guard let data = try? Data(contentsOf: url) else {
			// No file yet. Normal before the first notification fires.
			onChange(AgentState())
			return
		}
		guard let state = try? JSONDecoder().decode(AgentState.self, from: data) else {
			// An empty workspace list is a legitimate state, so only a genuine
			// decode failure is worth complaining about. The app's entire output
			// is a 128pt icon, so this log is the only debugging surface:
			//   log stream --predicate 'process == "CmuxDock"'
			NSLog("CmuxDock: could not decode %@ — leaving the tile unchanged", url.path)
			return
		}
		NSLog(
			"CmuxDock: reload — %d workspace(s), worst=%@", state.workspaces.count,
			state.worst.rawValue)
		onChange(state)
	}
}

// MARK: - Tile

final class TileView: NSView {
	var state = AgentState() { didSet { needsDisplay = true } }

	override func draw(_ dirty: NSRect) {
		let r = bounds.insetBy(dx: bounds.width * 0.06, dy: bounds.height * 0.06)
		guard r.width > 0, r.height > 0 else { return }
		let radius = r.width * 0.22  // radius.soft, scaled to the tile

		let panel = NSBezierPath(roundedRect: r, xRadius: radius, yRadius: radius)
		Iris.bgRaised.setFill()
		panel.fill()
		Iris.border.setStroke()
		panel.lineWidth = max(1, r.width * 0.012)
		panel.stroke()

		// The accent is IDENTITY, so it owns the resting ring. The moment there
		// is real state to report, state wins — see docs/DESIGN.md §3.
		let ringColor: NSColor
		switch state.worst {
		case .idle: ringColor = Iris.accent
		case .working: ringColor = Iris.info
		case .attention: ringColor = Iris.warning
		case .error: ringColor = Iris.error
		}

		let inset = r.width * 0.09
		let ring = NSBezierPath(
			roundedRect: r.insetBy(dx: inset, dy: inset),
			xRadius: radius * 0.7, yRadius: radius * 0.7)
		ring.lineWidth = max(1.5, r.width * 0.05)
		ringColor.setStroke()
		ring.stroke()

		// A count when something is pending, otherwise a working ellipsis or a
		// resting check.
		let pending = state.needsAttention
		let glyph = pending > 0 ? "\(min(pending, 99))" : (state.working > 0 ? "⋯" : "✓")
		let size = pending > 9 ? r.height * 0.40 : r.height * 0.48
		let attrs: [NSAttributedString.Key: Any] = [
			.font: NSFont.systemFont(ofSize: size, weight: .semibold),
			.foregroundColor: pending > 0 ? Iris.textBright : Iris.textDim,
		]
		let s = NSAttributedString(string: glyph, attributes: attrs)
		let sz = s.size()
		s.draw(at: NSPoint(x: r.midX - sz.width / 2, y: r.midY - sz.height / 2))
	}
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate {
	// The tile view needs a real frame. dockTile.contentView is not laid out for
	// you — with a zero rect it draws nothing, silently. 128pt is the tile size
	// AppKit renders at.
	private let tile = TileView(frame: NSRect(x: 0, y: 0, width: 128, height: 128))
	private var watcher: StateWatcher?
	private var state = AgentState()

	/// Hysteresis for hiding. Showing is immediate — an agent wanting attention
	/// should not wait — but hiding is delayed, because agent state flaps
	/// (working → idle → working within a second is normal) and an icon
	/// entering and leaving the Dock on every flap is worse than one that
	/// lingers.
	private var hideWork: DispatchWorkItem?
	private static let hideDelay: TimeInterval = 4

	func applicationDidFinishLaunching(_ n: Notification) {
		// Start hidden. There is nothing to report until the first state
		// arrives, and appearing for a moment at login just to vanish is worse
		// than never appearing.
		NSApp.setActivationPolicy(.accessory)

		let url = FileManager.default.homeDirectoryForCurrentUser
			.appendingPathComponent(".cmux/dock-state.json")
		watcher = StateWatcher(url: url) { [weak self] s in
			guard let self else { return }
			self.state = s
			self.tile.state = s
			self.applyVisibility(for: s)
		}
	}

	/// The tile exists only while something is worth reporting.
	///
	/// This is the one way to have it both ways: an .accessory app has no dock
	/// tile at all, so instead of being permanently visible or permanently
	/// hidden, the activation policy is switched at runtime. Idle means
	/// .accessory (no tile, no Cmd-Tab entry); anything else means .regular.
	private func applyVisibility(for s: AgentState) {
		let shouldShow = s.worst != .idle

		hideWork?.cancel()
		hideWork = nil

		if shouldShow {
			show()
		} else {
			let work = DispatchWorkItem { [weak self] in self?.hide() }
			hideWork = work
			DispatchQueue.main.asyncAfter(deadline: .now() + Self.hideDelay, execute: work)
		}
	}

	private func show() {
		guard NSApp.activationPolicy() != .regular else {
			NSApp.dockTile.display()
			return
		}
		NSApp.setActivationPolicy(.regular)
		// The tile's content view does not survive the policy transition, so it
		// has to be re-attached every time the app becomes .regular. Without
		// this the icon comes back as the generic app icon.
		NSApp.dockTile.contentView = tile
		NSApp.dockTile.display()
		NSLog("CmuxDock: shown (worst=%@)", state.worst.rawValue)
	}

	private func hide() {
		guard NSApp.activationPolicy() != .accessory else { return }
		NSApp.setActivationPolicy(.accessory)
		NSLog("CmuxDock: hidden (idle)")
	}

	/// Dock icon context menu.
	func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
		let m = NSMenu()
		for ws in state.workspaces where ws.status != .idle {
			let item = NSMenuItem(
				title: "\(ws.name) — \(ws.status.rawValue)",
				action: #selector(focusWorkspace(_:)), keyEquivalent: "")
			item.target = self
			item.representedObject = ws.name
			m.addItem(item)
		}
		if m.numberOfItems > 0 { m.addItem(.separator()) }

		let hide = NSMenuItem(
			title: "Ocultar Dock automáticamente",
			action: #selector(toggleDockAutohide), keyEquivalent: "")
		hide.target = self
		hide.state = dockAutohides ? .on : .off
		m.addItem(hide)
		return m
	}

	private var dockAutohides: Bool {
		UserDefaults(suiteName: "com.apple.dock")?.bool(forKey: "autohide") ?? false
	}

	@objc private func focusWorkspace(_ sender: NSMenuItem) {
		guard let name = sender.representedObject as? String else { return }
		run("/opt/homebrew/bin/aerospace", ["workspace", name])
	}

	@objc private func toggleDockAutohide() {
		run(
			"/usr/bin/defaults",
			["write", "com.apple.dock", "autohide", "-bool", dockAutohides ? "false" : "true"])
		run("/usr/bin/killall", ["Dock"])
	}

	private func run(_ path: String, _ args: [String]) {
		guard FileManager.default.isExecutableFile(atPath: path) else {
			NSLog("CmuxDock: not executable: \(path)")
			return
		}
		let p = Process()
		p.executableURL = URL(fileURLWithPath: path)
		p.arguments = args
		do { try p.run() } catch { NSLog("CmuxDock: \(path) failed: \(error)") }
	}
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
