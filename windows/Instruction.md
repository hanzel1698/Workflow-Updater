# Role & Objective
You are an expert full-stack developer. Your task is to build a lightweight, highly responsive internal web application that acts as a clean, custom UI frontend for an existing, shared Google Sheets project tracker. 

The goal is to eliminate the need for manual, clunky filtering inside Google Sheets by creating an elegant, dedicated form and dashboard for the user to manage only their specific work.

# Core Requirements

## 1. Google Sheets Integration
- Connect to a specific Google Sheet using either:
  - **Option A (Preferred for serverless/frontend-only)**: A Google Apps Script deployed as a Web App URL acting as a REST API (GET to fetch data, POST to append/update).
  - **Option B**: Node.js/Python backend utilizing the official `@googleapis/sheets` library with a Service Account credential.
- Read existing column headers dynamically or map them cleanly in a configuration file.
- Support two primary actions:
  - **Append**: Write new rows to the sheet.
  - **Update**: Modify specific columns (like 'Status') on an existing row without disrupting other columns or team members' rows.

## 2. Smart Data Filtering (The "My Work" View)
- Implement a user-selection filter (e.g., a dropdown or hardcoded setting for "Assignee Name").
- On load, fetch all data but ONLY display rows where the "Assignee" column matches the selected user.
- Eliminate the need for temporary sheet filters. The user should only see their tasks.

## 3. Dynamic Form & Modern UI
- Build a polished, modern, and minimalist user interface using **Tailwind CSS**.
- **Dashboard View**: Display filtered tasks in a clean grid or kanban-style layout showing key details and current status.
- **Input/Edit Form**: 
  - Create an input field *only* for the specific columns I explicitly select (to keep the layout clean).
  - Use structured UI inputs: Dropdown menus for "Status" or "Priority" columns to enforce data validation and prevent typos.
  - Provide an intuitive edit modal or inline-update system to quickly flip a task status (e.g., from "In Progress" to "Completed").

## 4. Developer Preferences
- **Tech Stack**: Use a modern, fast, and easy-to-deploy stack (e.g., Next.js with React, Vite/React with a lightweight backend, or pure HTML/JS communicating with a Google Apps Script).
- **UX/UI Style**: Highly scannable, clean borders, generous whitespace, fast loading, and clear visual feedback (loading spinners, success toasts on data submission).

# Step-by-Step Implementation Instructions
1. **Setup & Architecture**: Propose the simplest architecture based on the stack. Give me the Google Apps Script code or backend API setup instructions first if required.
2. **Schema Mapping**: Provide a clear configuration file (`config.js` or `.env`) where I can paste my exact Google Sheet ID, Sheet Name, and define which columns should appear as app inputs.
3. **Frontend Development**: Build the dashboard layout, user filter toggle, input forms, and status update buttons.
4. **State Management**: Ensure that when a user updates a task status, the UI updates instantly (optimistic UI updates) and fires the API request in the background.

Please provide the structural layout of the project and the first set of files to get started.
