import subprocess
import threading
import time
import webbrowser
import os
import sys
import signal

# Configuration
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
FRONTEND_URL = "http://localhost:5173"
BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8000

# Global processes
backend_process = None
frontend_process = None

def get_python_executable():
    """Find the best python executable, preferring virtual environments.
    Validates that the found executable actually works AND has fastapi installed."""
    # Possible paths for venv python on Windows and Unix
    # Order: backend/venv first (known working), then venv_win, then others
    candidates = [
        # backend/venv (Windows standard — preferred)
        os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, "venv", "bin", "python.exe"),
        os.path.join(BACKEND_DIR, "venv", "bin", "python"),
        # backend/.venv
        os.path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, ".venv", "bin", "python.exe"),
        os.path.join(BACKEND_DIR, ".venv", "bin", "python"),
        # backend/venv_win (legacy — may be broken if base Python was uninstalled)
        os.path.join(BACKEND_DIR, "venv_win", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, "venv_win", "bin", "python.exe"),
        # root/venv
        os.path.join(os.path.dirname(BACKEND_DIR), "venv", "Scripts", "python.exe"),
        os.path.join(os.path.dirname(BACKEND_DIR), "venv", "bin", "python.exe"),
        os.path.join(os.path.dirname(BACKEND_DIR), "venv", "bin", "python"),
        # root/.venv (VS Code default)
        os.path.join(os.path.dirname(BACKEND_DIR), ".venv", "Scripts", "python.exe"),
        os.path.join(os.path.dirname(BACKEND_DIR), ".venv", "bin", "python.exe"),
        os.path.join(os.path.dirname(BACKEND_DIR), ".venv", "bin", "python"),
    ]
    
    for candidate in candidates:
        if os.path.exists(candidate):
            # Validate 1: Can the interpreter run at all?
            try:
                result = subprocess.run(
                    [candidate, "--version"],
                    capture_output=True, timeout=5
                )
                if result.returncode != 0:
                    print(f"[!] Venv found but broken (base Python missing?): {candidate}")
                    continue
            except (subprocess.TimeoutExpired, OSError, FileNotFoundError):
                print(f"[!] Venv found but cannot execute: {candidate}")
                continue
            
            # Validate 2: Can it import fastapi? (the core dependency)
            try:
                result = subprocess.run(
                    [candidate, "-c", "import fastapi"],
                    capture_output=True, timeout=10
                )
                if result.returncode == 0:
                    print(f"[*] Found working virtual environment: {candidate}")
                    return candidate
                else:
                    print(f"[!] Venv works but missing fastapi: {candidate}")
            except (subprocess.TimeoutExpired, OSError):
                print(f"[!] Venv import check failed: {candidate}")

    # Fallback to current interpreter
    print(f"[*] No working virtual environment found. Using system: {sys.executable}")
    return sys.executable

def run_backend():
    global backend_process
    python_exe = get_python_executable()
    print(f"\n[BACKEND] Starting via: {python_exe}")
    
    # Run FastAPI app via uvicorn
    cmd = [python_exe, "-m", "app.main"]
    
    # Build environment with proper venv activation
    env = os.environ.copy()
    venv_dir = os.path.dirname(os.path.dirname(python_exe))  # go up from Scripts/python.exe
    if os.path.isdir(venv_dir):
        env["VIRTUAL_ENV"] = venv_dir
        # Prepend venv Scripts/bin to PATH so subprocesses find the right python
        if sys.platform == "win32":
            scripts_dir = os.path.join(venv_dir, "Scripts")
        else:
            scripts_dir = os.path.join(venv_dir, "bin")
        env["PATH"] = scripts_dir + os.pathsep + env.get("PATH", "")
    
    try:
        # cwd=BACKEND_DIR is important so it finds 'app' module
        backend_process = subprocess.Popen(cmd, cwd=BACKEND_DIR, env=env)
        print(f"[BACKEND] Process started with PID {backend_process.pid}")
    except Exception as e:
        print(f"[!] Failed to start backend: {e}")

def run_frontend():
    global frontend_process
    print("[*] Starting Frontend...")
    
    # Check if npm is installed
    try:
        if sys.platform == 'win32':
            subprocess.run(["where", "npm"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        else:
            subprocess.run(["which", "npm"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError:
        print("\n\n [CRITICAL ERROR] 'npm' not found in PATH.")
        print(" [!] CAUSE: If you just installed Node.js, your terminal does not see it yet.")
        print(" [!] SOLUTION: Close THIS terminal window completely and open a new one.")
        print(" [!] Then run 'python run.py' again.\n\n")
        return

    # Check if node_modules exists
    if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
        print("[*] node_modules not found. Attempting 'npm install'...")
        try:
            subprocess.check_call(["npm", "install"], cwd=FRONTEND_DIR, shell=True)
        except subprocess.CalledProcessError:
            print("[!] 'npm install' failed. Please install Node.js and run 'npm install' in frontend folder manually.")
            return

    # Using shell=True for windows npm compatibility
    cmd = ["npm", "run", "dev"]
    try:
        frontend_process = subprocess.Popen(cmd, cwd=FRONTEND_DIR, shell=True)
    except Exception as e:
        print(f"[!] Failed to start frontend: {e}")

def cleanup(signum, frame):
    print("\n[*] Shutting down services...")
    if backend_process:
        backend_process.terminate()
    if frontend_process:
        # On Windows, terminating shell=True process is tricky, often need taskkill
        if sys.platform == 'win32':
             subprocess.call(['taskkill', '/F', '/T', '/PID', str(frontend_process.pid)])
        else:
            frontend_process.terminate()
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("=== EventHorizon AI Runner ===")
    
    # Start Backend
    t_backend = threading.Thread(target=run_backend)
    t_backend.start()
    
    # Start Frontend
    t_frontend = threading.Thread(target=run_frontend)
    t_frontend.start()

    # Wait for servers to spin up (naive wait)
    print("[*] Waiting for services to startup...")
    time.sleep(5) 
    
    print(f"[*] Opening {FRONTEND_URL}")
    webbrowser.open(FRONTEND_URL)

    print("[*] App is running. Press Ctrl+C to stop.")
    
    # Keep main thread alive
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()
