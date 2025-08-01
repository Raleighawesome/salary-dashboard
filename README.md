# 💰 Salary Raise Dashboard

A web application for managers to efficiently allocate salary raises with budget tracking and policy compliance validation.

## 🎯 What It Does

This dashboard helps managers during salary review cycles to:
- Upload employee salary and performance data from CSV/XLSX files
- Set and track budget allocations in multiple currencies
- Make data-driven raise decisions with real-time calculations
- Validate decisions against company policies (comparatio floors, raise limits)
- Export finalized decisions for leadership approval
- Maintain data persistence with automatic backups

## 🚀 Quick Start

### Prerequisites

- **Node.js** (version 18 or higher)
- **npm** or **yarn** package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone or download** the project
2. **Install dependencies:**
   ```bash
   npm install
   ```

### Running the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

3. **You're ready to go!** The application will open with the file upload screen.

## 📖 How to Use

### Step 1: Prepare Your Data Files

You'll need employee data in CSV or XLSX format. The application supports:

**Salary Sheet** (required) - Must include:
- `employeeId` or `email` - Unique identifier
- `name` - Employee full name
- `baseSalary` - Current salary amount
- `currency` - Currency code (USD, EUR, GBP, etc.)
- `country` - Employee location
- `comparatio` - Current comparatio percentage

**Performance Sheet** (optional) - Can include:
- `employeeId` or `email` - Matching the salary sheet
- `performanceRating` - Performance score
- `retentionRisk` - Risk level
- `businessImpactScore` - Impact rating

### Step 2: Upload Your Files

1. **Drag and drop** files onto the upload area, or **click to browse**
2. The app will automatically detect file types and process the data
3. Review the upload summary for any errors or warnings
4. Click **"Proceed to Dashboard"** when ready

### Step 3: Set Your Budget

1. **Enter your total raise budget** in the Budget Input section
2. **Select the appropriate currency**
3. The dashboard will show real-time budget utilization

### Step 4: Review and Adjust Raises

1. **Navigate between views:**
   - **Overview**: Budget metrics and heat maps
   - **Employee Table**: Sortable list with inline editing
   - **Employee Details**: Individual employee analysis

2. **Make raise decisions:**
   - Edit proposed raise amounts directly in the table
   - View real-time calculations for new salaries and percentages
   - Check policy violations (highlighted in red/yellow)

3. **Monitor budget:**
   - Track remaining budget in real-time
   - Get warnings when approaching budget limits

### Step 5: Validate and Export

1. **Review policy violations** and budget usage
2. **Export final decisions** to CSV for leadership review
3. **Save your work** - the app automatically backs up your progress

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Format code
npm run format
```

## 📁 File Format Examples

### Salary Sheet (CSV/XLSX)
```csv
employeeId,name,email,baseSalary,currency,country,comparatio,jobTitle
EMP001,John Smith,john.smith@company.com,75000,USD,United States,85.5,Software Engineer
EMP002,Jane Doe,jane.doe@company.com,45000,EUR,Germany,78.2,Product Manager
```

### Performance Sheet (CSV/XLSX)
```csv
employeeId,performanceRating,retentionRisk,businessImpactScore
EMP001,4.2,2,8
EMP002,3.8,1,9
```

## 🎨 Key Features

- **Multi-currency support** with real-time exchange rates
- **Intelligent data joining** across salary and performance files
- **Policy validation** for comparatio floors and raise limits
- **Visual analytics** with heat maps and trend charts
- **Session persistence** - your work is automatically saved
- **Export functionality** with customizable formats
- **Responsive design** optimized for desktop use

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: CSS Modules
- **Data Storage**: IndexedDB (via Dexie)
- **File Processing**: Papaparse + XLSX
- **Charts**: Plotly.js
- **Testing**: Jest + Testing Library

## 📊 Policy Validation Rules

The application enforces these default policies:
- **Comparatio Floor**: 74% minimum
- **Maximum Raise (US)**: 12% of base salary
- **Maximum Raise (India)**: 10% of base salary
- **No-Raise Threshold**: Employees without raises for 18+ months flagged

## 🔒 Data Privacy

- **All data stays local** - nothing is sent to external servers
- **Automatic backups** stored in your browser's local storage
- **Reset functionality** to clear all data when needed

## 🐛 Troubleshooting

**File Upload Issues:**
- Ensure files are in CSV or XLSX format
- Check that required columns (employeeId, name, baseSalary) are present
- Verify currency codes are valid (USD, EUR, GBP, etc.)

**Performance Issues:**
- For 500+ employees, use table pagination and filtering
- Large files may take a moment to process - watch for progress indicators

**Data Not Saving:**
- Enable browser cookies and local storage
- Check browser console for any error messages