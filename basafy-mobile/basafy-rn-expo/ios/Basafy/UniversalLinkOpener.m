#import <React/RCTBridgeModule.h>
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

RCT_EXPORT_METHOD(copyToClipboard:(NSString *)text
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIPasteboard generalPasteboard].string = text;
    resolve(@(YES));
  });
}

@end
