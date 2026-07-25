import AppKit

// MARK: - Window

/// A Dynamic-Island-style panel that grows out of the notch.
///
/// There are no pixels *inside* the notch — it is a physical hole where the
/// camera is. The illusion comes from a shape that is WIDER than the cutout,
/// flush with the top edge, extending below it, in the same near-black as the
/// bezel. The notch then reads as carved out of the panel.
///
/// Measured on this machine rather than assumed: the built-in display is
/// 1512x982pt, the notch is 185pt wide spanning x 663…848, safeAreaInsets.top
/// is 32. Sketchybar sits at window layer -20, below ordinary windows, so
/// drawing over its strip is free — this window is at .statusBar (25).
final class IslandWindow: NSWindow {
	enum Mode {
		case compact  // a sliver under the notch: something is happening
		case expanded  // the full panel: what, and where
	}

	private let content = IslandView()
	private var mode: Mode = .compact
	private var collapseWork: DispatchWorkItem?

	init() {
		super.init(
			contentRect: NSRect(x: 0, y: 0, width: 10, height: 10),
			styleMask: .borderless, backing: .buffered, defer: false)

		isOpaque = false
		backgroundColor = .clear
		hasShadow = false  // a shadow would break the "part of the bezel" illusion
		level = .statusBar
		collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
		contentView = content
		isReleasedWhenClosed = false
		content.window_ = self
	}

	override var canBecomeKey: Bool { false }
	override var canBecomeMain: Bool { false }

	var state: AgentState = AgentState() {
		didSet {
			content.state = state
			// A fresh notification is worth opening for; a downgrade is not.
			if state.needsAttention > oldValue.needsAttention {
				expand(thenCollapseAfter: 4)
			} else {
				layout(animated: true)
			}
		}
	}

	// MARK: Geometry

	private struct Metrics {
		var centreX: CGFloat
		var notchW: CGFloat
		var notchH: CGFloat
		var screenTop: CGFloat
	}

	private func metrics() -> Metrics? {
		let screen =
			NSScreen.screens.first(where: { $0.auxiliaryTopLeftArea != nil }) ?? NSScreen.main
		guard let screen else { return nil }
		if let l = screen.auxiliaryTopLeftArea, let r = screen.auxiliaryTopRightArea {
			return Metrics(
				centreX: (l.maxX + r.minX) / 2, notchW: r.minX - l.maxX,
				notchH: max(screen.safeAreaInsets.top, 32), screenTop: screen.frame.maxY)
		}
		// No notch: behave like a plain top-centre banner.
		return Metrics(
			centreX: screen.frame.midX, notchW: 0, notchH: 0, screenTop: screen.frame.maxY)
	}

	/// ALWAYS the expanded extent, whatever the mode.
	///
	/// Sizing the window to the mode created a feedback loop: hovering expanded
	/// it, expanding swallowed the cursor, collapsing released it, and the panel
	/// oscillated whenever the pointer sat near its edge. Observed directly in
	/// the logs as expand/collapse/expand at speed.
	///
	/// A fixed window with mode-dependent DRAWING breaks the loop — the hover
	/// region no longer moves as a result of hovering.
	private func targetFrame(_ m: Metrics) -> NSRect {
		let w = max(m.notchW + 150, content.expandedWidth)
		let h = m.notchH + content.expandedBodyHeight
		return NSRect(
			x: (m.centreX - w / 2).rounded(), y: (m.screenTop - h).rounded(),
			width: w.rounded(), height: h.rounded())
	}

	private func layout(animated: Bool) {
		guard let m = metrics() else { return }
		content.notchWidth = m.notchW
		content.notchHeight = m.notchH
		let f = targetFrame(m)
		if frame != f { setFrame(f, display: false) }

		// The shape animates, not the window. motion.base / motion.slow from
		// docs/DESIGN.md with the same easing curve.
		content.setMode(
			mode, animated: animated && isVisible,
			duration: mode == .expanded ? 0.18 : 0.14)
	}

	// MARK: Modes

