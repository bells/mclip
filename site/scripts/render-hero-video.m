#import <AppKit/AppKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <unistd.h>

static const CGFloat CanvasWidth = 1280.0;
static const CGFloat CanvasHeight = 960.0;

static CGFloat clamp01(CGFloat value) {
  return MAX(0.0, MIN(1.0, value));
}

static CGFloat smoothstep(CGFloat edge0, CGFloat edge1, CGFloat value) {
  CGFloat t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
}

static NSColor *color(CGFloat red, CGFloat green, CGFloat blue, CGFloat alpha) {
  return [NSColor colorWithCalibratedRed:red green:green blue:blue alpha:alpha];
}

static void roundedRect(NSRect rect, CGFloat radius, NSColor *fill, NSColor *stroke) {
  NSBezierPath *path = [NSBezierPath bezierPathWithRoundedRect:rect xRadius:radius yRadius:radius];
  if (fill != nil) {
    [fill setFill];
    [path fill];
  }
  if (stroke != nil) {
    [stroke setStroke];
    path.lineWidth = 1.0;
    [path stroke];
  }
}

static void line(NSPoint start, NSPoint end, CGFloat width, NSColor *stroke) {
  NSBezierPath *path = [NSBezierPath bezierPath];
  [path moveToPoint:start];
  [path lineToPoint:end];
  path.lineWidth = width;
  path.lineCapStyle = NSLineCapStyleRound;
  [stroke setStroke];
  [path stroke];
}

static void text(NSString *value,
                 NSRect rect,
                 CGFloat size,
                 NSFontWeight weight,
                 NSColor *ink,
                 NSTextAlignment alignment) {
  NSMutableParagraphStyle *paragraph = [[NSMutableParagraphStyle alloc] init];
  paragraph.alignment = alignment;
  paragraph.lineBreakMode = NSLineBreakByTruncatingTail;
  NSDictionary *attributes = @{
    NSFontAttributeName : [NSFont systemFontOfSize:size weight:weight],
    NSForegroundColorAttributeName : ink,
    NSParagraphStyleAttributeName : paragraph,
  };
  [value drawWithRect:rect
              options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingTruncatesLastVisibleLine
           attributes:attributes];
}

static void searchIcon(NSPoint center, CGFloat opacity) {
  NSColor *accent = color(0.45, 0.82, 0.79, opacity);
  NSBezierPath *circle = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(center.x - 8.0, center.y - 8.0, 16.0, 16.0)];
  circle.lineWidth = 2.5;
  [accent setStroke];
  [circle stroke];
  line(NSMakePoint(center.x + 6.0, center.y + 6.0), NSMakePoint(center.x + 12.0, center.y + 12.0), 2.5, accent);
}

static void drawWindowShadow(NSRect rect, CGFloat radius, CGFloat opacity) {
  [NSGraphicsContext saveGraphicsState];
  NSShadow *shadow = [[NSShadow alloc] init];
  shadow.shadowBlurRadius = 34.0;
  shadow.shadowOffset = NSMakeSize(0.0, 18.0);
  shadow.shadowColor = color(0.0, 0.0, 0.0, opacity * 0.62);
  [shadow set];
  roundedRect(rect, radius, color(0.02, 0.03, 0.025, opacity), nil);
  [NSGraphicsContext restoreGraphicsState];
}

