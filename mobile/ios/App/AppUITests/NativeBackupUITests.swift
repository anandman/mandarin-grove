import XCTest

final class NativeBackupUITests: XCTestCase {
    @MainActor private func requireGroveContent(_ app: XCUIApplication, context: String,
                                               timeout: TimeInterval = 30,
                                               file: StaticString = #filePath, line: UInt = #line) -> Bool {
        guard app.webViews.buttons["Report a problem"].waitForExistence(timeout: timeout) else {
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "Grove content unavailable " + context
            tree.lifetime = .keepAlways
            add(tree)
            if app.state == .runningForeground {
                let screenshot = XCTAttachment(screenshot: app.screenshot())
                screenshot.name = "Grove readiness failure " + context
                screenshot.lifetime = .keepAlways
                add(screenshot)
            }
            XCTFail("Grove content is not accessible \(context). A WebView container alone is not readiness.", file: file, line: line)
            return false
        }
        return true
    }

    @MainActor func testInstalledDeviceRotationPreservesVisibleApp() throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        continueAfterFailure = false
        let device = XCUIDevice.shared, original = XCUIDevice.shared.orientation
        defer { device.orientation = original == .unknown ? .portrait : original }
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        device.orientation = .portrait
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20), app.debugDescription)
        guard requireGroveContent(app, context: "before rotation") else { return }
        let portrait = web.frame
        XCTAssertLessThan(portrait.width, portrait.height)
        device.orientation = .landscapeLeft
        let wide = expectation(for: NSPredicate { _, _ in web.frame.width > web.frame.height }, evaluatedWith: web)
        wait(for: [wide], timeout: 10)
        guard requireGroveContent(app, context: "after landscape rotation", timeout: 10) else { return }
        let landscape = XCTAttachment(screenshot: app.screenshot()); landscape.name = "Actual iPad device rotation at system text size"; landscape.lifetime = .keepAlways; add(landscape)
        let frames = XCTAttachment(string: "Portrait: \(portrait); landscape: \(web.frame)"); frames.name = "Actual installed viewport frames"; frames.lifetime = .keepAlways; add(frames)
        device.orientation = .portrait
        let tall = expectation(for: NSPredicate { _, _ in web.frame.width < web.frame.height }, evaluatedWith: web)
        wait(for: [tall], timeout: 10)
        guard requireGroveContent(app, context: "after returning to portrait", timeout: 10) else { return }
        XCTAssertEqual(web.frame.width, portrait.width, accuracy: 2)
        XCTAssertEqual(web.frame.height, portrait.height, accuracy: 2)
    }
    @MainActor func testFeedbackSystemFileAndShareCancellation() throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        app.launch()
        let report = app.webViews.buttons["Report a problem"].firstMatch
        XCTAssertTrue(report.waitForExistence(timeout: 20), app.debugDescription); report.tap()
        let category = app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Something did not work")).firstMatch
        XCTAssertTrue(category.waitForExistence(timeout: 10), app.debugDescription); category.tap()
        let note = app.webViews.textViews.firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 10)); note.tap(); note.typeText("Synthetic native feedback manual proof")
        let hideKeyboard = app.buttons["Hide keyboard"]
        if hideKeyboard.waitForExistence(timeout: 2), hideKeyboard.isHittable, hideKeyboard.frame.minY < app.frame.maxY { hideKeyboard.tap() }
        let manual = app.webViews.buttons.matching(NSPredicate(format: "label == %@ AND value != nil", "Grown-ups: saved reports & manual sharing")).firstMatch
        XCTAssertTrue(manual.waitForExistence(timeout: 10), app.debugDescription); manual.tap()
        let details = app.webViews.buttons.matching(NSPredicate(format: "label == %@ AND value != nil", "Report details")).firstMatch
        XCTAssertTrue(details.waitForExistence(timeout: 10), app.debugDescription); details.tap()
        let output = app.webViews.textViews["Feedback report"]
        XCTAssertTrue(output.waitForExistence(timeout: 10), app.debugDescription)
        let expected = try XCTUnwrap(output.value as? String)
        XCTAssertTrue(expected.contains("Synthetic native feedback manual proof"))
        let raw = XCTAttachment(string: expected); raw.name = "Expected exact feedback file"; raw.lifetime = .keepAlways; add(raw)
        let download = app.webViews.buttons["Save report file"]
        download.tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription); cancel.tap()
        XCTAssertTrue(app.webViews.staticTexts["Report file save cancelled. Your local reports were kept."].waitForExistence(timeout: 10), app.debugDescription)
        download.tap()
        let save = app.buttons["DOCPicker.actionButton"], filename = app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(save.waitForExistence(timeout: 15), app.debugDescription); XCTAssertEqual(save.label, "Save"); XCTAssertTrue(filename.exists)
        let local = app.cells["DOC.sidebar.item.On My iPad"]
        if local.exists { local.tap() }
        let oldName = filename.value as? String ?? "", unique = "grove-feedback-ios-" + UUID().uuidString.lowercased()
        filename.tap(); filename.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: oldName.count + 10)); filename.typeText(unique)
        XCTAssertTrue((filename.value as? String)?.contains(unique) == true, "Use a new unique filename; never overwrite an earlier file")
        print("GROVE_FEEDBACK_EXPORT_STEM:" + unique)
        save.tap()
        XCTAssertTrue(app.webViews.staticTexts["Report file saved. Keep its local details private."].waitForExistence(timeout: 15), app.debugDescription)
        app.webViews.buttons["Share report"].tap()
        let openShare = app.webViews.buttons["Open share sheet"]
        XCTAssertTrue(openShare.waitForExistence(timeout: 10), app.debugDescription); openShare.tap()
        let close = app.otherElements["PopoverDismissRegion"]
        XCTAssertTrue(close.waitForExistence(timeout: 15), app.debugDescription)
        let shared = XCTAttachment(screenshot: app.screenshot()); shared.name = "Actual iPad share sheet, no recipient selected"; shared.lifetime = .keepAlways; add(shared)
        close.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.1)).tap()
        XCTAssertTrue(app.webViews.staticTexts["Share sheet closed. Grove does not confirm delivery. Your local reports were kept."].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(output.value as? String, expected, "File and share actions preserve the full raw local report")
    }
    @MainActor func testSystemBackupTransferAndCancel() throws {
        let syntheticDevices = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], syntheticDevices.contains(simulator) else {
            throw XCTSkip("This file-replacement test is restricted to the dedicated synthetic simulators")
        }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        app.launch()
        guard requireGroveContent(app, context: "before backup transfer") else { return }
        let gear = app.webViews.buttons["Grown-ups settings, press and hold or activate with keyboard"]
        XCTAssertTrue(gear.waitForExistence(timeout: 20), app.debugDescription)
        gear.press(forDuration: 2.2)
        let backupSection = app.webViews.buttons["Backup"]
        XCTAssertTrue(backupSection.waitForExistence(timeout: 10), app.debugDescription)
        backupSection.tap()
        let export = app.webViews.buttons["Download backup file"]
        XCTAssertTrue(export.waitForExistence(timeout: 10))
        export.tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Actual system backup export picker"; screenshot.lifetime = .keepAlways; add(screenshot)
        cancel.tap()
        XCTAssertTrue(app.webViews.staticTexts["Backup save cancelled. Your progress is unchanged."].waitForExistence(timeout: 10), app.debugDescription)
        app.webViews.buttons["Restore from backup file"].tap()
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        let opened = XCTAttachment(screenshot: app.screenshot()); opened.name = "Actual system backup import picker"; opened.lifetime = .keepAlways; add(opened)
        cancel.tap()
        XCTAssertTrue(app.webViews.buttons["Download backup file"].waitForExistence(timeout: 10))

        // Save through the actual system Files UI. A previous file is never
        // replaced automatically; any unexpected overwrite prompt fails here.
        export.tap()
        let save = app.buttons["DOCPicker.actionButton"]
        XCTAssertTrue(save.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(save.label, "Save")
        let filename = app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(filename.exists)
        let oldName = filename.value as? String ?? ""
        let unique = "grove-native-ios-" + UUID().uuidString.lowercased()
        filename.tap(); filename.press(forDuration: 1.1)
        if app.menuItems["Select All"].exists { app.menuItems["Select All"].tap() }
        else if app.buttons["Select All"].exists { app.buttons["Select All"].tap() }
        filename.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: oldName.count + 10))
        filename.typeText(unique)
        XCTAssertTrue((filename.value as? String)?.contains(unique) == true, "Use a new unique filename; never overwrite a prior backup")
        print("GROVE_OS_EXPORT_STEM:" + unique)
        save.tap()
        XCTAssertTrue(app.webViews.staticTexts["Backup file saved. It includes every child’s progress and names."].waitForExistence(timeout: 15), app.debugDescription)

        // Import the file that Files just saved. This is the normal backup
        // round trip, without injecting a URL or calling the picker delegate.
        // The separate hosted test covers exact BOM/CRLF decoding.
        app.webViews.buttons["Restore from backup file"].tap()
        let local = app.cells["DOC.sidebar.item.On My iPad"]
        XCTAssertTrue(local.waitForExistence(timeout: 15), app.debugDescription)
        local.tap()
        let original = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", unique)).firstMatch
        XCTAssertTrue(original.waitForExistence(timeout: 10), app.debugDescription)
        original.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).tap()
        let replace = app.webViews.buttons["Replace all device progress"]
        if !replace.waitForExistence(timeout: 3) {
            let open = app.buttons["DOCPicker.actionButton"]
            if open.exists && open.label == "Open" { open.tap() }
            else if original.exists { original.doubleTap() }
        }
        XCTAssertTrue(replace.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Synthetic Learner B")).firstMatch.exists)
        replace.tap()
        let closed = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: app.webViews.buttons["Close"])
        wait(for: [closed], timeout: 15)
        XCTAssertTrue(app.webViews.buttons["Practice"].waitForExistence(timeout: 10), app.debugDescription)
        let restored = XCTAttachment(screenshot: app.screenshot()); restored.name = "Restored OS-saved backup through actual Files picker"; restored.lifetime = .keepAlways; add(restored)
    }
}
