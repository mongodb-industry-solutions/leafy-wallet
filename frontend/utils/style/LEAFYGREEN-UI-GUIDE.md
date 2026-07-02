# LeafyGreen UI Components Guide

This document provides a comprehensive reference for MongoDB's LeafyGreen UI components for modern web applications.

## Table of Contents

- [Core Components](#core-components)
- [Typography](#typography)
- [Containers & Layout](#containers--layout)
- [Inputs & Forms](#inputs--forms)
- [Navigation & Tabs](#navigation--tabs)
- [Data Display](#data-display)
- [Feedback & Indicators](#feedback--indicators)
- [Color System](#color-system)
- [Spacing](#spacing)

## Core Components

### Button

```jsx
import Button from '@leafygreen-ui/button';

// Primary button (green)
<Button variant="primary">Submit</Button>

// Default button
<Button variant="default">Cancel</Button>

// With icon
<Button leftGlyph={<Icon glyph="Plus" />}>Add New</Button>

// Disabled button
<Button disabled={true}>Disabled</Button>
```

### Icon

```jsx
import Icon from '@leafygreen-ui/icon';

// Basic icon
<Icon glyph="Bell" />

// With custom color
<Icon glyph="Checkmark" fill={palette.green.base} />

// With custom size
<Icon glyph="Warning" size="large" />
```

### IconButton

```jsx
import IconButton from "@leafygreen-ui/icon-button";

// Icon-only button with tooltip
<IconButton aria-label="Refresh data">
  <Icon glyph="Refresh" />
</IconButton>;
```

## Typography

```jsx
import {
  H1, H2, H3,
  Subtitle,
  Body,
  InlineCode,
  InlineKeyCode,
  Disclaimer,
  Error,
  Label,
  Description,
  BackLink
} from '@leafygreen-ui/typography';

// Headings
<H1>Main Heading</H1>
<H2>Section Heading</H2>
<H3>Subsection Heading</H3>

// Subtitle (smaller than H3)
<Subtitle>Smaller heading for subsections</Subtitle>

// Regular body text
<Body>Standard text content</Body>

// Weights and sizes
<Body weight="medium">Medium weight text</Body>
<Body size="small">Smaller text</Body>

// Special text elements
<InlineCode>Code snippet</InlineCode>
<InlineKeyCode>Keyboard key</InlineKeyCode>
<Disclaimer>Fine-print or disclaimer text</Disclaimer>
<Error>Error message</Error>

// Form labels and descriptions
<Label htmlFor="input-id">Input Label</Label>
<Description>Additional description text</Description>

// Navigation link
<BackLink href="/">Back to Home</BackLink>
```

## Containers & Layout

### Card

```jsx
import Card from '@leafygreen-ui/card';

// Basic card
<Card>Content here</Card>

// With custom padding
<Card style={{ padding: spacing[4] }}>Content with padding</Card>

// With header and footer sections
<Card>
  <div style={{ borderBottom: `1px solid ${palette.gray.light2}`, padding: spacing[3] }}>
    <H3>Card Header</H3>
  </div>
  <div style={{ padding: spacing[3] }}>
    <Body>Card content</Body>
  </div>
  <div style={{ borderTop: `1px solid ${palette.gray.light2}`, padding: spacing[3] }}>
    Footer actions
  </div>
</Card>
```

### ExpandableCard

```jsx
import ExpandableCard from "@leafygreen-ui/expandable-card";

// Expandable card that collapses/expands
<ExpandableCard
  title="MongoDB Document"
  defaultOpen={false}
  onClick={() => setShowContent(!showContent)}
>
  <div style={{ maxHeight: "300px", overflow: "auto" }}>
    <Code language="json" copyable={true}>
      {JSON.stringify(data, null, 2)}
    </Code>
  </div>
</ExpandableCard>;
```

### Popover

```jsx
import Popover from "@leafygreen-ui/popover";

// Popover that appears on trigger
<Popover active={isOpen} refEl={triggerRef} usePortal={true}>
  <div style={{ padding: spacing[3] }}>
    <Body>Popover content</Body>
  </div>
</Popover>;
```

## Inputs & Forms

### TextInput

```jsx
import TextInput, { State, SizeVariant, TextInputType } from '@leafygreen-ui/text-input';

// Basic text input
<TextInput
  label="Username"
  placeholder="Enter username"
  onChange={(e) => setUsername(e.target.value)}
  value={username}
/>

// Input types
<TextInput type={TextInputType.Text} />
<TextInput type={TextInputType.Number} />
<TextInput type={TextInputType.Password} />

// Input states
<TextInput state={State.Error} errorMessage="This field is required" />
<TextInput state={State.Valid} />

// Sizes
<TextInput sizeVariant={SizeVariant.Default} />
<TextInput sizeVariant={SizeVariant.Small} />
<TextInput sizeVariant={SizeVariant.Large} />
```

### TextArea

```jsx
import TextArea from '@leafygreen-ui/text-area';

// Basic text area
<TextArea
  label="Description"
  placeholder="Enter description..."
  onChange={(e) => setDescription(e.target.value)}
  value={description}
/>

// With validation states
<TextArea
  label="Notes"
  state={State.Error}
  errorMessage="Notes field is required"
/>

// With custom sizing
<TextArea
  label="Large Text Area"
  rows={8}
  resize="vertical"
/>
```

### Select

```jsx
import { Select, Option } from '@leafygreen-ui/select';

// Basic select dropdown
<Select
  label="Customer"
  placeholder="Select a customer"
  onChange={handleCustomerChange}
  value={selectedCustomer?._id}
>
  {customers.map(customer => (
    <Option key={customer._id} value={customer._id}>
      {customer.personal_info.name}
    </Option>
  ))}
</Select>

// Multi-select
<Select
  label="Categories"
  placeholder="Select categories"
  onChange={handleCategoryChange}
  value={selectedCategories}
  allowDeselect={true}
  multiselect={true}
>
  {categories.map(category => (
    <Option key={category.id} value={category.id}>
      {category.name}
    </Option>
  ))}
</Select>
```

### Toggle

```jsx
import Toggle from "@leafygreen-ui/toggle";

// Toggle switch
<Toggle
  onChange={() => setEnabled(!enabled)}
  checked={enabled}
  size="default" // or "small"
  label="Enable feature"
  aria-label="Enable feature"
/>;
```

### RadioGroup

```jsx
import { RadioGroup, Radio } from "@leafygreen-ui/radio-group";

// Radio button group
<RadioGroup
  onChange={(e) => setSelectedOption(e.target.value)}
  value={selectedOption}
  name="options"
>
  <Radio value="option1" id="option1">
    Option 1
  </Radio>
  <Radio value="option2" id="option2">
    Option 2
  </Radio>
  <Radio value="option3" id="option3" disabled>
    Option 3 (Disabled)
  </Radio>
</RadioGroup>;
```

### RadioBoxGroup

```jsx
import RadioBox from "@leafygreen-ui/radio-box-group";

// Radio boxes with more complex content
<RadioBox
  name="scenario"
  value={selectedScenario}
  onChange={(e) => setSelectedScenario(e.target.value)}
>
  <RadioBox.RadioBox value="normal" id="normal" className={styles.radioBox}>
    <div>
      <H3>Normal Transaction</H3>
      <Body>Standard transaction within expected patterns</Body>
    </div>
  </RadioBox.RadioBox>

  <RadioBox.RadioBox value="anomaly" id="anomaly" className={styles.radioBox}>
    <div>
      <H3>Anomalous Transaction</H3>
      <Body>Transaction outside normal patterns</Body>
    </div>
  </RadioBox.RadioBox>
</RadioBox>;
```

## Navigation & Tabs

### Tabs

```jsx
import { Tabs, Tab } from "@leafygreen-ui/tabs";

// Basic tabs
<Tabs selected={activeTab} setSelected={setActiveTab} aria-label="Content tabs">
  <Tab name="Overview">
    <div style={{ marginTop: spacing[3] }}>
      <Card>Overview content</Card>
    </div>
  </Tab>

  <Tab name="Details">
    <div style={{ marginTop: spacing[3] }}>
      <Card>Details content</Card>
    </div>
  </Tab>

  <Tab name="History">
    <div style={{ marginTop: spacing[3] }}>
      <Card>History content</Card>
    </div>
  </Tab>
</Tabs>;
```

### Menu

```jsx
import { Menu, MenuItem } from "@leafygreen-ui/menu";

// Dropdown menu
<Menu open={menuOpen} setOpen={setMenuOpen} trigger={<Button>Actions</Button>}>
  <MenuItem onClick={handleEdit}>Edit</MenuItem>
  <MenuItem onClick={handleDelete}>Delete</MenuItem>
  <MenuItem href="/details">View Details</MenuItem>
  <MenuItem disabled>Disabled Action</MenuItem>
</Menu>;
```

## Data Display

### Table

```jsx
import {
  Table,
  TableBody,
  TableHead,
  HeaderRow,
  HeaderCell,
  Row,
  Cell,
  useLeafyGreenTable,
  flexRender,
} from "@leafygreen-ui/table";

// Basic table
<Table data={transactions} columns={columns}>
  <TableHead>
    <HeaderRow>
      <HeaderCell>Date</HeaderCell>
      <HeaderCell>Customer</HeaderCell>
      <HeaderCell>Amount</HeaderCell>
      <HeaderCell>Status</HeaderCell>
    </HeaderRow>
  </TableHead>
  <TableBody>
    {transactions.map((transaction) => (
      <Row key={transaction._id}>
        <Cell>{new Date(transaction.timestamp).toLocaleDateString()}</Cell>
        <Cell>{transaction.customer_name}</Cell>
        <Cell>${transaction.amount.toFixed(2)}</Cell>
        <Cell>{transaction.status}</Cell>
      </Row>
    ))}
  </TableBody>
</Table>;

// With sorting and pagination (using useLeafyGreenTable hook)
const table = useLeafyGreenTable({
  columns,
  data,
  initialState: {
    sorting: [{ id: "date", desc: true }],
  },
});

<Table>
  <TableHead>
    {table.getHeaderGroups().map((headerGroup) => (
      <HeaderRow key={headerGroup.id}>
        {headerGroup.headers.map((header) => (
          <HeaderCell
            key={header.id}
            sortDirection={header.column.getIsSorted()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </HeaderCell>
        ))}
      </HeaderRow>
    ))}
  </TableHead>
  <TableBody>
    {table.getRowModel().rows.map((row) => (
      <Row key={row.id}>
        {row.getVisibleCells().map((cell) => (
          <Cell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </Cell>
        ))}
      </Row>
    ))}
  </TableBody>
</Table>;
```

### Code

```jsx
import Code from '@leafygreen-ui/code';

// Code block with syntax highlighting
<Code language="json" copyable={true}>
  {JSON.stringify(data, null, 2)}
</Code>

// JavaScript syntax highlighting
<Code language="javascript">
  {`function example() {
    return "Hello world!";
  }`}
</Code>
```

## Feedback & Indicators

### Banner

```jsx
import Banner from '@leafygreen-ui/banner';

// Success banner
<Banner variant="success">Operation completed successfully</Banner>

// Warning banner
<Banner variant="warning">Please review before proceeding</Banner>

// Danger/error banner
<Banner variant="danger">An error occurred</Banner>

// Info banner
<Banner variant="info">New features available</Banner>
```

### Badge

```jsx
import Badge from '@leafygreen-ui/badge';

// Basic badges
<Badge variant="green">Active</Badge>
<Badge variant="red">Error</Badge>
<Badge variant="yellow">Warning</Badge>
<Badge variant="blue">Info</Badge>
<Badge variant="lightgray">Default</Badge>

// With custom content
<Badge variant="blue">MongoDB $graphLookup</Badge>

// Custom risk badge pattern (used extensively in Entity Management)
function RiskBadge({ level, score, size = 'default' }) {
  const colors = {
    critical: palette.red.dark2,
    high: palette.red.base,
    medium: palette.yellow.base,
    low: palette.green.base,
    unknown: palette.gray.base
  };

  const bgColors = {
    critical: palette.red.light2,
    high: palette.red.light2,
    medium: palette.yellow.light2,
    low: palette.green.light2,
    unknown: palette.gray.light2
  };

  const levelLower = level?.toLowerCase() || 'unknown';
  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[1],
    padding: size === 'small' ? `${spacing[1]}px ${spacing[2]}px` : `${spacing[1]}px ${spacing[3]}px`,
    borderRadius: '16px',
    backgroundColor: bgColors[levelLower],
    color: colors[levelLower],
    fontSize: size === 'small' ? '12px' : '14px',
    fontWeight: '600',
    border: `1px solid ${colors[levelLower]}`,
  };

  return (
    <span style={badgeStyle}>
      <Icon
        glyph={levelLower === 'high' ? 'Warning' : 'Checkmark'}
        size={size === 'small' ? 12 : 14}
        fill={colors[levelLower]}
      />
      {score && `${score} - `}{level}
    </span>
  );
}

// Custom status badge pattern
function StatusBadge({ status, size = 'default' }) {
  const statusColors = {
    active: { bg: palette.green.light2, color: palette.green.base, border: palette.green.base },
    inactive: { bg: palette.gray.light2, color: palette.gray.base, border: palette.gray.base },
    under_review: { bg: palette.yellow.light2, color: palette.yellow.base, border: palette.yellow.base },
    restricted: { bg: palette.red.light2, color: palette.red.base, border: palette.red.base }
  };

  const statusData = statusColors[status?.toLowerCase()] || statusColors.inactive;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${spacing[1]}px ${spacing[3]}px`,
      borderRadius: '16px',
      backgroundColor: statusData.bg,
      color: statusData.color,
      border: `1px solid ${statusData.border}`,
      fontSize: '14px',
      fontWeight: '600'
    }}>
      {status}
    </span>
  );
}
```

### Callout

```jsx
import Callout from '@leafygreen-ui/callout';

// Information callout
<Callout
  title="Important Information"
  variant="info"
>
  <Body>This provides additional context to the user.</Body>
</Callout>

// Warning callout
<Callout
  title="Warning"
  variant="warning"
>
  <Body>This action cannot be undone.</Body>
</Callout>

// Note callout
<Callout
  title="Note"
  variant="note"
>
  <Body>Remember to save your changes.</Body>
</Callout>
```

### Modal

```jsx
import Modal from "@leafygreen-ui/modal";

// Basic modal
<Modal
  open={showModal}
  setOpen={setShowModal}
  size="large" // "small", "default", "large"
  title="Transaction Details"
>
  <div style={{ padding: spacing[3] }}>
    <Body>Modal content goes here</Body>
  </div>

  <div
    style={{
      display: "flex",
      justifyContent: "flex-end",
      padding: spacing[3],
      borderTop: `1px solid ${palette.gray.light2}`,
    }}
  >
    <Button onClick={() => setShowModal(false)}>Close</Button>
  </div>
</Modal>;
```

### LoadingIndicator

```jsx
import { Spinner } from '@leafygreen-ui/loading-indicator';

// Spinner
<Spinner />

// In a button
<Button
  variant="primary"
  disabled={loading}
  leftGlyph={loading ? <Spinner /> : <Icon glyph="Plus" />}
>
  {loading ? 'Loading...' : 'Submit'}
</Button>
```

### SkeletonLoader

```jsx
import {
  ParagraphSkeleton,
  CardSkeleton,
  TableSkeleton,
  FormSkeleton
} from '@leafygreen-ui/skeleton-loader';

// Paragraph skeleton
<ParagraphSkeleton withHeader />

// Card skeleton
<CardSkeleton style={{ height: '300px' }} />

// Table skeleton
<TableSkeleton
  rowCount={5}
  columnCount={4}
  style={{ height: '500px' }}
/>

// Form skeleton
<FormSkeleton fieldCount={3} />
```

### Tooltip

```jsx
import Tooltip from '@leafygreen-ui/tooltip';

// Basic tooltip
<Tooltip
  trigger={<Button>Hover Me</Button>}
  triggerEvent="hover"
>
  Tooltip content
</Tooltip>

// Directional tooltip
<Tooltip
  trigger={<Icon glyph="InfoWithCircle" />}
  triggerEvent="hover"
  placement="bottom"
>
  Additional information
</Tooltip>
```

### Avatar

```jsx
import Avatar from '@leafygreen-ui/avatar';

// User avatar with initials
<Avatar>JD</Avatar>

// With custom color
<Avatar backgroundColor={palette.green.base}>MG</Avatar>

// With image
<Avatar src="/path/to/image.jpg" />
```

## Color System

MongoDB LeafyGreen UI provides a consistent color palette through the `@leafygreen-ui/palette` package.

```jsx
import { palette } from "@leafygreen-ui/palette";
```

### Color Groups

- **Green**: Primary action colors, success states

  - From `palette.green.light3` (lightest) to `palette.green.dark3` (darkest)

- **Gray**: Neutral colors for text, backgrounds

  - From `palette.gray.light3` (lightest) to `palette.gray.dark3` (darkest)

- **Blue**: Secondary action colors, information states

  - From `palette.blue.light2` (lightest) to `palette.blue.dark2` (darkest)

- **Yellow**: Warning states

  - From `palette.yellow.light2` (lightest) to `palette.yellow.dark2` (darkest)

- **Red**: Error states, critical actions

  - From `palette.red.light2` (lightest) to `palette.red.dark2` (darkest)

- **Purple**: Tertiary colors, decorative elements
  - From `palette.purple.light2` (lightest) to `palette.purple.dark2` (darkest)

See the [PALETTE-GUIDE.md](./components/PALETTE-GUIDE.md) for detailed usage guidelines.

## Spacing

LeafyGreen UI provides consistent spacing tokens through the `@leafygreen-ui/tokens` package.

```jsx
import { spacing } from "@leafygreen-ui/tokens";
```

Spacing values range from `spacing[1]` (4px) to `spacing[4]` (32px):

- `spacing[1]`: 4px (Extra small spacing)
- `spacing[2]`: 8px (Small spacing)
- `spacing[3]`: 16px (Medium spacing)
- `spacing[4]`: 32px (Large spacing)

Example usage:

```jsx
<div
  style={{
    padding: spacing[3],
    marginBottom: spacing[2],
    gap: spacing[1],
  }}
>
  Content with consistent spacing
</div>
```

## Advanced UI Patterns

### Processing Step Indicators

```jsx
import Card from "@leafygreen-ui/card";
import { H3, Body } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import Badge from "@leafygreen-ui/badge";
import { Spinner } from "@leafygreen-ui/loading-indicator";

// Multi-step processing indicator
function ProcessingStepsIndicator({
  steps,
  currentStep,
  workflowType = "parallelSearch",
}) {
  const getStepStatus = (stepIndex) => {
    if (stepIndex < currentStep) return "completed";
    if (stepIndex === currentStep) return "active";
    return "pending";
  };

  return (
    <Card style={{ padding: spacing[4] }}>
      <H3 style={{ marginBottom: spacing[3] }}>Processing Steps</H3>

      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isActive = status === "active";
        const isCompleted = status === "completed";

        return (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              padding: spacing[2],
              marginBottom: spacing[2],
              backgroundColor: isActive ? palette.blue.light3 : "transparent",
              borderRadius: "8px",
              border: isActive ? `1px solid ${palette.blue.light2}` : "none",
            }}
          >
            <div style={{ minWidth: "24px" }}>
              {isCompleted && (
                <Icon glyph="Checkmark" fill={palette.green.base} />
              )}
              {isActive && <Spinner size="small" />}
              {status === "pending" && (
                <Icon glyph="Clock" fill={palette.gray.base} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <Body
                style={{
                  fontWeight: isActive ? "600" : "400",
                  color: isCompleted
                    ? palette.green.dark2
                    : isActive
                    ? palette.blue.dark2
                    : palette.gray.dark1,
                }}
              >
                {step.title}
              </Body>
              <Body
                style={{
                  fontSize: "12px",
                  color: palette.gray.dark1,
                  marginTop: spacing[1],
                }}
              >
                {step.description}
              </Body>
            </div>

            {isActive && (
              <Badge variant="blue" style={{ fontSize: "10px" }}>
                Processing
              </Badge>
            )}
            {isCompleted && (
              <Badge variant="green" style={{ fontSize: "10px" }}>
                Complete
              </Badge>
            )}
          </div>
        );
      })}
    </Card>
  );
}
```

### Grid Statistics Layout

```jsx
// Grid-based statistics display (commonly used for risk analysis)
function StatisticsGrid({ data }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: spacing[3],
        padding: spacing[3],
        backgroundColor: palette.gray.light3,
        borderRadius: "8px",
      }}
    >
      {Object.entries(data).map(([key, value]) => (
        <div key={key} style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: palette.blue.dark2,
              marginBottom: spacing[1],
            }}
          >
            {value}
          </div>
          <Label style={{ color: palette.gray.dark1 }}>
            {key.replace(/_/g, " ").toUpperCase()}
          </Label>
        </div>
      ))}
    </div>
  );
}
```

### Enhanced Modal with Custom Footer

```jsx
import Modal from "@leafygreen-ui/modal";
import Button from "@leafygreen-ui/button";

