#import <AppKit/AppKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <unistd.h>

static const CGFloat CanvasWidth = 1280.0;
static const CGFloat CanvasHeight = 720.0;

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
  NSBezierPath *circle = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(center.x - 13.0, center.y - 13.0, 26.0, 26.0)];
  circle.lineWidth = 4.0;
  [accent setStroke];
  [circle stroke];
  line(NSMakePoint(center.x + 9.0, center.y + 9.0), NSMakePoint(center.x + 20.0, center.y + 20.0), 4.0, accent);
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
  CGFloat x = 66.0;
  CGFloat y = 58.0 + (1.0 - entrance) * 28.0;
  CGFloat width = 510.0;
  CGFloat height = 544.0;
  NSRect frame = NSMakeRect(x, y, width, height);

  drawWindowShadow(frame, 30.0, opacity);
  roundedRect(frame, 30.0, color(0.052, 0.061, 0.057, opacity), color(0.25, 0.31, 0.28, opacity));

  NSRect iconRect = NSMakeRect(x + 22.0, y + 20.0, 58.0, 58.0);
  roundedRect(iconRect, 15.0, color(0.07, 0.09, 0.075, opacity), color(0.23, 0.28, 0.25, opacity));
  [appIcon drawInRect:NSInsetRect(iconRect, 5.0, 5.0)
             fromRect:NSZeroRect
            operation:NSCompositingOperationSourceOver
             fraction:opacity
       respectFlipped:YES
                hints:nil];
  text(@"mclip", NSMakeRect(x + 92.0, y + 31.0, 104.0, 30.0), 24.0, NSFontWeightBold,
       color(0.94, 0.95, 0.92, opacity), NSTextAlignmentLeft);

  NSRect searchRect = NSMakeRect(x + 202.0, y + 18.0, 284.0, 64.0);
  roundedRect(searchRect, 18.0, color(0.035, 0.045, 0.042, opacity), color(0.32, 0.72, 0.69, opacity));
  searchIcon(NSMakePoint(searchRect.origin.x + 29.0, searchRect.origin.y + 28.0), opacity);

  CGFloat typing = smoothstep(0.16, 0.31, progress);
  NSString *query = @"";
  if (typing > 0.02) {
    NSArray<NSString *> *steps = @[ @"r", @"re", @"rel", @"rele", @"relea", @"release" ];
    NSUInteger index = MIN(steps.count - 1, (NSUInteger)floor(typing * steps.count));
    query = steps[index];
  }
  NSString *searchText = query.length > 0 ? query : @"Search clipboard history…";
  NSColor *searchInk = query.length > 0 ? color(0.93, 0.94, 0.91, opacity) : color(0.59, 0.62, 0.59, opacity);
  text(searchText, NSMakeRect(searchRect.origin.x + 58.0, searchRect.origin.y + 18.0, 210.0, 32.0), 20.0,
       NSFontWeightMedium, searchInk, NSTextAlignmentLeft);
  if (progress > 0.14 && progress < 0.76) {
    CGFloat cursorX = searchRect.origin.x + 60.0 + MIN(128.0, query.length * 16.8);
    line(NSMakePoint(cursorX, searchRect.origin.y + 16.0), NSMakePoint(cursorX, searchRect.origin.y + 47.0), 2.0,
         color(0.90, 0.92, 0.88, opacity));
  }

  line(NSMakePoint(x, y + 102.0), NSMakePoint(x + width, y + 102.0), 1.0, color(0.20, 0.24, 0.22, opacity));

  NSArray<NSString *> *rows = @[
    @"Release checklist for v0.1.1",
    @"mclip-cli agent --last 5 --json",
    @"Image 1200×754",
    @"Design notes.md +2",
    @"System / Light / Dark",
  ];
  NSArray<NSString *> *kinds = @[ @"TEXT", @"TEXT", @"IMAGE", @"FILES", @"TEXT" ];
  NSArray<NSNumber *> *rowHeights = @[ @44.0, @44.0, @96.0, @44.0, @44.0 ];
  CGFloat filtered = smoothstep(0.29, 0.38, progress);
  CGFloat selected = smoothstep(0.34, 0.43, progress);
  CGFloat rowY = y + 116.0;
  for (NSUInteger index = 0; index < rows.count; index += 1) {
    CGFloat rowHeight = rowHeights[index].doubleValue;
    CGFloat rowOpacity = index == 0 ? opacity : opacity * (1.0 - filtered * 0.78);
    if (index == 0 && selected > 0.01) {
      roundedRect(NSMakeRect(x + 12.0, rowY, width - 24.0, 38.0), 9.0,
                  color(0.22, 0.30, 0.16, opacity * selected), color(0.46, 0.67, 0.28, opacity * selected));
    }
    CGFloat textY = rowY + 5.0;
    CGFloat numberY = rowY + 7.0;
    CGFloat labelX = x + 68.0;
    if (index == 2) {
      NSRect thumbnail = NSMakeRect(x + 68.0, rowY + 7.0, 74.0, 82.0);
      roundedRect(thumbnail, 10.0, color(0.035, 0.043, 0.039, rowOpacity), color(0.28, 0.35, 0.31, rowOpacity));
      roundedRect(NSInsetRect(thumbnail, 10.0, 12.0), 7.0,
                  color(0.22, 0.34, 0.13, rowOpacity), color(0.48, 0.68, 0.29, rowOpacity));
      line(NSMakePoint(NSMinX(thumbnail) + 15.0, NSMaxY(thumbnail) - 23.0),
           NSMakePoint(NSMidX(thumbnail) - 2.0, NSMidY(thumbnail) + 3.0), 3.0,
           color(0.72, 0.86, 0.47, rowOpacity));
      line(NSMakePoint(NSMidX(thumbnail) - 2.0, NSMidY(thumbnail) + 3.0),
           NSMakePoint(NSMaxX(thumbnail) - 14.0, NSMaxY(thumbnail) - 31.0), 3.0,
           color(0.72, 0.86, 0.47, rowOpacity));
      labelX = x + 158.0;
      textY = rowY + 30.0;
      numberY = rowY + 32.0;
    }
    text([NSString stringWithFormat:@"%lu.", (unsigned long)(index + 1)],
         NSMakeRect(x + 24.0, numberY, 38.0, 28.0), 19.0, NSFontWeightSemibold,
         color(0.77, 0.57, 0.27, rowOpacity), NSTextAlignmentLeft);
    text(rows[index], NSMakeRect(labelX, textY, index == 2 ? 240.0 : 330.0, 30.0), 20.0, NSFontWeightMedium,
         color(0.87, 0.88, 0.85, rowOpacity), NSTextAlignmentLeft);
    text(kinds[index], NSMakeRect(x + 402.0, textY + 3.0, 78.0, 24.0), 10.0, NSFontWeightBold,
         color(0.48, 0.54, 0.49, rowOpacity), NSTextAlignmentRight);
    rowY += rowHeight;
  }

  line(NSMakePoint(x, y + 400.0), NSMakePoint(x + width, y + 400.0), 1.0, color(0.20, 0.24, 0.22, opacity));
  NSArray<NSString *> *actions = @[ @"11 – 30", @"Preferences", @"About mclip" ];
  for (NSUInteger index = 0; index < actions.count; index += 1) {
    CGFloat actionY = y + 416.0 + index * 38.0;
    roundedRect(NSMakeRect(x + 22.0, actionY + 4.0, 18.0, 14.0), 3.0, nil, color(0.73, 0.55, 0.28, opacity));
    text(actions[index], NSMakeRect(x + 54.0, actionY, 230.0, 28.0), 16.0, NSFontWeightSemibold,
         color(0.80, 0.82, 0.78, opacity), NSTextAlignmentLeft);
  }
}

