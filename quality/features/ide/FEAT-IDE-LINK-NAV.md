---
id: 'FEAT-IDE-LINK-NAV'
title: 'Desktop IDE Comment Preview Link Navigation'
category: 'ide'
interfaces:
  - 'vscode'
  - 'cursor'
  - 'antigravity'
flowId: 'FLOW-IDE-LINK-NAV'
dependsOn:
  - 'FEAT-IDE-PREVIEW'
implementedIn:
  - 'vscode-extension/src/headingIds.ts'
  - 'vscode-extension/src/links.ts'
  - 'vscode-extension/src/navHistory.ts'
  - 'vscode-extension/src/extension.ts'
  - 'vscode-extension/src/commentPreviewPanel.ts'
  - 'vscode-extension/media/navModel.js'
  - 'vscode-extension/media/navigation.js'
  - 'vscode-extension/media/navigation.css'
verifiedIn:
  - 'tests/vscode-heading-ids.test.ts'
  - 'tests/vscode-links.test.ts'
  - 'tests/vscode-nav-model.test.ts'
  - 'tests/vscode-nav-history.test.ts'
  - 'tests/e2e/vscode-link-navigation.spec.ts'
invariants:
  - 'INV-XSS-SANITIZED'
minCoverage: 100
---

# Desktop IDE Comment Preview Link Navigation

## Overview

Links in the standalone comment preview behave as they do on GitHub. Headings carry GitHub's ids, same-file fragment links and `<a id>` anchors scroll to their target, and relative links to other markdown files re-render the panel on that file at the linked section. Cmd/Ctrl-click or middle-click opens the file in a new panel instead (`mdComments.openLinks` swaps the two). Links to other files open in an editor.

## User Journey (Gherkin Scenarios)

- Given a markdown document open in the comment preview
- When the user clicks a link to a numbered heading in the same file
- Then the panel scrolls that heading to the top
- When the user clicks a relative link to another markdown file with a fragment
- Then the same panel shows that file, scrolled to the linked section
- When the user Cmd/Ctrl-clicks the same link
- Then a second comment preview opens beside the first on the linked file
- When the user presses Back (the ← button, Alt+← or Ctrl+- on macOS)
- Then the panel returns to the previous file and scroll position
- When the user presses the mouse back or forward side button over the panel
- Then the panel navigates the same way, and VS Code's editor history does not move
