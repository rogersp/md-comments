---
id: 'FEAT-IDE-OUTLINE'
title: 'Desktop IDE Comment Preview Outline Navigator'
category: 'ide'
interfaces:
  - 'vscode'
  - 'cursor'
  - 'antigravity'
flowId: 'FLOW-IDE-OUTLINE'
dependsOn:
  - 'FEAT-IDE-LINK-NAV'
implementedIn:
  - 'vscode-extension/media/outline.js'
  - 'vscode-extension/media/navModel.js'
  - 'vscode-extension/media/navigation.css'
  - 'vscode-extension/src/commentPreviewPanel.ts'
verifiedIn:
  - 'tests/vscode-nav-model.test.ts'
  - 'tests/e2e/vscode-outline.spec.ts'
invariants:
  - 'INV-XSS-SANITIZED'
minCoverage: 100
---

# Desktop IDE Comment Preview Outline Navigator

## Overview

A drawer on the left of the standalone comment preview lists the document's headings. It has a depth selector (H2, H3, H4, All) and a filter that searches every level. It highlights the section in view and shows how many open inline comment threads each section holds, subsections included. Clicking an entry jumps to the heading and records history, so Back returns. The drawer's open state and depth persist across files in the same panel.

## User Journey (Gherkin Scenarios)

- Given a long markdown document open in the comment preview
- When the user toggles the outline from the navigation bar or presses O
- Then the headings to the chosen depth are listed with open-thread counts
- When the user clicks an entry
- Then the panel scrolls to that heading and the entry is highlighted