static void drawMainWindow(NSImage *appIcon, CGFloat progress, CGFloat opacity) {
  CGFloat entrance = smoothstep(0.02, 0.12, progress);
  CGFloat filtered = smoothstep(0.29, 0.38, progress);
  CGFloat x = 28.0;
  CGFloat y = 28.0 + (1.0 - entrance) * 34.0;
  CGFloat width = 444.0;
  CGFloat height = 842.0 - filtered * 128.0;
  NSRect frame = NSMakeRect(x, y, width, height);

  drawWindowShadow(frame, 25.0, opacity);
  roundedRect(frame, 25.0, color(0.018, 0.021, 0.020, opacity), color(0.17, 0.19, 0.18, opacity));

  NSRect iconRect = NSMakeRect(x + 14.0, y + 14.0, 44.0, 44.0);
  roundedRect(iconRect, 11.0, color(0.07, 0.09, 0.075, opacity), color(0.23, 0.28, 0.25, opacity));
  [appIcon drawInRect:NSInsetRect(iconRect, 5.0, 5.0)
             fromRect:NSZeroRect
            operation:NSCompositingOperationSourceOver
             fraction:opacity
       respectFlipped:YES
                hints:nil];
  text(@"mclip", NSMakeRect(x + 68.0, y + 23.0, 76.0, 28.0), 20.0, NSFontWeightBold,
       color(0.94, 0.95, 0.92, opacity), NSTextAlignmentLeft);

  NSRect searchRect = NSMakeRect(x + 142.0, y + 10.0, width - 154.0, 52.0);
  roundedRect(searchRect, 15.0, color(0.035, 0.039, 0.038, opacity), color(0.24, 0.28, 0.27, opacity));
  searchIcon(NSMakePoint(searchRect.origin.x + 26.0, searchRect.origin.y + 25.0), opacity * 0.72);

  CGFloat typing = smoothstep(0.16, 0.31, progress);
  NSString *query = @"";
  if (typing > 0.02) {
    NSArray<NSString *> *steps = @[ @"o", @"op", @"ope", @"open", @"opens", @"opensp", @"openspe", @"openspec" ];
    NSUInteger index = MIN(steps.count - 1, (NSUInteger)floor(typing * steps.count));
    query = steps[index];
  }
  NSString *searchText = query.length > 0 ? query : @"Search clipboard history…";
  NSColor *searchInk = query.length > 0 ? color(0.93, 0.94, 0.91, opacity) : color(0.59, 0.62, 0.59, opacity);
  text(searchText, NSMakeRect(searchRect.origin.x + 50.0, searchRect.origin.y + 14.0, 225.0, 28.0), 17.0,
       NSFontWeightMedium, searchInk, NSTextAlignmentLeft);
  if (query.length > 0) {
    text(@"×", NSMakeRect(NSMaxX(searchRect) - 34.0, searchRect.origin.y + 11.0, 24.0, 30.0), 20.0,
         NSFontWeightRegular, color(0.40, 0.44, 0.42, opacity), NSTextAlignmentCenter);
  }
  if (progress > 0.14 && progress < 0.76) {
    CGFloat cursorX = searchRect.origin.x + 51.0 + MIN(130.0, query.length * 13.8);
    line(NSMakePoint(cursorX, searchRect.origin.y + 13.0), NSMakePoint(cursorX, searchRect.origin.y + 39.0), 1.5,
         color(0.90, 0.92, 0.88, opacity));
  }

  line(NSMakePoint(x, y + 74.0), NSMakePoint(x + width, y + 74.0), 1.0, color(0.14, 0.16, 0.15, opacity));

  NSArray<NSString *> *defaultRows = @[
    @"Image 441×1200",
    @"Image 501×1200",
    @"Performance optimization is complete…",
    @"export http_proxy=http://127.0.0.1:1087;…",
    @"2. Generate a product demo video",
    @"Image 1200×753",
    @"Review layout, spacing, and colors…",
    @"IMG_1363.HEIC +83",
    @"Image 463×1200",
  ];
  NSSet<NSNumber *> *imageRows = [NSSet setWithArray:@[ @0, @1, @5, @8 ]];
  NSArray<NSNumber *> *defaultRowHeights = @[ @70.0, @70.0, @44.0, @44.0, @44.0, @70.0, @44.0, @44.0, @70.0 ];
  CGFloat selected = smoothstep(0.38, 0.47, progress);

  CGFloat defaultRowY = y + 84.0;
  for (NSUInteger index = 0; index < defaultRows.count; index += 1) {
    CGFloat rowHeight = defaultRowHeights[index].doubleValue;
    CGFloat rowOpacity = opacity * (1.0 - filtered);
    CGFloat textY = defaultRowY + 7.0;
    CGFloat numberY = defaultRowY + 8.0;
    CGFloat labelX = x + 50.0;
    if ([imageRows containsObject:@(index)]) {
      NSRect thumbnail = NSMakeRect(x + 50.0, defaultRowY + 3.0, 58.0, 62.0);
      roundedRect(thumbnail, 7.0, color(0.028, 0.031, 0.030, rowOpacity), color(0.16, 0.18, 0.17, rowOpacity));
      roundedRect(NSInsetRect(thumbnail, 7.0, 7.0), 5.0,
                  color(0.09, 0.13, 0.08, rowOpacity), color(0.35, 0.48, 0.24, rowOpacity));
      line(NSMakePoint(NSMinX(thumbnail) + 12.0, NSMaxY(thumbnail) - 17.0),
           NSMakePoint(NSMidX(thumbnail) - 1.0, NSMidY(thumbnail) + 2.0), 2.0,
           color(0.63, 0.74, 0.43, rowOpacity));
      line(NSMakePoint(NSMidX(thumbnail) - 1.0, NSMidY(thumbnail) + 2.0),
           NSMakePoint(NSMaxX(thumbnail) - 10.0, NSMaxY(thumbnail) - 23.0), 2.0,
           color(0.63, 0.74, 0.43, rowOpacity));
      labelX = x + 120.0;
      textY = defaultRowY + 22.0;
      numberY = defaultRowY + 23.0;
    }
    text([NSString stringWithFormat:@"%lu.", (unsigned long)(index + 1)],
         NSMakeRect(x + 10.0, numberY, 34.0, 26.0), 16.0, NSFontWeightSemibold,
         color(0.88, 0.65, 0.28, rowOpacity), NSTextAlignmentLeft);
    text(defaultRows[index], NSMakeRect(labelX, textY, x + width - labelX - 16.0, 28.0), 16.0, NSFontWeightMedium,
         color(0.87, 0.88, 0.85, rowOpacity), NSTextAlignmentLeft);
    defaultRowY += rowHeight;
  }

  NSArray<NSString *> *searchRows = @[
    @"v0.1.1 core features are nearly complete…",
    @"openspec",
    @"# OpenSpec Proposal: Atoms / Hashiwokakero…",
    @"# OpenSpec Proposal: Atoms / Hashiwokakero…",
    @"# OpenSpec Proposal: Atoms / Hashiwokakero…",
    @"# OpenSpec Proposal: Atoms / Hashiwokakero…",
    @"Codex, after reviewing Almanac carefully…",
    @"# OpenSpec Proposal: Snap / Zip…",
    @"# OpenSpec Proposal: Atoms / Hashiwokakero…",
    @"Codex, after reviewing Almanac carefully…",
  ];
  NSArray<NSNumber *> *searchNumbers = @[ @68, @70, @77, @78, @80, @82, @85, @86, @88, @89 ];
  CGFloat searchRowY = y + 84.0;
  for (NSUInteger index = 0; index < searchRows.count; index += 1) {
    CGFloat rowOpacity = opacity * filtered;
    if (index == 2 && selected > 0.01) {
      roundedRect(NSMakeRect(x + 1.0, searchRowY - 1.0, width - 2.0, 42.0), 10.0,
                  color(0.08, 0.16, 0.15, opacity * filtered * selected),
                  color(0.26, 0.64, 0.61, opacity * filtered * selected));
    }
    text([NSString stringWithFormat:@"%@.", searchNumbers[index]],
         NSMakeRect(x + 10.0, searchRowY + 8.0, 42.0, 26.0), 16.0, NSFontWeightSemibold,
         color(0.88, 0.65, 0.28, rowOpacity), NSTextAlignmentLeft);
    text(searchRows[index], NSMakeRect(x + 52.0, searchRowY + 7.0, width - 66.0, 28.0), 16.0,
         NSFontWeightMedium, color(0.87, 0.88, 0.85, rowOpacity), NSTextAlignmentLeft);
    searchRowY += 44.0;
  }

  CGFloat defaultDividerY = defaultRowY + 2.0;
  line(NSMakePoint(x + 6.0, defaultDividerY), NSMakePoint(x + width - 6.0, defaultDividerY), 1.0,
       color(0.14, 0.16, 0.15, opacity * (1.0 - filtered)));
  NSArray<NSString *> *defaultGroups = @[ @"11 – 30", @"31 – 50", @"51 – 70" ];
  for (NSUInteger index = 0; index < defaultGroups.count; index += 1) {
    CGFloat groupY = defaultRowY + 14.0 + index * 36.0;
    roundedRect(NSMakeRect(x + 11.0, groupY + 5.0, 13.0, 10.0), 2.0, nil,
                color(0.91, 0.66, 0.24, opacity * (1.0 - filtered)));
    text(defaultGroups[index], NSMakeRect(x + 34.0, groupY, 240.0, 26.0), 15.0, NSFontWeightMedium,
         color(0.80, 0.83, 0.79, opacity * (1.0 - filtered)), NSTextAlignmentLeft);
    text(@"›", NSMakeRect(x + width - 38.0, groupY - 1.0, 20.0, 28.0), 22.0, NSFontWeightRegular,
         color(0.58, 0.64, 0.61, opacity * (1.0 - filtered)), NSTextAlignmentCenter);
  }

  CGFloat searchDividerY = searchRowY + 2.0;
  line(NSMakePoint(x + 6.0, searchDividerY), NSMakePoint(x + width - 6.0, searchDividerY), 1.0,
       color(0.14, 0.16, 0.15, opacity * filtered));
  CGFloat searchGroupY = searchRowY + 14.0;
  roundedRect(NSMakeRect(x + 11.0, searchGroupY + 5.0, 13.0, 10.0), 2.0, nil,
              color(0.91, 0.66, 0.24, opacity * filtered));
  text(@"11 – 30", NSMakeRect(x + 34.0, searchGroupY, 240.0, 26.0), 15.0, NSFontWeightMedium,
       color(0.80, 0.83, 0.79, opacity * filtered), NSTextAlignmentLeft);
  text(@"›", NSMakeRect(x + width - 38.0, searchGroupY - 1.0, 20.0, 28.0), 22.0, NSFontWeightRegular,
       color(0.58, 0.64, 0.61, opacity * filtered), NSTextAlignmentCenter);

  CGFloat footerY = y + height - 142.0;
  line(NSMakePoint(x, footerY), NSMakePoint(x + width, footerY), 1.0, color(0.14, 0.16, 0.15, opacity));
  NSArray<NSString *> *actions = @[ @"Clear history", @"Preferences", @"About mclip", @"Quit" ];
  NSArray<NSString *> *hints = @[ @"Delete saved items", @"Language and history", @"Version information", @"Close tray app" ];
  for (NSUInteger index = 0; index < actions.count; index += 1) {
    CGFloat actionY = footerY + 13.0 + index * 32.0;
    text(index == 0 ? @"⌫" : index == 1 ? @"⌘" : index == 2 ? @"ⓘ" : @"⏻",
         NSMakeRect(x + 10.0, actionY, 22.0, 25.0), 14.0, NSFontWeightRegular,
         color(0.58, 0.64, 0.61, opacity), NSTextAlignmentCenter);
    text(actions[index], NSMakeRect(x + 40.0, actionY, 160.0, 26.0), 15.0, NSFontWeightSemibold,
         color(0.80, 0.82, 0.78, opacity), NSTextAlignmentLeft);
    text(hints[index], NSMakeRect(x + 206.0, actionY + 1.0, width - 220.0, 24.0), 13.0, NSFontWeightRegular,
         color(0.55, 0.59, 0.57, opacity), NSTextAlignmentRight);
  }
}

