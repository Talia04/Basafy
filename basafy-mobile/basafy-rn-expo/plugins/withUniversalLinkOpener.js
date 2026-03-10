/**
 * Config plugin: UniversalLinkOpener
 * Injects UniversalLinkOpener.m into the iOS project on every `expo prebuild`.
 */
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const FILENAME = 'UniversalLinkOpener.m';

const SOURCE = `#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface UniversalLinkOpener : NSObject <RCTBridgeModule>
@end

@implementation UniversalLinkOpener

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(openUniversalLink:(NSString *)urlString
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    reject(@"INVALID_URL", @"Invalid URL", nil);
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    [[UIApplication sharedApplication]
      openURL:url
      options:@{UIApplicationOpenURLOptionUniversalLinksOnly: @YES}
      completionHandler:^(BOOL success) {
        resolve(@(success));
      }];
  });
}

@end
`;

module.exports = function withUniversalLinkOpener(config) {
  // 1. Write the file into ios/<ProjectName>/
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const iosProjectDir = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
      );
      fs.writeFileSync(path.join(iosProjectDir, FILENAME), SOURCE);
      return config;
    },
  ]);

  // 2. Register it in the .xcodeproj
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;
    const filePath = `${projectName}/${FILENAME}`;

    const refs = xcodeProject.pbxFileReferenceSection();
    const alreadyAdded = Object.values(refs).some(
      (ref) => ref && (ref.path === `"${FILENAME}"` || ref.path === FILENAME),
    );

    if (!alreadyAdded) {
      const groupKey = xcodeProject.findPBXGroupKey({ name: projectName });
      if (groupKey) {
        xcodeProject.addSourceFile(filePath, {}, groupKey);
      }
    }

    return config;
  });

  return config;
};