// Modal with custom action footer
<Modal
  open={showModal}
  setOpen={setShowModal}
  size="large"
  title="Entity Details"
>
  <div style={{ padding: spacing[3] }}>
    <Body>Modal content goes here</Body>
  </div>

  {/* Custom Footer with Actions */}
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing[3],
      borderTop: `1px solid ${palette.gray.light2}`,
      backgroundColor: palette.gray.light3,
    }}
  >
    <div>
      <Body style={{ fontSize: "12px", color: palette.gray.dark1 }}>
        Last updated: {new Date().toLocaleDateString()}
      </Body>
    </div>

    <div style={{ display: "flex", gap: spacing[2] }}>
      <Button variant="default" onClick={() => setShowModal(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave}>
        Save Changes
      </Button>
    </div>
  </div>
</Modal>;
```

### Search with Autocomplete

```jsx
import TextInput from "@leafygreen-ui/text-input";
import { Body } from "@leafygreen-ui/typography";

// Enhanced search with autocomplete suggestions
function SearchWithAutocomplete({
  onSearch,
  placeholder = "Search entities...",
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <TextInput
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          // Trigger autocomplete fetch
          fetchSuggestions(e.target.value);
        }}
        rightGlyph={<Icon glyph="MagnifyingGlass" />}
      />

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: `1px solid ${palette.gray.light2}`,
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 1000,
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              style={{
                padding: spacing[2],
                cursor: "pointer",
                borderBottom: `1px solid ${palette.gray.light2}`,
                ":hover": { backgroundColor: palette.gray.light3 },
              }}
              onClick={() => {
                setQuery(suggestion.name);
                onSearch(suggestion);
                setShowSuggestions(false);
              }}
            >
              <Body style={{ fontWeight: "500" }}>{suggestion.name}</Body>
              <Body style={{ fontSize: "12px", color: palette.gray.dark1 }}>
                {suggestion.type} • {suggestion.matchReason}
              </Body>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Complex Loading States

```jsx
// Multi-stage loading indicator with different spinners
function ComplexLoadingState({ stage, stages }) {
  return (
    <Card style={{ padding: spacing[4] }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "300px",
          justifyContent: "center",
          gap: spacing[3],
        }}
      >
        <Spinner size="large" />
        <H3>Processing Request</H3>
        <Body style={{ textAlign: "center", color: palette.gray.dark1 }}>
          {stages[stage]?.description || "Processing..."}
        </Body>

        {/* Stage Indicators */}
        <div
          style={{
            display: "flex",
            gap: spacing[4],
            marginTop: spacing[2],
          }}
        >
          {stages.map((stageInfo, index) => (
            <div
              key={stageInfo.id}
              style={{ textAlign: "center", opacity: index <= stage ? 1 : 0.5 }}
            >
              <Icon
                glyph={stageInfo.icon}
                size={24}
                style={{
                  color:
                    index <= stage ? palette.green.base : palette.gray.base,
                }}
              />
              <Body style={{ fontSize: "12px", marginTop: spacing[1] }}>
                {stageInfo.title}
              </Body>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
```

### Expandable Content with Code

```jsx
import ExpandableCard from "@leafygreen-ui/expandable-card";
import Code from "@leafygreen-ui/code";

// Expandable card with syntax-highlighted code (commonly used for query details)
<ExpandableCard
  title="Query Details"
  defaultOpen={false}
  style={{ marginTop: spacing[3] }}
>
  <div style={{ padding: spacing[3] }}>
    <Body style={{ marginBottom: spacing[2], color: palette.gray.dark1 }}>
      Database aggregation pipeline executed:
    </Body>
    <Code
      language="json"
      copyable={true}
      style={{ maxHeight: "300px", overflow: "auto" }}
    >
      {JSON.stringify(queryData, null, 2)}
    </Code>
  </div>
</ExpandableCard>;
```

### Real-time Event Notifications

```jsx
import Banner from "@leafygreen-ui/banner";

// Real-time notifications with dynamic styling based on event type
function EventNotification({ event, onDismiss }) {
  const getEventColor = (operationType) => {
    switch (operationType) {
      case "insert":
        return palette.green.light2;
      case "update":
      case "replace":
        return palette.blue.light2;
      case "delete":
        return palette.red.light2;
      default:
        return palette.gray.light2;
    }
  };

  const getVariant = (operationType) => {
    switch (operationType) {
      case "insert":
        return "success";
      case "update":
      case "replace":
        return "info";
      case "delete":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <Banner
      variant={getVariant(event.operationType)}
      dismissible
      onClose={onDismiss}
      style={{
        marginBottom: spacing[2],
        backgroundColor: getEventColor(event.operationType),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        <Body style={{ fontWeight: "600" }}>
          {formatEventTime()} - {event.description}
        </Body>
      </div>
    </Banner>
  );
}
```

### Custom Node Components for Flow Diagrams

```jsx
import { Handle, Position } from "reactflow";
import Icon from "@leafygreen-ui/icon";
import Badge from "@leafygreen-ui/badge";
import { Body, Overline } from "@leafygreen-ui/typography";

// Custom diamond-shaped decision node
function DecisionNode({ data }) {
  const { label, isActive, isCompleted } = data;

  const getStatusColor = () => {
    if (isCompleted) return palette.green.base;
    if (isActive) return palette.blue.base;
    return palette.gray.base;
  };

  const getBackgroundColor = () => {
    if (isActive)
      return `linear-gradient(135deg, ${palette.blue.light2}, ${palette.blue.light3})`;
    if (isCompleted)
      return `linear-gradient(135deg, ${palette.green.light2}, ${palette.green.light3})`;
    return palette.gray.light3;
  };

  return (
    <div
      style={{
        width: "200px",
        height: "200px",
        background: getBackgroundColor(),
        border: `2px solid ${getStatusColor()}`,
        borderRadius: "0",
        boxShadow: isActive
          ? "0 4px 12px rgba(0,0,0,0.15)"
          : "0 2px 6px rgba(0,0,0,0.08)",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", // Diamond shape
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: "120px",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: getStatusColor(),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[1],
          }}
        >
          {isCompleted ? (
            <Icon glyph="Checkmark" fill={palette.white} size={10} />
          ) : (
            <Icon
              glyph="QuestionMarkWithCircle"
              fill={palette.white}
              size={10}
            />
          )}
        </div>

        <Overline
          style={{
            color: getStatusColor(),
            fontWeight: "bold",
            fontSize: "11px",
          }}
        >
          {label}
        </Overline>
      </div>
    </div>
  );
}

// Custom rectangular processing node
function ProcessingNode({ data }) {
  const { label, stage, isActive, isCompleted } = data;

  return (
    <div
      style={{
        minWidth: "180px",
        padding: spacing[3],
        background: isActive
          ? `linear-gradient(135deg, ${palette.blue.light2}, ${palette.blue.light3})`
          : isCompleted
          ? `linear-gradient(135deg, ${palette.green.light2}, ${palette.green.light3})`
          : palette.gray.light3,
        border: `2px solid ${
          isActive
            ? palette.blue.base
            : isCompleted
            ? palette.green.base
            : palette.gray.base
        }`,
        borderRadius: "8px",
        boxShadow: isActive
          ? "0 4px 12px rgba(0,0,0,0.15)"
          : "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        {isActive && <Spinner size="small" />}
        {isCompleted && <Icon glyph="Checkmark" fill={palette.green.base} />}

        <div>
          <Body style={{ fontWeight: "600", margin: 0 }}>{label}</Body>
          {stage && (
            <Body
              style={{ fontSize: "12px", color: palette.gray.dark1, margin: 0 }}
            >
              {stage}
            </Body>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Advanced Toggle Patterns

```jsx
import Toggle from "@leafygreen-ui/toggle";
import { Body, Label } from "@leafygreen-ui/typography";

// Toggle with descriptive labels and state feedback
function FeatureToggle({
  feature,
  enabled,
  onToggle,
  description,
  disabled = false,
  requiresRestart = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: spacing[3],
        padding: spacing[3],
        border: `1px solid ${palette.gray.light2}`,
        borderRadius: "8px",
        backgroundColor: disabled ? palette.gray.light3 : "white",
      }}
    >
      <Toggle
        checked={enabled}
        onChange={onToggle}
        disabled={disabled}
        aria-label={`Toggle ${feature}`}
      />

      <div style={{ flex: 1 }}>
        <Label
          style={{
            fontWeight: "600",
            color: disabled ? palette.gray.dark1 : palette.gray.dark3,
          }}
        >
          {feature}
        </Label>
        <Body
          style={{
            fontSize: "13px",
            color: palette.gray.dark1,
            marginTop: spacing[1],
          }}
        >
          {description}
        </Body>

        {requiresRestart && enabled && (
          <div
            style={{
              marginTop: spacing[2],
              padding: spacing[2],
              backgroundColor: palette.yellow.light2,
              borderRadius: "4px",
              border: `1px solid ${palette.yellow.light1}`,
            }}
          >
            <Body
              style={{
                fontSize: "12px",
                color: palette.yellow.dark2,
                margin: 0,
              }}
            >
              <Icon glyph="Warning" size={12} fill={palette.yellow.dark2} />{" "}
              Requires restart to take effect
            </Body>
          </div>
        )}
      </div>
    </div>
  );
}
```

### WebSocket Connection Status

```jsx
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { Body } from "@leafygreen-ui/typography";

