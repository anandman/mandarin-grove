#!/usr/bin/env swift
// Package the existing approved artwork. Run from the repository root on macOS.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceURL = root.appendingPathComponent("icon1024.png")
guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let artwork = CGImageSourceCreateImageAtIndex(source, 0, nil),
      artwork.width == 1024, artwork.height == 1024 else {
    fatalError("Expected the approved 1024px Grove icon")
}
let colors = CGColorSpace(name: CGColorSpace.sRGB)!
var generated = 0
func render(_ relative: String, width: Int, height: Int, artworkSize: Int) throws {
    let output = root.appendingPathComponent(relative)
    guard FileManager.default.fileExists(atPath: output.path) else {
        throw NSError(domain: "GroveBranding", code: 1, userInfo: [NSLocalizedDescriptionKey: "Refuse unexpected asset path: " + relative])
    }
    // Opaque output is required for the App Store marketing icon. The same
    // dark background also surrounds the artwork in adaptive-icon safe areas.
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: colors, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.setFillColor(CGColor(colorSpace: colors, components: [20/255,22/255,26/255,1])!)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(artwork, in: CGRect(x: (width-artworkSize)/2, y: (height-artworkSize)/2,
        width: artworkSize, height: artworkSize))
    let image = context.makeImage()!
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "GroveBranding", code: 2)
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw NSError(domain: "GroveBranding", code: 3) }
    generated += 1
}

try render("mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", width: 1024, height: 1024, artworkSize: 1024)
for name in ["splash-2732x2732.png","splash-2732x2732-1.png","splash-2732x2732-2.png"] {
    try render("mobile/ios/App/App/Assets.xcassets/Splash.imageset/" + name, width: 2732, height: 2732, artworkSize: 512)
}
for (density, icon, foreground, safeArtwork) in [
    ("mdpi",48,108,66),("hdpi",72,162,99),("xhdpi",96,216,132),
    ("xxhdpi",144,324,198),("xxxhdpi",192,432,264)
] {
    let base = "mobile/android/app/src/main/res/mipmap-" + density + "/"
    for name in ["ic_launcher.png","ic_launcher_round.png"] {
        try render(base + name, width: icon, height: icon, artworkSize: icon)
    }
    try render(base + "ic_launcher_foreground.png", width: foreground, height: foreground, artworkSize: safeArtwork)
}
let resourceRoot = root.appendingPathComponent("mobile/android/app/src/main/res")
let folders = try FileManager.default.contentsOfDirectory(at: resourceRoot, includingPropertiesForKeys: nil)
for folder in folders where folder.lastPathComponent == "drawable" || folder.lastPathComponent.hasPrefix("drawable-port-") || folder.lastPathComponent.hasPrefix("drawable-land-") {
    let splash = folder.appendingPathComponent("splash.png")
    guard FileManager.default.fileExists(atPath: splash.path),
          let input = CGImageSourceCreateWithURL(splash as CFURL, nil),
          let old = CGImageSourceCreateImageAtIndex(input, 0, nil) else { continue }
    try render("mobile/android/app/src/main/res/" + folder.lastPathComponent + "/splash.png",
        width: old.width, height: old.height, artworkSize: min(old.width, old.height)/4)
}
print("Packaged approved Grove artwork into \(generated) opaque icon/launch PNGs; source artwork unchanged")
