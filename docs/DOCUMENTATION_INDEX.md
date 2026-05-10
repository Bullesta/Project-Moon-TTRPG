# Project Moon TTRPG System - Documentation Index

Welcome! This folder contains comprehensive documentation about how the Project Moon TTRPG Foundry VTT system works internally. Use this index to find what you need.

## 📚 Documentation Files

### [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - **START HERE** for Understanding
**Best for:** Learning how everything works

This is the comprehensive guide to the system's internal architecture. It covers:
- System overview and technology stack
- Complete architecture diagram
- Detailed explanation of each core component
- How data flows through the system
- Key concepts (abilities, moves, equipment, weight, etc.)
- Development setup and build commands
- Common modification patterns
- Debugging tips

**Use this when:**
- You're new to the system and want to understand it
- You need to know how two components interact
- You want to understand the overall architecture
- You're debugging a complex issue

---

### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - **USE THIS** for Navigation
**Best for:** Finding files and quick lookups

This is your quick reference guide for fast lookups:
- File-by-file reference with descriptions
- Quick navigation table ("I want to modify...")
- Common code patterns with examples
- Build commands reference
- Debugging checklist
- Common mistakes and fixes

**Use this when:**
- You need to find a specific file
- You want code examples for a pattern
- You're debugging and want a checklist
- You need a build command

---

### [MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md) - **FOLLOW THIS** for Making Changes
**Best for:** Step-by-step modification instructions

This guide has practical, tested instructions for common modifications:
- Simple modifications (rename abilities, change defaults)
- Sheet modifications (add sections, hide elements)
- Roll system modifications (add advantage/disadvantage)
- Content modifications (add moves, equipment)
- Advanced modifications (new abilities, custom sheets)

**Use this when:**
- You want to make a specific change
- You need step-by-step instructions with code
- You're modifying something for the first time
- You want to see complete examples

---

## 🎯 Quick Start Paths

### Path 1: I Want to Understand the System (30 minutes)
1. Read: [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - Architecture section
2. Skim: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - File-by-file reference
3. Look at: `src/module/projectmoonttrpg.js` - The entry point

### Path 2: I Want to Make a Simple Change (15 minutes)
1. Find your change in: [MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md)
2. Follow the step-by-step instructions
3. Use: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) if you get stuck