// WebSocket connection status indicator
function ConnectionStatus({ isConnected, lastEventTime, eventCount = 0 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        padding: spacing[2],
        backgroundColor: isConnected
          ? palette.green.light3
          : palette.red.light3,
        border: `1px solid ${
          isConnected ? palette.green.light2 : palette.red.light2
        }`,
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: isConnected ? palette.green.base : palette.red.base,
          animation: isConnected ? "pulse 2s infinite" : "none",
        }}
      />

      <div>
        <Badge
          variant={isConnected ? "green" : "red"}
          style={{ fontSize: "10px" }}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>

        <Body
          style={{
            fontSize: "12px",
            color: palette.gray.dark1,
            marginTop: spacing[1],
          }}
        >
          {isConnected
            ? `${eventCount} events • Last: ${lastEventTime}`
            : "Connection lost"}
        </Body>
      </div>
    </div>
  );
}
```

### Performance Comparison Panels

```jsx
import Card from "@leafygreen-ui/card";
import { Select, Option } from "@leafygreen-ui/select";
import Button from "@leafygreen-ui/button";
import { H3, Body, Label } from "@leafygreen-ui/typography";
import {
  Table,
  TableBody,
  TableHead,
  HeaderRow,
  HeaderCell,
  Row,
  Cell,
} from "@leafygreen-ui/table";

