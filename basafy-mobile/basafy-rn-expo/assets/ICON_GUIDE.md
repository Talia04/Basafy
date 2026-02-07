# Basafy App Icon & Splash Screen Guide

## Brand Colors
- **Primary**: #4A8CFF (Blue)
- **Background**: #0A0E1A (Dark Navy)
- **Success**: #5AEFD5 (Teal)
- **Accent Pink**: #F38FA9

## Icon Specifications

### iOS App Icon (icon.png)
- Size: 1024x1024px
- Format: PNG, no transparency, no rounded corners
- Design: "B" lettermark or briefcase icon on gradient background

### Android Adaptive Icon
- Foreground (adaptive-icon.png): 1024x1024px with safe zone
- Background color: #0A0E1A
- Keep icon content within center 66% (safe zone)

### Favicon (favicon.png)
- Size: 48x48px
- Format: PNG

## Splash Screen Specifications

### Image (splash.png)
- Size: 1284x2778px (iPhone 14 Pro Max native)
- Background: #0A0E1A
- Content: Centered logo/icon (max 200x200px visible area)
- Keep critical content in center 50% for all device sizes

## Generation Commands

### Using Expo CLI (Recommended)
```bash
# Generate all icon sizes from a single 1024x1024 source
npx expo-optimize

# Or use @expo/image-utils
npx @expo/image-utils resize icon-source.png -o ./assets/ -s 1024
```

### Using ImageMagick
```bash
# Create iOS icon with rounded corners removed
convert icon-source.png -resize 1024x1024 ./assets/icon.png

# Create adaptive icon foreground
convert icon-source.png -resize 1024x1024 -gravity center -extent 1024x1024 ./assets/adaptive-icon.png

# Create favicon
convert icon-source.png -resize 48x48 ./assets/favicon.png

# Create splash with logo centered
convert -size 1284x2778 xc:'#0A0E1A' \
  \( logo.png -resize 400x400 \) -gravity center -composite \
  ./assets/splash.png
```

### Using Figma/Design Tools
1. Create 1024x1024 artboard
2. Use brand colors: Background #0A0E1A, Icon #4A8CFF
3. Export as PNG at 1x
4. For splash: Create 1284x2778 artboard with centered logo

## Quick Icon Generator Script
Run this after placing your source icon as `icon-source.png`:

```bash
#!/bin/bash
cd assets

# Ensure source exists
if [ ! -f "icon-source.png" ]; then
  echo "Please add icon-source.png (1024x1024) to assets/"
  exit 1
fi

# Generate icons (requires ImageMagick)
convert icon-source.png -resize 1024x1024 icon.png
convert icon-source.png -resize 1024x1024 -gravity center -background none -extent 1024x1024 adaptive-icon.png
convert icon-source.png -resize 48x48 favicon.png

echo "Icons generated successfully!"
```

## Expo Splash Screen Plugin
The app.config.ts is already configured with:
- splash.image: './assets/splash.png'
- splash.backgroundColor: '#0A0E1A'
- splash.resizeMode: 'contain'

## Testing
After updating assets, rebuild the app:
```bash
npx expo prebuild --clean
npx expo run:ios
```