static void drawDetailWindow(CGFloat progress, CGFloat opacity) {
  CGFloat reveal = smoothstep(0.39, 0.52, progress) * (1.0 - smoothstep(0.80, 0.94, progress));
  if (reveal <= 0.001) {
    return;
  }

  CGFloat x = 472.0 + (1.0 - reveal) * 48.0;
  CGFloat y = 200.0;
  CGFloat width = 780.0;
  CGFloat height = 438.0;
  CGFloat alpha = opacity * reveal;
  NSRect frame = NSMakeRect(x, y, width, height);

  drawWindowShadow(frame, 24.0, alpha);
  roundedRect(frame, 24.0, color(0.058, 0.064, 0.062, alpha), color(0.20, 0.23, 0.22, alpha));

  text(@"History detail", NSMakeRect(x + 24.0, y + 20.0, 200.0, 30.0), 18.0, NSFontWeightBold,
       color(0.94, 0.68, 0.29, alpha), NSTextAlignmentLeft);
  text(@"⌫   Text #77", NSMakeRect(x + width - 190.0, y + 20.0, 162.0, 30.0), 18.0, NSFontWeightSemibold,
       color(0.90, 0.91, 0.88, alpha), NSTextAlignmentRight);
  line(NSMakePoint(x, y + 62.0), NSMakePoint(x + width, y + 62.0), 1.0, color(0.16, 0.18, 0.17, alpha));

  roundedRect(NSMakeRect(x + 22.0, y + 82.0, width - 44.0, 202.0), 14.0,
              color(0.035, 0.039, 0.038, alpha), color(0.16, 0.19, 0.18, alpha));
  text(@"# OpenSpec Proposal: Atoms / Hashiwokakero\n\n## 1. Overview\nThis proposal implements the fourth core puzzle in puzl: Atoms.\nPlayers connect numbered atoms in a grid using single or double bonds.",
       NSMakeRect(x + 42.0, y + 103.0, width - 84.0, 152.0), 19.0, NSFontWeightRegular,
       color(0.88, 0.89, 0.86, alpha), NSTextAlignmentLeft);

  NSArray<NSString *> *labels = @[ @"Application", @"First copied", @"Last copied", @"Copy count" ];
  NSArray<NSString *> *values = @[ @"Sublime Text", @"Jul 25, 19:18", @"Jul 25, 19:18", @"1" ];
  for (NSUInteger index = 0; index < labels.count; index += 1) {
    CGFloat rowY = y + 302.0 + index * 30.0;
    text(labels[index], NSMakeRect(x + 24.0, rowY, 180.0, 24.0), 15.0, NSFontWeightSemibold,
         color(0.91, 0.67, 0.29, alpha), NSTextAlignmentLeft);
    text(values[index], NSMakeRect(x + 205.0, rowY, width - 230.0, 24.0), 15.0, NSFontWeightSemibold,
         color(0.78, 0.81, 0.79, alpha), NSTextAlignmentLeft);
  }
}