// Performance metrics comparison interface
function PerformanceComparison({
  primaryModel,
  comparisonModel,
  timeframe,
  onTimeframeChange,
  onStartComparison,
}) {
  const metrics = [
    { key: "accuracy", label: "Accuracy", format: "percentage" },
    { key: "precision", label: "Precision", format: "percentage" },
    { key: "recall", label: "Recall", format: "percentage" },
    { key: "f1_score", label: "F1 Score", format: "decimal" },
    { key: "response_time", label: "Avg Response Time", format: "ms" },
  ];

  const formatValue = (value, format) => {
    switch (format) {
      case "percentage":
        return `${(value * 100).toFixed(1)}%`;
      case "decimal":
        return value?.toFixed(3);
      case "ms":
        return `${value?.toFixed(0)}ms`;
      default:
        return value;
    }
  };

  const getComparisonColor = (primary, comparison) => {
    if (!primary || !comparison) return palette.gray.base;
    if (comparison > primary) return palette.green.base;
    if (comparison < primary) return palette.red.base;
    return palette.gray.base;
  };

  return (
    <Card style={{ padding: spacing[4] }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing[4],
        }}
      >
        <H3>Performance Comparison</H3>

        <div style={{ display: "flex", gap: spacing[2], alignItems: "center" }}>
          <Label>Timeframe:</Label>
          <Select
            value={timeframe}
            onChange={(value) => onTimeframeChange(value)}
            style={{ minWidth: "120px" }}
          >
            <Option value="1h">Last Hour</Option>
            <Option value="24h">Last 24 Hours</Option>
            <Option value="7d">Last 7 Days</Option>
            <Option value="30d">Last 30 Days</Option>
          </Select>

          <Button
            variant="primary"
            size="small"
            onClick={onStartComparison}
            disabled={!primaryModel || !comparisonModel}
          >
            Compare
          </Button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing[4],
        }}
      >
        {/* Primary Model */}
        <div>
          <div
            style={{
              padding: spacing[3],
              backgroundColor: palette.blue.light3,
              border: `2px solid ${palette.blue.base}`,
              borderRadius: "8px",
              marginBottom: spacing[3],
            }}
          >
            <Label style={{ color: palette.blue.dark2, fontWeight: "600" }}>
              Primary Model
            </Label>
            <Body style={{ color: palette.blue.dark2, fontWeight: "500" }}>
              {primaryModel?.name || "None Selected"}
            </Body>
          </div>

          {primaryModel?.metrics && (
            <div>
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: spacing[2],
                    borderBottom: `1px solid ${palette.gray.light2}`,
                  }}
                >
                  <Label>{metric.label}</Label>
                  <Body style={{ fontWeight: "500" }}>
                    {formatValue(
                      primaryModel.metrics[metric.key],
                      metric.format
                    )}
                  </Body>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comparison Model */}
        <div>
          <div
            style={{
              padding: spacing[3],
              backgroundColor: palette.green.light3,
              border: `2px solid ${palette.green.base}`,
              borderRadius: "8px",
              marginBottom: spacing[3],
            }}
          >
            <Label style={{ color: palette.green.dark2, fontWeight: "600" }}>
              Comparison Model
            </Label>
            <Body style={{ color: palette.green.dark2, fontWeight: "500" }}>
              {comparisonModel?.name || "None Selected"}
            </Body>
          </div>

          {comparisonModel?.metrics && (
            <div>
              {metrics.map((metric) => {
                const primaryValue = primaryModel?.metrics?.[metric.key];
                const comparisonValue = comparisonModel.metrics[metric.key];
                const color = getComparisonColor(primaryValue, comparisonValue);

                return (
                  <div
                    key={metric.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: spacing[2],
                      borderBottom: `1px solid ${palette.gray.light2}`,
                    }}
                  >
                    <Label>{metric.label}</Label>
                    <Body style={{ fontWeight: "500", color }}>
                      {formatValue(comparisonValue, metric.format)}
                    </Body>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
```

### Model Configuration Forms

```jsx
import TextInput from "@leafygreen-ui/text-input";
import { Select, Option } from "@leafygreen-ui/select";
import Toggle from "@leafygreen-ui/toggle";
import Button from "@leafygreen-ui/button";
import { H3, Body, Label } from "@leafygreen-ui/typography";
import Callout from "@leafygreen-ui/callout";

// Model configuration form with validation
function ModelConfigForm({ model, onSave, onCancel, isEditing = false }) {
  const [config, setConfig] = useState(model || {});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const handleFieldChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);

    // Clear field-specific error
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  return (
    <Card style={{ padding: spacing[4] }}>
      <H3 style={{ marginBottom: spacing[4] }}>
        {isEditing ? "Edit Model Configuration" : "New Model Configuration"}
      </H3>

      <div
        style={{ display: "grid", gap: spacing[3], marginBottom: spacing[4] }}
      >
        <TextInput
          label="Model Name"
          value={config.name || ""}
          onChange={(e) => handleFieldChange("name", e.target.value)}
          state={errors.name ? "error" : "none"}
          errorMessage={errors.name}
          placeholder="Enter model name"
        />

        <Select
          label="Model Type"
          value={config.type || ""}
          onChange={(value) => handleFieldChange("type", value)}
        >
          <Option value="">Select model type</Option>
          <Option value="classification">Classification</Option>
          <Option value="regression">Regression</Option>
          <Option value="clustering">Clustering</Option>
          <Option value="anomaly_detection">Anomaly Detection</Option>
        </Select>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: spacing[3],
          }}
        >
          <TextInput
            label="Threshold"
            type="number"
            value={config.threshold || ""}
            onChange={(e) =>
              handleFieldChange("threshold", parseFloat(e.target.value))
            }
            placeholder="0.5"
            step="0.01"
            min="0"
            max="1"
          />

          <TextInput
            label="Max Iterations"
            type="number"
            value={config.maxIterations || ""}
            onChange={(e) =>
              handleFieldChange("maxIterations", parseInt(e.target.value))
            }
            placeholder="1000"
          />
        </div>

        {/* Feature toggles section */}
        <div
          style={{
            padding: spacing[3],
            backgroundColor: palette.gray.light3,
            borderRadius: "8px",
            border: `1px solid ${palette.gray.light2}`,
          }}
        >
          <Label
            style={{
              fontWeight: "600",
              marginBottom: spacing[2],
              display: "block",
            }}
          >
            Feature Flags
          </Label>

          <div style={{ display: "grid", gap: spacing[2] }}>
            <Toggle
              checked={config.enableAutoRetrain || false}
              onChange={(checked) =>
                handleFieldChange("enableAutoRetrain", checked)
              }
              label="Enable Auto-Retraining"
              description="Automatically retrain model based on performance metrics"
            />

            <Toggle
              checked={config.enableExplainability || false}
              onChange={(checked) =>
                handleFieldChange("enableExplainability", checked)
              }
              label="Enable Explainability"
              description="Generate explanations for model predictions"
            />

            <Toggle
              checked={config.enableMonitoring || false}
              onChange={(checked) =>
                handleFieldChange("enableMonitoring", checked)
              }
              label="Enable Performance Monitoring"
              description="Track and log model performance metrics"
            />
          </div>
        </div>

        {isDirty && (
          <Callout title="Unsaved Changes" variant="warning">
            You have unsaved changes. Make sure to save before navigating away.
          </Callout>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: spacing[2],
          justifyContent: "flex-end",
          paddingTop: spacing[3],
          borderTop: `1px solid ${palette.gray.light2}`,
        }}
      >
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(config)}
          disabled={!isDirty || Object.keys(errors).some((key) => errors[key])}
        >
          {isEditing ? "Update Model" : "Create Model"}
        </Button>
      </div>
    </Card>
  );
}
```

## Additional Resources

- [LeafyGreen UI GitHub Repository](https://github.com/mongodb/leafygreen-ui)
- [LeafyGreen UI Documentation](https://www.mongodb.design/component/banner/example/)