### Path 3: I'm Debugging a Problem (20 minutes)
1. Check: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Debugging checklist
2. Read: [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - Debugging tips section
3. Review: [MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md) - Common mistakes

### Path 4: I Want to Understand One Component (15 minutes)
1. Find the component in: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - File-by-file reference
2. Read details in: [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - Core Components section
3. Look at actual code in the mentioned file

---

## 🔍 Common Tasks - Where to Look

| Task | Go to |
|------|-------|
| Rename ability scores | MODIFICATION_GUIDE.md → Simple Modifications → #1 |
| Change default HP | MODIFICATION_GUIDE.md → Simple Modifications → #3 |
| Add new resource | MODIFICATION_GUIDE.md → Simple Modifications → #4 |
| Add sheet section | MODIFICATION_GUIDE.md → Sheet Modifications → #6 |
| Hide sheet section | MODIFICATION_GUIDE.md → Sheet Modifications → #7 |
| Add advantage/disadvantage | MODIFICATION_GUIDE.md → Roll System → #8 |
| Create new move | MODIFICATION_GUIDE.md → Content Modifications → #10 |
| Create new ability | MODIFICATION_GUIDE.md → Advanced Modifications → #12 |
| Find where X is defined | QUICK_REFERENCE.md → File-by-File Reference |
| Understanding X concept | SYSTEM_INTERNALS.md → Key Concepts |
| Build/compile something | QUICK_REFERENCE.md → Build Commands Reference |
| Fix something broken | QUICK_REFERENCE.md → Debugging Checklist |

---

## 📖 System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│            Foundry VTT Core Framework                    │
├─────────────────────────────────────────────────────────┤
│  System Registration & Configuration (projectmoonttrpg.js)  │
├─────────────────────────────────────────────────────────┤
│                 Document Classes                         │
│  • ActorDw (Characters/NPCs) → src/module/actor/        │
│  • ItemDw (Moves/Equipment)  → src/module/item/         │
├─────────────────────────────────────────────────────────┤
│              Application Classes (Sheets)               │
│  • Actor Sheets → src/module/actor/                     │
│  • Item Sheets  → src/module/item/                      │
├─────────────────────────────────────────────────────────┤
│           Support Systems & Utilities                    │
│  • Roll System → src/module/rolls.js                    │
│  • Chat System → src/module/chat.js                     │
│  • Utilities   → src/module/utility.js                  │
│  • Helpers     → src/module/handlebars.js               │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Development Workflow

### Quick Setup
```bash
# 1. Install dependencies
npm install

# 2. Start watching for changes
npm run watch

# 3. Open Foundry and refresh (Ctrl+Shift+R)

# 4. Make changes - they auto-compile!
```

### Common Commands
```bash
npm run build          # Build everything once
npm run watch          # Watch for changes (recommended)
npm run compile        # Just compile CSS
npm run compilePacks   # Update content packs
```

---

## 📁 Key Files at a Glance

```
src/
├── module/
│   ├── projectmoonttrpg.js         ← System entry point (where it all starts)
│   ├── config.js               ← Configuration constants
│   ├── utility.js              ← Helper functions
│   ├── rolls.js                ← The 2d6 roll system
│   ├── actor/actor.js          ← Character data preparation
│   ├── actor/actor-sheet.js    ← PC sheet UI
│   ├── item/item.js            ← Item base class
│   └── item/item-sheet.js      ← Item sheet UI
├── yaml/
│   ├── template.yml            ← Data schema definition
│   └── system.yml              ← System manifest
├── templates/
│   ├── sheet/                  ← Sheet HTML templates
│   ├── items/                  ← Item templates
│   └── chat/                   ← Chat message templates
└── styles/
    └── src/                    ← SCSS styling files
```

---

## 🎓 Learning Resources

### For Complete Understanding
Start with **SYSTEM_INTERNALS.md** and read through:
1. System Overview
2. Architecture
3. Core Components (in order)
4. Data Flow
5. Key Concepts

### For Specific Components
Use **QUICK_REFERENCE.md** to jump to any file, then read its description in **SYSTEM_INTERNALS.md**.

### For Practical Implementation
Follow **MODIFICATION_GUIDE.md** step-by-step, with code examples for each modification.

---

## ⚡ Tips for Success

### Best Practices
1. **Always run `npm run watch`** while developing
2. **Hard-refresh Foundry** (Ctrl+Shift+R) after changes
3. **Check the browser console** (F12) for errors
4. **Test with a new character** before modifying existing ones
5. **Make small changes** one at a time

### Common Pitfalls to Avoid
- Forgetting to rebuild (run `npm run build`)
- Using browser refresh instead of hard refresh
- Not checking the console for JavaScript errors
- Editing wrong file (check QUICK_REFERENCE.md)
- Breaking YAML indentation (YAML is whitespace-sensitive)

### When Stuck
1. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Debugging checklist
2. Search [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) for the concept
3. Review actual code file mentioned in docs
4. Check browser console (F12) for error messages

---

## 📝 Documentation Structure

Each documentation file has a specific purpose:

**SYSTEM_INTERNALS.md**
- What: Deep dive into architecture
- Level: Intermediate
- Use when: Need to understand HOW something works

**QUICK_REFERENCE.md**
- What: Fast lookup and navigation
- Level: Beginner to Advanced
- Use when: Need to find something quickly

**MODIFICATION_GUIDE.md**
- What: Step-by-step instructions
- Level: Beginner to Intermediate
- Use when: Want to make a specific change

---

## 🚀 Next Steps

### New to the System?
1. Read: [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - System Overview section (5 min)
2. Skim: [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - Core Components section (15 min)
3. Look at: `src/module/projectmoonttrpg.js` (10 min)

### Want to Make Changes?
1. Check: [MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md) - Find your task
2. Follow: Step-by-step instructions
3. Refer: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) if confused

### Want to Debug Something?
1. Check: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Debugging checklist
2. Review: [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - Debugging tips
3. Inspect: Actual code in the relevant file

---

## 📞 Quick Help Reference

### "I don't know where to start"
→ Read the **[SYSTEM_INTERNALS.md - System Overview](./SYSTEM_INTERNALS.md#system-overview)** section (5 minutes)

### "I want to change X"
→ Look up X in **[MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md)** and follow the steps

### "My change didn't work"
→ Check **[QUICK_REFERENCE.md - Debugging Checklist](./QUICK_REFERENCE.md#debugging-checklist)**

### "Where is file X?"
→ Search **[QUICK_REFERENCE.md - File-by-File Reference](./QUICK_REFERENCE.md#file-by-file-reference)**

### "How does X work?"
→ Look for X in **[SYSTEM_INTERNALS.md - Core Components](./SYSTEM_INTERNALS.md#core-components)**

### "What code pattern should I use?"
→ Check **[QUICK_REFERENCE.md - Common Code Patterns](./QUICK_REFERENCE.md#common-code-patterns)**

---

## 📋 Checklist for Getting Started

- [ ] Read this file (you're reading it!)
- [ ] Read [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - System Overview
- [ ] Bookmark [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for quick lookups
- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run watch` in terminal
- [ ] Refresh Foundry (Ctrl+Shift+R)
- [ ] Make a test change to verify workflow
- [ ] Keep [MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md) open while making changes

---

## 🎯 Your First Modification

Try this simple modification to verify your setup works:

### Change Ability Score Names (5 minutes)

1. Open `src/module/config.js`
2. Find `TTRPG.abilities`
3. Change `"str": "TTRPG.AbilityStr"` to `"str": "TTRPG.AbilityMight"`
4. Find your localization file and change `"TTRPG.AbilityStr": "Strength"` to `"TTRPG.AbilityStr": "Might"`
5. Run `npm run build`
6. Refresh Foundry (Ctrl+Shift+R)
7. Create a new character - STR should now display as "Might"

**If this works:** Your development setup is good to go!
**If this doesn't work:** Check [QUICK_REFERENCE.md - Debugging](./QUICK_REFERENCE.md#debugging-checklist)

---

## 📚 Full Documentation Maps

### SYSTEM_INTERNALS.md Structure
```
1. System Overview
2. Architecture (with diagram)
3. Project Structure
4. Core Components (8 major sections)
5. Data Flow (4 major flows)
6. Key Concepts (abilities, moves, equipment, etc.)
7. Common Modifications
8. Development Setup
9. Debugging Tips
10. Common Issues
11. Version History
```

### QUICK_REFERENCE.md Structure
```
1. Quick Navigation Table
2. File-by-File Reference
3. Template Files
4. Styling (CSS/SCSS)
5. Compendium Content
6. Common Code Patterns
7. Build Commands Reference
8. Debugging Checklist
9. Common Mistakes Table
10. Tips for Common Tasks
```

### MODIFICATION_GUIDE.md Structure
```
1. Before You Start (setup)
2. Simple Modifications (5 examples)
3. Sheet Modifications (2 examples)
4. Roll System Modifications (2 examples)
5. Content Modifications (2 examples)
6. Advanced Modifications (3 examples)
7. Testing Checklist
8. Debugging Guide
```

---

## 💡 Pro Tips

1. **Keep QUICK_REFERENCE.md bookmarked** - You'll use it constantly
2. **Read the code comments** - They often explain intent
3. **Use git/version control** - Makes it easy to revert bad changes
4. **Test in a new world** - Before modifying existing campaigns
5. **Make small, testable changes** - Don't change 10 things at once
6. **Document your changes** - Leave comments in your code

---

**Last Updated:** May 2026  
**System Version:** 1.9.0  
**Foundry Compatibility:** v13

---

**Ready to get started?** → [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md)  
**Need quick answers?** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)  
**Want to make changes?** → [MODIFICATION_GUIDE.md](./MODIFICATION_GUIDE.md)