static void drawDetailWindow(CGFloat progress, CGFloat opacity) {
  CGFloat reveal = smoothstep(0.39, 0.52, progress) * (1.0 - smoothstep(0.80, 0.94, progress));
  if (reveal <= 0.001) {
    return;
  }

  CGFloat x = 574.0 + (1.0 - reveal) * 44.0;
  CGFloat y = 148.0;
  CGFloat width = 640.0;
  CGFloat height = 430.0;
  CGFloat alpha = opacity * reveal;
  NSRect frame = NSMakeRect(x, y, width, height);

  drawWindowShadow(frame, 28.0, alpha);
  roundedRect(frame, 28.0, color(0.058, 0.067, 0.063, alpha), color(0.27, 0.33, 0.30, alpha));

  text(@"Text detail", NSMakeRect(x + 28.0, y + 24.0, 200.0, 30.0), 18.0, NSFontWeightBold,
       color(0.91, 0.92, 0.89, alpha), NSTextAlignmentLeft);
  text(@"LOCAL HISTORY", NSMakeRect(x + width - 190.0, y + 29.0, 156.0, 22.0), 10.0, NSFontWeightBold,
       color(0.46, 0.69, 0.31, alpha), NSTextAlignmentRight);
  line(NSMakePoint(x, y + 70.0), NSMakePoint(x + width, y + 70.0), 1.0, color(0.20, 0.25, 0.22, alpha));

  roundedRect(NSMakeRect(x + 28.0, y + 94.0, width - 56.0, 178.0), 16.0,
              color(0.035, 0.043, 0.039, alpha), color(0.18, 0.23, 0.20, alpha));
  text(@"Release checklist for v0.1.1", NSMakeRect(x + 52.0, y + 118.0, width - 104.0, 38.0), 25.0,
       NSFontWeightBold, color(0.94, 0.95, 0.92, alpha), NSTextAlignmentLeft);
  text(@"Verify macOS and Windows builds\nConfirm checksums and release assets\nPublish only after the final smoke test",
       NSMakeRect(x + 52.0, y + 164.0, width - 104.0, 86.0), 17.0, NSFontWeightRegular,
       color(0.69, 0.73, 0.69, alpha), NSTextAlignmentLeft);

  NSArray<NSString *> *labels = @[ @"TYPE", @"COPIED", @"COUNT" ];
  NSArray<NSString *> *values = @[ @"Text", @"2 min ago", @"3" ];
  for (NSUInteger index = 0; index < labels.count; index += 1) {
    CGFloat cellX = x + 28.0 + index * 190.0;
    text(labels[index], NSMakeRect(cellX, y + 298.0, 150.0, 20.0), 10.0, NSFontWeightBold,
         color(0.47, 0.54, 0.49, alpha), NSTextAlignmentLeft);
    text(values[index], NSMakeRect(cellX, y + 320.0, 160.0, 26.0), 16.0, NSFontWeightSemibold,
         color(0.82, 0.84, 0.80, alpha), NSTextAlignmentLeft);
  }

  CGFloat copied = smoothstep(0.67, 0.72, progress);
  NSColor *buttonFill = copied > 0.1 ? color(0.42, 0.68, 0.18, alpha) : color(0.20, 0.35, 0.10, alpha);
  roundedRect(NSMakeRect(x + width - 182.0, y + height - 62.0, 154.0, 38.0), 11.0, buttonFill, nil);
  text(copied > 0.1 ? @"Copied ✓" : @"Copy", NSMakeRect(x + width - 170.0, y + height - 55.0, 130.0, 25.0),
       14.0, NSFontWeightBold, color(0.96, 0.98, 0.94, alpha), NSTextAlignmentCenter);
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
  NSGradient *glow = [[NSGradient alloc] initWithStartingColor:color(0.34, 0.67, 0.12, 0.20 + pulse * 0.05)
                                                 endingColor:color(0.34, 0.67, 0.12, 0.0)];
  [glow drawInRect:NSMakeRect(770.0, -80.0, 620.0, 620.0) relativeCenterPosition:NSMakePoint(0.0, 0.0)];

  CGFloat fadeIn = smoothstep(0.0, 0.07, progress);
  CGFloat fadeOut = 1.0 - smoothstep(0.92, 1.0, progress);
  CGFloat opacity = fadeIn * fadeOut;
  drawMainWindow(appIcon, progress, opacity);
  drawDetailWindow(progress, opacity);

  text(@"SEARCH  →  SELECT  →  PREVIEW", NSMakeRect(794.0, 630.0, 410.0, 24.0), 12.0, NSFontWeightBold,
       color(0.55, 0.70, 0.44, opacity * 0.82), NSTextAlignmentRight);
  text(@"Your clipboard stays local.", NSMakeRect(746.0, 656.0, 458.0, 28.0), 16.0, NSFontWeightSemibold,
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
