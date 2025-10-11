# Extension Console 💬

**Chat-First Extension Builder** for the personalized ERP system.

Build service extensions through conversational AI—no forms, no wizards, just chat.

## Features

✅ **Chat-Based Creation** - Describe extensions in plain English
✅ **Natural Language Understanding** - AI parses field requirements automatically
✅ **Smart Follow-ups** - Context-aware questions to complete missing details
✅ **Contract Validation** - Real-time backward compatibility checks
✅ **Plan Preview** - See exactly what will change before approving
✅ **Impact Analysis** - Detailed reports on affected endpoints and events
✅ **One-Click Approval** - Generate and deploy code artifacts with a button
✅ **Audit History** - View all extensions per tenant with timeline

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Extension Console (React + Vite)                         │
│ ├─ ChatInterface: Conversational extension builder      │
│ │  ├─ Message stream with user/assistant/system roles   │
│ │  ├─ Quick action chips (Order, Item, Optional, etc.)  │
│ │  └─ Draft status tracking                             │
│ ├─ PlanPanel: Implementation preview (right sidebar)     │
│ │  ├─ Storage, API, UI, Test, Docs breakdown           │
│ │  └─ "Approve Plan" action button                      │
│ ├─ ImpactReportPanel: Contract break warnings           │
│ │  ├─ Violations list                                   │
│ │  ├─ Affected endpoints/events                         │
│ │  └─ "Revise Extension" action                         │
│ └─ AuditHistory: Timeline view per tenant               │
└──────────────────────────────────────────────────────────┘
                         │
                         ↓ POST /chat/message
┌──────────────────────────────────────────────────────────┐
│ Extension Service (ext-svc) - Port 8090                  │
│ ├─ ChatService: Orchestrates conversational flow        │
│ │  ├─ Intent parsing (add_field, approve, revise)      │
│ │  ├─ Session management (drafts, fields, answers)     │
│ │  └─ Status tracking (collecting → validating → ready)│
│ ├─ NLUHelper: Natural language understanding            │
│ │  ├─ Field name/type extraction via regex patterns    │
│ │  ├─ Constraint parsing (maxLength, enums, ranges)    │
│ │  └─ Follow-up question generation                     │
│ ├─ ContractGuard: Backward compatibility enforcement    │
│ ├─ StorageGuard: JSONB column verification              │
│ └─ CodeGenerator: Artifact generation on approval       │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### Access the Console

The console is deployed at:
```
http://localhost:3000
```

Port-forward if needed:
```bash
kubectl -n dev port-forward svc/ext-console 3000:80
```

### Chat Workflow Example

**Step 1: Describe what you need**
```
You: Add Customer PO on order header, optional, max length 40
```

**Step 2: Answer follow-up questions (if any)**
```
Assistant: Is this field required?
You: optional
```

**Step 3: Add more fields or finish**
```
You: Add priority level as enum with values standard, high, critical
Assistant: Added field "priorityLevel". Add more or type "done".

You: done
```

**Step 4: Review validation & plan**
```
Assistant: ✅ Validation successful! Here's the plan:

Storage: JSONB field in order-svc/order_header
API: Optional overlay on existing endpoints
Fields: customerPo (string), priorityLevel (string)
Tests: Auto-generated validation tests
Docs: kg.yaml, change-map.yaml updates

Type "approve" to proceed with implementation.
```

**Step 5: Approve and generate**
```
You: approve
```

Assistant generates code artifacts, creates PRs, and prepares for deployment!

### Contract Break Handling

If your extension violates backward compatibility:

```
Assistant: ⚠️ Contract Break Detected:
- Extension fields cannot be required (must be optional for backward compatibility)

To fix: Make all fields optional or remove conflicts. Type "revise" to adjust.
```

The plan panel will show:
- **Violations** - Specific contract rules broken
- **Affected Endpoints** - APIs that would break
- **Affected Events** - Events that would break
- **Fix Suggestions** - How to resolve issues

Type `revise` to restart field collection with the guidance in mind.

## Development

### Environment Variables

Create a `.env` file in the project root:

```bash
# Backend API base URL
VITE_EXT_API_BASE=http://localhost:8090

# Or for production/k8s
# VITE_EXT_API_BASE=/api
```

### Local Development

```bash
cd apps/demos/ext-console
npm install
npm run dev
```

Visit http://localhost:3000

Ensure `ext-svc` is running on port 8090:
```bash
cd apps/services/ext-svc
npm install
npm start
```

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

### Docker Build

```bash
docker build -t ext-console:dev .
```

### Deploy to Kubernetes

```bash
k3d image import ext-console:dev -c dev
kubectl apply -f deployment.yaml
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **TanStack Query** - Data fetching
- **Axios** - HTTP client
- **date-fns** - Date formatting
- **Lucide React** - Icons
- **Nginx** - Production web server

## API Integration

All API calls are proxied through Nginx:

```
/api/* → http://ext-svc.dev.svc.cluster.local:8090/*
```

API client: `src/services/api.ts`

## Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `ChatInterface` | Main chat UI with message stream | `tenantId` |
| `PlanPanel` | Implementation plan preview (right sidebar) | Rendered conditionally |
| `ImpactReportPanel` | Contract break warnings (right sidebar) | Rendered conditionally |
| `AuditHistory` | Timeline view of all extensions | `tenantId` |

## Chat Status Flow

```
idle → collecting → validating → ready_to_propose → proposed
                        ↓
                  contract_break (show impact report, allow revise)
```

## Sample Chat Patterns

**Adding a simple field:**
```
You: Add notes field to order header, optional, max 500 chars
```

**Adding an enum:**
```
You: Add shipping method as enum: standard, express, overnight
```

**Adding a date field:**
```
You: Add expected delivery date to order items
```

**Multiple fields:**
```
You: Add Customer PO, optional, max 40 chars
You: Add priority with values low, medium, high
You: done
```

## Troubleshooting

**Console not loading:**
```bash
kubectl -n dev get pods -l app=ext-console
kubectl -n dev logs -l app=ext-console
```

**API calls failing:**
- Check ext-svc is running: `kubectl -n dev get pods -l app=ext-svc`
- Check nginx proxy config in `nginx.conf`
- View browser console for errors

**Build failures:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Screenshots

### Create Draft
![Draft creation form with tenant/service/extension name fields]

### Q&A Schema Builder
![Interactive chat interface for defining extension fields]

### Validation Results
![Impact report showing backward compatibility status]

### Generated Artifacts
![Tabbed view of AJV, Zod, UI, and test code]

### Test Results
![Test execution status with pass/fail counts and logs]

### Approval Workflow
![Approval form and deployment checklist]

### Audit History
![Timeline view of all extensions per tenant]

## License

Part of the Personalized ERP Demo project.
