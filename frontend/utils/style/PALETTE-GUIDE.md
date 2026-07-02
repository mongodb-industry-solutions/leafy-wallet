# MongoDB LeafyGreen UI Palette Guide

This document provides a reference for using the `@leafygreen-ui/palette` in modern web applications based on established design recommendations.

## Design Principles

Our color system follows these key principles:

- **Neutral colors** help maintain clarity, readability, and a visually pleasing user experience
- **Primary colors** serve as key components for brand recognition, visual hierarchy, interactivity, and conveying important information

## Color Usage Guidelines

- **Green**: Used for primary buttons and interactive elements to draw attention and prompt user actions.
  Makes CTAs stand out and encourages users to click. Also indicates successful states.
- **Blue**: Used for links, secondary actions, or to call attention to information that needs to stand out.
- **Yellow**: Used for communicating content warnings and cautionary states.
- **Red**: Reserved for signaling critical errors, failures, or disabled content, ensuring users
  immediately recognize and address urgent issues.
- **Purple**: Considered a tertiary color, used for decorative elements and backgrounds where status
  indication isn't needed.

## Importing the Palette

```jsx
import { palette } from "@leafygreen-ui/palette";
```

## Primary Color Groups

### Green

- `palette.green.light3` - Lightest green, used for section backgrounds
- `palette.green.light2` - Light green, used for success indicators
- `palette.green.light1` - Slightly lighter green
- `palette.green.base` - Base green, used for icons
- `palette.green.dark1` - Slightly darker green
- `palette.green.dark2` - Darker green, used for icons in light backgrounds
- `palette.green.dark3` - Darkest green, used for headers

### Gray

- `palette.gray.light3` - Lightest gray, used for text on dark backgrounds
- `palette.gray.light2` - Light gray, used for backgrounds and footer text
- `palette.gray.light1` - Slightly lighter gray
- `palette.gray.base` - Base gray
- `palette.gray.dark1` - Darker gray, used for secondary text
- `palette.gray.dark2` - Very dark gray
- `palette.gray.dark3` - Darkest gray, used for footers

### Blue

- `palette.blue.light2` - Light blue, used for backgrounds
- `palette.blue.light1` - Slightly lighter blue
- `palette.blue.base` - Base blue, used for icons and links
- `palette.blue.dark1` - Slightly darker blue
- `palette.blue.dark2` - Dark blue, used for text on blue backgrounds

### Yellow

- `palette.yellow.light2` - Light yellow, used for warning backgrounds
- `palette.yellow.light1` - Slightly lighter yellow
- `palette.yellow.base` - Base yellow, used for medium risk indicators
- `palette.yellow.dark1` - Slightly darker yellow
- `palette.yellow.dark2` - Dark yellow, used for warning text and icons

### Red

- `palette.red.light2` - Light red, used for error backgrounds
- `palette.red.light1` - Slightly lighter red
- `palette.red.base` - Base red, used for high risk indicators
- `palette.red.dark1` - Slightly darker red
- `palette.red.dark2` - Dark red, used for error text

### Purple

- `palette.purple.light2` - Light purple, used for backgrounds
- `palette.purple.light1` - Slightly lighter purple
- `palette.purple.base` - Base purple
- `palette.purple.dark1` - Slightly darker purple
- `palette.purple.dark2` - Dark purple, used for text on purple backgrounds

## Common Usage Patterns

### Text Colors

- Primary text: Default (no color override)
- Secondary text: `palette.gray.dark1`
- Warning text: `palette.yellow.dark2`
- Error text: `palette.red.base`
- Success text: `palette.green.dark2`
- Text on dark backgrounds: `palette.gray.light3`
- Link text: `palette.blue.dark1`

### Background Colors

- Main section backgrounds: `palette.green.light3`
- Card backgrounds: Default (white)
- Success backgrounds: `palette.green.light2`
- Warning backgrounds: `palette.yellow.light2`
- Error backgrounds: `palette.red.light2`
- Information backgrounds: `palette.blue.light2`
- Footer backgrounds: `palette.gray.dark2`
- Header backgrounds: `palette.green.dark2`
- Secondary action backgrounds: `palette.blue.light2`

### Icons

- Default icons: `palette.gray.dark1`
- Primary action icons: `palette.green.dark1` or `palette.gray.light3` (on colored buttons)
- Secondary action icons: `palette.blue.dark1`
- Success icons: `palette.green.base`
- Warning icons: `palette.yellow.dark2`
- Error icons: `palette.red.base`
- Icons on dark backgrounds: `palette.gray.light3`

### Buttons

- Primary action buttons:
  - Background: `palette.green.dark2`
  - Text: `palette.gray.light3`
- Secondary action buttons:
  - Background: `palette.blue.light2`
  - Text: `palette.blue.dark2`
  - Border: `palette.blue.light1`
- Tertiary/Cancel buttons:
  - Background: `palette.gray.light2`
  - Text: `palette.gray.dark1`
  - Border: `palette.gray.light1`

### Cards & Containers

