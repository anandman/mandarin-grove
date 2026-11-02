import Capacitor
import CryptoKit
import Foundation
import UIKit
import UniformTypeIdentifiers

struct GroveExportFiles {
    private let root: URL
    private let manager = FileManager.default
    init(root: URL = FileManager.default.temporaryDirectory) { self.root = root.standardizedFileURL.resolvingSymlinksInPath() }
    private func failure() -> NSError { NSError(domain: "GroveExportFiles", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unrecognized temporary backup path. Original files were kept."]) }
    private func ownedDirectory(_ directory: URL) throws {
        let name = directory.lastPathComponent
        guard directory.deletingLastPathComponent().standardizedFileURL.path == root.path,
              name.hasPrefix("GroveExport-"), UUID(uuidString: String(name.dropFirst("GroveExport-".count))) != nil,
              directory.standardizedFileURL.resolvingSymlinksInPath().path == directory.standardizedFileURL.path else { throw failure() }
        if manager.fileExists(atPath: directory.path), try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]).isDirectory != true { throw failure() }
    }
    func stage(name: String, text: String) throws -> URL {
        guard name.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$", options: .regularExpression) != nil else { throw failure() }
        try manager.createDirectory(at: root, withIntermediateDirectories: true)
        let directory = root.appendingPathComponent("GroveExport-" + UUID().uuidString, isDirectory: true)
        try manager.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        let file = directory.appendingPathComponent(name)
        do { try Data(text.utf8).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]); return file }
        catch { try? discard(file); throw error }
    }
    func discard(_ file: URL) throws {
        let directory = file.deletingLastPathComponent(); try ownedDirectory(directory)
        if manager.fileExists(atPath: directory.path) { try manager.removeItem(at: directory) }
    }
    func clear() throws {
        if !manager.fileExists(atPath: root.path) { return }
        let directories = try manager.contentsOfDirectory(at: root, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey]).filter { $0.lastPathComponent.hasPrefix("GroveExport-") }
        for directory in directories { try ownedDirectory(directory) }
        for directory in directories { try manager.removeItem(at: directory) }
    }
}

struct GrovePickerRequest {
    let call: CAPPluginCall
    let exportFile: URL?
}
struct GrovePickerRequests {
    private var active: (UIDocumentPickerViewController, GrovePickerRequest)?
    var isPending: Bool { active != nil }
    mutating func begin(_ picker: UIDocumentPickerViewController, request: GrovePickerRequest) throws {
        guard active == nil else { throw NSError(domain: "GroveFiles", code: 3, userInfo: [NSLocalizedDescriptionKey: "Finish the current file picker first."]) }
        active = (picker, request)
    }
    mutating func finish(_ picker: UIDocumentPickerViewController) -> GrovePickerRequest? {
        guard let (owner, request) = active, owner === picker else { return nil }
        active = nil; return request
    }
}

final class GroveBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GroveFilesPlugin())
        bridge?.registerPluginInstance(GroveSpeechPlugin())
    }
}

