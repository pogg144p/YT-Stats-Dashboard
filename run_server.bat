@echo off
REM Activate the virtual environment and run the FastAPI server

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Run the FastAPI server with uvicorn
echo Starting YT Stats Dashboard server...
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
