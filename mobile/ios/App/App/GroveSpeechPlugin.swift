import AVFoundation
import Capacitor
import UIKit

struct GroveSpeechRequest {
    let id: String
    let utterance: AVSpeechUtterance
    let call: CAPPluginCall
    var timeout: DispatchWorkItem?
}

@objc(GroveSpeechPlugin)
public final class GroveSpeechPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "GroveSpeechPlugin"
    public let jsName = "GroveSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    var synthesizer = AVSpeechSynthesizer()
    var pending: GroveSpeechRequest?
    private var foreground = true
    private var observers: [NSObjectProtocol] = []
    public override func load() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            // Let the system manage its separate speech audio session, without
            // changing the existing WebView recording session or background modes.
            self.synthesizer.usesApplicationAudioSession = false
            self.synthesizer.delegate = self
            self.foreground = UIApplication.shared.applicationState != .background
            let center = NotificationCenter.default
            for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification] {
                self.observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.foreground = false; self?.cancelCurrent() })
            }
            self.observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.foreground = true })
            self.observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
                if let value = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, value == AVAudioSession.InterruptionType.began.rawValue { self?.interrupted() }
            })
            self.observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
                if let value = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt, value == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { self?.interrupted() }
            })
        }
    }
    deinit { observers.forEach(NotificationCenter.default.removeObserver) }
    private func voices() -> [AVSpeechSynthesisVoice] {
        // Personal Voice is outside this app's scope; never request its consent.
        Array(AVSpeechSynthesisVoice.speechVoices().filter { !$0.voiceTraits.contains(.isPersonalVoice) && $0.identifier.count <= 512 && $0.name.count <= 256 }.sorted { $0.identifier < $1.identifier }.prefix(512))
    }
    @objc public func getVoices(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.resolve(["voices": [], "available": false]); return }
            let defaultID = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())?.identifier
            let result: [JSObject] = self.voices().map { voice in ["voiceURI": voice.identifier, "name": voice.name, "lang": voice.language, "localService": true, "default": voice.identifier == defaultID] }
            call.resolve(["voices": result, "available": true])
        }
    }
    private func matches(_ requested: String, _ language: String) -> Bool {
        let tag = language.replacingOccurrences(of: "_", with: "-").lowercased(), parts = tag.split(separator: "-").map(String.init)
        if requested == "en-US" { return parts.first == "en" }
        return (parts.first == "zh" || parts.first == "cmn") && !parts.contains("hk") && !parts.contains("mo") && !parts.contains("yue")
    }
    private func validID(_ id: String) -> Bool { UUID(uuidString: id)?.uuidString.lowercased() == id.lowercased() }
    @objc public func speak(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), validID(id), let text = call.getString("text"), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.utf16.count <= 2000,
              let lang = call.getString("lang"), ["zh-CN", "en-US"].contains(lang), let uri = call.getString("voiceURI"), uri.count <= 512 else { call.reject("Invalid device speech request."); return }
        let rate = call.getDouble("rate") ?? 0.75
        guard rate.isFinite, rate >= 0.5, rate <= 1.5 else { call.reject("Invalid device speech rate."); return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.resolve(["id": id, "spoken": false, "reason": "error"]); return }
            guard self.foreground else { call.resolve(["id": id, "spoken": false, "reason": "background"]); return }
            guard self.cancelCurrent() else { call.resolve(["id": id, "spoken": false, "reason": "error"]); return }
            guard let voice = self.voices().first(where: { $0.identifier == uri && self.matches(lang, $0.language) }) else { call.resolve(["id": id, "spoken": false, "reason": "unavailable"]); return }
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = voice; utterance.rate = Float(rate) * AVSpeechUtteranceDefaultSpeechRate
            let timeout = DispatchWorkItem { [weak self] in
                guard let self, self.pending?.id == id else { return }
                self.cancelCurrent(reason: "error")
            }
            self.pending = GroveSpeechRequest(id: id, utterance: utterance, call: call, timeout: timeout)
            DispatchQueue.main.asyncAfter(deadline: .now() + min(180, max(10, Double(text.utf16.count) * 0.25 / rate + 8)), execute: timeout)
            self.synthesizer.speak(utterance)
        }
    }
    private func resolve(_ request: GroveSpeechRequest, spoken: Bool, reason: String? = nil) {
        request.timeout?.cancel()
        var value: JSObject = ["id": request.id, "spoken": spoken]
        if let reason { value["reason"] = reason }
        request.call.resolve(value)
    }
    @discardableResult func cancelCurrent(reason: String = "cancelled") -> Bool {
        guard let old = pending else { return true }
        // A failed SDK stop is not an acknowledgement. Keep this owner and its
        // deadline until a successful retry or its own delegate completion.
        guard synthesizer.stopSpeaking(at: .immediate) else { return false }
        pending = nil
        resolve(old, spoken: false, reason: reason)
        return true
    }
    private func interrupted() {
        cancelCurrent()
        notifyListeners("interrupted", data: ["reason": "audio-interruption"])
    }
    @objc public func stop(_ call: CAPPluginCall) {
        let id = call.getString("id")
        if let id, !validID(id) { call.reject("Invalid device speech identifier."); return }
        DispatchQueue.main.async { [weak self] in
            if let self, let pending = self.pending, id == nil || pending.id == id {
                guard self.cancelCurrent() else { call.reject("Could not stop the device voice. Try again."); return }
            }
            call.resolve()
        }
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let request = self.pending, request.utterance === utterance else { return }
            self.pending = nil; self.resolve(request, spoken: true)
        }
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let request = self.pending, request.utterance === utterance else { return }
            self.pending = nil; self.resolve(request, spoken: false, reason: "cancelled")
        }
    }
}
