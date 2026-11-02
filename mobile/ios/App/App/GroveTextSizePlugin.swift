import Capacitor
import Foundation
import UIKit

@objc(GroveTextSizePlugin)
public final class GroveTextSizePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GroveTextSizePlugin"
    public let jsName = "GroveTextSize"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "preferredScale", returnType: CAPPluginReturnPromise)]
    private var observer: NSObjectProtocol?
    private func scale() -> CGFloat {
        let preferred = UIFont.preferredFont(forTextStyle: .body).pointSize
        let standard = UIFont.preferredFont(forTextStyle: .body, compatibleWith: UITraitCollection(preferredContentSizeCategory: .large)).pointSize
        return max(1, preferred / standard)
    }
    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.notifyListeners("textSizeChanged", data: ["scale": self.scale()])
        }
    }
    deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }
    @objc public func preferredScale(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["scale": self.scale()]) }
    }
}
