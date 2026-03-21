---
name: safe-dom-manipulation
description: Safely manipulate contentEditable DOM elements. Use when implementing text replacement, smart resizing, text selection, or modifying Editor.tsx content.
---

# Safe DOM Manipulation Guidelines

When working with `contentEditable` areas or injecting HTML dynamically, you must prevent cursor jumping, React state desync, and DOM corruption.

## 1. State vs. DOM Awareness
Always remember there is an information gap between React's `state` (e.g., `formData.content`) and the browser's native DOM selection state.

## 2. Safe Range Replacement
- **NEVER** use generic string `.replace()` on `innerHTML` for text manipulation.
- **ALWAYS** capture the exact selection range before modification:
  `const selection = window.getSelection(); const range = selection.getRangeAt(0);`
- Use native execution for insertion: `document.execCommand('insertText', false, newText)` or safely use `range.deleteContents()` followed by `range.insertNode()`.

## 3. State Synchronization (Crucial)
Immediately after a native DOM manipulation succeeds, you must manually trigger React's state sync to prevent the next render from wiping out your changes:
`if (contentRef.current) setFormData(prev => ({ ...prev, content: contentRef.current.innerHTML }));`