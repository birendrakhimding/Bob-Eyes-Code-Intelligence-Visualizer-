# 🔍 Bob Eyes - Code Intelligence Visualizer

A powerful code analysis and visualization tool that parses code in multiple languages, extracts relationships between functions and classes, and displays them in an interactive graph visualization.

![IBM Bob Dev Day Hackathon](https://img.shields.io/badge/IBM-Bob%20Dev%20Day%20Hackathon-blue)
![Python](https://img.shields.io/badge/Python-3.8+-green)
![React](https://img.shields.io/badge/React-19.2.5-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Latest-teal)

## ✨ Features

- 🌐 **Multi-Language Support**: Python, JavaScript, TypeScript, Java, Go, Rust, C/C++, Ruby, PHP
- 🔍 **Intelligent Parsing**: AST-based parsing for Python, regex-based for other languages
- 📊 **Interactive Visualization**: Beautiful graph-based visualization using ReactFlow
- 🔄 **Impact Analysis**: Compare code versions to see what changed and what's affected
- 🤖 **AI-Powered Descriptions**:  IBM Granite AI integration for function descriptions
- 🎨 **Modern UI**: Clean, dark-themed interface with syntax highlighting
- ⚡ **Real-time Analysis**: Fast parsing and visualization

## 🏗️ Architecture

### Backend (FastAPI + Python)
```
backend/
├── main.py                    # FastAPI app entry point
├── models/
│   └── schemas.py            # Pydantic request/response models
├── parsers/
│   ├── language_detector.py  # Auto-detect programming language
│   ├── python_parser.py      # Python AST parser
│   └── generic_parser.py     # Regex parser for other languages
├── ai/
│   └── granite_client.py     # IBM Granite AI integration
├── services/
│   └── impact_analyzer.py    # Code change impact analysis
└── api/
    └── routes.py             # API endpoints
```

### Frontend (React + Vite)
```
frontend/src/
├── App.jsx                   # Main application component
├── config/
│   └── constants.js          # Colors, API URL, constants
├── components/
│   ├── CodeEditor.jsx        # Code editor with line numbers
│   ├── GlowFilters.jsx       # SVG glow effects
│   └── nodes/
│       ├── FunctionNode.jsx  # Function/class/variable node
│       └── ClassGroupNode.jsx # Class group wrapper
├── utils/
│   ├── layoutEngine.js       # Graph layout algorithm
│   └── nodeBuilder.js        # Node data builder
└── hooks/
    └── useHighlight.js       # Node highlighting logic
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+**
- **Node.js 16+**
- **npm or yarn**

### Backend Setup

1. Navigate to the backend directory:
```bash
cd bob_eyes/backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install fastapi uvicorn python-dotenv ibm-watsonx-ai
```

4. Configure environment variables (optional for AI features):
```bash
# Create .env file
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

5. Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd bob_eyes/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📖 Usage

### Basic Code Analysis

1. **Paste Code**: Copy your code into the left editor panel
2. **Select Language**: Choose a language or use auto-detect
3. **Analyze**: Click "Analyze Code" button
4. **Explore**: Interact with the generated graph:
   - Click nodes to highlight connections
   - Hover over edges to see relationships
   - Zoom and pan to navigate
   - Use minimap for overview

### Impact Analysis Mode

1. **Enable Impact Mode**: Check the "Impact Mode" checkbox
2. **Paste Original Code**: Add your original code in the top editor
3. **Paste Modified Code**: Add the updated version in the bottom editor
4. **Compare**: Click "Compare Impact" to see:
   - 🟢 **Added**: New functions/classes
   - 🟠 **Modified**: Changed functions/classes
   - 🔴 **Removed**: Deleted functions/classes
   - 🟣 **Affected**: Functions that call modified code

## 🔌 API Endpoints

### `POST /parse`
Parse code and extract structure.

**Request:**
```json
{
  "code": "def hello():\n    print('Hello')",
  "language": "auto"
}
```

**Response:**
```json
{
  "nodes": [...],
  "edges": [...],
  "language": "python",
  "stats": {
    "functions": 1,
    "classes": 0,
    "variables": 0,
    "imports": 0,
    "connections": 0
  }
}
```

### `POST /impact`
Analyze impact of code changes.

**Request:**
```json
{
  "old_code": "def hello():\n    print('Hello')",
  "new_code": "def hello():\n    print('Hi')",
  "language": "auto"
}
```

**Response:**
```json
{
  "nodes": [...],  // with impact field: "added", "modified", "removed", "affected"
  "edges": [...],
  "language": "python"
}
```

### `GET /health`
Check API health and supported languages.

**Response:**
```json
{
  "status": "ok",
  "languages": ["python", "javascript", "typescript", ...]
}
```

## 🎨 Features in Detail

### Language Detection
Automatically detects programming language using pattern matching:
- Analyzes syntax patterns (keywords, operators, structures)
- Resolves ambiguities (TypeScript vs JavaScript, C vs C++)
- Falls back to Python if uncertain

### Python Parser
- Uses Python's built-in AST (Abstract Syntax Tree)
- Extracts:
  - Functions (sync/async)
  - Classes with inheritance
  - Methods and their parent classes
  - Decorators
  - Docstrings
  - Function calls and relationships
  - Type annotations

### Generic Parser
- Regex-based parsing for non-Python languages
- Extracts:
  - Functions/methods with parameters
  - Classes/structs/interfaces
  - Inheritance relationships
  - Top-level variables
  - Import statements
  - Function calls

### Graph Layout
- Hierarchical tree layout based on call relationships
- Groups class methods inside class containers
- Separates imports, variables, and callable code
- Automatic sizing based on content
- Optimized spacing for readability

## 🤖 AI Integration (Optional)

Bob Eyes can integrate with IBM Granite AI to generate natural language descriptions of functions:

1. Set up IBM Watsonx credentials in `.env`
2. The system will automatically generate descriptions during parsing
3. Descriptions appear in function nodes with an "AI:" prefix

## 🛠️ Development

### Backend Development
```bash
# Run with auto-reload
uvicorn main:app --reload

# Run tests (if implemented)
pytest

# Format code
black .
```

### Frontend Development
```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📦 Dependencies

### Backend
- **FastAPI**: Modern web framework
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation
- **python-dotenv**: Environment variables
- **ibm-watsonx-ai**: AI integration (optional)

### Frontend
- **React 19.2.5**: UI framework
- **ReactFlow 11.11.4**: Graph visualization
- **Vite 8.0.10**: Build tool
- **ESLint**: Code linting

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project was created for the IBM Bob Dev Day Hackathon.

## 🙏 Acknowledgments

- IBM Granite AI for intelligent code descriptions
- ReactFlow for the amazing graph visualization library
- The open-source community for inspiration and tools

## 📞 Support

For issues, questions, or suggestions, please open an issue in the repository.

---

**Built with ❤️ for IBM Bob Dev Day Hackathon**