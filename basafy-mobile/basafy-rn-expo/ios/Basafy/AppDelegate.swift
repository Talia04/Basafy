import Expo
import React
import ReactAppDependencyProvider
import GoogleSignIn

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private var lastHandledUrl: (url: String, at: Date)?
  private var lastOauthHandledAt: Date?
  private let duplicateUrlWindow: TimeInterval = 10
  private var pendingOpenUrl: URL?


  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handlePendingOpenUrl),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if app.applicationState != .active {
      pendingOpenUrl = url
      return true
    }
    return handleOpenUrl(app: app, url: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if let url = userActivity.webpageURL {
      if let scheme = url.scheme, scheme.hasPrefix("com.googleusercontent.apps.") {
        if let lastOauth = lastOauthHandledAt, Date().timeIntervalSince(lastOauth) < duplicateUrlWindow {
          return true
        }
        lastOauthHandledAt = Date()
        lastHandledUrl = (url.absoluteString, Date())
        return super.application(application, continue: userActivity, restorationHandler: restorationHandler)
      }
      if let last = lastHandledUrl, last.url == url.absoluteString, Date().timeIntervalSince(last.at) < duplicateUrlWindow {
        return true
      }
      lastHandledUrl = (url.absoluteString, Date())
    }
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  @objc private func handlePendingOpenUrl() {
    guard let url = pendingOpenUrl else { return }
    pendingOpenUrl = nil
    _ = handleOpenUrl(app: UIApplication.shared, url: url, options: [:])
  }

  private func handleOpenUrl(
    app: UIApplication,
    url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any]
  ) -> Bool {
    if GIDSignIn.sharedInstance.handle(url) {
      return true
    }
    if let scheme = url.scheme, scheme.hasPrefix("com.googleusercontent.apps.") {
      if let lastOauth = lastOauthHandledAt, Date().timeIntervalSince(lastOauth) < duplicateUrlWindow {
        return true
      }
      lastOauthHandledAt = Date()
      lastHandledUrl = (url.absoluteString, Date())
      return super.application(app, open: url, options: options)
    }
    if let last = lastHandledUrl, last.url == url.absoluteString, Date().timeIntervalSince(last.at) < duplicateUrlWindow {
      return true
    }
    lastHandledUrl = (url.absoluteString, Date())
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