static void renderFrame(CGContextRef context, NSImage *appIcon, CGFloat progress) {
  CGContextSaveGState(context);
  CGContextTranslateCTM(context, 0.0, CanvasHeight);
  CGContextScaleCTM(context, 1.0, -1.0);
  NSGraphicsContext *graphicsContext = [NSGraphicsContext graphicsContextWithCGContext:context flipped:YES];
  [NSGraphicsContext saveGraphicsState];
  [NSGraphicsContext setCurrentContext:graphicsContext];

  NSGradient *background = [[NSGradient alloc] initWithStartingColor:color(0.025, 0.052, 0.032, 1.0)
                                                      endingColor:color(0.020, 0.027, 0.023, 1.0)];
  [background drawInRect:NSMakeRect(0.0, 0.0, CanvasWidth, CanvasHeight) angle:0.0];

  CGFloat pulse = 0.5 + 0.5 * sin(progress * M_PI * 2.0);
  NSGradient *glow = [[NSGradient alloc] initWithStartingColor:color(0.27, 0.57, 0.10, 0.14 + pulse * 0.04)
                                                 endingColor:color(0.34, 0.67, 0.12, 0.0)];
  [glow drawInRect:NSMakeRect(690.0, 30.0, 690.0, 690.0) relativeCenterPosition:NSMakePoint(0.0, 0.0)];

  CGFloat fadeIn = smoothstep(0.0, 0.07, progress);
  CGFloat fadeOut = 1.0 - smoothstep(0.92, 1.0, progress);
  CGFloat opacity = fadeIn * fadeOut;
  drawMainWindow(appIcon, progress, opacity);
  drawDetailWindow(progress, opacity);

  text(@"SEARCH  →  SELECT  →  PREVIEW", NSMakeRect(766.0, 860.0, 444.0, 24.0), 12.0, NSFontWeightBold,
       color(0.55, 0.70, 0.44, opacity * 0.82), NSTextAlignmentRight);
  text(@"Independent windows. Local history.", NSMakeRect(720.0, 886.0, 490.0, 28.0), 16.0, NSFontWeightSemibold,
       color(0.70, 0.74, 0.69, opacity * 0.84), NSTextAlignmentRight);

  [NSGraphicsContext restoreGraphicsState];
  CGContextRestoreGState(context);
}

