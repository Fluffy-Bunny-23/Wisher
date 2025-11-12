#!/usr/bin/env python3
"""
Simple HTTP Server for Wisher Development

This script starts a local development server for the Wisher application.
It serves static files and handles CORS for Firebase integration.

Usage:
    python server.py [port]
    
Default port is 8000.
"""

import http.server
import socketserver
import sys
import os
from urllib.parse import urlparse

# Global counter for request logs
request_log_counter = 0

# Global variable to store header lines
HEADER_LINES = []

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler with CORS support"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight OPTIONS requests"""
        self.send_response(200)
        self.end_headers()
    
    def guess_type(self, path):
        """Guess the type of a file based on its URL."""
        guessed_type = super().guess_type(path)
        if isinstance(guessed_type, tuple):
            mimetype, encoding = guessed_type
        else:
            mimetype = guessed_type
            encoding = None
        
        # Ensure proper MIME types for web files
        if path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.html'):
            return 'text/html'
        elif path.endswith('.json'):
            return 'application/json'
        
        return mimetype
    
    def log_message(self, format, *args):
        """Custom log format with periodic screen clear and header reprint"""
        global request_log_counter
        global HEADER_LINES

        request_log_counter += 1

        if request_log_counter % 20 == 0:
            os.system('cls' if os.name == 'nt' else 'clear')
            for line in HEADER_LINES:
                print(line)
            print("\n" + "-"*50 + "\n") # Add a separator

        print(f"[{self.log_date_time_string()}] {format % args}")

def is_port_in_use(port, host="127.0.0.1"):
    """Return True if a TCP connection to host:port succeeds (port is in use)"""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False

def main():
    # Get port from command line argument or use default
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}")
            print("Using default port 8000")
    
    # Abort if port already in use
    if is_port_in_use(port):
        print(f"Error: Port {port} is already in use. Another server appears to be running.", file=sys.stderr)
        sys.exit(1)
    
    # Change to the public directory to serve static files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, 'public')
    os.chdir(public_dir)
    
    # Store header lines globally
    global HEADER_LINES
    HEADER_LINES = [
        f"\n🎁 Wisher Development Server",
        f"📁 Serving files from: {script_dir}",
        f"🌐 Server running at: http://localhost:{port}",
        f"📱 Mobile access: http://{get_local_ip()}:{port}",
        f"\n🔧 Make sure to configure Firebase settings in firebase-config.js",
        f"⚡ Press Ctrl+C to stop the server\n"
    ]

    # Print initial header
    for line in HEADER_LINES:
        try:
            print(line)
        except UnicodeEncodeError:
            # Fallback for systems that don't support Unicode
            print(line.encode('ascii', 'ignore').decode('ascii'))
    print("\n" + "-"*50 + "\n") # Add a separator
    
    # Create server
    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Thanks for using Wisher!")
        except Exception as e:
            print(f"\n\n❌ Server crashed unexpectedly: {e}")
            import traceback
            traceback.print_exc()
        finally:
            httpd.server_close()
            print("Server closed.")

def get_local_ip():
    """Get the local IP address for mobile testing"""
    import socket
    try:
        # Connect to a remote address to determine local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "localhost"

if __name__ == "__main__":
    main()