import CoreGraphics
import Foundation

struct WindowBounds: Codable {
    let height: Double
    let name: String
    let ownerPid: Int
    let width: Double
    let x: Double
    let y: Double
}

func mclipWindows() -> [WindowBounds] {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    let entries = CGWindowListCopyWindowInfo(options, kCGNullWindowID)
        as? [[String: Any]] ?? []

    return entries.compactMap { entry in
        guard entry[kCGWindowOwnerName as String] as? String == "mclip",
              let name = entry[kCGWindowName as String] as? String,
              let ownerPid = entry[kCGWindowOwnerPID as String] as? Int,
              let rawBounds = entry[kCGWindowBounds as String] as? [String: Any],
              let x = rawBounds["X"] as? Double,
              let y = rawBounds["Y"] as? Double,
              let width = rawBounds["Width"] as? Double,
              let height = rawBounds["Height"] as? Double else {
            return nil
        }

        return WindowBounds(
            height: height,
            name: name,
            ownerPid: ownerPid,
            width: width,
            x: x,
            y: y
        )
    }
}

func number(_ value: String?) -> Double? {
    guard let value else { return nil }
    return Double(value)
}

func postMouse(_ type: CGEventType, x: Double, y: Double) {
    CGEvent(
        mouseEventSource: nil,
        mouseType: type,
        mouseCursorPosition: CGPoint(x: x, y: y),
        mouseButton: .left
    )?.post(tap: .cghidEventTap)
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard let command = arguments.first else {
    fputs("expected windows, move, click, or escape\n", stderr)
    exit(2)
}

switch command {
case "windows":
    let data = try JSONEncoder().encode(mclipWindows())
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
case "move", "click":
    guard let x = number(arguments[safe: 1]), let y = number(arguments[safe: 2]) else {
        fputs("move and click require numeric x and y\n", stderr)
        exit(2)
    }
    if command == "move" {
        postMouse(.mouseMoved, x: x, y: y)
    } else {
        // Crossing from the focus-owning main window into a non-focusable
        // preview must first update the system pointer hit target. A direct
        // mouseDown can race main-window focus loss and dismiss the preview
        // before its button receives a click.
        postMouse(.mouseMoved, x: x, y: y)
        usleep(100_000)
        postMouse(.leftMouseDown, x: x, y: y)
        postMouse(.leftMouseUp, x: x, y: y)
    }
case "escape":
    let keyCode: CGKeyCode = 53
    CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true)?
        .post(tap: .cghidEventTap)
    CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false)?
        .post(tap: .cghidEventTap)
default:
    fputs("unknown command: \(command)\n", stderr)
    exit(2)
}

extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