static BOOL writePoster(CGImageRef image, NSURL *url, NSError **error) {
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL((__bridge CFURLRef)url,
                                                                       (__bridge CFStringRef)UTTypePNG.identifier,
                                                                       1,
                                                                       NULL);
  if (destination == NULL) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"mclip.video" code:1 userInfo:@{NSLocalizedDescriptionKey : @"Unable to create poster destination"}];
    }
    return NO;
  }
  CGImageDestinationAddImage(destination, image, NULL);
  BOOL success = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  return success;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 4) {
      fprintf(stderr, "usage: render-hero-video <app-icon.png> <output.mp4> <poster.png>\n");
      return 2;
    }

    NSURL *iconURL = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]];
    NSURL *videoURL = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[2]]];
    NSURL *posterURL = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[3]]];
    NSImage *appIcon = [[NSImage alloc] initWithContentsOfURL:iconURL];
    if (appIcon == nil) {
      fprintf(stderr, "unable to load app icon\n");
      return 3;
    }

    NSFileManager *files = [NSFileManager defaultManager];
    [files createDirectoryAtURL:[videoURL URLByDeletingLastPathComponent]
     withIntermediateDirectories:YES
                      attributes:nil
                           error:nil];
    [files removeItemAtURL:videoURL error:nil];
    [files removeItemAtURL:posterURL error:nil];

    NSError *error = nil;
    AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:videoURL fileType:AVFileTypeMPEG4 error:&error];
    if (writer == nil) {
      fprintf(stderr, "%s\n", error.localizedDescription.UTF8String);
      return 4;
    }

    NSDictionary *compression = @{
      AVVideoAverageBitRateKey : @(1.1 * 1000 * 1000),
      AVVideoExpectedSourceFrameRateKey : @30,
      AVVideoMaxKeyFrameIntervalKey : @60,
      AVVideoProfileLevelKey : AVVideoProfileLevelH264HighAutoLevel,
    };
    NSDictionary *settings = @{
      AVVideoCodecKey : AVVideoCodecTypeH264,
      AVVideoWidthKey : @(CanvasWidth),
      AVVideoHeightKey : @(CanvasHeight),
      AVVideoCompressionPropertiesKey : compression,
    };
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:settings];
    input.expectsMediaDataInRealTime = NO;
    NSDictionary *pixelAttributes = @{
      (NSString *)kCVPixelBufferPixelFormatTypeKey : @(kCVPixelFormatType_32BGRA),
      (NSString *)kCVPixelBufferWidthKey : @(CanvasWidth),
      (NSString *)kCVPixelBufferHeightKey : @(CanvasHeight),
      (NSString *)kCVPixelBufferCGImageCompatibilityKey : @YES,
      (NSString *)kCVPixelBufferCGBitmapContextCompatibilityKey : @YES,
    };
    AVAssetWriterInputPixelBufferAdaptor *adaptor =
        [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input
                                                                         sourcePixelBufferAttributes:pixelAttributes];
    if (![writer canAddInput:input]) {
      fprintf(stderr, "unable to add video input\n");
      return 5;
    }
    [writer addInput:input];
    [writer startWriting];
    [writer startSessionAtSourceTime:kCMTimeZero];

    const NSInteger fps = 30;
    const NSInteger frameCount = 240;
    const NSInteger posterFrame = 142;
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    for (NSInteger frame = 0; frame < frameCount; frame += 1) {
      while (!input.readyForMoreMediaData) {
        usleep(1000);
      }

      CVPixelBufferRef pixelBuffer = NULL;
      CVReturn result = CVPixelBufferCreate(kCFAllocatorDefault,
                                            (size_t)CanvasWidth,
                                            (size_t)CanvasHeight,
                                            kCVPixelFormatType_32BGRA,
                                            (__bridge CFDictionaryRef)pixelAttributes,
                                            &pixelBuffer);
      if (result != kCVReturnSuccess || pixelBuffer == NULL) {
        fprintf(stderr, "unable to allocate frame %ld\n", (long)frame);
        return 6;
      }

      CVPixelBufferLockBaseAddress(pixelBuffer, 0);
      void *base = CVPixelBufferGetBaseAddress(pixelBuffer);
      size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
      CGContextRef context = CGBitmapContextCreate(base,
                                                   (size_t)CanvasWidth,
                                                   (size_t)CanvasHeight,
                                                   8,
                                                   bytesPerRow,
                                                   colorSpace,
                                                   kCGBitmapByteOrder32Little | kCGImageAlphaPremultipliedFirst);
      CGFloat progress = (CGFloat)frame / (CGFloat)(frameCount - 1);
      renderFrame(context, appIcon, progress);

      if (frame == posterFrame) {
        CGImageRef poster = CGBitmapContextCreateImage(context);
        if (!writePoster(poster, posterURL, &error)) {
          fprintf(stderr, "unable to write poster\n");
        }
        CGImageRelease(poster);
      }

      CGContextRelease(context);
      CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);
      if (![adaptor appendPixelBuffer:pixelBuffer withPresentationTime:CMTimeMake(frame, (int32_t)fps)]) {
        fprintf(stderr, "unable to append frame %ld: %s\n", (long)frame, writer.error.localizedDescription.UTF8String);
        CVPixelBufferRelease(pixelBuffer);
        return 7;
      }
      CVPixelBufferRelease(pixelBuffer);
    }
    CGColorSpaceRelease(colorSpace);

    [input markAsFinished];
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{
      dispatch_semaphore_signal(semaphore);
    }];
    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    if (writer.status != AVAssetWriterStatusCompleted) {
      fprintf(stderr, "video writer failed: %s\n", writer.error.localizedDescription.UTF8String);
      return 8;
    }

    printf("wrote %s and %s\n", videoURL.path.UTF8String, posterURL.path.UTF8String);
  }
  return 0;
}