	func expand(thenCollapseAfter seconds: TimeInterval?) {
		NSLog("Island: expand(after: %@)", seconds.map{String($0)} ?? "never")
		collapseWork?.cancel()
		mode = .expanded
		orderFrontRegardless()
		layout(animated: true)
		guard let seconds else { return }
		let w = DispatchWorkItem { [weak self] in self?.collapse() }
		collapseWork = w
		DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: w)
	}

	func collapse() {
		NSLog("Island: collapse()")
		collapseWork?.cancel()
		collapseWork = nil
		mode = .compact
		layout(animated: true)
	}

	func present() {
		orderFrontRegardless()
		layout(animated: false)
	}

	func dismiss() {
		collapseWork?.cancel()
		orderOut(nil)
	}

	/// Rows are clickable: jump straight to the workspace that wants you.
	func focusWorkspace(_ name: String) {
		let p = Process()
		p.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/aerospace")
		p.arguments = ["workspace", name]
		try? p.run()
		collapse()
	}
}

// MARK: - View

final class IslandView: NSView {
	static let compactStrip: CGFloat = 18
	static let rowHeight: CGFloat = 26
	static let headerHeight: CGFloat = 30
	static let padBottom: CGFloat = 10

	weak var window_: IslandWindow?

	var state = AgentState() { didSet { needsDisplay = true } }
	private(set) var mode: IslandWindow.Mode = .compact

	/// 0 = fully compact, 1 = fully expanded. Driven by a display link-ish timer
	/// so the SHAPE animates while the window frame stays put.
	private var progress: CGFloat = 0 { didSet { needsDisplay = true } }
	private var anim: Timer?

	func setMode(_ m: IslandWindow.Mode, animated: Bool, duration: TimeInterval) {
		mode = m
		updateTrackingAreas()
		let target: CGFloat = m == .expanded ? 1 : 0
		anim?.invalidate()
		guard animated, progress != target else {
			progress = target
			return
		}
		let start = progress
		let t0 = Date()
		anim = Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { [weak self] t in
			guard let self else { t.invalidate(); return }
			let f = min(1, Date().timeIntervalSince(t0) / duration)
			// Same curve as docs/DESIGN.md motion.easing, evaluated directly.
			let e = Self.ease(CGFloat(f))
			self.progress = start + (target - start) * e
			if f >= 1 { t.invalidate(); self.anim = nil }
		}
	}

	/// cubic-bezier(0.32, 0.72, 0, 1) — Newton-solved for x, then y.
	private static func ease(_ x: CGFloat) -> CGFloat {
		let (x1, y1, x2, y2): (CGFloat, CGFloat, CGFloat, CGFloat) = (0.32, 0.72, 0, 1)
		func cx(_ t: CGFloat) -> CGFloat {
			let u = 1 - t
			return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t
		}
		func cy(_ t: CGFloat) -> CGFloat {
			let u = 1 - t
			return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t
		}
		var t = x
        for _ in 0..<6 {
			let d = cx(t) - x
			if abs(d) < 0.0005 { break }
			let dt = (cx(t + 0.001) - cx(t - 0.001)) / 0.002
			if abs(dt) < 1e-6 { break }
			t -= d / dt
		}
		return cy(max(0, min(1, t)))
	}

	/// The shape currently drawn, interpolated between compact and expanded.
	/// Anchored to the top centre of the fixed window.
	private var shapeRect: NSRect {
		let full = bounds
		let cw = notchWidth + 96
		let ch = notchHeight + Self.compactStrip
		let w = cw + (full.width - cw) * progress
		let h = ch + (full.height - ch) * progress
		return NSRect(x: (full.width - w) / 2, y: full.maxY - h, width: w, height: h)
	}
	var notchWidth: CGFloat = 185
	var notchHeight: CGFloat = 32

	private var tracking: NSTrackingArea?
	private var hoveredRow: Int? { didSet { needsDisplay = true } }

	/// Only workspaces with something to say get a row — an expanded panel
	/// listing idle workspaces would be noise.
	private var rows: [AgentState.Workspace] {
		state.workspaces.filter { $0.status != .idle }
	}

	/// The normal set, not the chrome one: this panel is bgBase, so the status
	/// colours already clear their gates without lifting.
	private var tint: NSColor {
		switch state.worst {
		case .idle: return Iris.accent
		case .working: return Iris.info
		case .attention: return Iris.warning
		case .error: return Iris.error
		}
	}

