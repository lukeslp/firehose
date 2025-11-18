# Bluesky Brand Colors Research

## Official Brand Colors

Based on research from multiple sources, Bluesky's primary brand color is:

### Primary Blue
- **Hex:** `#01AAFF` (Azure Radiance)
- **RGB:** 1, 170, 255
- **HSL:** 200, 100%, 50%
- **Usage:** Primary brand color, butterfly logo, accents

### Secondary Blue (Lighter)
- **Hex:** `#A5D4FE` 
- **RGB:** 165, 212, 254
- **Usage:** Lighter accents, backgrounds

### Additional Blues from Logo
Looking at the butterfly logo, there appear to be gradient blues:
- Bright blue: `#1E8FFF` (approximate)
- Sky blue: `#4DA3E0` (approximate)

## Design Philosophy

From the blog post "A New Look for Bluesky: The Social Butterfly":
- The butterfly represents transformation and change
- Blue sky represents "open space of possibilities"
- The name symbolizes freedom and openness

## Application to Dashboard

For our Swiss-style dashboard with black/white dominant aesthetic:

### Recommended Usage:
1. **Primary accent:** `#01AAFF` for:
   - Status indicator when RUNNING
   - Links and interactive elements
   - Key metrics highlights

2. **Subtle backgrounds:** `#A5D4FE` at low opacity (5-10%) for:
   - Section backgrounds
   - Hover states
   - Card accents

3. **Keep dominant:** Black and white for:
   - Text and typography
   - Borders and structure
   - Main layout elements

4. **Cyan accent** (current: `oklch(0.5 0.15 220)`) → Replace with Bluesky blue

## Color Palette for Dashboard

```css
--bluesky-primary: #01AAFF;
--bluesky-light: #A5D4FE;
--bluesky-dark: #0088CC;
```

This maintains the Swiss brutalist aesthetic while incorporating Bluesky's brand identity through strategic accent usage.