- Default card:
  - Border: `1px solid ${palette.gray.light2}`
  - Shadow: `0 2px 6px rgba(0,0,0,0.08)`
- Information card:
  - Border: `1px solid ${palette.blue.light2}`
- Success card:
  - Border: `1px solid ${palette.green.light2}`
- Warning card:
  - Border: `1px solid ${palette.yellow.light2}`
- Error card:
  - Border: `1px solid ${palette.red.light2}`

### Risk-Based Color Scales

A comprehensive 4-level risk classification system with consistent color coding:

- **Critical Level** (80-100):

  - Background: `palette.red.light2`
  - Border: `palette.red.dark2`
  - Text: `palette.red.dark2`
  - Icon: `palette.red.dark2`

- **High Level** (60-79):

  - Background: `palette.red.light2`
  - Border: `palette.red.base`
  - Text: `palette.red.base`
  - Icon: `palette.red.base`

- **Medium Level** (40-59):

  - Background: `palette.yellow.light2`
  - Border: `palette.yellow.base`
  - Text: `palette.yellow.base`
  - Icon: `palette.yellow.dark2`

- **Low Level** (0-39):
  - Background: `palette.green.light2`
  - Border: `palette.green.base`
  - Text: `palette.green.base`
  - Icon: `palette.green.base`

### Processing State Colors

Used in multi-step workflows and loading indicators:

- **Active/Processing State**:

  - Background: `palette.blue.light3`
  - Border: `palette.blue.light2`
  - Text: `palette.blue.dark2`
  - Progress indicator: `palette.blue.base`

- **Completed State**:

  - Background: `palette.green.light3`
  - Border: `palette.green.light2`
  - Text: `palette.green.dark2`
  - Check icon: `palette.green.base`

- **Pending State**:
  - Background: `transparent`
  - Text: `palette.gray.dark1`
  - Clock icon: `palette.gray.base`

### Network Visualization Colors

For entity and relationship visualizations:

- **Entity Types**:

  - Individual: `palette.blue.base`
  - Business: `palette.purple.base`
  - Organization: `palette.green.dark1`
  - Unknown: `palette.gray.base`

- **Relationship Types**:
  - Corporate (director_of, shareholder_of): `palette.blue.base`
  - Household (spouse_of, parent_of): `palette.green.base`
  - Suspicious (linked_to, associated_with): `palette.red.base`
  - Financial (transacted_with): `palette.purple.base`

### Technical Panel Themes

For database operation insights and analysis panels:

- **Database Operations Theme**:

  - Background: `palette.blue.light3`
  - Border: `palette.blue.light2`
  - Accent text: `palette.blue.dark2`
  - Secondary text: `palette.blue.dark1`
  - Icon/badge: `palette.blue.base`

- **Analysis Summary Theme**:
  - Background: `palette.green.light3`
  - Border: `palette.green.light2`
  - Text: `palette.green.dark2`
  - Icon: `palette.green.base`

## Example Usage

```jsx
// Text color
<Body style={{ color: palette.gray.dark1 }}>Secondary information text</Body>

// Background color
<div style={{ backgroundColor: palette.green.light3 }}>Section background</div>

// Icon color
<Icon glyph="Checkmark" fill={palette.green.base} />

// Border color
<div style={{ border: `1px solid ${palette.gray.light2}` }}>Bordered container</div>

// Combined styling
<div style={{
  backgroundColor: palette.blue.light2,
  border: `1px solid ${palette.blue.base}`,
  borderRadius: '4px',
  padding: spacing[2]
}}>
  <Body style={{ color: palette.blue.dark2 }}>Information message</Body>
</div>

// Score/level-based styling
<Card style={{
  backgroundColor: palette.red.light2,
  border: `2px solid ${palette.red.base}`,
  padding: spacing[4]
}}>
  <div style={{
    fontSize: '48px',
    fontWeight: 'bold',
    color: palette.red.base,
    textAlign: 'center'
  }}>
    85
  </div>
  <H3 style={{ color: palette.red.base, textAlign: 'center' }}>
    HIGH LEVEL
  </H3>
</Card>

// Processing step indicator
<div style={{
  padding: spacing[2],
  backgroundColor: palette.blue.light3,
  border: `1px solid ${palette.blue.light2}`,
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2]
}}>
  <Spinner size="small" />
  <Body style={{ color: palette.blue.dark2, fontWeight: '600' }}>
    Processing Atlas Search...
  </Body>
</div>

// Custom badge with risk colors
<span style={{
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]}px ${spacing[3]}px`,
  borderRadius: '16px',
  backgroundColor: palette.red.light2,
  color: palette.red.base,
  border: `1px solid ${palette.red.base}`,
  fontSize: '14px',
  fontWeight: '600'
}}>
  <Icon glyph="Warning" size={14} fill={palette.red.base} />
  High Risk
</span>

