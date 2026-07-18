# ContractIQ

ContractIQ is a starter application for uploading and reviewing legal contracts.

## Run locally

1. Install Python 3.11+ and Node.js 20+.
2. In `backend`, create and activate a virtual environment, then install the backend packages:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   uvicorn app.main:app --reload
   ```

3. In a second terminal, start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

Open `http://localhost:3000` for the web app and `http://127.0.0.1:8000/docs` for the API documentation.
