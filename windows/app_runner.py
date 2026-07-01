import os
import sys
import webbrowser
import http.server
import socketserver
import threading
import time

# Determine base directory containing the HTML assets (temp directory in PyInstaller or native folder)
try:
    base_dir = sys._MEIPASS
except Exception:
    base_dir = os.path.abspath(os.path.dirname(__file__) if __file__ else ".")

# Change directory so http.server is serving the correct assets folder
os.chdir(base_dir)

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    # Start server in a daemon thread so it terminates when the main window closes
    threading.Thread(target=start_server, daemon=True).start()
    
    # Wait half a second for server initialization before opening browser
    time.sleep(0.5)
    webbrowser.open(f"http://localhost:{PORT}")
    
    print("====================================================")
    print("      Workflow Updater Standalone Desktop App       ")
    print("====================================================")
    print(" [√] Live local server successfully started!")
    print(f" [√] Dashboard running at: http://localhost:{PORT}")
    print("----------------------------------------------------")
    print(" Close this console window to shut down the application.")
    print("====================================================")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down server...")