	private static let title = NSFont.systemFont(ofSize: 12, weight: .semibold)
	private static let row = NSFont.systemFont(ofSize: 12, weight: .medium)
	private static let meta = NSFont.systemFont(ofSize: 11, weight: .regular)

	private var headline: String {
		let n = state.needsAttention
		if n > 0 { return n == 1 ? "1 agente te espera" : "\(n) agentes te esperan" }
		if state.working > 0 { return "trabajando" }
		return "listo"
	}

	var expandedWidth: CGFloat {
		let w = (headline as NSString).size(withAttributes: [.font: Self.title]).width
		let widest =
			rows.map {
				("\($0.name)  \($0.status.rawValue)" as NSString)
					.size(withAttributes: [.font: Self.row]).width
			}.max() ?? 0
		return min(420, max(300, max(w, widest) + 80))
	}

	var expandedBodyHeight: CGFloat {
		Self.headerHeight + CGFloat(rows.count) * Self.rowHeight + Self.padBottom
	}

	// MARK: Mouse

    override func updateTrackingAreas() {
		super.updateTrackingAreas()
		if let t = tracking { removeTrackingArea(t) }
		// Track the drawn shape, never the whole fixed window — otherwise the
		// invisible margin would react to the pointer.
		let t = NSTrackingArea(
			rect: shapeRect, options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways],
			owner: self, userInfo: nil)
		addTrackingArea(t)
		tracking = t
	}

	/// Let clicks through everywhere except the visible shape, so the panel
	/// never swallows a menu-bar click in its transparent margin.
	override func hitTest(_ point: NSPoint) -> NSView? {
		let p = convert(point, from: superview)
		return shapeRect.contains(p) ? super.hitTest(point) : nil
	}

	override func mouseEntered(with event: NSEvent) {
		// Hovering means the user is looking at it, so hold it open rather than
		// yanking it away mid-read.
		window_?.expand(thenCollapseAfter: nil)
	}

	override func mouseExited(with event: NSEvent) {
		hoveredRow = nil
		window_?.collapse()
	}

	override func mouseMoved(with event: NSEvent) {
		hoveredRow = rowIndex(at: convert(event.locationInWindow, from: nil))
	}

	override func mouseUp(with event: NSEvent) {
		let p = convert(event.locationInWindow, from: nil)
		guard let i = rowIndex(at: p), i < rows.count else { return }
		window_?.focusWorkspace(rows[i].name)
	}

	private func rowIndex(at p: NSPoint) -> Int? {
		guard mode == .expanded, !rows.isEmpty else { return nil }
		let top = shapeRect.maxY - notchHeight - Self.headerHeight
		guard p.y <= top, p.y >= Self.padBottom else { return nil }
		let i = Int((top - p.y) / Self.rowHeight)
		return (0..<rows.count).contains(i) ? i : nil
	}

	// MARK: Draw

	override func draw(_ dirty: NSRect) {
		let r = shapeRect
		// Square at the top, flush with the screen edge; generously rounded at
		// the bottom so it reads as growing out of the bezel, not as a window.
		let radius: CGFloat = mode == .expanded ? 22 : 14
		let body = NSBezierPath()
		body.move(to: NSPoint(x: r.minX, y: r.maxY))
		body.line(to: NSPoint(x: r.minX, y: r.minY + radius))
		body.appendArc(
			withCenter: NSPoint(x: r.minX + radius, y: r.minY + radius), radius: radius,
			startAngle: 180, endAngle: 270)
		body.line(to: NSPoint(x: r.maxX - radius, y: r.minY))
		body.appendArc(
			withCenter: NSPoint(x: r.maxX - radius, y: r.minY + radius), radius: radius,
			startAngle: 270, endAngle: 360)
		body.line(to: NSPoint(x: r.maxX, y: r.maxY))
		body.close()

		// bgBase, deliberately, even though the system bar sits on the lighter
		// bgChrome. This panel is the one surface that SHOULD be near-black: it
		// has to match the physical bezel so the notch reads as carved out of it.
		// A lighter fill turns it into a panel floating over the notch instead.
		Iris.bgBase.setFill()
		body.fill()

		// Cross-fade the two layouts across the animation rather than snapping,
		// so nothing pops in at the halfway point.
		if progress < 0.999 {
			drawCompact(in: r, alpha: 1 - progress)
		}
		if progress > 0.001 {
			drawExpanded(in: r, alpha: progress)
		}
	}

	/// Collapsed: a single lozenge of status colour under the cutout. No text —
	/// at this size colour is the only thing that reads at a glance.
	private func drawCompact(in r: NSRect, alpha: CGFloat) {
		let h: CGFloat = 5
		let w = min(64, r.width - 40)
		let bar = NSRect(
			x: r.midX - w / 2, y: (Self.compactStrip - h) / 2 + 2, width: w, height: h)
		// A soft halo so the bar reads on a bright window behind the panel too.
		NSGraphicsContext.current?.saveGraphicsState()
		let glow = NSShadow()
		glow.shadowColor = tint.withAlphaComponent(0.55)
		glow.shadowBlurRadius = 7
		glow.shadowOffset = .zero
		glow.set()
		tint.withAlphaComponent(alpha).setFill()
		NSBezierPath(roundedRect: bar, xRadius: h / 2, yRadius: h / 2).fill()
		NSGraphicsContext.current?.restoreGraphicsState()
	}

	private func drawExpanded(in r: NSRect, alpha: CGFloat) {
		let top = r.maxY - notchHeight

		// Header: dot + headline, sitting just below the cutout.
		let d: CGFloat = 8
		let hy = top - Self.headerHeight / 2
		NSGraphicsContext.current?.saveGraphicsState()
		let glow = NSShadow()
		glow.shadowColor = tint.withAlphaComponent(0.6)
		glow.shadowBlurRadius = 8
		glow.shadowOffset = .zero
		glow.set()
		tint.withAlphaComponent(alpha).setFill()
		NSBezierPath(ovalIn: NSRect(x: r.minX + 18, y: hy - d / 2, width: d, height: d)).fill()
		NSGraphicsContext.current?.restoreGraphicsState()

		let title = NSAttributedString(
			string: headline,
			attributes: [
				.font: Self.title, .foregroundColor: Iris.textBright.withAlphaComponent(alpha),
			])
		title.draw(at: NSPoint(x: r.minX + 18 + d + 9, y: hy - title.size().height / 2))

		guard !rows.isEmpty else { return }

		// Hairline between header and rows.
		Iris.border.withAlphaComponent(0.7).setStroke()
		let sep = NSBezierPath()
		sep.move(to: NSPoint(x: r.minX + 14, y: top - Self.headerHeight))
		sep.line(to: NSPoint(x: r.maxX - 14, y: top - Self.headerHeight))
		sep.lineWidth = 1
		sep.stroke()

		for (i, ws) in rows.enumerated() {
			let y = top - Self.headerHeight - CGFloat(i + 1) * Self.rowHeight
			let rowRect = NSRect(x: r.minX + 8, y: y, width: r.width - 16, height: Self.rowHeight)

			if hoveredRow == i {
				Iris.bgPanel.setFill()
				NSBezierPath(roundedRect: rowRect.insetBy(dx: 0, dy: 2), xRadius: 7, yRadius: 7)
					.fill()
			}

			let c = colour(for: ws.status)
			c.withAlphaComponent(alpha).setFill()
			NSBezierPath(
				ovalIn: NSRect(x: r.minX + 20, y: rowRect.midY - 3, width: 6, height: 6)
			).fill()

			let name = NSAttributedString(
				string: ws.name,
				attributes: [
					.font: Self.row, .foregroundColor: Iris.text.withAlphaComponent(alpha),
				])
			name.draw(at: NSPoint(x: r.minX + 34, y: rowRect.midY - name.size().height / 2))

			let st = NSAttributedString(
				string: label(for: ws.status),
				attributes: [.font: Self.meta, .foregroundColor: c.withAlphaComponent(alpha)])
			st.draw(
				at: NSPoint(
					x: r.maxX - 20 - st.size().width, y: rowRect.midY - st.size().height / 2))
		}
	}

	private func colour(for s: AgentState.Status) -> NSColor {
		switch s {
		case .idle: return Iris.textDim
		case .working: return Iris.info
		case .attention: return Iris.warning
		case .error: return Iris.error
		}
	}

	private func label(for s: AgentState.Status) -> String {
		switch s {
		case .idle: return "en reposo"
		case .working: return "trabajando"
		case .attention: return "te espera"
		case .error: return "error"
		}
	}
}