// Database operations panel
<Card style={{
  backgroundColor: palette.blue.light3,
  border: `1px solid ${palette.blue.light2}`,
  padding: spacing[3]
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] }}>
    <Badge variant="blue">Database Operation</Badge>
  </div>
  <Body style={{ color: palette.blue.dark2 }}>
    Analysis completed using database aggregation operations
  </Body>
</Card>

// Statistics grid background
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: spacing[3],
  padding: spacing[3],
  backgroundColor: palette.gray.light3,
  borderRadius: '8px'
}}>
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontSize: '24px',
      fontWeight: 'bold',
      color: palette.blue.dark2
    }}>
      156
    </div>
    <Label style={{ color: palette.gray.dark1 }}>
      TOTAL CONNECTIONS
    </Label>
  </div>
</div>
```

## Application-Specific Color Patterns

### Search Result Highlighting

For search result correlation and contribution analysis:

- **Primary Search Method**:

  - Pill background: `palette.blue.light2`
  - Pill text: `palette.blue.dark2`
  - Tab active: `palette.blue.base`

- **Secondary Search Method**:

  - Pill background: `palette.purple.light2`
  - Pill text: `palette.purple.dark2`
  - Tab active: `palette.purple.base`

- **Combined Search Results**:
  - Pill background: `palette.green.light2`
  - Pill text: `palette.green.dark2`
  - Tab active: `palette.green.base`

### Entity/Record Status Colors

For entity lifecycle and compliance status:

- **Active Record**: `palette.green.base` / `palette.green.light2`
- **Inactive Record**: `palette.gray.base` / `palette.gray.light2`
- **Under Review**: `palette.yellow.base` / `palette.yellow.light2`
- **Restricted/Blocked**: `palette.red.base` / `palette.red.light2`

### Analysis Insight Colors

For different types of insights and discoveries:

- **Data Insights**: `palette.purple.base` / `palette.purple.light2`
- **Network Insights**: `palette.blue.base` / `palette.blue.light2`
- **Alert Insights**: `palette.red.base` / `palette.red.light2`
- **Performance Insights**: `palette.yellow.base` / `palette.yellow.light2`

### Grid and Statistics Backgrounds

- **Primary Statistics Grid**: `palette.gray.light3`
- **Alert Assessment Grid**: `palette.red.light3`
- **Analysis Grid**: `palette.blue.light3`
- **Processing Summary Grid**: `palette.green.light3`

### Accent Colors for Charts and Visualizations

- **Primary Series**: `palette.blue.base`
- **Secondary Series**: `palette.green.base`
- **Tertiary Series**: `palette.purple.base`
- **Warning Series**: `palette.yellow.base`
- **Critical Series**: `palette.red.base`

### Flow Diagram Node Colors

For ReactFlow and similar diagram components:

- **Decision Nodes (Diamond)**:

  - Active: `linear-gradient(135deg, ${palette.yellow.light2}, ${palette.yellow.light3})`
  - Completed: `linear-gradient(135deg, ${palette.yellow.light3}, ${palette.white})`
  - Border: `palette.yellow.base` / `palette.yellow.dark1`

- **Processing Nodes (Rectangle)**:

  - Active: `linear-gradient(135deg, ${palette.blue.light2}, ${palette.blue.light3})`
  - Completed: `linear-gradient(135deg, ${palette.green.light2}, ${palette.green.light3})`
  - Inactive: `palette.gray.light3`

- **Input/Output Nodes**:

  - Background: `palette.purple.light3`
  - Border: `palette.purple.base`
  - Text: `palette.purple.dark2`

- **Tool/Function Nodes**:
  - Background: `palette.blue.light3`
  - Border: `palette.blue.light1`
  - Text: `palette.blue.dark2`

### Real-time Connection States

For WebSocket and real-time features:

- **Connected State**:

  - Background: `palette.green.light3`
  - Border: `palette.green.light2`
  - Indicator: `palette.green.base` (with pulse animation)
  - Text: `palette.green.dark2`

- **Disconnected State**:

  - Background: `palette.red.light3`
  - Border: `palette.red.light2`
  - Indicator: `palette.red.base` (static)
  - Text: `palette.red.dark2`

- **Reconnecting State**:
  - Background: `palette.yellow.light3`
  - Border: `palette.yellow.light2`
  - Indicator: `palette.yellow.base` (spinning animation)
  - Text: `palette.yellow.dark2`

### Event Notification Colors

For real-time event notifications:

- **Create/Insert Events**:

  - Background: `palette.green.light2`
  - Border: `palette.green.light1`
  - Icon: `palette.green.base`

- **Update/Modify Events**:

  - Background: `palette.blue.light2`
  - Border: `palette.blue.light1`
  - Icon: `palette.blue.base`

- **Delete/Remove Events**:

  - Background: `palette.red.light2`
  - Border: `palette.red.light1`
  - Icon: `palette.red.base`

- **System Events**:
  - Background: `palette.purple.light2`
  - Border: `palette.purple.light1`
  - Icon: `palette.purple.base`

For more details, consult the official [@leafygreen-ui/palette documentation](https://github.com/mongodb/leafygreen-ui/tree/main/packages/palette).