@objc(GroveFilesPlugin)
public final class GroveFilesPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "GroveFilesPlugin"
    public let jsName = "GroveFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installationIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rawRecovery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTemporaryFiles", returnType: CAPPluginReturnPromise)
    ]
    var requests = GrovePickerRequests()
    private let exports = GroveExportFiles()
    private let limit = 64 * 1024 * 1024
    private func failure(_ message: String) -> NSError {
        NSError(domain: "GroveFiles", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    private func databaseDirectory() throws -> URL {
        try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("CapacitorDatabase", isDirectory: true)
    }
    static func decodeBackupText(_ data: Data) throws -> String {
        guard String(data: data, encoding: .utf8) != nil else {
            throw NSError(domain: "GroveFiles", code: 2, userInfo: [NSLocalizedDescriptionKey: "The backup is not valid UTF-8. The original was kept."])
        }
        // Foundation's external-representation initializer strips a BOM.
        // Validate strictly above, then decode the already-valid bytes with
        // Swift's UTF-8 codec so the exact selected-file text is retained.
        return String(decoding: data, as: UTF8.self)
    }
    @objc public func installationIdentity(_ call: CAPPluginCall) {
        do {
            let manager = FileManager.default
            var directory = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                .appendingPathComponent("GroveInstallation", isDirectory: true)
            try manager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            var excluded = URLResourceValues(); excluded.isExcludedFromBackup = true
            try directory.setResourceValues(excluded)
            var file = directory.appendingPathComponent("identity")
            if !manager.fileExists(atPath: file.path) {
                try UUID().uuidString.lowercased().write(to: file, atomically: true, encoding: .utf8)
            }
            try file.setResourceValues(excluded)
            try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: file.path)
            let id = try String(contentsOf: file, encoding: .utf8)
            guard UUID(uuidString: id) != nil else { throw failure("Installation identity needs recovery; its original file was kept.") }
            let database = try databaseDirectory()
            try manager.createDirectory(at: database, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: database.path)
            for suffix in ["", "-wal", "-shm"] {
                let path = database.appendingPathComponent("mandarin_groveSQLite.db" + suffix).path
                if manager.fileExists(atPath: path) { try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: path) }
            }
            call.resolve(["id": id])
        } catch { call.reject("Could not prepare private installation storage. Existing files were kept.", nil, error) }
    }
    @objc public func saveText(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), name.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$", options: .regularExpression) != nil,
              let text = call.getString("text") else { call.reject("Invalid backup file request."); return }
        DispatchQueue.main.async {
            guard !self.requests.isPending, let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else { call.reject("Finish the current file picker first."); return }
            var prepared: URL?
            do {
                let file = try self.exports.stage(name: name, text: text)
                prepared = file
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                try self.requests.begin(picker, request: GrovePickerRequest(call: call, exportFile: file)); picker.delegate = self
                presenter.present(picker, animated: true)
            } catch {
                if let file = prepared { try? self.exports.discard(file) }
                call.reject("Could not prepare the backup file. Progress was kept.", nil, error)
            }
        }
    }
    @objc public func openText(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.requests.isPending, let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else { call.reject("Finish the current file picker first."); return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText, .json], asCopy: true)
            picker.allowsMultipleSelection = false; picker.delegate = self
            do { try self.requests.begin(picker, request: GrovePickerRequest(call: call, exportFile: nil)); presenter.present(picker, animated: true) }
            catch { call.reject("Could not open the file picker. Progress was kept.", nil, error) }
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let request = requests.finish(controller) else { return }
        do {
            if let file = request.exportFile { try exports.discard(file) }
            request.call.resolve(request.exportFile != nil ? ["saved": false] : ["cancelled": true])
        } catch { request.call.reject("Could not remove the private temporary backup after cancellation. Progress was kept.", nil, error) }
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let request = requests.finish(controller) else { return }
        let call = request.call
        if let file = request.exportFile {
            do {
                try exports.discard(file)
                if urls.isEmpty { call.reject("No backup destination was confirmed. Progress was kept.") }
                else { call.resolve(["saved": true]) }
            } catch { call.reject(urls.isEmpty ? "Could not remove the private temporary backup. Progress was kept." : "The backup file was saved, but its private temporary copy could not be removed. Your progress is unchanged.", urls.isEmpty ? "GROVE_EXPORT_STAGING" : "GROVE_EXPORT_SAVED", error) }
            return
        }
        guard let url = urls.first else { call.reject("No document was selected."); return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            var readError: Error?, text: String?, coordinateError: NSError?
            NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinateError) { readable in
                do {
                    let data = try Data(contentsOf: readable, options: .mappedIfSafe)
                    guard data.count <= limit else { throw failure("This file is too large to preview safely (64 MiB maximum). The original was kept.") }
                    text = try Self.decodeBackupText(data)
                } catch { readError = error }
            }
            if let error = coordinateError ?? readError as NSError? { throw error }
            guard let text else { throw failure("Could not read the selected document.") }
            call.resolve(["cancelled": false, "text": text])
        } catch { call.reject(error.localizedDescription, nil, error) }
    }
    @objc public func clearTemporaryFiles(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.requests.isPending else { call.reject("Finish the current file picker before erasing this device."); return }
            do { try self.exports.clear(); call.resolve() }
            catch { call.reject("Could not remove all private temporary backups. Progress has not been erased.", nil, error) }
        }
    }
    @objc public func rawRecovery(_ call: CAPPluginCall) {
        do {
            let directory = try databaseDirectory()
            var files: [[String: String]] = []
            for suffix in ["", "-wal", "-shm"] {
                let name = "mandarin_groveSQLite.db" + suffix, url = directory.appendingPathComponent("mandarin_groveSQLite.db" + suffix)
                guard FileManager.default.fileExists(atPath: url.path) else { continue }
                let data = try Data(contentsOf: url, options: .mappedIfSafe)
                guard data.count <= limit else { throw failure("A recovery file exceeds the safe export limit. All original files were kept.") }
                files.append(["name": name, "base64": data.base64EncodedString(), "sha256": SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()])
            }
            guard !files.isEmpty else { throw failure("No native database files were found. Nothing was erased or replaced.") }
            call.resolve(["format": "mandarin-grove-native-files-v1", "files": files])
        } catch { call.reject(error.localizedDescription, nil, error) }
    }
}
