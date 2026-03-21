---
name: zero-dependency-viz
description: Build data visualizations without external libraries. Use when creating knowledge graphs, tag clouds, charts, or generating statistics UI for the Reader.
---

# Zero-Dependency Visualization Rules

To ensure our exported HTML remains lightweight, strictly offline-capable, and print-friendly, we must avoid heavy third-party charting libraries.

## 1. No External Libraries
- **STRICTLY PROHIBITED**: Do not run `npm install echarts`, `d3`, `chart.js`, or any heavy visualization dependencies.

## 2. Native Rendering Strategies
- **For Graphs/Nodes**: Use native `<svg>` tags. Map your data to `<circle>` (nodes) and `<line>` (edges) directly in React.
- **For Tag Clouds**: Use Tailwind CSS utilities (`flex`, `flex-wrap`, `gap`) and inline styles for dynamic sizing based on tag frequency.

## 3. Stateless & Print-Ready
Ensure all generated visualizations are stateless and pure data-driven. Test the layout mentally against `@media print` constraints to ensure graphs do not break across physical pages.